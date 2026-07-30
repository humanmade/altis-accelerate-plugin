<?php

namespace Altis\Accelerate;

use Altis\Accelerate\Integrations\HubSpot;
use WP_UnitTestCase;

/**
 * HubSpot integration — server-side tests.
 *
 * The HTTP layer is mocked via the `pre_http_request` filter, so these
 * cover: API client pagination + auth header, token validation error
 * surfacing, directory sync (including failure preserving the last-good
 * maps), the enabled-option cron lifecycle, audience field registration,
 * and the settings REST contract (token is write-only).
 */
class HubSpotIntegrationTest extends WP_UnitTestCase {

	/**
	 * Queued mock HTTP responses, consumed in order by filter_http().
	 *
	 * @var array
	 */
	protected array $http_queue = [];

	/**
	 * Captured outgoing requests for assertions.
	 *
	 * @var array
	 */
	protected array $http_requests = [];

	public function set_up() {
		parent::set_up();

		// The plugin bootstrap bails before module setup in the test
		// environment (no altis_config); register the module's hooks
		// directly. add_action dedupes repeat registrations.
		HubSpot\setup();

		delete_option( HubSpot\OPTION_ENABLED );
		delete_option( HubSpot\OPTION_TOKEN );
		delete_option( HubSpot\OPTION_DIRECTORIES );
		wp_clear_scheduled_hook( HubSpot\CRON_HOOK );

		$this->http_queue = [];
		$this->http_requests = [];
		add_filter( 'pre_http_request', [ $this, 'filter_http' ], 10, 3 );
	}

	public function tear_down() {
		remove_filter( 'pre_http_request', [ $this, 'filter_http' ] );
		parent::tear_down();
	}

	/**
	 * Serve queued mock responses for HubSpot API requests.
	 *
	 * @param mixed $preempt Whether to short-circuit.
	 * @param array $args Request args.
	 * @param string $url Request URL.
	 * @return array|\WP_Error
	 */
	public function filter_http( $preempt, $args, $url ) {
		if ( strpos( $url, 'api.hubapi.com' ) === false ) {
			return $preempt;
		}

		$this->http_requests[] = [
			'url' => $url,
			'args' => $args,
		];

		$next = array_shift( $this->http_queue );
		if ( $next === null ) {
			$this->fail( 'Unexpected HubSpot API request: ' . $url );
		}

		return $next;
	}

	/**
	 * Build a mock HTTP response.
	 *
	 * @param int $code Status code.
	 * @param array $body JSON body.
	 * @return array
	 */
	protected function response( int $code, array $body ) : array {
		return [
			'headers' => [],
			'response' => [
				'code' => $code,
				'message' => '',
			],
			'body' => wp_json_encode( $body ),
			'cookies' => [],
			'filename' => null,
		];
	}

	// -------------------------------------------------------------------------
	// API client
	// -------------------------------------------------------------------------

	public function test_api_requests_carry_bearer_token() {
		$this->http_queue[] = $this->response( 200, [ 'results' => [] ] );

		HubSpot\api_get_all( 'pat-test-token', '/marketing/v3/forms/' );

		$this->assertCount( 1, $this->http_requests );
		$this->assertSame( 'Bearer pat-test-token', $this->http_requests[0]['args']['headers']['Authorization'] );
	}

	public function test_pagination_follows_after_cursor() {
		$this->http_queue[] = $this->response( 200, [
			'results' => [ [ 'id' => 'form-1', 'name' => 'One' ] ],
			'paging' => [ 'next' => [ 'after' => 'CURSOR' ] ],
		] );
		$this->http_queue[] = $this->response( 200, [
			'results' => [ [ 'id' => 'form-2', 'name' => 'Two' ] ],
		] );

		$directory = HubSpot\fetch_forms_directory( 'pat-test' );

		$this->assertSame( [
			'form-1' => 'One',
			'form-2' => 'Two',
		], $directory );
		$this->assertCount( 2, $this->http_requests );
		$this->assertStringContainsString( 'after=CURSOR', $this->http_requests[1]['url'] );
	}

	public function test_validate_token_surfaces_hubspot_error_message() {
		$this->http_queue[] = $this->response( 403, [
			'message' => 'This app hasn\'t been granted all required scopes',
		] );

		$result = HubSpot\validate_token( 'pat-bad' );

		$this->assertWPError( $result );
		$this->assertStringContainsString( 'required scopes', $result->get_error_message() );
	}

	// -------------------------------------------------------------------------
	// Directory sync
	// -------------------------------------------------------------------------

	public function test_sync_builds_both_directories() {
		update_option( HubSpot\OPTION_TOKEN, 'pat-test', false );
		$this->http_queue[] = $this->response( 200, [
			'results' => [ [ 'id' => 'form-1', 'name' => 'RFI' ] ],
		] );
		$this->http_queue[] = $this->response( 200, [
			'results' => [ [ 'id' => 42, 'name' => 'Nurture #3' ] ],
		] );

		HubSpot\sync_directories();

		$directories = HubSpot\get_directories();
		$this->assertSame( [ 'form-1' => 'RFI' ], $directories['forms'] );
		$this->assertSame( [ '42' => 'Nurture #3' ], $directories['emails'] );
		$this->assertNotNull( $directories['synced_at'] );
		$this->assertNull( $directories['error'] );
	}

