<?php
/**
 * Beta Testing Opt in for Altis Accelerate.
 */

namespace Altis\Accelerate\Beta;

/**
 * Set up beta release opt-in functionality.
 *
 * @return void
 */
function bootstrap() {
	if ( ! defined( 'ALTIS_BETA_TESTER_EXPIRATION' ) ) {
		define( 'ALTIS_BETA_TESTER_EXPIRATION', 60 * 60 * 24 );
	}

	// Add toggle for beta release opt in.
	add_filter( 'plugin_row_meta', __NAMESPACE__ . '\\meta_filter', 10, 3 );

	// Hijack the upgrades response from wordpress.org.
	add_filter( 'http_response', __NAMESPACE__ . '\\http_filter', 10, 3 );

	// Handle the beta optin / out links.
	add_action( 'admin_init', __NAMESPACE__ . '\\handle_optin' );
}

/**
 * Handle updating the list of beta optins.
 *
 * @return void
 */
function handle_optin() : void {
	if ( ! isset( $_GET['action'] ) || $_GET['action'] !== 'plugin_beta' ) {
		return;
	}

	if ( ! check_admin_referer( 'plugin_beta', 'nonce' ) ) {
		return;
	}

	if ( ! isset( $_GET['slug'] ) ) {
		return;
	}

	$slug = sanitize_key( $_GET['slug'] );
	$optin = isset( $_GET['optin'] );

	$plugins = (array) get_option( 'altis_beta_plugins', [] );
	$plugins[ $slug ] = $optin;

	update_option( 'altis_beta_plugins', $plugins );

	reset_transient();

	wp_safe_redirect( admin_url( 'plugins.php' ) );
	exit;
}

/**
 * Force a refresh of the plugin updates status.
 *
 * @return void
 */
function reset_transient() : void {
	delete_site_transient( 'update_plugins' );
}

/**
 * Modify responses from plugin update check to allow preview releases.
 *
 * @param array $response HTTP response object.
 * @param array $parsed_args Args passed to response.
 * @param string $url Requested URL.
 * @return array
 */
function http_filter( $response, $parsed_args, $url ) {
	if ( $url !== 'https://api.wordpress.org/plugins/update-check/1.1/' ) {
		return $response;
	}

	$wpapi_response = json_decode( $response['body'] );
	$override = (object) upgradable();
	$wpapi_response->plugins = $override;
	$response['body'] = wp_json_encode( $wpapi_response );

	return $response;
}

/**
 * Get plugin IDs eligible for beta updates.
 *
 * Note: these must be the slugs used on wordpress.org
 *
 * @return array
 */
function get_eligible_plugins() : array {
	/**
	 * Filter plugins eligible for beta releases.
	 *
	 * @param array $plugins Slugs of plugins opted in to beta releases.
	 */
	return (array) apply_filters( 'altis.beta_eligible_plugins', [
		'altis-accelerate',
	] );
}

/**
 * Check plugin is opted in to beta releases.
 *
 * @param string $slug The plugin slug.
 * @return boolean
 */
function is_using_beta( string $slug ) : bool {
	$plugins = (array) get_option( 'altis_beta_plugins', [] );
	return isset( $plugins[ $slug ] ) && (bool) $plugins[ $slug ];
}

/**
 * Get modified plugins data depending on beta opt-in status.
 *
 * @return array
 */
function upgradable() : array {
	$plugins = get_plugins();
	$upgrades = [];

	foreach ( $plugins as $file => $plugin ) {
		$slug = get_plugin_slug( $plugin, $file );
		if ( ! is_using_beta( $slug ) ) {
			continue;
		}

		$versions = versions( $slug );
		if ( $versions && version_compare( $versions->latest, $plugin['Version'] ) ) {
			$upgrades[ $file ] = new \stdClass;
			$upgrades[ $file ]->slug = $slug;
			$upgrades[ $file ]->stable_version = $versions->stable;
			$upgrades[ $file ]->new_version = $versions->latest;
			$upgrades[ $file ]->url = "http://wordpress.org/extend/plugins/{$slug}/";
			$upgrades[ $file ]->package = "http://downloads.wordpress.org/plugin/{$slug}.{$versions->latest}.zip";
			if ( version_compare( $versions->latest, $upgrades[ $file ]->stable_version ) ) {
				$upgrades[ $file ]->upgrade_notice = " <strong>" . __( 'This is a preview release.', 'altis' ) . "</strong>";
			}
		}
	}

	return $upgrades;
}

