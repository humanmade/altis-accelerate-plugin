<?php

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Engagement;
use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/engagement.php';

/**
 * Engaged time — raw-analytics aggregation.
 *
 * The client flushes engaged time as an additive delta on each _session.stop
 * event (metrics['engaged'], milliseconds accrued since the previous flush).
 * Deltas are additive facts, so the server plain-sums stop rows — the same
 * correctness model as count() over pageView rows. A visit that hides the tab
 * twice contributes two deltas that sum to the visit total; engaged reads are
 * the distinct page sessions those deltas belong to. The query lives in
 * API\get_graph_data() (under stats.summary.engaged), reusing the same
 * path/include/audience filters as every other metric; the engagement ability
 * is a mapping layer over that result. These tests verify the summation is
 * correct, multi-flush visits don't double-count reads, non-stop rows are
 * ignored, scoping by post works, engaged_first_seen derives from engaged
 * rows, and avg_time_on_page (elapsed) stays independent.
 */
class EngagedTimeAggTest extends WP_UnitTestCase {

	protected int $post_a;
	protected int $post_b;

	public function set_up() {
		parent::set_up();

		$this->post_a = self::factory()->post->create( [ 'post_title' => 'Post A' ] );
		$this->post_b = self::factory()->post->create( [ 'post_title' => 'Post B' ] );

		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
		Utils\query( 'TRUNCATE TABLE analytics_hourly' );
	}

	// -------------------------------------------------------------------------
	// Ability output — engaged time present
	// -------------------------------------------------------------------------

	public function test_returns_engaged_fields_from_stop_deltas() {
		$session = wp_generate_uuid4();
		$page    = wp_generate_uuid4();

		// The pageView carries no engaged data; the stop event flushes the delta.
		$this->insert_event( 'pageView', $session, $this->post_a, null, null, null, $page );
		$this->insert_event( '_session.stop', $session, $this->post_a, 25_000, null, null, $page );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertIsArray( $result );
		$this->assertArrayNotHasKey( 'engaged_seconds_per_session_p50', $result );
		$this->assertEqualsWithDelta( 25.0, $result['engaged_seconds_total'], 0.1 );
		$this->assertEqualsWithDelta( 25.0, $result['engaged_seconds_avg'], 0.1 );
		$this->assertSame( 1, (int) $result['engaged_sessions'] );
		$this->assertSame( 1, (int) $result['engaged_pageviews'] );
		$this->assertNotNull( $result['engaged_first_seen'] );
	}

