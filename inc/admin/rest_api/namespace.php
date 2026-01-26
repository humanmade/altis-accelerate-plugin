<?php
/**
 * Settings REST API.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\Admin\REST_API;

use Altis\Accelerate;
use Altis\Accelerate\Admin;
use Altis\Accelerate\Telemetry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Set up REST API hooks.
 *
 * @return void
 */
function setup() {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_routes' );
}

/**
 * Register REST API routes.
 *
 * @return void
 */
function register_routes() {
	// Get settings.
	register_rest_route( 'accelerate/v1', 'settings', [
		[
			'methods' => WP_REST_Server::READABLE,
			'callback' => __NAMESPACE__ . '\\get_settings',
			'permission_callback' => __NAMESPACE__ . '\\check_admin_permission',
		],
		[
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => __NAMESPACE__ . '\\update_settings',
			'permission_callback' => __NAMESPACE__ . '\\check_admin_permission',
			'args' => [
				'telemetry_enabled' => [
					'type' => 'boolean',
					'required' => false,
				],
				'abilities_api_enabled' => [
					'type' => 'boolean',
					'required' => false,
				],
			],
		],
	] );

	// Get account info.
	register_rest_route( 'accelerate/v1', 'settings/account', [
		[
			'methods' => WP_REST_Server::READABLE,
			'callback' => __NAMESPACE__ . '\\get_account',
			'permission_callback' => __NAMESPACE__ . '\\check_admin_permission',
		],
	] );
}

/**
 * Check if user has admin permission.
 *
 * @return bool
 */
function check_admin_permission() : bool {
	return current_user_can( 'manage_options' );
}

/**
 * Get current settings.
 *
 * @return WP_REST_Response
 */
function get_settings() : WP_REST_Response {
	$telemetry_enabled = Telemetry\is_site_opted_in();
	$abilities_enabled = get_option( 'accelerate_abilities_api_enabled', false );
	$has_abilities_api = function_exists( 'wp_register_ability' );

	return rest_ensure_response( [
		'telemetry_enabled' => (bool) $telemetry_enabled,
		'abilities_api_enabled' => (bool) $abilities_enabled,
		'has_abilities_api' => $has_abilities_api,
	] );
}

/**
 * Update settings.
 *
 * @param WP_REST_Request $request The REST request.
 * @return WP_REST_Response|WP_Error
 */
function update_settings( WP_REST_Request $request ) {
	$params = $request->get_params();

	// Update telemetry setting if provided.
	if ( isset( $params['telemetry_enabled'] ) ) {
		Telemetry\opt_in( (bool) $params['telemetry_enabled'], null, 'settings' );
	}

	// Update abilities API setting if provided.
	if ( isset( $params['abilities_api_enabled'] ) ) {
		update_option( 'accelerate_abilities_api_enabled', (bool) $params['abilities_api_enabled'] );
	}

	return get_settings();
}

/**
 * Get account information.
 *
 * @return WP_REST_Response
 */
function get_account() : WP_REST_Response {
	$connected = Accelerate\get_accelerate_dashboard_access_token();
	$authorize_url = Accelerate\get_accelerate_dashboard_authorize_url();
	$dashboard_url = Accelerate\get_accelerate_dashboard_url();
	$unlink_url = wp_nonce_url(
		add_query_arg(
			'action',
			Admin\UNLINK_ALTIS_DASHBOARD_ACTION,
			admin_url( 'admin.php?page=' . Admin\MENU_SLUG )
		),
		Admin\UNLINK_ALTIS_DASHBOARD_ACTION
	);

	$response = [
		'connected' => ! empty( $connected ),
		'user_name' => null,
		'error' => null,
		'manage_url' => $dashboard_url . '/accelerate/',
		'unlink_url' => $unlink_url,
		'authorize_url' => $authorize_url,
	];

	if ( $connected ) {
		$user = Accelerate\accelerate_dashboard_remote_request( '/wp/v2/users/me' );

		if ( is_wp_error( $user ) ) {
			$response['error'] = $user->get_error_message();
		} else {
			$response['user_name'] = $user->name;
		}
	}

	return rest_ensure_response( $response );
}
