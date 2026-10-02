<?php
/**
 * Per-interval referrer composition through the /stats response.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

class IntervalSegmentsTest extends WP_UnitTestCase {

	protected int $post_id;

	public function set_up() : void {
		parent::set_up();
		wp_cache_flush();
		$this->post_id = self::factory()->post->create( [ 'post_title' => 'Segments Test Post' ] );
		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
	}

	public function test_empty_window_returns_empty_keys() {
		$now = time();
		$result = $this->get_stats_with_segments( $now - HOUR_IN_SECONDS, $now + MINUTE_IN_SECONDS );

		$this->assertNotWPError( $result );
		$this->assertSame( 'referer', $result['segments']['dimension'] );
		$this->assertSame( 'ready', $result['segments']['status'] );
		$this->assertSame( [], $result['segments']['keys'] );
		$this->assertSame( [], $result['segments']['by_interval'] );
	}

	public function test_direct_and_hosts_compose_per_interval() {
		$now = time();
		$this->insert_pageview( '', $now - 120 );
		$this->insert_pageview( '', $now - 100 );
		$this->insert_pageview( 'https://google.com/search', $now - 90 );
		$this->insert_pageview( 'https://twitter.com/status/1', $now - 80 );

		$result = $this->get_stats_with_segments( $now - HOUR_IN_SECONDS, $now + MINUTE_IN_SECONDS );

		$this->assertNotWPError( $result );
		$this->assertSame( 'ready', $result['segments']['status'] );
		$this->assertContains( API\DIRECT_SEGMENT_KEY, $result['segments']['keys'] );
		$this->assertContains( 'google.com', $result['segments']['keys'] );
		$this->assertContains( 'twitter.com', $result['segments']['keys'] );
		$this->assertNotContains( API\OTHER_SEGMENT_KEY, $result['segments']['keys'] );
		$this->assertLessThanOrEqual( 3, count( $result['segments']['keys'] ) );

		$total = 0;
		foreach ( $result['segments']['by_interval'] as $bucket ) {
			$total += array_sum( $bucket );
		}
		$this->assertSame( 4, $total );
	}

	public function test_four_hosts_collapse_to_top_two_plus_other() {
		$now = time();
		foreach ( [ 1, 2, 3 ] as $_ ) {
			$this->insert_pageview( 'https://a.example/x', $now - 200 );
		}
		foreach ( [ 1, 2 ] as $_ ) {
			$this->insert_pageview( 'https://b.example/x', $now - 180 );
		}
		$this->insert_pageview( 'https://c.example/x', $now - 160 );
		$this->insert_pageview( 'https://d.example/x', $now - 140 );

		$result = $this->get_stats_with_segments( $now - HOUR_IN_SECONDS, $now + MINUTE_IN_SECONDS );

		$this->assertNotWPError( $result );
		$this->assertCount( 3, $result['segments']['keys'] );
		$this->assertSame( 'a.example', $result['segments']['keys'][0] );
		$this->assertSame( 'b.example', $result['segments']['keys'][1] );
		$this->assertSame( API\OTHER_SEGMENT_KEY, $result['segments']['keys'][2] );

		$sums = array_fill_keys( $result['segments']['keys'], 0 );
		foreach ( $result['segments']['by_interval'] as $bucket ) {
			foreach ( $result['segments']['keys'] as $key ) {
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

		$result = $this->get_stats_with_segments( $now - HOUR_IN_SECONDS, $now + MINUTE_IN_SECONDS );

		$this->assertNotWPError( $result );
		$this->assertSame( [ API\DIRECT_SEGMENT_KEY ], $result['segments']['keys'] );
		$total = 0;
		foreach ( $result['segments']['by_interval'] as $bucket ) {
			$total += (int) ( $bucket[ API\DIRECT_SEGMENT_KEY ] ?? 0 );
		}
		$this->assertSame( 2, $total );
	}

	public function test_www_prefix_is_stripped_from_host_keys() {
		$now = time();
		$this->insert_pageview( 'https://www.google.com/search', $now - 90 );
		$this->insert_pageview( 'https://www.google.com/search', $now - 80 );
		$this->insert_pageview( 'https://google.com/other', $now - 70 );

		$result = $this->get_stats_with_segments( $now - HOUR_IN_SECONDS, $now + MINUTE_IN_SECONDS );

		$this->assertNotWPError( $result );
		$this->assertContains( 'google.com', $result['segments']['keys'] );
		$this->assertNotContains( 'www.google.com', $result['segments']['keys'] );
		$total = 0;
		foreach ( $result['segments']['by_interval'] as $bucket ) {
			$total += (int) ( $bucket['google.com'] ?? 0 );
		}
		$this->assertSame( 3, $total );
	}

	public function test_invalid_dimension_errors() {
		$now = time();
		$result = API\get_graph_data( $now - HOUR_IN_SECONDS, $now + MINUTE_IN_SECONDS, 'P1D', null, 'country' );

		$this->assertWPError( $result );
		$this->assertSame( 'analytics.invalid_dimension', $result->get_error_code() );
	}

	public function test_stats_forwards_segment_errors() {
		$now = time();
		$result = $this->get_stats_with_segments( $now - HOUR_IN_SECONDS, $now + MINUTE_IN_SECONDS, 'country' );

		$this->assertWPError( $result );
		$this->assertSame( 'analytics.invalid_dimension', $result->get_error_code() );
	}

	protected function get_stats_with_segments( int $start, int $end, string $segments = 'referer' ) {
		$request = new \WP_REST_Request( 'GET', '/accelerate/v1/stats' );
		$request->set_param( 'start', gmdate( 'c', $start ) );
		$request->set_param( 'end', gmdate( 'c', $end ) );
		$request->set_param( 'interval', 'P1D' );
		$request->set_param( 'segments', $segments );

		return API\get_stats( $request );
	}

	protected function insert_pageview( string $referer, int $timestamp ) : void {
		$session = wp_generate_uuid4();
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
			'INSERT INTO ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE . ' FORMAT JSONEachRow',
			[],
			'array',
			wp_json_encode( $event )
		);
		if ( is_wp_error( $result ) ) {
			$this->fail( $result->get_error_message() );
		}
	}
}
