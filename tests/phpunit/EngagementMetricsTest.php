<?php

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Engagement;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

// The abilities domain files are only auto-loaded when the WP 6.9+ Abilities
// API is present (see inc/namespace.php). Tests call the execute callbacks
// directly, so make sure their files are loaded regardless of WP version.
require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/engagement.php';

class EngagementMetricsTest extends WP_UnitTestCase {

	/**
	 * @var int
	 */
	protected $post_a;

	/**
	 * @var int
	 */
	protected $post_b;

	public function set_up() {
		parent::set_up();

		$this->post_a = self::factory()->post->create( [ 'post_title' => 'Post A' ] );
		$this->post_b = self::factory()->post->create( [ 'post_title' => 'Post B' ] );

		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
	}

	public function test_returns_wp_error_when_entity_id_missing() {
		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'post' ] );

		$this->assertWPError( $result );
		$this->assertEquals( 'missing_entity_id', $result->get_error_code() );
	}

	public function test_zero_state_when_no_events() {
		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertIsArray( $result );
		$this->assertEquals( 0, $result['avg_time_on_page_seconds'] );
		$this->assertEquals( [ 'p25' => 0, 'p50' => 0, 'p75' => 0, 'p100' => 0 ], $result['scroll_depth'] );
		$this->assertEquals( 0, $result['recirculation_rate'] );
		$this->assertSame( [], $result['exit_pages'] );
	}

	public function test_scroll_depth_is_derived_from_pageview_metrics() {
		$session = wp_generate_uuid4();
		$this->insert_pageview( $session, $this->post_a, [ 'scrollDepthMax' => 80, 'elapsed' => 30000 ] );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertEquals( 100, $result['scroll_depth']['p25'] );
		$this->assertEquals( 100, $result['scroll_depth']['p50'] );
		$this->assertEquals( 100, $result['scroll_depth']['p75'] );
		$this->assertEquals( 0, $result['scroll_depth']['p100'] );
	}

	public function test_time_on_page_uses_max_elapsed_per_page() {
		$now = time();
		$session = wp_generate_uuid4();
		// Two pageviews on Post A within the same session — second has higher elapsed.
		// Timestamps are in the past so both fall inside the default date range.
		$this->insert_pageview( $session, $this->post_a, [ 'elapsed' => 5000 ], $now - 60 );
		$this->insert_pageview( $session, $this->post_a, [ 'elapsed' => 45000 ], $now - 10 );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertEquals( 45.0, $result['avg_time_on_page_seconds'] );
	}

	public function test_exit_pages_uses_last_pageview_in_session() {
		$now = time();
		$session = wp_generate_uuid4();
		// User reads Post A then ends the session on Post B.
		$this->insert_pageview( $session, $this->post_a, [], $now - 60 );
		$this->insert_pageview( $session, $this->post_b, [], $now - 10 );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertCount( 1, $result['exit_pages'] );
		$this->assertEquals( $this->post_b, $result['exit_pages'][0]['post_id'] );
		$this->assertEquals( 1, $result['exit_pages'][0]['exit_count'] );
	}

	public function test_recirculation_for_post_scope_counts_other_pages_in_session() {
		$now = time();
		// Session 1: visited A then B — should count as recirculated for entity=A.
		$session_1 = wp_generate_uuid4();
		$this->insert_pageview( $session_1, $this->post_a, [], $now - 60 );
		$this->insert_pageview( $session_1, $this->post_b, [], $now - 10 );

		// Session 2: only visited A — single-page session, no recirculation.
		$session_2 = wp_generate_uuid4();
		$this->insert_pageview( $session_2, $this->post_a, [], $now - 60 );

		$result = Engagement\execute_get_engagement_metrics( [
			'entity_type' => 'post',
			'entity_id'   => $this->post_a,
		] );

		$this->assertEquals( 50.0, $result['recirculation_rate'] );
		$this->assertEquals( 1.5, $result['pages_per_session'] );
	}

	public function test_exit_pages_only_returned_for_site_scope() {
		$session = wp_generate_uuid4();
		$this->insert_pageview( $session, $this->post_a );

		$result = Engagement\execute_get_engagement_metrics( [
			'entity_type' => 'post',
			'entity_id'   => $this->post_a,
		] );

		$this->assertSame( [], $result['exit_pages'] );
	}

	/**
	 * Insert a pageView event into the test analytics table.
	 */
	protected function insert_pageview( string $session_id, int $post_id, array $metrics = [], ?int $timestamp = null ) : void {
		$timestamp = $timestamp ?: time();

		$attributes = [
			'postId'      => (string) $post_id,
			'session'     => $session_id,
			'pageSession' => wp_generate_uuid4(),
			'blogId'      => '1',
		];

		// metrics column is Map(String, Float64) — pass numeric values so
		// JSONEachRow ingest targets the Float64 value type correctly.
		$metrics = array_map( 'floatval', $metrics );

		$event = [
			'app_id'              => '123',
			'event_type'          => 'pageView',
			'event_timestamp'     => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'attributes'          => (object) $attributes,
			'metrics'             => (object) $metrics,
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

	// =====================================================================
	// Slice 3 — contract tests for engagement aggregation edge cases.
	//
	// What these DO prove:
	//   - Zero-visitor input returns a clean zero result (no divide-by-zero).
	//   - Exit-page detection uses argMax across pageview events.
	//   - Recirculation reflects sessions that visited > 1 distinct post.
	//
	// What they do NOT prove:
	//   - bounce_rate magnitude — that's computed via `endpoint_views < 2`
	//     in `inc/api/namespace.php::get_graph_data`, which requires setting
	//     the `endpoint_views` column at ingest. The existing `insert_pageview`
	//     helper doesn't expose that; a future slice can broaden the helper.
	//   - argMax behaviour on EXACT timestamp ties (ClickHouse-undefined and
	//     hard to test deterministically through JSONEachRow ingest).
	//
	// See docs/test-coverage-audit.md → P1 #4.
	// =====================================================================

	public function test_zero_visitor_guard_returns_clean_zero_result() {
		// No events inserted. Expect a clean zero, no warnings, no NaN.
		// `assertEquals` instead of `assertSame` because the live result
		// type for recirculation_rate is the int `0`, while post-event
		// results return rounded floats. Type pin not in scope.
		//
		// NOTE: bounce_rate is deliberately NOT asserted here. It is sourced
		// from API\get_graph_data(), whose unfiltered site+daily path reads the
		// hardcoded `analytics_hourly` materialized view — NOT the per-test
		// `test_analytics` table that set_up() truncates. That view carries
		// seeded demo data, so bounce_rate is non-deterministic in the test
		// environment and cannot exercise the divide-by-zero guard. The fields
		// asserted below are all sourced from the truncatable test table and
		// therefore prove the zero-state guard deterministically.
		$result = Engagement\execute_get_engagement_metrics( [
			'entity_type' => 'site',
		] );

		$this->assertIsArray( $result );
		$this->assertEquals( 0, $result['recirculation_rate'] );
		$this->assertEquals( 0, $result['avg_time_on_page_seconds'] );
		$this->assertEquals( [ 'p25' => 0, 'p50' => 0, 'p75' => 0, 'p100' => 0 ], $result['scroll_depth'] );
		$this->assertSame( [], $result['exit_pages'] );
	}

	public function test_recirculation_reflects_sessions_with_multiple_distinct_posts() {
		$base = time() - HOUR_IN_SECONDS;

		// Session 1: visits two distinct posts → counts as recirculated.
		$session_1 = wp_generate_uuid4();
		$this->insert_pageview( $session_1, $this->post_a, [], $base );
		$this->insert_pageview( $session_1, $this->post_b, [], $base + 30 );

		// Session 2: stays on one post → not recirculated.
		$session_2 = wp_generate_uuid4();
		$this->insert_pageview( $session_2, $this->post_a, [], $base );

		$result = Engagement\execute_get_engagement_metrics( [
			'entity_type' => 'site',
		] );

		// 1 of 2 sessions recirculated → 50%.
		$this->assertEquals( 50.0, $result['recirculation_rate'] );
	}

	public function test_exit_page_is_the_last_pageview_in_a_session() {
		$base = time() - HOUR_IN_SECONDS;
		$session = wp_generate_uuid4();
		// Session walks A → B → A. Exit should be post_a (latest event).
		$this->insert_pageview( $session, $this->post_a, [ 'elapsed' => 5000 ], $base );
		$this->insert_pageview( $session, $this->post_b, [ 'elapsed' => 5000 ], $base + 10 );
		$this->insert_pageview( $session, $this->post_a, [ 'elapsed' => 5000 ], $base + 20 );

		$result = Engagement\execute_get_engagement_metrics( [
			'entity_type' => 'site',
		] );

		$this->assertNotEmpty( $result['exit_pages'] );
		$this->assertEquals( (string) $this->post_a, (string) $result['exit_pages'][0]['post_id'] );
	}
}
