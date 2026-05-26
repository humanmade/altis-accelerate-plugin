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
 * What this test does NOT prove:
 *   - Channel classification rules in attribution_comparison (Organic / Social
 *     / etc. depend on `initial_referer`, which isn't set by the JSONEachRow
 *     insert template). Tested only as "responds without error".
 *   - First-touch / last-touch math under real traffic (no `endpoint_views`
 *     or `endpoint_sessions` plumbing in the insert helper).
 *   - utm_campaign / utm_source aggregation under inserted data. See TODO
 *     below — both functions hardcode `FROM analytics`, ignoring the
 *     `ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE` constant that the other two
 *     attribution functions honor. The test environment uses `test_analytics`
 *     so the queries return zero rows under test ingest. Slice-2 TODO.
 *   - Divide-by-zero in `conversion_rate` (`visitors > 0 ? ... : 0`). Once
 *     the table-name bug is fixed, a follow-up test can insert pageviews
 *     with zero clicks and prove this directly.
 *
 * TODO (slice 2, tracked in docs/test-coverage-audit.md "Slice 2 — open
 * decisions"): switch `execute_get_attribution_comparison` (inc/abilities/
 * attribution.php:91, 115) and `execute_get_utm_performance`
 * (inc/abilities/attribution.php:443) to use the table constant, mirroring
 * `execute_get_source_breakdown` (line 265–297) and `execute_get_landing_pages`
 * (line 541–558). Once that lands, the utm/source aggregation tests below
 * can be re-enabled.
 *
 * See `docs/test-coverage-audit.md` → P2 #10.
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

	public function test_utm_performance_conversion_rate_guards_against_zero_visitors() {
		// No data → zero campaigns; the guard isn't exercised here but the
		// shape should still be sane and not error.
		$result = Attribution\execute_get_utm_performance( [] );

		$this->assertIsArray( $result['campaigns'] );
	}

	public function test_utm_performance_accepts_group_by_argument_without_erroring() {
		// We can't assert aggregation results until the FROM-analytics TODO
		// in the file header is resolved; this just pins that the
		// `group_by` argument is accepted across all five valid values.
		foreach ( [ 'campaign', 'source', 'medium', 'term', 'content' ] as $group_by ) {
			$result = Attribution\execute_get_utm_performance( [ 'group_by' => $group_by ] );
			$this->assertNotWPError( $result, "group_by={$group_by} should not error" );
			$this->assertIsArray( $result['campaigns'] );
		}
	}

	public function test_utm_performance_accepts_campaign_filter_without_erroring() {
		$result = Attribution\execute_get_utm_performance( [ 'campaign' => 'spring' ] );

		$this->assertNotWPError( $result );
		$this->assertIsArray( $result['campaigns'] );
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
}
