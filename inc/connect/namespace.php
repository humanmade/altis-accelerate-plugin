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

use Altis\Accelerate;
use Altis\Accelerate\Admin;
use Altis\Accelerate\Telemetry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

const NONCE_TRANSIENT_KEY = 'accelerate_connect_nonce';
const NONCE_EXPIRY = HOUR_IN_SECONDS;

// Valid AWS regions for config validation.
const VALID_REGIONS = [
	'us-east-1',
	'us-east-2',
	'us-west-1',
	'us-west-2',
	'eu-west-1',
	'eu-west-2',
	'eu-west-3',
	'eu-central-1',
	'eu-north-1',
	'ap-southeast-1',
	'ap-southeast-2',
	'ap-northeast-1',
	'ap-northeast-2',
	'ap-south-1',
	'sa-east-1',
];

/**
 * Bootstrap the connect module.
 *
 * @return void
 */
function bootstrap() : void {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_routes' );
}

/**
 * Register REST API routes.
 *
 * @return void
 */
function register_routes() : void {
	register_rest_route( 'accelerate/v1', '/connect', [
		'methods'  => WP_REST_Server::CREATABLE,
		'callback' => __NAMESPACE__ . '\\handle_connect',
		'permission_callback' => '__return_true', // Auth via one-time nonce, documented above.
		'args' => [
			'config' => [
				'type' => 'string',
				'required' => true,
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => __NAMESPACE__ . '\\validate_config_format',
			],
			'nonce' => [
				'type' => 'string',
				'required' => true,
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => __NAMESPACE__ . '\\validate_nonce_format',
			],
		],
	] );
}

/**
 * Validate config format matches expected pattern.
 *
 * WordPress REST API validate_callback signature: ($value, $request, $param)
 *
 * @param mixed           $value   The parameter value.
 * @param WP_REST_Request $request The request object.
 * @param string          $param   The parameter name.
 * @return bool|WP_Error True if valid, WP_Error otherwise.
 */
function validate_config_format( $value, $request, $param ) {
	// First check if it's a string.
	if ( ! is_string( $value ) ) {
		return new WP_Error(
			'rest_invalid_param',
			sprintf(
				/* translators: %s: parameter name */
				__( '%s must be a string.', 'altis-accelerate' ),
				$param
			),
			[ 'status' => 400 ]
		);
	}

	$parsed = explode( ':', $value, 3 );
	if ( count( $parsed ) !== 3 ) {
		return new WP_Error(
			'invalid_config_format',
			__( 'Config must be in format region:app_id:key', 'altis-accelerate' ),
			[ 'status' => 400 ]
		);
	}

	[ $region, $app_id, $key ] = $parsed;

	// Validate region.
	if ( ! in_array( $region, VALID_REGIONS, true ) ) {
		return new WP_Error(
			'invalid_region',
			__( 'Invalid region specified.', 'altis-accelerate' ),
			[ 'status' => 400 ]
		);
	}

	// Validate app_id is alphanumeric (with underscores/hyphens).
	if ( ! preg_match( '/^[a-zA-Z0-9_-]+$/', $app_id ) ) {
		return new WP_Error(
			'invalid_app_id',
			__( 'Invalid app ID format.', 'altis-accelerate' ),
			[ 'status' => 400 ]
		);
	}

	// Validate key is non-empty.
	if ( empty( $key ) ) {
		return new WP_Error(
			'invalid_key',
			__( 'Key cannot be empty.', 'altis-accelerate' ),
			[ 'status' => 400 ]
		);
	}

	return true;
}

/**
 * Validate nonce format.
 *
 * WordPress REST API validate_callback signature: ($value, $request, $param)
 *
 * @param mixed           $value   The parameter value.
 * @param WP_REST_Request $request The request object.
 * @param string          $param   The parameter name.
 * @return bool|WP_Error True if valid, WP_Error otherwise.
 */
function validate_nonce_format( $value, $request, $param ) {
	// First check if it's a string.
	if ( ! is_string( $value ) ) {
		return new WP_Error(
			'rest_invalid_param',
			sprintf(
				/* translators: %s: parameter name */
				__( '%s must be a string.', 'altis-accelerate' ),
				$param
			),
			[ 'status' => 400 ]
		);
	}

	// Nonce should be 32 alphanumeric characters.
	if ( ! preg_match( '/^[a-zA-Z0-9]{32}$/', $value ) ) {
		return new WP_Error(
			'invalid_nonce_format',
			__( 'Invalid nonce format.', 'altis-accelerate' ),
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
