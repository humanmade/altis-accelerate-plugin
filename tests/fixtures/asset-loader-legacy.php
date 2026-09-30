<?php

namespace Asset_Loader;

use Altis\Tests\Unit\Utils\RegisterAssetsTest;

/**
 * Stand in for Asset Loader before the manifest API was introduced.
 *
 * @param string $manifest Manifest path.
 * @param string $asset Asset name.
 * @param array $options Registration options.
 * @return array
 */
function register_asset( string $manifest, string $asset, array $options ) : array {
	return RegisterAssetsTest::$asset_loader->legacy( $manifest, $asset, $options );
}
