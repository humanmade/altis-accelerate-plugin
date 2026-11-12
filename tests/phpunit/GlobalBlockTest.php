<?php

namespace Altis\Accelerate;

use WP_UnitTestCase;

class GlobalBlockTest extends WP_UnitTestCase {
	/**
	 * Global block ID.
	 *
	 * @var int
	 */
	protected $global_block_id;

	/**
	 * Page ID.
	 *
	 * @var int
	 */
	protected $page_id;

	/**
	 * Endpoint data.
	 *
	 * @var array
	 */
	protected $endpoint;

	/**
	 * Session data.
	 *
	 * @var array
	 */
	protected $session;

	public function set_up() {
		parent::set_up();
		$this->global_block_id = self::factory()->post->create( [
			'post_title' => 'Test Global Block',
			'post_type' => 'wp_block',
		] );
		$this->page_id = self::factory()->post->create( [
			'post_title' => 'Test Page',
			'post_type' => 'page',
			'post_content' => '<!-- wp:block {"ref":' . $this->global_block_id . '} /-->',
		] );

		$this->endpoint = [
			'Id' => wp_generate_uuid4(),
			'Demographic' => [
				'AppVersion' => '1.0',
				'Locale' => 'en-US',
				'Make' => 'Apple',
				'Model' => 'iPhone',
				'ModelVersion' => '12.0',
				'Platform' => 'iOS',
				'PlatformVersion' => '12.0',
			],
			'Location' => [
				'Country' => 'US',
				'City' => 'New York',
				'PostalCode' => '10001',
				'Region' => 'NY',
			],
		];

		$this->session = [
			'session_id' => wp_generate_uuid4(),
			'start_timestamp' => time() * 1000,
			'stop_timestamp' => time() * 1000 + 60000,
			'duration' => 60,
		];

		$this->create_event( 'blockView', time() * 1000, $this->endpoint, [
			'postId' => $this->page_id,
			'blockId' => $this->global_block_id,
		], $this->session );
	}

	public function test_get_block_type() {
		$this->assertEquals( 'standard', Blocks\get_block_type( $this->global_block_id ) );
	}

	public function test_get_views() {
		$views = Blocks\get_views( $this->global_block_id );
		$this->assertEquals( 1, $views['views'] );
		$this->assertEquals( 1, $views['unique']['views'] );
		$this->assertArrayHasKey('loads', $views);
		$this->assertArrayHasKey('conversions', $views);
		$this->assertArrayHasKey('variants', $views);
	}

	protected function create_event( string $type, ?int $timestamp = null, array $endpoint, array $attributes = [], array $session = [] ) {
		$endpoint_id = 'aed42d5a-78b1-46b8-9820-c9247ac7665b';

		$attributes['session'] = $session['session_id'];
		$attributes['pageSession'] = wp_generate_uuid4();
		$attributes['blogId'] = 1;

		$event = [
			'app_id' => '123',
			'event_type' => $type,
			'event_timestamp' => ch_format_date( $timestamp ?: time() ),
			'attributes' => (object) array_map( 'strval', $attributes ),
			'metrics' => (object) [],
			'endpoint_id' => $endpoint_id,
			'endpoint_attributes' => (object) array_map( function ( $att ) { return is_array( $att ) ? $att : [ $att ]; }, $endpoint['Attributes'] ?? [] ),
			'endpoint_metrics' => (object) array_map( function ( $att ) { return is_array( $att ) ? $att[0] : $att; }, $endpoint['Metrics'] ?? [] ),
			'endpoint_address' => $endpoint['Address'] ?? '',
			'endpoint_optout' => $endpoint['OptOut'] ?? 'ALL',
			'app_version' => $endpoint['Demographic']['AppVersion'] ?? '',
			'locale' => $endpoint['Demographic']['Locale'] ?? '',
			'make' => $endpoint['Demographic']['Make'] ?? '',
			'model' => $endpoint['Demographic']['Model'] ?? '',
			'model_version' => $endpoint['Demographic']['ModelVersion'] ?? '',
			'platform' => $endpoint['Demographic']['Platform'] ?? '',
			'platform_version' => $endpoint['Demographic']['PlatformVersion'] ?? '',
			'country' => $endpoint['Location']['Country'] ?? '',
			'city' => $endpoint['Location']['City'] ?? '',
			'postal_code' => $endpoint['Location']['PostalCode'] ?? '',
			'region' => $endpoint['Location']['Region'] ?? '',
			'user_id' => $endpoint['User']['UserId'] ?? '',
			'user_attributes' => (object) array_map( function ( $att ) { return is_array( $att ) ? $att : [ $att ]; }, $endpoint['User']['UserAttributes'] ?? [] ),
			'session_id' => $session['session_id'] ?? '',
			'session_start' => ch_format_date( $session['start_timestamp'] ?? null ),
			'session_stop' => ch_format_date( $session['stop_timestamp'] ?? null ),
			'session_duration' => $session['duration'] ?? null,
		];

		Utils\query( "INSERT INTO " . ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE . " FORMAT JSONEachRow", [], 'array', json_encode( $event ) );
	}
}

function ch_format_date( $date ) {
	if ( ! $date ) {
		return $date;
	}
	if ( is_numeric( $date ) ) {
		$date = date( 'Y-m-d H:i:s.000', $date / 1000 );
	}
	$date = str_replace( 'T', ' ', $date );
	$date = str_replace( 'Z', '', $date );
	return $date;
}
