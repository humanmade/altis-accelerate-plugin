<?php

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

/**
 * Per-interval referer composition segments (stats/segments — #697 phase 4).
 *
 * Verifies top-N host selection, Other collapse at 4+ hosts, stable Direct
 * mapping for empty referers, and that by_interval keys are site-local bucket
 * labels that line up with get_graph_data().
 */
class IntervalSegmentsTest extends WP_UnitTestCase {

	protected int $post_id;

	public function set_up() {
		parent::set_up();

		$this->post_id = self::factory()->post->create( [ 'post_title' => 'Segments Test Post' ] );

		// Segments read the raw test table only — never touch analytics_hourly
		// (the shared unfiltered-dashboard rollup used by local /stats graphs).
		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
	}

	public function test_empty_window_returns_empty_keys() {
		$now = time();
		$result = API\get_interval_segments( $now - 3_600, $now + 60, 'P1D' );

		$this->assertIsArray( $result );
		$this->assertSame( 'referer', $result['dimension'] );
		$this->assertSame( [], $result['keys'] );
		$this->assertSame( [], $result['by_interval'] );
	}

	public function test_direct_and_hosts_compose_per_interval() {
		$now = time();
		// Three distinct hosts → show all three, no Other.
		$this->insert_pageview( '', $now - 120 );
		$this->insert_pageview( '', $now - 100 );
		$this->insert_pageview( 'https://google.com/search', $now - 90 );
		$this->insert_pageview( 'https://twitter.com/status/1', $now - 80 );

		$result = API\get_interval_segments( $now - 3_600, $now + 60, 'P1D' );

		$this->assertIsArray( $result );
		$this->assertNotEmpty( $result['keys'] );
		$this->assertContains( API\DIRECT_SEGMENT_KEY, $result['keys'] );
		$this->assertContains( 'google.com', $result['keys'] );
		$this->assertContains( 'twitter.com', $result['keys'] );
		$this->assertNotContains( API\OTHER_SEGMENT_KEY, $result['keys'] );
		$this->assertLessThanOrEqual( 3, count( $result['keys'] ) );

		$total = 0;
		foreach ( $result['by_interval'] as $bucket ) {
			$total += array_sum( $bucket );
		}
		$this->assertSame( 4, $total );
	}

	public function test_four_hosts_collapse_to_top_two_plus_other() {
		$now = time();
		// a.com ×3, b.com ×2, c.com ×1, d.com ×1 → top 2 + Other.
		foreach ( [ 1, 2, 3 ] as $_ ) {
			$this->insert_pageview( 'https://a.example/x', $now - 200 );
		}
		foreach ( [ 1, 2 ] as $_ ) {
			$this->insert_pageview( 'https://b.example/x', $now - 180 );
		}
		$this->insert_pageview( 'https://c.example/x', $now - 160 );
		$this->insert_pageview( 'https://d.example/x', $now - 140 );

		$result = API\get_interval_segments( $now - 3_600, $now + 60, 'P1D' );

		$this->assertIsArray( $result );
		$this->assertCount( 3, $result['keys'] );
		$this->assertSame( 'a.example', $result['keys'][0] );
		$this->assertSame( 'b.example', $result['keys'][1] );
		$this->assertSame( API\OTHER_SEGMENT_KEY, $result['keys'][2] );

		$sums = array_fill_keys( $result['keys'], 0 );
		foreach ( $result['by_interval'] as $bucket ) {
			foreach ( $result['keys'] as $key ) {
				$sums[ $key ] += (int) ( $bucket[ $key ] ?? 0 );
			}
		}
		$this->assertSame( 3, $sums['a.example'] );
		$this->assertSame( 2, $sums['b.example'] );
		$this->assertSame( 2, $sums[ API\OTHER_SEGMENT_KEY ] );
	}

	public function test_own_site_referer_maps_to_direct() {
		$now = time();
		$this->insert_pageview( home_url( '/internal/' ), $now - 60 );
		$this->insert_pageview( '', $now - 50 );

		$result = API\get_interval_segments( $now - 3_600, $now + 60, 'P1D' );

		$this->assertSame( [ API\DIRECT_SEGMENT_KEY ], $result['keys'] );
		$total = 0;
		foreach ( $result['by_interval'] as $bucket ) {
			$total += (int) ( $bucket[ API\DIRECT_SEGMENT_KEY ] ?? 0 );
		}
		$this->assertSame( 2, $total );
	}

	public function test_www_prefix_is_stripped_from_host_keys() {
		$now = time();
		$this->insert_pageview( 'https://www.google.com/search', $now - 90 );
		$this->insert_pageview( 'https://www.google.com/search', $now - 80 );
		$this->insert_pageview( 'https://google.com/other', $now - 70 );

		$result = API\get_interval_segments( $now - 3_600, $now + 60, 'P1D' );

		$this->assertIsArray( $result );
		$this->assertContains( 'google.com', $result['keys'] );
		$this->assertNotContains( 'www.google.com', $result['keys'] );
		// www.google.com + google.com collapse into one host key.
		$total = 0;
		foreach ( $result['by_interval'] as $bucket ) {
			$total += (int) ( $bucket['google.com'] ?? 0 );
		}
		$this->assertSame( 3, $total );
	}

	public function test_invalid_dimension_errors() {
		$now = time();
		$result = API\get_interval_segments( $now - 3_600, $now + 60, 'P1D', null, 'country' );
		$this->assertWPError( $result );
	}

	public function test_stats_segments_forwards_errors() {
		$now     = time();
		$request = new \WP_REST_Request( 'GET', '/accelerate/v1/stats/segments' );
		$request->set_param( 'start', gmdate( 'c', $now - 3_600 ) );
		$request->set_param( 'end', gmdate( 'c', $now + 60 ) );
		$request->set_param( 'interval', 'P1D' );
		$request->set_param( 'dimension', 'country' );

		$result = API\get_stats_segments( $request );
		$this->assertWPError( $result );
		$this->assertSame( 'analytics.invalid_dimension', $result->get_error_code() );
	}

	/**
	 * Insert a pageView with an optional referer attribute.
	 */
	protected function insert_pageview( string $referer, ?int $timestamp = null ) : void {
		$timestamp = $timestamp ?: time();
		$table     = ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE;
		$session   = wp_generate_uuid4();

		$attributes = [
			'postId'      => (string) $this->post_id,
			'session'     => $session,
			'pageSession' => wp_generate_uuid4(),
			'blogId'      => (string) get_current_blog_id(),
		];
		if ( $referer !== '' ) {
			$attributes['referer'] = $referer;
		}

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
			'session_id'          => $session,
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
			$this->fail( 'Insert failed: ' . $result->get_error_message() );
		}
	}
}
