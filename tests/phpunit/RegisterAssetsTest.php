<?php
/**
 * Asset Loader API compatibility tests.
 */

namespace Altis\Accelerate;

use PHPUnit\Framework\TestCase;

class RegisterAssetsTest extends TestCase {

	/**
	 * Exercise both APIs in a fresh PHP process, since functions cannot be unloaded.
	 *
	 * @dataProvider asset_loader_cases
	 * @param string $api Available Asset Loader API.
	 * @param bool $admin Whether this is an admin request.
	 * @param bool $enqueue Whether to enqueue the registered assets.
	 * @param string $runtime Runtime chunk state.
	 */
	public function test_register_assets( string $api, bool $admin, bool $enqueue, string $runtime ) : void {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.system_calls_proc_open -- Function availability must be isolated from the WordPress bootstrap.
		$process = proc_open(
			escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( __DIR__ . '/../fixtures/register-assets.php' ) . ' ' . escapeshellarg( $api ) . ' ' . (int) $admin . ' ' . (int) $enqueue . ' ' . escapeshellarg( $runtime ),
			[ 1 => [ 'pipe', 'w' ], 2 => [ 'pipe', 'w' ] ],
			$pipes
		);
		$this->assertIsResource( $process );
		$output = stream_get_contents( $pipes[1] );
		$error = stream_get_contents( $pipes[2] );
		fclose( $pipes[1] );
		fclose( $pipes[2] );
		$this->assertSame( 0, proc_close( $process ), $error );
		$result = json_decode( $output, true );
		$this->assertIsArray( $result, $output );
		$manifest = dirname( __DIR__, 2 ) . '/build/development-asset-manifest.json';
		$dependencies = [ 'wp-element' ];
		$calls = [
			[ $api, $manifest, 'dashboard.css', [
				'handle' => 'altis-accelerate-dashboard',
				'dependencies' => $admin ? [ 'common', 'wp-components' ] : [],
			] ],
		];
		if ( $api === 'legacy' && $runtime !== 'absent' ) {
			if ( $runtime !== 'registered' ) {
				$calls[] = [ $api, $manifest, 'runtime.js', [ 'handle' => 'altis-accelerate-webpack-runtime' ] ];
			}
			$dependencies[] = 'altis-accelerate-webpack-runtime';
		}
		$calls[] = [ $api, $manifest, 'dashboard.js', [
			'handle' => 'altis-accelerate-dashboard',
			'dependencies' => $dependencies,
		] ];
		$this->assertSame( $calls, $result['calls'] );
		$this->assertSame( [ 'style' => 'altis-accelerate-dashboard', 'script' => 'altis-accelerate-dashboard' ], $result['handles'] );
		$this->assertSame( $enqueue ? [ 'altis-accelerate-dashboard' ] : [], $result['scripts'] );
		$this->assertSame( $enqueue ? [ 'altis-accelerate-dashboard' ] : [], $result['styles'] );
	}

	/**
	 * Provide API, request context, enqueue, and runtime combinations.
	 *
	 * @return array
	 */
	public static function asset_loader_cases() : array {
		$cases = [];
		foreach ( [ 'manifest', 'legacy' ] as $api ) {
			foreach ( [ true, false ] as $admin ) {
				foreach ( [ true, false ] as $enqueue ) {
					foreach ( [ 'absent', 'present', 'registered' ] as $runtime ) {
						$name = $api . '-' . ( $admin ? 'admin' : 'frontend' ) . '-' . ( $enqueue ? 'enqueue' : 'register' ) . '-' . $runtime;
						$cases[ $name ] = [ $api, $admin, $enqueue, $runtime ];
					}
				}
			}
		}
		return $cases;
	}
}
