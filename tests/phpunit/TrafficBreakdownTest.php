<?php

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Discovery;
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Utils;
use WP_UnitTestCase;

// The abilities domain files are only auto-loaded when the WP 6.9+ Abilities
// API is present (see inc/namespace.php). Tests call the execute callback
// directly, so make sure the file is loaded regardless of WP version.
require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/discovery.php';

/**
 * Regression tests for execute_get_traffic_breakdown.
 *
 * execute_get_traffic_breakdown runs its own ClickHouse query directly against
 * the table named by ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE (via
 * Helpers\get_analytics_table()). The test environment points that constant at
 * a dedicated test table, so controlled inserts allow exact assertions.
 *
 * The global $altis_analytics_event_data_maps is reset between WPUnit test
 * cases, so set_up() re-registers the default fields and truncates the table
 * before each test.
 *
 * Array-typed dimension columns:
 * The four exposed dimensions (country, browser, os, referrer) map to the
 * columns country, model, platform, and referer respectively — none of which
 * are array-typed in the field registry (endpoint.Attributes.referer uses the
 * array-typed `referers` column, but that field is NOT exposed via the
 * dimension map). The LEFT ARRAY JOIN path in execute_get_traffic_breakdown is
 * therefore not exercised by any of the four public dimensions, so it has no
 * dedicated test here.
 */
class TrafficBreakdownTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();
		Utils\query( 'TRUNCATE TABLE ' . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE );
		// The $altis_analytics_event_data_maps global is cleared between WPUnit
		// test cases. Re-register the fields so get_fields() resolves columns.
		Audiences\register_default_event_data_maps();
		wp_cache_flush();
	}

	// -------------------------------------------------------------------------
	// Helper: insert a minimal pageView event.
	// -------------------------------------------------------------------------

	protected function insert_pageview( int $post_id, ?int $timestamp = null, string $country = 'US' ) : void {
		$timestamp  = $timestamp ?: time();
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
			'country'             => $country,
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

	// -------------------------------------------------------------------------
	// Test 1: Default input returns a well-shaped array.
	// -------------------------------------------------------------------------

	public function test_returns_array_of_rows_for_default_input() {
		$result = Discovery\execute_get_traffic_breakdown( [] );

		$this->assertIsArray( $result );

		// Each row must carry the three keys declared in the output_schema.
		foreach ( $result as $row ) {
			$this->assertArrayHasKey( 'key',     $row, 'Each row must have "key".' );
			$this->assertArrayHasKey( 'value',   $row, 'Each row must have "value".' );
			$this->assertArrayHasKey( 'percent', $row, 'Each row must have "percent".' );
		}
	}

	// -------------------------------------------------------------------------
	// Test 2: Regression — date_range must be honoured.
	//
	// Insert one row ~10 days old (country DE) and one ~1 day old (country US).
	// A 7-day window must return only the recent row; a 14-day window must
	// return both.
	// -------------------------------------------------------------------------

	public function test_date_range_is_honoured() {
		$now  = time();
		$old  = $now - ( 10 * DAY_IN_SECONDS ); // ~10 days ago — outside 7d window.
		$new  = $now - ( 1  * DAY_IN_SECONDS ); // ~1 day ago  — inside 7d window.

		$post_id = self::factory()->post->create();
		$this->insert_pageview( $post_id, $old, 'DE' );
		$this->insert_pageview( $post_id, $new, 'US' );

		// 7-day window: only the recent (US) row must appear.
		$result_7d = Discovery\execute_get_traffic_breakdown( [
			'dimension'  => 'country',
			'date_range' => [
				'start' => gmdate( 'Y-m-d\TH:i:s\Z', $now - ( 7 * DAY_IN_SECONDS ) ),
				'end'   => gmdate( 'Y-m-d\TH:i:s\Z', $now ),
			],
		] );

		$this->assertIsArray( $result_7d );
		$keys_7d = array_column( $result_7d, 'key' );
		$this->assertContains( 'US', $keys_7d, '7d window must include the recent US row.' );
		$this->assertNotContains( 'DE', $keys_7d, '7d window must exclude the 10-day-old DE row.' );

		// 14-day window: both rows must appear.
		$result_14d = Discovery\execute_get_traffic_breakdown( [
			'dimension'  => 'country',
			'date_range' => [
				'start' => gmdate( 'Y-m-d\TH:i:s\Z', $now - ( 14 * DAY_IN_SECONDS ) ),
				'end'   => gmdate( 'Y-m-d\TH:i:s\Z', $now ),
			],
		] );

		$this->assertIsArray( $result_14d );
		$keys_14d = array_column( $result_14d, 'key' );
		$this->assertContains( 'US', $keys_14d, '14d window must include the US row.' );
		$this->assertContains( 'DE', $keys_14d, '14d window must include the older DE row.' );
	}

	// -------------------------------------------------------------------------
	// Test 3: Dimension switching — all four supported values must not error.
	// -------------------------------------------------------------------------

	public function test_all_dimensions_return_arrays_without_error() {
		foreach ( [ 'country', 'browser', 'os', 'referrer' ] as $dim ) {
			wp_cache_flush();
			$result = Discovery\execute_get_traffic_breakdown( [ 'dimension' => $dim ] );
			$this->assertIsArray(
				$result,
				"Dimension '{$dim}' must return an array."
			);
			$this->assertNotWPError(
				$result,
				"Dimension '{$dim}' must not return a WP_Error."
			);
		}
	}

	// -------------------------------------------------------------------------
	// Test 4: limit is respected.
	// -------------------------------------------------------------------------

	public function test_limit_is_respected() {
		$result = Discovery\execute_get_traffic_breakdown( [
			'dimension' => 'country',
			'limit'     => 3,
		] );

		$this->assertIsArray( $result );
		$this->assertLessThanOrEqual(
			3,
			count( $result ),
			'Result row count must not exceed the requested limit of 3.'
		);
	}

	// -------------------------------------------------------------------------
	// Test 5: No zero-count entries may be returned.
	// -------------------------------------------------------------------------

	public function test_no_zero_count_entries_in_result() {
		$post_id = self::factory()->post->create();
		$this->insert_pageview( $post_id, null, 'GB' );

		$result = Discovery\execute_get_traffic_breakdown( [ 'dimension' => 'country' ] );

		$this->assertIsArray( $result );

		foreach ( $result as $row ) {
			$this->assertGreaterThan(
				0,
				(int) $row['value'],
				sprintf( 'Row with key "%s" has value %d — zero-count entries must be absent.', $row['key'], $row['value'] )
			);
		}
	}

	// -------------------------------------------------------------------------
	// Test 6: Maximum limit boundary (schema caps at 50).
	// -------------------------------------------------------------------------

	public function test_limit_capped_at_schema_maximum() {
		$result = Discovery\execute_get_traffic_breakdown( [
			'dimension' => 'country',
			'limit'     => 200, // Far above the schema maximum of 50.
		] );

		$this->assertIsArray( $result );
		$this->assertLessThanOrEqual(
			50,
			count( $result ),
			'Result must never exceed the schema maximum of 50 rows regardless of requested limit.'
		);
	}
}
