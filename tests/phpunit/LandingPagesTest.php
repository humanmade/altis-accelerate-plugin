<?php

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Attribution;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

// The abilities domain files are only auto-loaded when the WP 6.9+ Abilities
// API is present (see inc/namespace.php). Tests call the execute callbacks
// directly, so make sure their files are loaded regardless of WP version.
require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/attribution.php';

class LandingPagesTest extends WP_UnitTestCase {

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

		$this->post_a = self::factory()->post->create( [ 'post_title' => 'Landing Post A' ] );
		$this->post_b = self::factory()->post->create( [ 'post_title' => 'Landing Post B' ] );

		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
	}

	public function test_returns_array_for_default_input() {
		$result = Attribution\execute_get_landing_pages( [] );

		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'pages', $result );
		$this->assertArrayHasKey( 'period', $result );
		$this->assertArrayHasKey( 'start', $result['period'] );
		$this->assertArrayHasKey( 'end', $result['period'] );
	}

	public function test_returns_array_for_explicit_date_range() {
		$result = Attribution\execute_get_landing_pages( [
			'date_range' => [ 'preset' => '7d' ],
			'limit'      => 5,
		] );

		$this->assertIsArray( $result );
		$this->assertSame( [], $result['pages'] );
	}

	public function test_first_pageview_in_session_is_landing_page() {
		$now = time();
		$session = wp_generate_uuid4();

		// User entered on Post A, then navigated to Post B in the same session.
		// Both timestamps are in the past so they fall inside the default window.
		$this->insert_pageview( $session, $this->post_a, $now - 60 );
		$this->insert_pageview( $session, $this->post_b, $now - 10 );

		$result = Attribution\execute_get_landing_pages( [] );

		$this->assertNotWPError( $result );
		$this->assertCount( 1, $result['pages'] );
		$this->assertEquals( $this->post_a, $result['pages'][0]['post_id'] );
		$this->assertEquals( 1, $result['pages'][0]['entries'] );
	}

	public function test_session_with_uuid_session_id_does_not_error() {
		// Regression coverage for #609 — session_id is a UUID string.
		$session = wp_generate_uuid4();
		$this->insert_pageview( $session, $this->post_a );

		$result = Attribution\execute_get_landing_pages( [] );

		$this->assertNotWPError( $result );
		$this->assertIsArray( $result );
	}

	/**
	 * Insert a pageView event into the test analytics table.
	 */
	protected function insert_pageview( string $session_id, int $post_id, ?int $timestamp = null ) : void {
		$timestamp = $timestamp ?: time();

		$attributes = [
			'postId'      => (string) $post_id,
			'session'     => $session_id,
			'pageSession' => wp_generate_uuid4(),
			'blogId'      => '1',
		];

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
