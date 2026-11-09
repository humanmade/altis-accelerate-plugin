<?php
/**
 * Regression coverage for the single-response referrer composition contract.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

class StatsSegmentsParityTest extends WP_UnitTestCase {

	protected int $post_id;

	public function set_up() : void {
		parent::set_up();
		wp_cache_flush();
		$this->post_id = self::factory()->post->create();
		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
	}

	public function test_composition_sums_to_the_authoritative_stats_bucket_total() : void {
		$now = time();
		$this->insert_pageview( '', $now - 180 );
		$this->insert_pageview( 'https://google.com/search', $now - 120 );
		$this->insert_pageview( 'https://www.google.com/news', $now - 90 );
		$this->insert_pageview( 'https://example.net/article', $now - 60 );

		$request = new \WP_REST_Request( 'GET', '/accelerate/v1/stats' );
		$request->set_param( 'start', gmdate( 'c', $now - HOUR_IN_SECONDS ) );
		$request->set_param( 'end', gmdate( 'c', $now + MINUTE_IN_SECONDS ) );
		$request->set_param( 'interval', 'P1D' );
		$request->set_param( 'segments', 'referer' );
		$data = API\get_stats( $request );

		$this->assertNotWPError( $data );
		$this->assertSame( 'ready', $data['segments']['status'] );
		$this->assertContains( API\DIRECT_SEGMENT_KEY, $data['segments']['keys'] );
		$this->assertContains( 'google.com', $data['segments']['keys'] );

		$sum = 0;
		foreach ( $data['by_interval'] as $date => $stat ) {
			$segments = $data['segments']['by_interval'][ $date ] ?? [];
			$this->assertSame( (int) $stat['views'], array_sum( $segments ), "Composition must equal the /stats total for {$date}." );
			$sum += array_sum( $segments );
		}
		$this->assertSame( $sum, (int) $data['stats']['summary']['views'] );
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
