<?php
/**
 * Regression tests for the discovery/engagement ability hardening pass.
 *
 * Covers:
 *   - Fix 2: get-performance-summary survives a custom 32-day ISO window
 *            (no ClickHouse error 475, no interleaved phantom zero-rows).
 *   - Fix 3: get-taxonomy-performance serialises its include-array param
 *            correctly for ClickHouse (no "Array does not start with '['").
 *   - Fix 4: get-engagement-metrics accepts post_id as an alias for entity_id.
 *   - Fix 5: additionalProperties:false is enforced through the Abilities API
 *            validation path (wp_get_ability(...)->validate_input()).
 *   - Fix 6: additionalProperties:false is also present on execution-domain
 *            (mutation) abilities — validated via set-block-goal.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Discovery;
use Altis\Accelerate\Abilities\Engagement;
use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/discovery.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/engagement.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';

class AbilitiesHardeningTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();
		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
		wp_cache_flush();
	}

	// -------------------------------------------------------------------------
	// Fix 2: custom 32-day window must not error and must not interleave
	// phantom zero-rows offset from the real rows.
	// -------------------------------------------------------------------------

	public function test_performance_summary_handles_custom_32_day_window() {
		// The summary's daily/weekly path reads the isolated hourly rollup.
		$exists = Utils\query(
			'SELECT count() AS c FROM system.tables WHERE database = currentDatabase() AND name = {table:String}',
			[ 'table' => ACCELERATE_ANALYTICS_CLICKHOUSE_HOURLY_TABLE ]
		);
		if ( is_wp_error( $exists ) || empty( $exists[0]->c ) ) {
			$this->markTestSkipped( 'Test analytics hourly table not provisioned in this environment.' );
		}

		$result = Discovery\execute_get_performance_summary( [
			'date_range' => [
				'start' => '2026-05-10T00:00:00Z',
				'end'   => '2026-06-11T00:00:00Z',
			],
		] );

		$this->assertNotWPError(
			$result,
			'A 32-day custom ISO window must not raise a ClickHouse error (regression for err 475 ' .
			'"Incompatible types of WITH FILL expression values").'
		);
		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'time_series', $result );

		// Auto-granularity for a 32-day span resolves to weekly (P7D): the
		// WITH FILL range should yield a small, sane number of buckets — not
		// hundreds, and never an interleaved real/zero-row doubling.
		$rows = $result['time_series'];
		$this->assertLessThanOrEqual(
			10,
			count( $rows ),
			'A 32-day weekly window should produce ~5 buckets; a much larger count signals ' .
			'interleaved phantom WITH FILL rows.'
		);

		// No two adjacent buckets may share the same date (the phantom-row
		// artifact emitted duplicate timestamps offset by a sub-day step).
		$dates = array_column( $rows, 'date' );
		$this->assertSame(
			array_values( array_unique( $dates ) ),
			array_values( $dates ),
			'Time-series dates must be unique — interleaved phantom zero-rows would duplicate them.'
		);
	}

	// -------------------------------------------------------------------------
	// Fix 3: taxonomy performance passes an include-array into get_top_data,
	// which JSON-encodes it for the ClickHouse Array(String) param. This must
	// not produce err 130 "Array does not start with '[' character".
	// -------------------------------------------------------------------------

	public function test_taxonomy_performance_serialises_include_array() {
		$cat = self::factory()->category->create( [ 'name' => 'Hardening' ] );
		$post_id = self::factory()->post->create( [ 'post_title' => 'Tagged' ] );
		wp_set_object_terms( $post_id, [ $cat ], 'category' );

		// Seed one pageView so the term is non-empty and the include path runs.
		$this->insert_pageview( $post_id );

		$result = Discovery\execute_get_taxonomy_performance( [
			'taxonomy' => 'category',
		] );

		$this->assertNotWPError(
			$result,
			'Taxonomy performance must serialise its include-array param correctly for ClickHouse ' .
			'(regression for err 130 "Array does not start with [\'[\'").'
		);
		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'terms', $result );
	}

	// -------------------------------------------------------------------------
	// Fix 4: post_id is accepted as an alias for entity_id.
	// -------------------------------------------------------------------------

	public function test_engagement_metrics_accepts_post_id_alias() {
		$post_id = self::factory()->post->create();

		// With the alias present, the "missing entity_id" guard must NOT fire.
		$result = Engagement\execute_get_engagement_metrics( [
			'entity_type' => 'post',
			'post_id'     => $post_id,
		] );

		$this->assertNotWPError(
			$result,
			'post_id must be accepted as an alias for entity_id.'
		);
		$this->assertIsArray( $result );
	}

	public function test_engagement_metrics_missing_id_names_both_keys() {
		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'post' ] );

		$this->assertWPError( $result );
		$this->assertStringContainsString(
			'post_id',
			$result->get_error_message(),
			'The error message must name the post_id alias alongside entity_id.'
		);
	}

	// -------------------------------------------------------------------------
	// Visitors fix: get-post-performance must surface unique visitors, not 0.
	// get_top_data() previously emitted only `views` and never carried the
	// `unique_views` ClickHouse column through to the row, so `visitors` was
	// hardcoded-zero for every consumer. Insert N distinct endpoint_ids for one
	// post and assert visitors == N.
	// -------------------------------------------------------------------------

	public function test_post_performance_reports_unique_visitors() {
		$post_id = self::factory()->post->create( [ 'post_title' => 'Visited' ] );

		// Three distinct visitors (distinct endpoint_ids) view the same post.
		$this->insert_pageview( $post_id );
		$this->insert_pageview( $post_id );
		$this->insert_pageview( $post_id );

		$result = Discovery\execute_get_post_performance( [
			'post_id' => $post_id,
		] );

		$this->assertNotWPError( $result );
		$this->assertIsArray( $result );
		$this->assertSame(
			3,
			$result['metrics']['visitors'],
			'get-post-performance must report 3 unique visitors (one per distinct endpoint_id), not 0.'
		);
		$this->assertSame( 3, $result['metrics']['views'], 'Sanity: three pageViews → three views.' );
	}

	// -------------------------------------------------------------------------
	// Fix 5: additionalProperties:false is enforced through the real Abilities
	// API validation path (the same one the MCP adapter uses).
	// -------------------------------------------------------------------------

	public function test_additional_properties_rejected_by_validation() {
		if ( ! function_exists( 'wp_get_ability' ) ) {
			$this->markTestSkipped( 'Abilities API not present in this WP version.' );
		}

		// wp_register_ability() may only be called inside the
		// wp_abilities_api_init action, which the registry fires lazily on its
		// first get_instance(). The plugin's own all-abilities callback needs
		// every domain file loaded, but these tests only require discovery and
		// execution; detach the plugin's full bootstrap and register those two
		// domains ourselves on that hook.
		remove_action( 'wp_abilities_api_init', 'Altis\\Accelerate\\Abilities\\register_all_abilities' );
		remove_action( 'wp_abilities_api_categories_init', 'Altis\\Accelerate\\Abilities\\register_categories' );
		add_action( 'wp_abilities_api_categories_init', 'Altis\\Accelerate\\Abilities\\register_categories' );
		add_action( 'wp_abilities_api_init', 'Altis\\Accelerate\\Abilities\\Discovery\\register_abilities' );
		// Also register execution here so subsequent tests in the same process
		// can look up mutation abilities (the singleton persists across tests).
		add_action( 'wp_abilities_api_init', 'Altis\\Accelerate\\Abilities\\Execution\\register_abilities' );

		// First lookup triggers the registry init action above.
		$ability = wp_get_ability( 'accelerate/get-traffic-breakdown' );
		$this->assertNotNull( $ability, 'Ability must be registered.' );

		$valid = $ability->validate_input( [ 'dimension' => 'country' ] );
		$this->assertNotWPError( $valid, 'A known param must validate.' );

		$invalid = $ability->validate_input( [ 'days' => 30 ] );
		$this->assertWPError(
			$invalid,
			'An unknown param ("days") must be rejected by additionalProperties:false.'
		);
	}

	// -------------------------------------------------------------------------
	// Fix 6: additionalProperties:false on execution-domain (mutation) abilities.
	// Validates via set-block-goal only — NO execution, only validate_input().
	//
	// The WP_Abilities_Registry singleton persists across tests in the same
	// process. test_additional_properties_rejected_by_validation (above)
	// registers the execution domain on the same init hook, so set-block-goal
	// is available here without re-triggering the hook.
	// -------------------------------------------------------------------------

	public function test_mutation_ability_rejects_unknown_param() {
		if ( ! function_exists( 'wp_get_ability' ) ) {
			$this->markTestSkipped( 'Abilities API not present in this WP version.' );
		}

		$ability = wp_get_ability( 'accelerate/set-block-goal' );
		$this->assertNotNull( $ability, 'set-block-goal ability must be registered.' );

		$valid = $ability->validate_input( [ 'block_id' => 1, 'goal' => 'engagement' ] );
		$this->assertNotWPError( $valid, 'Known params must validate for set-block-goal.' );

		$invalid = $ability->validate_input( [ 'block_id' => 1, 'goal' => 'engagement', 'unknown_param' => 'oops' ] );
		$this->assertWPError(
			$invalid,
			'An unknown param must be rejected by additionalProperties:false on set-block-goal.'
		);
	}

	/**
	 * Insert a minimal pageView event into the test analytics table.
	 */
	protected function insert_pageview( int $post_id, ?int $timestamp = null ) : void {
		$timestamp = $timestamp ?: time();
		$session_id = wp_generate_uuid4();

		$event = [
			'app_id'              => '123',
			'event_type'          => 'pageView',
			'event_timestamp'     => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'item_id'             => (string) $post_id,
			'attributes'          => (object) [
				'postId'      => (string) $post_id,
				'session'     => $session_id,
				'pageSession' => wp_generate_uuid4(),
				'blogId'      => '1',
				'referer'     => 'https://example.com/',
			],
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
			'country'             => 'GB',
			'city'                => '',
			'postal_code'         => '',
			'region'              => '',
			'user_id'             => '',
			'user_attributes'     => (object) [],
			'referer'             => 'https://example.com/',
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
