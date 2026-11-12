<?php
/**
 * Block preview thumbnail requests must carry the key for their block.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Dashboard;
use WP_UnitTestCase;

class BlockThumbnailKeyTest extends WP_UnitTestCase {

	public function test_only_the_key_for_the_block_is_accepted() {
		$key = Dashboard\get_block_thumbnail_request_hmac( 123 );

		$this->assertTrue( Dashboard\is_valid_block_thumbnail_key( 123, $key ) );
		$this->assertFalse( Dashboard\is_valid_block_thumbnail_key( 124, $key ), 'A key for another block is rejected.' );
		$this->assertFalse( Dashboard\is_valid_block_thumbnail_key( 123, 'wrong' ) );
		$this->assertFalse( Dashboard\is_valid_block_thumbnail_key( 123, '' ) );
		$this->assertFalse( Dashboard\is_valid_block_thumbnail_key( 123, null ), 'A request with no key is rejected.' );
	}
}
