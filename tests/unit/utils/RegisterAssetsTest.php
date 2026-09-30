<?php

namespace Altis\Tests\Unit\Utils;

use Altis\Accelerate\Utils;
use Altis\Tests\Unit\TestCase;
use Brain\Monkey\Functions;

/**
 * Asset registration must support both bundled and newer Asset Loader versions.
 */
class RegisterAssetsTest extends TestCase {

	/**
	 * Registration spy shared with the isolated Asset Loader fixtures.
	 *
	 * @var \Mockery\MockInterface
	 */
	public static $asset_loader;

	/**
	 * Verify API selection, handles, dependencies, and optional enqueuing.
	 *
	 * @dataProvider asset_loader_versions
	 * @param bool $modern Whether the manifest API is available.
	 * @param bool $admin Whether assets are registered in the admin.
	 * @param bool $enqueue Whether assets should also be enqueued.
	 * @return void
	 */
	public function test_register_assets( bool $modern, bool $admin, bool $enqueue ) : void {
		$manifest_path = dirname( __DIR__, 3 ) . '/build/asset-manifest.json';
		self::$asset_loader = \Mockery::mock();
		require __DIR__ . '/../../fixtures/asset-loader-legacy.php';
		if ( $modern ) {
			require __DIR__ . '/../../fixtures/asset-loader-manifest.php';
		}
		$register_asset = $modern ? 'manifest' : 'legacy';

		Functions\when( 'Altis\\Accelerate\\Utils\\is_readable' )->justReturn( true );
		Functions\when( 'Altis\\Accelerate\\Utils\\file_get_contents' )->justReturn(
			'{"dashboard.css":"dashboard.css","dashboard.js":"dashboard.js"}'
		);
		Functions\when( 'is_admin' )->justReturn( $admin );

		if ( $modern ) {
			// A newer loader must never receive calls to its deprecated wrapper.
			self::$asset_loader->shouldReceive( 'legacy' )->never();
		}

		self::$asset_loader->shouldReceive( $register_asset )
			->once()
			->with(
				$manifest_path,
				'dashboard.css',
				[
					'handle' => 'altis-accelerate-dashboard',
					'dependencies' => $admin ? [ 'common', 'wp-components' ] : [],
				]
			)
			->andReturn( [ 'style' => 'dashboard-style' ] );

		self::$asset_loader->shouldReceive( $register_asset )
			->once()
			->with(
				$manifest_path,
				'dashboard.js',
				[
					'handle' => 'custom-dashboard-script',
					'dependencies' => [ 'wp-element' ],
				]
			)
			->andReturn( [ 'script' => 'dashboard-script' ] );

		if ( $enqueue ) {
			Functions\expect( 'wp_enqueue_script' )->once()->with( 'dashboard-script' );
			Functions\expect( 'wp_enqueue_style' )->once()->with( 'wp-components' );
			Functions\expect( 'wp_enqueue_style' )->once()->with( 'dashboard-style' );
		} else {
			Functions\expect( 'wp_enqueue_script' )->never();
			Functions\expect( 'wp_enqueue_style' )->never();
		}

		$this->assertSame(
			[ 'style' => 'dashboard-style', 'script' => 'dashboard-script' ],
			Utils\register_assets(
				'dashboard',
				[
					'handle' => 'custom-dashboard-script',
					'dependencies' => [ 'wp-element' ],
				],
				$enqueue
			)
		);
	}

	/**
	 * Exercise both API versions in admin and frontend contexts.
	 *
	 * @return array
	 */
	public function asset_loader_versions() : array {
		return [
			'manifest API, admin, enqueue' => [ true, true, true ],
			'manifest API, frontend, register only' => [ true, false, false ],
			'legacy API, admin, enqueue' => [ false, true, true ],
			'legacy API, frontend, register only' => [ false, false, false ],
		];
	}
}