/**
 * Enhanced version comparison function.
 *
 * @param string $a Version string.
 * @param string $b Version string to compare against $a.
 * @return int|bool
 */
function version_compare( $a, $b ) {
	// Remove unnecessary whitespace and lowercase all the things.
	$a = trim( preg_replace( [ '!(\d)\s(\D)!', '!(\D)\s(\d)!' ], '\1\2', strtolower( $a ) ) );
	$b = trim( preg_replace( [ '!(\d)\s(\D)!', '!(\D)\s(\d)!' ], '\1\2', strtolower( $b ) ) );

	return \version_compare( $a, $b, '>' );
}

/**
 * Add beta opt-in/out links.
 *
 * @param array $plugin_meta The plugin page links.
 * @param string $plugin_file The plugin file name.
 * @param array $plugin_data The plugin header data.
 * @return array
 */
function meta_filter( $plugin_meta, $plugin_file, $plugin_data ) {
	$eligible_plugins = get_eligible_plugins();
	$slug = get_plugin_slug( $plugin_data, $plugin_file );
	if ( ! in_array( $slug, $eligible_plugins, true ) ) {
		return $plugin_meta;
	}

	$args = [
		'action' => 'plugin_beta',
		'slug' => $slug,
		'nonce' => wp_create_nonce( 'plugin_beta' ),
		'optin' => true,
	];

	$link = add_query_arg( $args, admin_url( 'plugins.php' ) );

	if ( ! is_using_beta( $slug ) ) {
		$plugin_meta[] = sprintf(
			'<a href="%s">%s</a>',
			$link,
			__( 'Switch to preview release channel', 'altis' )
		);
	} else {
		if ( preg_match( '/alpha|beta|rc/', $plugin_data['Version'] ) ) {
			array_unshift( $plugin_meta, sprintf( '<strong>%s</strong>',  __( '⚡️ Preview', 'altis' ) ) );
		}
		$plugin_meta[] = sprintf(
			' <a href="%s">%s</a>',
			add_query_arg( [ 'optin' => false ], $link ),
			__( 'Switch to stable release channel', 'altis' )
		);
	}

	return $plugin_meta;
}

/**
 * Get plugin versions.
 *
 * @param string $slug Plugin slug.
 * @return null|object
 */
function versions( $slug ) {
	if ( $versions_info = get_site_transient( 'altis_bt_' . md5( $slug ) ) ) {
		return $versions_info;
	}

	include_once ABSPATH . 'wp-admin/includes/plugin-install.php'; // for plugins_api.

	$api = plugins_api( 'plugin_information', [
		'slug' => $slug,
		'fields' => [ 'versions' => true ],
	] );

	if ( is_object( $api ) && isset( $api->versions ) && is_array( $api->versions ) && count( $api->versions ) ) {
		$versions = $api->versions;
		unset( $versions['trunk'] );
		$versions = array_keys( $versions );

		usort( $versions, 'version_compare' );
		$versions = array_reverse( $versions );

		$versions_info = (object) [
			'latest' => $versions[0],
			'stable' => $api->version,
		];

		set_site_transient( 'altis_bt_' . md5( $slug ), $versions_info, ALTIS_BETA_TESTER_EXPIRATION );

		return $versions_info;
	}

	return null;
}

/**
 * Try to find the true plugin slug.
 *
 * @param array $plugin Plugin data array from comment header.
 * @param string $file Plugin file name relative to plugins directory.
 * @return string|null
 */
function get_plugin_slug( array $plugin, string $file = '' ) : ?string {
	if ( ! empty( $plugin['UpdateURI'] ) ) {
		return basename( $plugin['UpdateURI'] );
	}

	if ( ! empty( $plugin['PluginURI'] ) && strpos( $plugin['PluginURI'], 'https://wordpress.org' ) === 0 ) {
		return basename( $plugin['PluginURI'] );
	}

	if ( ! empty( $file ) ) {
		$parts = explode( '/', $file );
		return basename( $parts[0], '.php' );
	}

	return null;
}
