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

class SourceBreakdownTest extends WP_UnitTestCase {

	/**
	 * @var int
	 */
	protected $post_id;

	public function set_up() {
		parent::set_up();

		$this->post_id = self::factory()->post->create( [ 'post_title' => 'Source Test Post' ] );

		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
	}

	public function test_returns_array_for_default_input() {
		$result = Attribution\execute_get_source_breakdown( [] );

		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'sources', $result );
		$this->assertArrayHasKey( 'period', $result );
		$this->assertArrayHasKey( 'start', $result['period'] );
		$this->assertArrayHasKey( 'end', $result['period'] );
	}

	public function test_returns_array_for_explicit_grouping() {
		$result = Attribution\execute_get_source_breakdown( [
			'date_range' => [ 'preset' => '7d' ],
			'group_by'   => 'referrer_domain',
			'limit'      => 5,
		] );

		$this->assertIsArray( $result );
		$this->assertSame( [], $result['sources'] );
	}

	public function test_inserted_pageviews_appear_in_breakdown() {
		$now = time();
		// Two events inside the default 7-day window. We don't assert which
		// group key they land under — that depends on ingest-side fields like
		// initial_referer / utm_campaign that aren't writable from a direct
		// JSONEachRow INSERT — but the total views across all groups must
		// equal the number we inserted, which proves the timestamp filter is
		// letting them through (the bug fixed in this PR was that all rows
		// were filtered out).
		$this->insert_pageview( wp_generate_uuid4(), $now - 60 );
		$this->insert_pageview( wp_generate_uuid4(), $now - 30 );

		$result = Attribution\execute_get_source_breakdown( [] );

		$this->assertNotWPError( $result );
		$this->assertNotEmpty( $result['sources'] );
		$total_views = array_sum( array_column( $result['sources'], 'views' ) );
		$this->assertEquals( 2, $total_views );
	}

	public function test_session_with_uuid_session_id_does_not_error() {
		// Regression coverage paired with #609 — confirms the function works
		// against the production-shaped session_id column.
		$this->insert_pageview( wp_generate_uuid4(), time() - 30 );

		$result = Attribution\execute_get_source_breakdown( [] );

		$this->assertNotWPError( $result );
		$this->assertIsArray( $result );
	}

	/**
	 * Insert a pageView event into the test analytics table.
	 */
	protected function insert_pageview( string $session_id, ?int $timestamp = null ) : void {
		$timestamp = $timestamp ?: time();

		$attributes = [
			'postId'      => (string) $this->post_id,
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