	public function test_failed_sync_preserves_last_good_directories() {
		update_option( HubSpot\OPTION_TOKEN, 'pat-test', false );
		update_option( HubSpot\OPTION_DIRECTORIES, [
			'forms' => [ 'form-1' => 'RFI' ],
			'emails' => [ '42' => 'Nurture #3' ],
			'synced_at' => 12345,
			'error' => null,
		], false );

		$this->http_queue[] = $this->response( 500, [ 'message' => 'upstream down' ] );
		$this->http_queue[] = $this->response( 500, [ 'message' => 'upstream down' ] );

		HubSpot\sync_directories();

		$directories = HubSpot\get_directories();
		$this->assertSame( [ 'form-1' => 'RFI' ], $directories['forms'] );
		$this->assertSame( [ '42' => 'Nurture #3' ], $directories['emails'] );
		$this->assertStringContainsString( 'upstream down', $directories['error'] );
	}

	public function test_sync_without_token_is_a_noop() {
		HubSpot\sync_directories();
		$this->assertCount( 0, $this->http_requests );
	}

	// -------------------------------------------------------------------------
	// Enabled option lifecycle
	// -------------------------------------------------------------------------

	public function test_cron_schedules_on_enable_and_clears_on_disable() {
		update_option( HubSpot\OPTION_ENABLED, 1 );
		$this->assertNotFalse( wp_next_scheduled( HubSpot\CRON_HOOK ) );

		update_option( HubSpot\OPTION_ENABLED, 0 );
		$this->assertFalse( wp_next_scheduled( HubSpot\CRON_HOOK ) );
	}

	// -------------------------------------------------------------------------
	// Audience fields
	// -------------------------------------------------------------------------

	public function test_audience_fields_registered_as_endpoint_arrays() {
		HubSpot\register_audience_fields();

		$expected = [
			'endpoint.Attributes.hubspot_forms_submitted' => 'endpoint_attributes[\'hubspot_forms_submitted\']',
			'endpoint.Attributes.hubspot_emails_arrived' => 'endpoint_attributes[\'hubspot_emails_arrived\']',
			'endpoint.Attributes.hubspot_chat_engaged' => 'endpoint_attributes[\'hubspot_chat_engaged\']',
		];

		$fields = [];
		foreach ( Audiences\get_fields() as $field ) {
			$fields[ $field['name'] ] = $field;
		}

		foreach ( $expected as $name => $column ) {
			$this->assertArrayHasKey( $name, $fields, $name . ' should be registered' );
			$this->assertSame( $column, $fields[ $name ]['options']['column'] );
			$this->assertTrue( $fields[ $name ]['options']['array'] );
		}
	}

	// -------------------------------------------------------------------------
	// Settings REST contract
	// -------------------------------------------------------------------------

	public function test_settings_never_echo_the_token() {
		update_option( HubSpot\OPTION_TOKEN, 'pat-secret', false );
		update_option( HubSpot\OPTION_ENABLED, 1 );

		$settings = Admin\REST_API\get_settings()->get_data();

		$this->assertTrue( $settings['hubspot_enabled'] );
		$this->assertTrue( $settings['hubspot_token_set'] );
		$this->assertStringNotContainsString( 'pat-secret', wp_json_encode( $settings ) );
	}

	public function test_settings_update_validates_token_before_storing() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$this->http_queue[] = $this->response( 401, [ 'message' => 'Invalid token' ] );

		$request = new \WP_REST_Request( 'POST', '/accelerate/v1/settings' );
		$request->set_param( 'hubspot_token', 'pat-invalid' );
		$result = Admin\REST_API\update_settings( $request );

		$this->assertWPError( $result );
		$this->assertSame( '', HubSpot\get_token() );
	}

	public function test_settings_update_stores_valid_token_and_syncs() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		// validate_token, then the two directory fetches from the inline sync.
		$this->http_queue[] = $this->response( 200, [ 'results' => [] ] );
		$this->http_queue[] = $this->response( 200, [
			'results' => [ [ 'id' => 'form-1', 'name' => 'RFI' ] ],
		] );
		$this->http_queue[] = $this->response( 200, [ 'results' => [] ] );

		$request = new \WP_REST_Request( 'POST', '/accelerate/v1/settings' );
		$request->set_param( 'hubspot_token', 'pat-valid' );
		$result = Admin\REST_API\update_settings( $request );

		$this->assertNotWPError( $result );
		$this->assertSame( 'pat-valid', HubSpot\get_token() );
		$this->assertSame( [ 'form-1' => 'RFI' ], HubSpot\get_directories()['forms'] );
	}

	public function test_settings_update_clears_token_with_empty_string() {
		update_option( HubSpot\OPTION_TOKEN, 'pat-old', false );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$request = new \WP_REST_Request( 'POST', '/accelerate/v1/settings' );
		$request->set_param( 'hubspot_token', '' );
		Admin\REST_API\update_settings( $request );

		$this->assertSame( '', HubSpot\get_token() );
		$this->assertCount( 0, $this->http_requests );
	}
}