	public function test_sums_deltas_across_visits() {
		foreach ( [ 10_000, 20_000, 30_000 ] as $engaged_ms ) {
			$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, $engaged_ms );
		}

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertSame( 3, (int) $result['engaged_sessions'] );
		$this->assertSame( 3, (int) $result['engaged_pageviews'] );
		$this->assertEqualsWithDelta( 60.0, $result['engaged_seconds_total'], 0.1 );
		$this->assertEqualsWithDelta( 20.0, $result['engaged_seconds_avg'], 0.1 );
	}

	public function test_multiple_flushes_per_visit_sum_to_visit_total() {
		// One visitor tabs away twice on the same page: two stop events flush
		// 30 s then 50 s. Deltas must sum (80 s) and the visit must count as
		// ONE engaged read and ONE engaged session — not two.
		$session = wp_generate_uuid4();
		$page    = wp_generate_uuid4();
		$now     = time();

		$this->insert_event( '_session.stop', $session, $this->post_a, 30_000, null, $now - 120, $page );
		$this->insert_event( '_session.stop', $session, $this->post_a, 50_000, null, $now - 60, $page );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertEqualsWithDelta( 80.0, $result['engaged_seconds_total'], 0.1 );
		$this->assertSame( 1, (int) $result['engaged_pageviews'] );
		$this->assertSame( 1, (int) $result['engaged_sessions'] );
		$this->assertEqualsWithDelta( 80.0, $result['engaged_seconds_avg'], 0.1 );
	}

	public function test_engaged_on_non_stop_rows_is_ignored() {
		// Only _session.stop rows carry flushed deltas. An engaged value on any
		// other row (e.g. stale client, replayed data) must not count.
		$this->insert_event( 'pageView', wp_generate_uuid4(), $this->post_a, 99_000 );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertSame( 0.0, (float) $result['engaged_seconds_total'] );
		$this->assertSame( 0, (int) $result['engaged_pageviews'] );
	}

	public function test_post_scoped_query_filters_by_post_id() {
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 30_000 );
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_b, 60_000 );

		$result = Engagement\execute_get_engagement_metrics( [
			'entity_type' => 'post',
			'entity_id'   => $this->post_a,
		] );

		// Only post_a's 30 s should count.
		$this->assertSame( 1, (int) $result['engaged_sessions'] );
		$this->assertEqualsWithDelta( 30.0, $result['engaged_seconds_total'], 0.1 );
	}

	// -------------------------------------------------------------------------
	// Internal contract — API\get_graph_data() summary.engaged
	// -------------------------------------------------------------------------

	public function test_get_graph_data_exposes_engaged_summary() {
		$now = time();

		// Insert all fixtures before the first get_graph_data() call —
		// it caches per (query, params, filter).
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 10_000, null, $now - 60 );
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 20_000, null, $now - 60 );
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 30_000, null, $now - 60 );

		$data = API\get_graph_data( $now - 3_600, $now + 60, 'P1D' );

		$this->assertIsArray( $data );
		$this->assertArrayHasKey( 'engaged', $data['stats']['summary'] );

		$engaged = $data['stats']['summary']['engaged'];
		$this->assertArrayNotHasKey( 'p50_seconds', $engaged );
		$this->assertSame( 3, (int) $engaged['pageviews'] );
		$this->assertSame( 3, (int) $engaged['sessions'] );
		$this->assertEqualsWithDelta( 60.0, $engaged['total_seconds'], 0.1 );
		$this->assertEqualsWithDelta( 20.0, $engaged['avg_seconds'], 0.1 );
		$this->assertNotNull( $engaged['first_seen'] );
	}

	public function test_get_graph_data_engaged_scopes_by_include_filter() {
		$now = time();

		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 30_000, null, $now - 60 );
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_b, 60_000, null, $now - 60 );

		$filter = new API\Filter();
		$filter->include = [ $this->post_a ];

		$data = API\get_graph_data( $now - 3_600, $now + 60, 'P1D', $filter );

		$engaged = $data['stats']['summary']['engaged'];
		// Only post_a's 30 s should count once the include filter applies.
		$this->assertSame( 1, (int) $engaged['pageviews'] );
		$this->assertEqualsWithDelta( 30.0, $engaged['total_seconds'], 0.1 );
	}

	// -------------------------------------------------------------------------
	// No engaged data
	// -------------------------------------------------------------------------

	public function test_no_engaged_data_returns_zero_and_null_first_seen() {
		// A pageView with elapsed but no engaged metric.
		$this->insert_event( 'pageView', wp_generate_uuid4(), $this->post_a, null, 30_000 );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertSame( 0.0, (float) $result['engaged_seconds_total'] );
		$this->assertSame( 0, (int) $result['engaged_sessions'] );
		$this->assertNull( $result['engaged_first_seen'] );
	}

	public function test_avg_time_on_page_uses_elapsed_independently_of_engaged() {
		// elapsed only — time on page is derived from elapsed, not engaged.
		$this->insert_event( 'pageView', wp_generate_uuid4(), $this->post_a, null, 30_000 );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertEqualsWithDelta( 30.0, $result['avg_time_on_page_seconds'], 0.1 );
		$this->assertSame( 0.0, (float) $result['engaged_seconds_total'] );
	}

	// -------------------------------------------------------------------------
	// engaged_first_seen — partial-range signal
	// -------------------------------------------------------------------------

	public function test_engaged_first_seen_is_earliest_engaged_stop() {
		$now = time();

		// Same page session: an earlier pageView with NO engaged data (the page
		// loaded before any engagement), then a later _session.stop that flushes
		// a delta. first_seen must track the engaged stop, not the load.
		$session = wp_generate_uuid4();
		$page    = wp_generate_uuid4();
		$this->insert_event( 'pageView', $session, $this->post_a, null, 12_000, $now - 7_200, $page );
		$this->insert_event( '_session.stop', $session, $this->post_a, 18_000, null, $now - 3_600, $page );

		// A separate engaged visit, later still.
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 9_000, null, $now - 1_800 );

		$result = Engagement\execute_get_engagement_metrics( [ 'entity_type' => 'site' ] );

		$this->assertNotNull( $result['engaged_first_seen'] );
		$first_seen = strtotime( $result['engaged_first_seen'] );
		// Earliest stop carrying an engaged delta, not the earlier non-engaged
		// load. The unfiltered path serves first_seen from the hourly rollup,
		// so it is truncated to the start of the hour containing the stop.
		$this->assertGreaterThanOrEqual( $now - 3_600 - 3_599, $first_seen );
		$this->assertEqualsWithDelta( $now - 3_600, $first_seen, 3_600 );
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	/**
	 * Insert a single analytics event carrying engaged/elapsed metrics.
	 *
	 * @param string      $event_type   pageView or _session.stop.
	 * @param string      $session_id   Session UUID.
	 * @param int         $post_id      Post ID written to attributes['postId'].
	 * @param int|null    $engaged_ms   metrics['engaged'] in milliseconds (a flushed delta on stop rows), or null to omit.
	 * @param int|null    $elapsed_ms   metrics['elapsed'] in milliseconds, or null to omit.
	 * @param int|null    $timestamp    Event time (Unix seconds); defaults to now.
	 * @param string|null $page_session Page session UUID (the engaged-read identity); defaults to a fresh UUID.
	 */
	protected function insert_event(
		string $event_type,
		string $session_id,
		int $post_id,
		?int $engaged_ms = null,
		?int $elapsed_ms = null,
		?int $timestamp = null,
		?string $page_session = null
	) : void {
		$timestamp = $timestamp ?: time();
		$table     = ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE;

		$metrics = [];
		if ( $engaged_ms !== null ) {
			$metrics['engaged'] = (float) $engaged_ms;
		}
		if ( $elapsed_ms !== null ) {
			$metrics['elapsed'] = (float) $elapsed_ms;
		}

		$event = [
			'app_id'              => '123',
			'event_type'          => $event_type,
			'event_timestamp'     => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'attributes'          => (object) [
				'postId'      => (string) $post_id,
				'session'     => $session_id,
				'pageSession' => $page_session ?: wp_generate_uuid4(),
				'blogId'      => (string) get_current_blog_id(),
			],
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

		$result = Utils\query(
			'INSERT INTO ' . $table . ' FORMAT JSONEachRow',
			[],
			'array',
			json_encode( $event )
		);

		if ( is_wp_error( $result ) ) {
			$this->fail( 'insert_event failed: ' . $result->get_error_message() );
		}
	}
}
