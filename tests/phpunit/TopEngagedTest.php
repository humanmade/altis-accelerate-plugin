<?php

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_REST_Request;
use WP_UnitTestCase;

/**
 * Top engaged-time list endpoint — /accelerate/v1/top-engaged.
 *
 * The dashboard "Engaged time" tile ranks posts/pages by AVERAGE engaged time
 * per visit (total engaged seconds ÷ distinct page sessions) — the same
 * definition as the "Avg. engaged time" KPI tile. Engaged deltas land on
 * _session.stop rows (column `engaged`, milliseconds) which carry post_id, so
 * grouping by post_id ranks content by engagement. These tests verify the
 * ranking/averaging, that non-stop rows are ignored, that the post_type filter
 * drops untracked types, and that the list caps at the top 10.
 */
class TopEngagedTest extends WP_UnitTestCase {

	protected int $post_a;
	protected int $post_b;

	public function set_up() {
		parent::set_up();

		$this->post_a = self::factory()->post->create( [ 'post_title' => 'Post A' ] );
		$this->post_b = self::factory()->post->create( [ 'post_title' => 'Post B' ] );

		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_HOURLY_TABLE );
	}

	/**
	 * Invoke the endpoint handler for the active period.
	 *
	 * @param string|null $type Post-type filter (comma-separated), or null.
	 * @return array Response data (list of engaged items).
	 */
	protected function get_top_engaged( ?string $type = null ) : array {
		$now = time();

		$request = new WP_REST_Request( 'GET', '/accelerate/v1/top-engaged' );
		$request->set_param( 'start', gmdate( 'c', $now - 3_600 ) );
		$request->set_param( 'end', gmdate( 'c', $now + 60 ) );
		$request->set_param( 'interval', 'P1D' );
		if ( $type !== null ) {
			$request->set_param( 'type', $type );
		}

		return API\get_top_engaged( $request )->get_data();
	}

	public function test_ranks_posts_by_engaged_time_descending() {
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 30_000 );
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_b, 90_000 );

		$items = $this->get_top_engaged();

		$this->assertCount( 2, $items );
		// post_b (90 s) ranks above post_a (30 s).
		$this->assertSame( $this->post_b, $items[0]['id'] );
		$this->assertEqualsWithDelta( 90.0, $items[0]['engaged_seconds'], 0.1 );
		$this->assertSame( $this->post_a, $items[1]['id'] );
		$this->assertEqualsWithDelta( 30.0, $items[1]['engaged_seconds'], 0.1 );
		$this->assertSame( 'Post B', $items[0]['title'] );
	}

	public function test_averages_engaged_time_per_visit() {
		// Three separate visits (distinct page sessions) totalling 60 s of
		// engaged time → average per visit is 20 s, not the 60 s sum.
		foreach ( [ 10_000, 20_000, 30_000 ] as $engaged_ms ) {
			$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, $engaged_ms );
		}

		$items = $this->get_top_engaged();

		$this->assertCount( 1, $items );
		$this->assertSame( $this->post_a, $items[0]['id'] );
		$this->assertEqualsWithDelta( 20.0, $items[0]['engaged_seconds'], 0.1 );
	}

	public function test_engaged_on_non_stop_rows_is_ignored() {
		$this->insert_event( 'pageView', wp_generate_uuid4(), $this->post_a, 99_000 );

		$items = $this->get_top_engaged();

		$this->assertSame( [], $items );
	}

	public function test_post_type_filter_excludes_untracked_types() {
		$this->insert_event( '_session.stop', wp_generate_uuid4(), $this->post_a, 30_000 );

		// Restricting to 'page' drops the 'post'-typed fixture entirely.
		$items = $this->get_top_engaged( 'page' );

		$this->assertSame( [], $items );

		// Restricting to 'post' keeps it.
		$items = $this->get_top_engaged( 'post' );
		$this->assertCount( 1, $items );
		$this->assertSame( $this->post_a, $items[0]['id'] );
	}

	public function test_caps_list_at_ten() {
		$ids = [];
		for ( $i = 0; $i < 12; $i++ ) {
			$id = self::factory()->post->create( [ 'post_title' => 'Post ' . $i ] );
			$ids[] = $id;
			// Decreasing engaged time so the rank order is deterministic.
			$this->insert_event( '_session.stop', wp_generate_uuid4(), $id, ( 12 - $i ) * 10_000 );
		}

		$items = $this->get_top_engaged();

		$this->assertCount( 10, $items );
		// The two lowest-engagement posts fall outside the top 10.
		$this->assertSame( $ids[0], $items[0]['id'] );
	}

	/**
	 * Insert a single analytics event carrying an engaged delta.
	 *
	 * @param string   $event_type pageView or _session.stop.
	 * @param string   $session_id Session UUID.
	 * @param int      $post_id    Post ID written to attributes['postId'].
	 * @param int|null $engaged_ms metrics['engaged'] in milliseconds, or null.
	 * @param int|null $timestamp  Event time (Unix seconds); defaults to now.
	 */
	protected function insert_event(
		string $event_type,
		string $session_id,
		int $post_id,
		?int $engaged_ms = null,
		?int $timestamp = null
	) : void {
		$timestamp = $timestamp ?: time();
		$table     = ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE;

		$metrics = [];
		if ( $engaged_ms !== null ) {
			$metrics['engaged'] = (float) $engaged_ms;
		}

		$event = [
			'app_id'              => '123',
			'event_type'          => $event_type,
			'event_timestamp'     => gmdate( 'Y-m-d H:i:s.000', $timestamp ),
			'attributes'          => (object) [
				'postId'      => (string) $post_id,
				'session'     => $session_id,
				'pageSession' => wp_generate_uuid4(),
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
