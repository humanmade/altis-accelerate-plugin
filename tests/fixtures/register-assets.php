<?php
/**
 * Isolated Asset Loader and WordPress stubs for registration tests.
 */

namespace Asset_Loader {
	/**
	 * Record a registration and return the appropriate handle.
	 *
	 * @param string $api API used.
	 * @param string $manifest Manifest file.
	 * @param string $asset Asset name.
	 * @param array $options Registration options.
	 * @return array
	 */
	function record_asset( string $api, string $manifest, string $asset, array $options ) : array {
		$GLOBALS['asset_result']['calls'][] = [ $api, $manifest, $asset, $options ];
		return substr( $asset, -4 ) === '.css'
			? [ 'style' => $options['handle'] ]
			: [ 'script' => $options['handle'] ];
	}

	/**
	 * Simulate the legacy API, rejecting deprecated calls on a modern installation.
	 *
	 * @param string $manifest Manifest file.
	 * @param string $asset Asset name.
	 * @param array $options Registration options.
	 * @return array
	 */
	function register_asset( string $manifest, string $asset, array $options ) : array {
		if ( $GLOBALS['argv'][1] === 'manifest' ) {
			throw new \RuntimeException( 'The deprecated Asset Loader API was called.' );
		}
		return record_asset( 'legacy', $manifest, $asset, $options );
	}

	if ( $GLOBALS['argv'][1] === 'manifest' ) {
		/**
		 * Simulate the modern manifest API.
		 *
		 * @param string $manifest Manifest file.
		 * @param string $asset Asset name.
		 * @param array $options Registration options.
		 * @return array
		 */
		function register_manifest_asset( string $manifest, string $asset, array $options ) : array {
			return record_asset( 'manifest', $manifest, $asset, $options );
		}
	}
}

namespace Altis\Accelerate\Utils {
	/**
	 * Make fixture assets readable without generating build output.
	 *
	 * @param string $path File path.
	 * @return bool
	 */
	function is_readable( string $path ) : bool {
		return true;
	}

	/**
	 * Supply the manifest fixture.
	 *
	 * @param string $path File path.
	 * @return string
	 */
	function file_get_contents( string $path ) : string {
		$manifest = [ 'dashboard.css' => 'dashboard.css', 'dashboard.js' => 'dashboard.js' ];
		if ( $GLOBALS['argv'][4] !== 'absent' ) {
			$manifest['runtime.js'] = 'runtime.js';
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- WordPress is deliberately not loaded in this fixture.
		return json_encode( $manifest );
	}
}

namespace {
	/**
	 * Return the request context.
	 *
	 * @return bool
	 */
	function is_admin() : bool {
		return (bool) $GLOBALS['argv'][2];
	}

	/**
	 * Return the existing runtime registration state.
	 *
	 * @param string $handle Script handle.
	 * @param string $status Registration state.
	 * @return bool
	 */
	function wp_script_is( string $handle, string $status ) : bool {
		return $GLOBALS['argv'][4] === 'registered';
	}

	/**
	 * Record script enqueues.
	 *
	 * @param string $handle Script handle.
	 */
	function wp_enqueue_script( string $handle ) : void {
		$GLOBALS['asset_result']['scripts'][] = $handle;
	}

	/**
	 * Record style enqueues.
	 *
	 * @param string $handle Style handle.
	 */
	function wp_enqueue_style( string $handle ) : void {
		$GLOBALS['asset_result']['styles'][] = $handle;
	}

	require dirname( __DIR__, 2 ) . '/inc/utils/namespace.php';
	$GLOBALS['asset_result'] = [ 'calls' => [], 'scripts' => [], 'styles' => [] ];
	$GLOBALS['asset_result']['handles'] = \Altis\Accelerate\Utils\register_assets(
		'dashboard',
		[ 'dependencies' => [ 'wp-element' ] ],
		(bool) $argv[3]
	);
	// phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- WordPress is deliberately not loaded in this fixture.
	echo json_encode( $GLOBALS['asset_result'] );
}
