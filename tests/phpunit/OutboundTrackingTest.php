<?php

namespace Altis\Accelerate\Analytics;

use Altis\Accelerate\Utils;
use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTestCase;

/**
 * Outbound click tracking — feature gate + REST settings round-trip.
 *
 * The frontend listener filter is unit-tested in
 * `tests/js/outbound-click.test.ts` (vitest, ships with #621).
 * This file pins the PHP side: option default, filter precedence,
 * and the settings endpoint contract.
 */
class OutboundTrackingTest extends WP_UnitTestCase {

	const OPTION = 'accelerate_outbound_tracking_enabled';

	public function set_up() {
		parent::set_up();
		// WP_UnitTestCase restores `$wp_filter` to a snapshot that
		// predates Analytics\setup() in some run configurations, so
		// re-register the production filter for each test rather than
		// relying on the bootstrap-time hook surviving.
		setup();
	}

	public function tear_down() {
		parent::tear_down();
		delete_option( self::OPTION );
		remove_all_filters( 'altis.analytics.feature.outbound_tracking' );
	}

	public function test_default_off_when_option_missing() {
		delete_option( self::OPTION );
		$this->assertFalse( Utils\is_feature_enabled( 'outbound_tracking' ) );
	}

	public function test_option_true_enables_feature() {
		update_option( self::OPTION, 1 );
		$this->assertTrue( Utils\is_feature_enabled( 'outbound_tracking' ) );
	}

	public function test_option_false_keeps_feature_off() {
		update_option( self::OPTION, 1 );
		update_option( self::OPTION, 0 );
		$this->assertFalse( Utils\is_feature_enabled( 'outbound_tracking' ) );
	}

	public function test_user_filter_at_default_priority_overrides_default_off() {
		// The plugin registers its option-reading callback at priority 1
		// so a user filter at the default priority (10) wins.
		delete_option( self::OPTION );
		add_filter( 'altis.analytics.feature.outbound_tracking', '__return_true' );
		$this->assertTrue( Utils\is_feature_enabled( 'outbound_tracking' ) );
	}

	public function test_admin_window_data_reflects_option() {
		update_option( self::OPTION, 1 );
		$this->assertTrue(
			(bool) get_option( self::OPTION ),
			'Admin app surfaces this exact option value via outbound_tracking_enabled in AltisAccelerateDashboardData.'
		);
	}

	public function test_settings_rest_get_includes_outbound_field() {
		$user_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		wp_set_current_user( $user_id );

		do_action( 'rest_api_init' );

		$request = new WP_REST_Request( 'GET', '/accelerate/v1/settings' );
		$response = rest_do_request( $request );

		$this->assertSame( 200, $response->get_status() );
		$data = $response->get_data();
		$this->assertArrayHasKey( 'outbound_tracking_enabled', $data );
		$this->assertFalse( $data['outbound_tracking_enabled'] );
	}

	public function test_settings_rest_post_updates_option() {
		$user_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		wp_set_current_user( $user_id );

		do_action( 'rest_api_init' );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/settings' );
		$request->set_param( 'outbound_tracking_enabled', true );
		$response = rest_do_request( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( (bool) get_option( self::OPTION ) );
		$this->assertTrue( $response->get_data()['outbound_tracking_enabled'] );
	}

	public function test_settings_rest_requires_manage_options() {
		// Subscriber lacks manage_options.
		$user_id = self::factory()->user->create( [ 'role' => 'subscriber' ] );
		wp_set_current_user( $user_id );

		do_action( 'rest_api_init' );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/settings' );
		$request->set_param( 'outbound_tracking_enabled', true );
		$response = rest_do_request( $request );

		$this->assertSame( 403, $response->get_status() );
		$this->assertFalse( get_option( self::OPTION ) );
	}
}
