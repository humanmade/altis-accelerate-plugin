<?php
/**
 * Connection handler for WAF-friendly OAuth callback.
 *
 * Provides a REST API endpoint for receiving site configuration when
 * the standard OAuth callback redirect is blocked by WAFs.
 *
 * Security Model:
 * - Uses one-time transient nonce (not WordPress user nonces)
 * - Nonce is consumed atomically to prevent race conditions
 * - Endpoint is publicly accessible but requires valid nonce
 * - 1-hour expiry on nonces
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\Connect;

use Altis\Accelerate\Admin;
use Altis\Accelerate\Telemetry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

const NONCE_TRANSIENT_KEY = 'accelerate_connect_nonce';
const NONCE_EXPIRY = HOUR_IN_SECONDS;

/**
 * Bootstrap the connect module.
 *
 * @return void
 */
function bootstrap() : void {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_routes' );
	add_filter( 'rest_pre_serve_request', __NAMESPACE__ . '\\add_cors_headers', 10, 4 );
}

/**
 * Add CORS headers for the connect endpoint.
 *
 * Allows cross-origin requests from accelerateplugin.com so the
 * dashboard can POST config via JavaScript fetch().
 *
 * @param bool             $served  Whether the request has been served.
 * @param WP_REST_Response $result  Response object.
 * @param WP_REST_Request  $request Request object.
 * @param WP_REST_Server   $server  Server instance.
 * @return bool
 */
function add_cors_headers( $served, $result, $request, $server ) {
	// Only add CORS headers for our connect endpoint.
	if ( strpos( $request->get_route(), '/accelerate/v1/connect' ) === false ) {
		return $served;
	}

	$origin = get_http_origin();
	$allowed_origin = defined( 'ACCELERATE_DASHBOARD_URL' )
		? ACCELERATE_DASHBOARD_URL
		: 'https://www.accelerateplugin.com';

	// Only allow requests from the Accelerate dashboard.
	if ( $origin && strpos( $origin, parse_url( $allowed_origin, PHP_URL_HOST ) ) !== false ) {
		header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
		header( 'Access-Control-Allow-Methods: POST, OPTIONS' );
		header( 'Access-Control-Allow-Headers: Content-Type' );
		header( 'Access-Control-Allow-Credentials: true' );
	}

	return $served;
}

/**
 * Register REST API routes.
 *
 * @return void
 */
function register_routes() : void {
	register_rest_route( 'accelerate/v1', '/connect', [
		[
			'methods'  => WP_REST_Server::CREATABLE,
			'callback' => __NAMESPACE__ . '\\handle_connect',
			'permission_callback' => '__return_true', // Auth via one-time nonce, documented above.
			'args' => [
				'config' => [
					'type' => 'string',
					'required' => true,
					'sanitize_callback' => 'sanitize_text_field',
					'validate_callback' => __NAMESPACE__ . '\\validate_config',
				],
				'nonce' => [
					'type' => 'string',
					'required' => true,
					'sanitize_callback' => 'sanitize_text_field',
				],
			],
		],
		// Handle CORS preflight requests.
		[
			'methods'  => 'OPTIONS',
			'callback' => '__return_true',
			'permission_callback' => '__return_true',
		],
	] );
}

/**
 * Validate config is a string with 3 colon-separated parts.
 *
 * Backend validates the actual values (region, app_id, key).
 *
 * @param mixed           $value   The parameter value.
 * @param WP_REST_Request $request The request object.
 * @param string          $param   The parameter name.
 * @return bool|WP_Error True if valid, WP_Error otherwise.
 */
function validate_config( $value, $request, $param ) {
	if ( ! is_string( $value ) ) {
		return new WP_Error(
			'rest_invalid_param',
			__( 'Config must be a string.', 'altis-accelerate' ),
			[ 'status' => 400 ]
		);
	}

	if ( count( explode( ':', $value, 3 ) ) !== 3 ) {
		return new WP_Error(
			'invalid_config_format',
			__( 'Config must be in format region:app_id:key', 'altis-accelerate' ),
			[ 'status' => 400 ]
		);
	}

	return true;
}

/**
 * Handle the connect REST API request.
 *
 * Validates the one-time nonce and saves the site configuration.
 * Uses atomic nonce consumption to prevent race conditions.
 *
 * @param WP_REST_Request $request The REST request object.
 * @return WP_REST_Response|WP_Error Response on success, error on failure.
 */
function handle_connect( WP_REST_Request $request ) {
	$config = $request->get_param( 'config' );
	$nonce = $request->get_param( 'nonce' );

	// Atomically consume nonce: get and delete in one operation.
	// This prevents race conditions where two requests pass validation.
	$stored_nonce = get_transient( NONCE_TRANSIENT_KEY );

	// Delete immediately before validation to ensure atomic consumption.
	delete_transient( NONCE_TRANSIENT_KEY );

	if ( ! $stored_nonce || ! hash_equals( $stored_nonce, $nonce ) ) {
		return new WP_Error(
			'invalid_nonce',
			__( 'Invalid or expired connection token.', 'altis-accelerate' ),
			[ 'status' => 403 ]
		);
	}

	// Save config.
	update_option( 'altis_config', $config );

	// Track site connected event if telemetry is available.
	if ( function_exists( '\\Altis\\Accelerate\\Telemetry\\track_site_connected' ) ) {
		Telemetry\track_site_connected();
	}

	return rest_ensure_response( [
		'success' => true,
		'redirect' => admin_url( 'admin.php?page=' . Admin\MENU_SLUG ),
	] );
}

/**
 * Generate a one-time nonce for the connect endpoint.
 *
 * Only generates a new nonce if one doesn't already exist.
 * This prevents overwriting nonces during the OAuth flow.
 *
 * @param bool $force Force generation of new nonce even if one exists.
 * @return string The generated nonce.
 */
function generate_connect_nonce( bool $force = false ) : string {
	// Check for existing valid nonce to prevent overwriting during OAuth flow.
	$existing = get_transient( NONCE_TRANSIENT_KEY );
	if ( $existing && ! $force ) {
		return $existing;
	}

	$nonce = wp_generate_password( 32, false );
	set_transient( NONCE_TRANSIENT_KEY, $nonce, NONCE_EXPIRY );
	return $nonce;
}

/**
 * Get the connect endpoint URL.
 *
 * @return string The REST API endpoint URL.
 */
function get_connect_endpoint_url() : string {
	return rest_url( 'accelerate/v1/connect' );
}
