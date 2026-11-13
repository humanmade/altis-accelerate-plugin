<?php
/**
 * Signed remote requests must not carry parameters outside the signature.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\API\Remote;
use WP_REST_Request;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/api/remote.php';

class RemoteSignatureTest extends WP_UnitTestCase {

	const SECRET = 'test-signing-secret';

	public function set_up() {
		parent::set_up();
		update_option( 'altis_config', 'local:test-app:' . self::SECRET );
	}

	public function tear_down() {
		delete_option( 'altis_config' );
		unset( $_SERVER['REQUEST_URI'] );
		parent::tear_down();
	}

	/**
	 * Build a correctly signed GET request.
	 *
	 * @return WP_REST_Request
	 */
	private function signed_get_request() : WP_REST_Request {
		$path = '/wp-json/accelerate/v1/remote/posts?ids[]=1';
		$timestamp = time();
		$_SERVER['REQUEST_URI'] = $path;

		$request = new WP_REST_Request( 'GET', '/accelerate/v1/remote/posts' );
		$request->set_header( 'X-Accelerate-Timestamp', (string) $timestamp );
		$request->set_header( 'X-Accelerate-Signature', 'sha256=' . hash_hmac( 'sha256', "{$timestamp}.GET.{$path}.", self::SECRET ) );

		return $request;
	}

	public function test_signed_get_request_is_accepted() {
		$this->assertTrue( Remote\verify_hmac_signature( $this->signed_get_request() ) );
	}

	public function test_signed_get_request_with_an_unsigned_body_is_rejected() {
		$request = $this->signed_get_request();
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( '{"ids":[2]}' );

		$result = Remote\verify_hmac_signature( $request );

		$this->assertWPError( $result );
		$this->assertSame( 'rest_forbidden', $result->get_error_code() );
	}
}
