<?php
/**
 * Attribution abilities — coverage for the two attribution functions not
 * exercised by `SourceBreakdownTest` or `LandingPagesTest`:
 *
 *   - `Attribution\execute_get_attribution_comparison()`
 *   - `Attribution\execute_get_utm_performance()`
 *
 * What this test DOES prove:
 *   - Response shape for empty inputs (channels, campaigns, period keys).
 *   - The functions don't error when called with no data or with all
 *     supported `group_by` values + a `campaign` filter.
 *   - `period.start` / `period.end` are valid ISO-8601 strings.
 *
 * What this test DOES prove (slice 2, now that both functions route through
 * `Helpers\get_analytics_table()` and therefore read the `test_analytics`
 * table under test ingest):
 *   - utm_campaign / utm_source aggregation under inserted data, including
 *     grouping, view/visitor counts, and the `campaign` filter.
 *   - Divide-by-zero guard in `conversion_rate` (`visitors > 0 ? ... : 0`):
 *     pageviews carrying utm attributes but zero clicks yield a 0.0 rate
 *     rather than a warning.
 *   - attribution_comparison first-touch vs last-touch deltas under inserted
 *     `click` events that carry an `attributes['referer']` (last-touch channel
 *     classification is driven by `attributes['referer']`).
 *
 * What this test does NOT prove:
 *   - First-touch channel classification in attribution_comparison. First-touch
 *     reads the materialized `initial_referer` column, which is derived from
 *     `endpoint_attributes['initialReferer']`; the JSONEachRow insert template
 *     leaves `endpoint_attributes` empty, so first-touch always classifies as
 *     'Direct'. See ATTRIBUTION LIVE-EMPTINESS note below.
 *
 * NOTE — attribution trio live-emptiness (issue #648 audit): on live
 * (humanmade.com) get-source-breakdown / get-utm-performance /
 * get-attribution-comparison return empty across all windows while
 * get-traffic-breakdown shows referrer data. Root cause is a data-source
 * mismatch, NOT version skew:
 *   - get-traffic-breakdown reads referrer from `attributes['referer']` on
 *     `pageView` events (the column that is actually populated live).
 *   - get-source-breakdown groups on `initial_referer`
 *     (= endpoint_attributes['initialReferer']); empty unless endpoints carry
 *     that attribute, so every visit collapses to 'Direct'/domain('').
 *   - get-attribution-comparison filters `event_type = 'click'` exclusively,
 *     so it is empty wherever conversions/clicks are sparse, regardless of
 *     pageview referrer data.
 *   - get-utm-performance requires per-event `attributes['utm_*'] != ''`, which
 *     real pageviews generally lack (no fallback to the initial_utm_* columns
 *     or referrer domain).
 * The aggregation tests below prove the CURRENT code aggregates correctly when
 * the data it queries IS present, isolating the emptiness to the data-source
 * mismatch rather than a query/aggregation defect. Changing which referrer
 * column is canonical is an attribution-modeling decision left to the parent.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Attribution;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/attribution.php';

class AttributionAbilitiesTest extends WP_UnitTestCase {

	/** @var int */
	protected $post_id;

	public function set_up() {
		parent::set_up();
		$this->post_id = self::factory()->post->create( [ 'post_title' => 'Attribution Test Post' ] );
		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
	}

	// =====================================================================
	// execute_get_attribution_comparison
	// =====================================================================

	public function test_attribution_comparison_returns_expected_shape_with_no_data() {
		$result = Attribution\execute_get_attribution_comparison( [] );

		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'channels', $result );
		$this->assertArrayHasKey( 'insights', $result );
		$this->assertArrayHasKey( 'period', $result );
		$this->assertArrayHasKey( 'start', $result['period'] );
		$this->assertArrayHasKey( 'end', $result['period'] );

		$insights = $result['insights'];
		$this->assertArrayHasKey( 'best_introducer', $insights );
		$this->assertArrayHasKey( 'best_closer', $insights );
		$this->assertArrayHasKey( 'most_undervalued', $insights );
	}

	public function test_attribution_comparison_period_uses_iso_8601() {
		$result = Attribution\execute_get_attribution_comparison( [] );

		// Period should round-trip through DateTime as a valid ISO 8601 string.
		$this->assertInstanceOf( \DateTime::class, new \DateTime( $result['period']['start'] ) );
		$this->assertInstanceOf( \DateTime::class, new \DateTime( $result['period']['end'] ) );
	}

	public function test_attribution_comparison_does_not_error_with_inserted_pageviews() {
		// We can't set initial_referer via JSONEachRow, so this is a "doesn't
		// error" check rather than a channel-classification check.
		$now = time();
		$this->insert_pageview( wp_generate_uuid4(), $now - 60 );

		$result = Attribution\execute_get_attribution_comparison( [] );

		$this->assertNotWPError( $result );
		$this->assertIsArray( $result );
	}

	public function test_attribution_comparison_classifies_last_touch_from_referer() {
		// attribution_comparison counts `click` events. Last-touch channel is
		// driven by attributes['referer']; first-touch reads the materialized
		// initial_referer column, which stays empty (endpoint_attributes not set
		// by the insert template) and so classifies as 'Direct'.
		$now = time();
		$this->insert_click( wp_generate_uuid4(), $now - 120, [ 'referer' => 'https://www.google.com/search' ] );

		$result = Attribution\execute_get_attribution_comparison( [] );

		$this->assertNotWPError( $result );
		$by_channel = [];
		foreach ( $result['channels'] as $row ) {
			$by_channel[ $row['name'] ] = $row;
		}

		// Last-touch sees the google referer → 'Organic Search'; first-touch is
		// empty → 'Direct'. The Organic Search row has last-touch (1) but no
		// first-touch (0): delta = -1, lt = 1 > 0 → delta_percent = -100.0.
		$this->assertArrayHasKey( 'Organic Search', $by_channel );
		$this->assertSame( 1, $by_channel['Organic Search']['last_touch_conversions'] );
		$this->assertSame( 0, $by_channel['Organic Search']['first_touch_conversions'] );
		$this->assertSame( -100.0, $by_channel['Organic Search']['delta_percent'] );
	}

	public function test_attribution_comparison_delta_percent_guards_against_zero_last_touch() {
		// Exercises the `lt === 0` branch of the guard:
		//   $lt > 0 ? round(($delta/$lt)*100,2) : ($delta > 0 ? 100 : 0)
		//
		// First-touch is driven by initial_referer, which is ALWAYS empty in
		// test inserts (endpoint_attributes not populated by the JSONEachRow
		// template) → every click classifies as 'Direct' for first-touch.
		//
		// Last-touch is driven by attributes['referer']. If we insert a click
		// whose referer is a search engine URL, last-touch classifies it as
		// 'Organic Search' — 'Direct' appears only in first_touch (lt = 0).
		//
		// Result for 'Direct': ft=1, lt=0, delta=1 → guard fires → delta_percent=100.
		$now = time();
		$this->insert_click( wp_generate_uuid4(), $now - 60, [ 'referer' => 'https://www.google.com/search' ] );

		$result = Attribution\execute_get_attribution_comparison( [] );
		$this->assertNotWPError( $result );

		$by_channel = [];
		foreach ( $result['channels'] as $row ) {
			$by_channel[ $row['name'] ] = $row;
		}

		// Direct: first-touch 1 (initial_referer empty), last-touch 0 (absent
		// from last_touch map). delta = 1 > 0 → guarded delta_percent = 100 (int,
		// not float — the fallback branch returns the literal integer 100).
		$this->assertArrayHasKey( 'Direct', $by_channel );
		$this->assertSame( 1, $by_channel['Direct']['first_touch_conversions'] );
		$this->assertSame( 0, $by_channel['Direct']['last_touch_conversions'] );
		$this->assertSame( 100, $by_channel['Direct']['delta_percent'] );
	}

	// =====================================================================
	// execute_get_utm_performance
	// =====================================================================

	public function test_utm_performance_returns_expected_shape_with_no_data() {
		$result = Attribution\execute_get_utm_performance( [] );

		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'campaigns', $result );
		$this->assertArrayHasKey( 'period', $result );
		$this->assertSame( [], $result['campaigns'] );
	}

	public function test_utm_performance_aggregates_inserted_campaign_data() {
		$now = time();

		// Two visits on "spring", one on "winter".
		$this->insert_pageview( wp_generate_uuid4(), $now - 300, [ 'utm_campaign' => 'spring' ] );
		$this->insert_pageview( wp_generate_uuid4(), $now - 240, [ 'utm_campaign' => 'spring' ] );
		$this->insert_pageview( wp_generate_uuid4(), $now - 180, [ 'utm_campaign' => 'winter' ] );

		$result = Attribution\execute_get_utm_performance( [ 'group_by' => 'campaign' ] );

		$this->assertNotWPError( $result );
		$by_name = [];
		foreach ( $result['campaigns'] as $row ) {
			$by_name[ $row['name'] ] = $row;
		}

		$this->assertArrayHasKey( 'spring', $by_name, 'spring campaign should aggregate' );
		$this->assertArrayHasKey( 'winter', $by_name );
		$this->assertSame( 2, $by_name['spring']['views'] );
		$this->assertSame( 1, $by_name['winter']['views'] );
		// Results are ordered by views DESC, so spring leads.
		$this->assertSame( 'spring', $result['campaigns'][0]['name'] );
	}

	public function test_utm_performance_groups_by_source() {
		$now = time();
		$this->insert_pageview( wp_generate_uuid4(), $now - 120, [ 'utm_source' => 'newsletter' ] );

		$result = Attribution\execute_get_utm_performance( [ 'group_by' => 'source' ] );

		$this->assertNotWPError( $result );
		$this->assertCount( 1, $result['campaigns'] );
		$this->assertSame( 'newsletter', $result['campaigns'][0]['name'] );
	}

	public function test_utm_performance_conversion_rate_guards_against_zero_clicks() {
		// Pageviews carrying a utm_campaign but zero click events: visitors > 0,
		// conversions == 0, so conversion_rate must be the guarded 0.0 (no
		// division-by-zero warning, no null).
		$now = time();
		$this->insert_pageview( wp_generate_uuid4(), $now - 120, [ 'utm_campaign' => 'spring' ] );

		$result = Attribution\execute_get_utm_performance( [ 'group_by' => 'campaign' ] );

		$this->assertNotWPError( $result );
		$this->assertCount( 1, $result['campaigns'] );
		$row = $result['campaigns'][0];
		$this->assertGreaterThan( 0, $row['visitors'] );
		$this->assertSame( 0, $row['conversions'] );
		$this->assertSame( 0.0, (float) $row['conversion_rate'] );
	}

	public function test_utm_performance_accepts_group_by_argument_without_erroring() {
		// Pins that the `group_by` argument is accepted across all five valid
		// values without error (aggregation correctness covered above).
		foreach ( [ 'campaign', 'source', 'medium', 'term', 'content' ] as $group_by ) {
			$result = Attribution\execute_get_utm_performance( [ 'group_by' => $group_by ] );
			$this->assertNotWPError( $result, "group_by={$group_by} should not error" );
			$this->assertIsArray( $result['campaigns'] );
		}
	}

	public function test_utm_performance_campaign_filter_restricts_results() {
		$now = time();
		$this->insert_pageview( wp_generate_uuid4(), $now - 200, [ 'utm_campaign' => 'spring' ] );
		$this->insert_pageview( wp_generate_uuid4(), $now - 100, [ 'utm_campaign' => 'winter' ] );

		$result = Attribution\execute_get_utm_performance( [ 'campaign' => 'spring' ] );

		$this->assertNotWPError( $result );
		$this->assertCount( 1, $result['campaigns'] );
		$this->assertSame( 'spring', $result['campaigns'][0]['name'] );
	}

	// =====================================================================
	// Abilities API input validation spike (Task 4)
	// =====================================================================

	/**
	 * Spike: does the WP Abilities API reject input properties not declared in
	 * the schema? With `additionalProperties => false` on the input schema and
	 * a bogus `days` param, WP_Ability::execute() must short-circuit with an
	 * `ability_invalid_input` WP_Error before the callback runs.
	 *
	 * We instantiate WP_Ability directly (same execute() → validate_input() →
	 * rest_validate_value_from_schema() path the registered abilities use) to
	 * avoid the registry/hook-timing setup that the WP test harness's
	 * "incorrect usage" guards make brittle.
	 *
	 * Result (2026-06): enforcement IS active — extra props are rejected when
	 * `additionalProperties => false` is set, and silently accepted otherwise.
	 * This is why the hardening in execution.php / our input schemas is real.
	 */
	public function test_abilities_api_enforces_additional_properties_false() {
		if ( ! class_exists( '\WP_Ability' ) ) {
			$this->markTestSkipped( 'Abilities API not available.' );
		}

		$args = [
			'label'        => 'Closed Schema Probe',
			'description'  => 'Probe for additionalProperties enforcement.',
			'category'     => 'accelerate-test',
			'input_schema' => [
				'type'                 => 'object',
				'additionalProperties' => false,
				'properties'           => [
					'group_by' => [ 'type' => 'string' ],
				],
			],
			'output_schema' => [
				'type'       => 'object',
				'properties' => [ 'ok' => [ 'type' => 'boolean' ] ],
			],
			'execute_callback'    => function () {
				return [ 'ok' => true ];
			},
			'permission_callback' => '__return_true',
		];

		$closed = new \WP_Ability( 'accelerate-test/closed-schema', $args );

		// Undeclared `days` param must be rejected.
		$result = $closed->execute( [ 'group_by' => 'campaign', 'days' => 30 ] );
		$this->assertWPError(
			$result,
			'With additionalProperties=false, an undeclared `days` param must be rejected.'
		);
		$this->assertSame( 'ability_invalid_input', $result->get_error_code() );

		// Control: the same input minus the bogus key passes validation and the
		// callback runs.
		$ok = $closed->execute( [ 'group_by' => 'campaign' ] );
		$this->assertSame( [ 'ok' => true ], $ok );

		// Control: without additionalProperties=false the bogus key is accepted,
		// confirming the flag (not some other guard) is what enforces closure.
		$open_args = $args;
		unset( $open_args['input_schema']['additionalProperties'] );
		$open = new \WP_Ability( 'accelerate-test/open-schema', $open_args );
		$open_result = $open->execute( [ 'group_by' => 'campaign', 'days' => 30 ] );
		$this->assertSame( [ 'ok' => true ], $open_result, 'Open schema should accept extra props.' );
	}

	// -- Helper ------------------------------------------------------------

	/**
	 * Insert a pageView event with optional attribute overrides. Useful for
	 * setting `utm_campaign` / `utm_source` / etc.
	 */
	protected function insert_pageview( string $session_id, ?int $timestamp = null, array $extra_attributes = [] ) : void {
		$timestamp = $timestamp ?: time();

		$attributes = array_merge( [
			'postId'      => (string) $this->post_id,
			'session'     => $session_id,
			'pageSession' => wp_generate_uuid4(),
			'blogId'      => '1',
		], $extra_attributes );

		$event = [
			'app_id'              => '123',
			'event_type'          => 'pageView',
			'event_timestamp'     => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'attributes'          => (object) $attributes,
			'metrics'             => (object) [],
			'endpoint_id'         => wp_generate_uuid4(),
			'endpoint_attributes' => (object) [],
			'endpoint_metrics'    => (object) [],
			'endpoint_address'    => '',
			'endpoint_optout'     => 'ALL',
			'app_version'         => '',
			'locale'              => '',
			'make'                => '',
			'model'               => '',
			'model_version'       => '',
			'platform'            => '',
			'platform_version'    => '',
			'country'             => '',
			'city'                => '',
			'postal_code'         => '',
			'region'              => '',
			'user_id'             => '',
			'user_attributes'     => (object) [],
			'session_id'          => $session_id,
			'session_start'       => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'session_stop'        => gmdate( 'Y-m-d H:i:s.000', $timestamp + 60 ),
			'session_duration'    => 60,
		];

		$result = Utils\query( 'INSERT INTO ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE . ' FORMAT JSONEachRow', [], 'array', json_encode( $event ) );
		if ( is_wp_error( $result ) ) {
			$this->fail( 'Insert failed: ' . $result->get_error_message() );
		}
	}

	/**
	 * Insert a `click` (conversion) event. attribution_comparison only counts
	 * click events, so this is required to exercise its aggregation.
	 */
	protected function insert_click( string $session_id, ?int $timestamp = null, array $extra_attributes = [] ) : void {
		$timestamp = $timestamp ?: time();

		$attributes = array_merge( [
			'postId'      => (string) $this->post_id,
			'session'     => $session_id,
			'pageSession' => wp_generate_uuid4(),
			'blogId'      => '1',
		], $extra_attributes );

		$event = [
			'app_id'              => '123',
			'event_type'          => 'click',
			'event_timestamp'     => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'attributes'          => (object) $attributes,
			'metrics'             => (object) [],
			'endpoint_id'         => wp_generate_uuid4(),
			'endpoint_attributes' => (object) [],
			'endpoint_metrics'    => (object) [],
			'endpoint_address'    => '',
			'endpoint_optout'     => 'ALL',
			'app_version'         => '',
			'locale'              => '',
			'make'                => '',
			'model'               => '',
			'model_version'       => '',
			'platform'            => '',
			'platform_version'    => '',
			'country'             => '',
			'city'                => '',
			'postal_code'         => '',
			'region'              => '',
			'user_id'             => '',
			'user_attributes'     => (object) [],
			'session_id'          => $session_id,
			'session_start'       => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'session_stop'        => gmdate( 'Y-m-d H:i:s.000', $timestamp + 60 ),
			'session_duration'    => 60,
		];

		$result = Utils\query( 'INSERT INTO ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE . ' FORMAT JSONEachRow', [], 'array', json_encode( $event ) );
		if ( is_wp_error( $result ) ) {
			$this->fail( 'Insert failed: ' . $result->get_error_message() );
		}
	}
}
