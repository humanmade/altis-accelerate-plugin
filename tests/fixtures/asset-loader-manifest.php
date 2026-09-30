<?php

namespace Asset_Loader;

use Altis\Tests\Unit\Utils\RegisterAssetsTest;

/**
 * Stand in for Asset Loader with the modern manifest API available.
 *
 * @param string $manifest Manifest path.
 * @param string $asset Asset name.
 * @param array $options Registration options.
 * @return array
 */
function register_manifest_asset( string $manifest, string $asset, array $options ) : array {
	return RegisterAssetsTest::$asset_loader->manifest( $manifest, $asset, $options );
}
