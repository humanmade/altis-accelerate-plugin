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
				'outbound_tracking_enabled' => [
					'type' => 'boolean',
					'required' => false,
				],
				'dashboard_takeover_enabled' => [
					'type' => 'boolean',
					'required' => false,
				],
			],
		],
	] );

	// Website settings proxy.
	register_rest_route( 'accelerate/v1', 'settings/website', [
		[
			'methods' => WP_REST_Server::READABLE,
			'callback' => __NAMESPACE__ . '\\get_website_settings',
			'permission_callback' => __NAMESPACE__ . '\\check_admin_permission',
		],
		[
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => __NAMESPACE__ . '\\update_website_settings',
			'permission_callback' => __NAMESPACE__ . '\\check_admin_permission',
			'args' => [
				'weekly_email_enabled' => [
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
	$outbound_enabled = get_option( 'accelerate_outbound_tracking_enabled', false );

	return rest_ensure_response( [
		'telemetry_enabled' => (bool) $telemetry_enabled,
		'abilities_api_enabled' => (bool) $abilities_enabled,
		'has_abilities_api' => $has_abilities_api,
		'outbound_tracking_enabled' => (bool) $outbound_enabled,
		'dashboard_takeover_enabled' => (bool) get_option( 'accelerate_dashboard_takeover_enabled', 1 ),
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

	// Update outbound click tracking setting if provided.
	// Toggling this off is non-destructive — it only stops new linkClick
	// events from firing. Historical events remain in ClickHouse and the
	// `by_outbound_host` aggregation continues to surface them in the UI
	// once the toggle is flipped back on.
	if ( isset( $params['outbound_tracking_enabled'] ) ) {
		update_option( 'accelerate_outbound_tracking_enabled', (bool) $params['outbound_tracking_enabled'] );
	}

	// Update dashboard takeover setting if provided.
	if ( isset( $params['dashboard_takeover_enabled'] ) ) {
		update_option( 'accelerate_dashboard_takeover_enabled', (int) (bool) $params['dashboard_takeover_enabled'] );
	}

	return get_settings();
}

/**
 * Get the dashboard site ID for the current WordPress site.
 *
 * Uses the locally stored ID from the OAuth flow, falling back to
 * an API lookup if not available.
 *
 * @return int|WP_Error The site ID on the dashboard, or WP_Error on failure.
 */
function get_dashboard_site_id() {
	$stored_id = get_option( 'accelerate_dashboard_site_id' );
	if ( $stored_id ) {
		return (int) $stored_id;
	}

	// Fallback: look up via API.
	$sites = Accelerate\accelerate_dashboard_remote_request( '/accelerate/sites', 'GET' );
	if ( is_wp_error( $sites ) ) {
		return $sites;
	}

	$home = home_url();
	foreach ( $sites as $site ) {
		if ( $site->url === $home ) {
			// Cache for future requests.
			update_option( 'accelerate_dashboard_site_id', (int) $site->id );
			return (int) $site->id;
		}
	}

	return new WP_Error( 'site_not_found', __( 'Could not find this site on the Accelerate dashboard.', 'altis-analytics' ) );
}

/**
 * Get website settings for the current site.
 *
 * @return WP_REST_Response|WP_Error
 */
function get_website_settings() {
	$site_id = get_dashboard_site_id();
	if ( is_wp_error( $site_id ) ) {
		return $site_id;
	}

	$site = Accelerate\accelerate_dashboard_remote_request( '/accelerate/sites/' . $site_id, 'GET' );
	if ( is_wp_error( $site ) ) {
		return $site;
	}

	return rest_ensure_response( [
		'weekly_email_enabled' => $site->weekly_email_enabled ?? true,
	] );
}

/**
 * Update website settings for the current site.
 *
 * @param WP_REST_Request $request The REST request.
 * @return WP_REST_Response|WP_Error
 */
function update_website_settings( WP_REST_Request $request ) {
	$site_id = get_dashboard_site_id();
	if ( is_wp_error( $site_id ) ) {
		return $site_id;
	}

	$args = [];
	if ( $request->has_param( 'weekly_email_enabled' ) ) {
		$args['weekly_email_enabled'] = (bool) $request['weekly_email_enabled'];
	}

	$site = Accelerate\accelerate_dashboard_remote_request( '/accelerate/sites/' . $site_id, 'POST', $args );
	if ( is_wp_error( $site ) ) {
		return $site;
	}

	return rest_ensure_response( [
		'weekly_email_enabled' => $site->weekly_email_enabled ?? true,
	] );
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
