<?php
/**
 * Bootstrap Altis Accelerate.
 */

namespace Altis\Accelerate;

use WP_Error;

/**
 * Bootstrap function to setup hooks / load plugins.
 *
 * @return void
 */
function bootstrap() : void {

	require_once __DIR__ . '/../plugins/asset-loader/asset-loader.php';

	$constants = [
		'ALTIS_DASHBOARD_OAUTH2_CLIENT_ID' => 'fcowf2sxofoa',
		// 'ALTIS_DASHBOARD_OAUTH2_CLIENT_ID' => '2vceivjn7mgh',
		'ALTIS_DASHBOARD_URL' => 'https://dashboard.altis-dxp.com',
		// 'ALTIS_DASHBOARD_URL' => 'https://dashboard.humansmadeus.com/',
	];
	foreach ( $constants as $constant => $default ) {
		if ( ! defined( $constant ) ) {
			define( $constant, getenv( $constant ) !== false ? getenv( $constant ) : $default );
		}
	}

	Admin\bootstrap();

	$config = get_config();

	if ( ! $config ) {
		return;
	}

	// Low level constants for Altis core.
	if ( ! defined( 'Altis\\ROOT_DIR' ) ) {
		define( 'Altis\\ROOT_DIR', PLUGIN_DIR );
		define( 'HM_ENV', parse_url( get_site_url(), PHP_URL_HOST ) );
		define( 'HM_ENV_ARCHITECTURE', 'accelerate' );
		define( 'HM_ENV_TYPE', 'accelerate' );
	}

	// Set constants.
	$constants = [
		'HM_ENV_REGION' => $config['region'],
		'ALTIS_ENVIRONMENT_TIER' => 'free',
		'ALTIS_FEATURE_TIER' => 'free',
		'ALTIS_SUPPORT_TIER' => 'default',
		'ALTIS_ACCELERATE_PINPOINT_ID' => $config['app_id'],
		'ALTIS_ACCELERATE_PINPOINT_REGION' => $config['region'],
		'ALTIS_ACCELERATE_PINPOINT_ENDPOINT' => 'https://eu.accelerate.altis.cloud/log',
		'ALTIS_CLICKHOUSE_USER' => sprintf( 'u_%s', $config['app_id'] ),
		'ALTIS_CLICKHOUSE_PASS' => $config['pass'],
		'ALTIS_CLICKHOUSE_HOST' => 'eu.db.accelerate.altis.cloud',
		'ALTIS_CLICKHOUSE_PORT' => '8443',
	];

	foreach ( $constants as $constant => $default ) {
		if ( ! defined( $constant ) ) {
			define( $constant, getenv( $constant ) !== false ? getenv( $constant ) : $default );
		}
	}

	// Configure features.
	configure_features();

	// Load libs.
	if ( ! function_exists( 'register_extended_post_type' ) ) {
		require_once __DIR__ . '/../lib/johnbillion/extended-cpts/extended-cpts.php';
	}

	// Load telemetry features, if not provided by Altis Cloud.
	if ( ! function_exists( '\\Altis\\Telemetry\\bootstrap' ) ) {
		require_once __DIR__ . '/telemetry/namespace.php';
		Telemetry\bootstrap();
	}

	// Conditionally load demo tools.
	if ( file_exists( __DIR__ . '/../plugins/analytics-demo-tools/plugin.php' ) ) {
		add_filter( 'altis.analytics_demo.destinations', function ( $destinations ) {
			unset( $destinations['es'] );
			return $destinations;
		} );
		require_once __DIR__ . '/../plugins/analytics-demo-tools/plugin.php';
	}

	Beta\bootstrap();
	Analytics\setup();
	API\setup();
	GlobalBlocks\bootstrap();
	AI\bootstrap();

	if ( Utils\is_feature_enabled( 'dashboard' ) ) {
		Dashboard\setup();
	}
	if ( Utils\is_feature_enabled( 'audiences' ) ) {
		Audiences\setup();
		Preview\setup();
	}
	if ( Utils\is_feature_enabled( 'experiments' ) ) {
		Experiments\setup();
	}
	if ( Utils\is_feature_enabled( 'blocks' ) ) {
		Blocks\setup();
	}
	if ( Utils\is_feature_enabled( 'broadcast' ) ) {
		Broadcast\setup();
	}
	if ( Utils\is_feature_enabled( 'export' ) ) {
		Export\setup();
	}

	add_filter( 'altis.telemetry.env_traits', __NAMESPACE__ . '\\extend_environment_traits' );

	add_action( 'altis.analytics.enqueue_scripts', __NAMESPACE__ . '\\override_analytics_js_url' );
}

/**
 * Get the config for the plugin.
 *
 * @return array|null
 */
