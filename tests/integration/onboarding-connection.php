<?php
/**
 * Connection regression checks against a disposable, local WordPress installation.
 * Run: wp eval-file wp-content/plugins/altis-accelerate/tests/integration/onboarding-connection.php
 * HTTP is intercepted and original options are restored. No provisioning or telemetry is sent.
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI || wp_get_environment_type() !== 'local' ) {
	throw new RuntimeException( 'Run only with WP-CLI in a disposable local environment.' );
}

$keys = [ 'altis_config', 'accelerate_dashboard_site_id', 'altis_analytics_dashboard_access_token', 'accelerate_site_connected_at', 'accelerate_connection_acknowledged' ];
$original = [];
foreach ( $keys as $key ) {
	$original[ $key ] = get_option( $key, null );
}
$user_id = get_current_user_id();
wp_set_current_user( get_users( [ 'role' => 'administrator', 'number' => 1 ] )[0]->ID );
$mode = 'success';
$created = 0;
$acknowledged = 0;
$assert = function ( $condition, string $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
	WP_CLI::log( 'PASS: ' . $message );
};
$mock = function ( $response, $args, $url ) use ( &$mode, &$created, &$acknowledged ) {
	$reply = function ( $body, $status = 200 ) {
		return [ 'response' => [ 'code' => $status ], 'body' => wp_json_encode( $body ), 'headers' => [] ];
	};
	if ( strpos( $url, '/oauth2/access_token' ) !== false ) {
		if ( $mode === 'network' ) {
			return new WP_Error( 'network', 'Simulated transport failure' );
		}
		return $reply( $mode === 'missing_token' ? [] : [ 'access_token' => 'local-test-token' ] );
	}
	if ( strpos( $url, '/accelerate/sites' ) !== false ) {
		if ( $args['method'] === 'POST' && substr( $url, -3 ) === '/42' ) {
			$acknowledged++;
			return $reply( [ 'account_connection' => 'connected' ] );
		}
		if ( $args['method'] === 'POST' ) {
			$created++;
			return $reply( [ 'id' => 42, 'status' => 'failed', 'plugin_config' => '' ] );
		}
		if ( $mode === 'invalid_sites' ) {
			return $reply( [ 'unexpected' => true ] );
		}
		return $reply( [ [ 'id' => 41, 'url' => 'https://unrelated.example', 'status' => 'created' ], [
			'id' => 42,
			'url' => home_url() . '/',
			'status' => $mode === 'failed_site' ? 'failed' : 'created',
			'plugin_config' => 'eu-central-1:local-fixture:local-only',
		] ] );
	}
	return new WP_Error( 'blocked', 'All unrelated network traffic is blocked by this test.' );
};
add_filter( 'pre_http_request', $mock, 0, 3 );
try {
	parse_str( wp_parse_url( Altis\Accelerate\get_accelerate_dashboard_authorize_url(), PHP_URL_QUERY ), $query );
	parse_str( wp_parse_url( $query['redirect_uri'], PHP_URL_QUERY ), $callback );
	$assert( ! isset( $query['name'] ) && ! isset( $query['email'] ), 'Authorization URL does not prefill WordPress user identity' );
	$assert( (bool) wp_verify_nonce( $callback['_accelerate_nonce'], 'accelerate_connect' ), 'Callback carries an admin-bound nonce' );

	foreach ( [ 'network', 'missing_token', 'invalid_sites', 'failed_site' ] as $failure ) {
		$mode = $failure;
		update_option( 'altis_analytics_dashboard_access_token', 'existing-test-token' );
		update_option( 'altis_config', 'eu-central-1:existing-test:existing-secret' );
		$result = Altis\Accelerate\Admin\complete_site_connection( 'local-test-code' );
		$assert( is_wp_error( $result ), $failure . ' does not report connection success' );
		$assert( get_option( 'altis_analytics_dashboard_access_token' ) === 'existing-test-token' && get_option( 'altis_config' ) === 'eu-central-1:existing-test:existing-secret', $failure . ' preserves the existing connection' );
	}

	$mode = 'success';
	$created = 0;
	$result = Altis\Accelerate\Admin\complete_site_connection( 'local-test-code' );
	$assert( $result === true, 'Confirmed site completes connection' );
	$assert( (int) get_option( 'accelerate_dashboard_site_id' ) === 42, 'Matching site is found even after a non-matching first item' );
	$assert( $created === 0, 'Retry reuses the matching site without creating a duplicate' );
	$assert( get_option( 'altis_analytics_dashboard_access_token' ) === 'local-test-token', 'Token is persisted after successful provisioning' );
	$assert( $acknowledged === 1 && (bool) get_option( 'accelerate_connection_acknowledged' ), 'Persisted connection is acknowledged separately from heartbeat' );
} finally {
	remove_filter( 'pre_http_request', $mock, 0 );
	foreach ( $original as $key => $value ) {
		if ( $value === null ) {
			delete_option( $key );
		} else {
			update_option( $key, $value );
		}
	}
	wp_set_current_user( $user_id );
}