function get_config() : ?array {
	if ( defined( 'WP_INSTALLING' ) && WP_INSTALLING ) {
		return null;
	}

	$config = get_option( 'altis_config', '' );
	if ( empty( $config ) ) {
		return null;
	}

	// Check for legacy API key and convert to new style.
	if ( strpos( $config, '{' ) === 0 ) {
		$config = json_decode( $config, ARRAY_A );
		$config = implode( ':', [
			$config['pinpoint']['region'],
			$config['pinpoint']['app_id'],
			hash( 'sha256',
				$config['elasticsearch']['access_key'] .
				$config['elasticsearch']['access_secret'] .
				$config['elasticsearch']['index_path']
			),
		] );
		update_option( 'altis_config', $config );
	}

	$config = explode( ':', $config, 3 );

	if ( count( $config ) !== 3 ) {
		return null;
	}

	return [
		'region' => $config[0],
		'app_id' => $config[1],
		'pass' => $config[2],
	];
}

/**
 * Configure default enabled features.
 *
 * @return void
 */
function configure_features() {
	add_filter( 'altis.analytics.feature.dashboard', '__return_true' );
	add_filter( 'altis.analytics.feature.audiences', '__return_true' );
	add_filter( 'altis.analytics.feature.experiments', '__return_true' );
	add_filter( 'altis.analytics.feature.blocks', '__return_true' );
	add_filter( 'altis.analytics.feature.export', '__return_true' );
}

/**
 * Use client library for tracking script.
 *
 * @return void
 */
function override_analytics_js_url() : void {
	if ( wp_get_environment_type() === 'local' ) {
		return;
	}

	$scripts = wp_scripts();
	$altis_analytics = $scripts->query( 'altis-accelerate-accelerate' );
	if ( ! $altis_analytics ) {
		return;
	}

	$altis_analytics->src = sprintf( 'https://eu.accelerate.altis.cloud/accelerate.%s.js', VERSION );
}

/**
 * Update the environment traits for the Accelerate plugin.
 *
 * @param array $traits List of environment specific traits.
 * @return array
 */
function extend_environment_traits( array $traits ) : array {
	$traits['plugin_version'] = VERSION;
	return $traits;
}

/**
 * Get the Altis Dashboard URL.
 *
 * @return string
 */
function get_altis_dashboard_url() : string {
	return ALTIS_DASHBOARD_URL;
}

/**
 * Get the URL to authorize with the Altis Dashboard.
 *
 * @return string
 */
function get_altis_dashboard_authorize_url() : string {
	$args = [
		'redirect_uri' => admin_url( 'admin.php?page=' . Admin\MENU_SLUG ),
		'site_name' => get_bloginfo( 'name' ),
	];

	if ( is_user_logged_in() ) {
		$args['name'] = wp_get_current_user()->display_name;
		$args['email'] = wp_get_current_user()->user_email;
	}
	return add_query_arg( $args, get_altis_dashboard_url() . '/wp-login.php?action=oauth2_authorize&response_type=code&client_id=' . get_altis_dashboard_oauth2_client_id() );
}

/**
 * Get the Altis Dashboard URL.
 *
 * @return string
 */
function get_altis_dashboard_oauth2_client_id() : string {
	return ALTIS_DASHBOARD_OAUTH2_CLIENT_ID;
}

/**
 * Set the Altis Dashboard Oauth2 Access token.
 *
 * @param string $access_token
 * @return void
 */
function set_altis_dashboard_access_token( string $access_token ) : void {
	update_option( 'altis_analytics_dashboard_access_token', $access_token );
}

/**
 * Delete the Altis Dashboard Oauth2 Access token.
 *
 * @return void
 */
function delete_altis_dashboard_access_token() : void {
	delete_option( 'altis_analytics_dashboard_access_token' );
}

/**
 * Get the Altis Dashboard Oauth2 Access token.
 *
 * @return string
 */
function get_altis_dashboard_access_token() : ?string {
	return get_option( 'altis_analytics_dashboard_access_token', null );
}

/**
 * Make a request to the Altis Dashboard API.
 *
 * @param string $path
 * @param string $method
 * @param array $args
 * @return WP_Error|mixed
 */
function altis_dashboard_remote_request( string $path, string $method = 'GET', array $args = [] ) {

	$url = get_altis_dashboard_url() . '/api' . $path;
	if ( ! get_altis_dashboard_access_token() ) {
		return new WP_Error( 'altis_analytics_dashboard_access_token_missing', __( 'Altis Dashboard access token is missing.', 'altis-analytics' ) );
	}

	$request_args = [
		'headers' => [
			'Authorization' => 'Bearer ' . get_altis_dashboard_access_token(),
			'Accept' => 'application/json',
			'Content-Type' => 'application/json',
		],
		'method' => $method,
		'sslverify' => false,
	];

	if ( $method === 'POST' ) {
		$request_args['body'] = wp_json_encode( $args );
	} else if ( $method === 'GET' && ! empty( $args ) ) {
		$url = add_query_arg( $args, $url );
	}

	$response = wp_remote_request( $url, $request_args );

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$body = json_decode( wp_remote_retrieve_body( $response ) );
	if ( wp_remote_retrieve_response_code( $response ) > 299 ) {
		if ( json_last_error() ) {
			return new WP_Error( 'json-decode-error', 'JSON decode error from response: ' . json_last_error_msg() );
		}
		return new WP_Error( 'error-response', $body->message );
	}

	return $body;
}
