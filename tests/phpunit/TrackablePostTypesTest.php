<?php
/**
 * Tests for Dashboard\get_trackable_post_types() — #682.
 *
 * The Analytics submenu surface localizes `post_types` from this helper so the
 * shared breakdown components can resolve content links. Pins the shape (the
 * keys the frontend reads) and the `wp_block`-first ordering.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Dashboard;
use WP_UnitTestCase;

class TrackablePostTypesTest extends WP_UnitTestCase {

	public function test_returns_shaped_entries() {
		$types = Dashboard\get_trackable_post_types();
		$this->assertIsArray( $types );
		$this->assertNotEmpty( $types );
		foreach ( $types as $type ) {
			$this->assertArrayHasKey( 'name', $type );
			$this->assertArrayHasKey( 'label', $type );
			$this->assertArrayHasKey( 'singular_label', $type );
		}
		$names = array_column( $types, 'name' );
		$this->assertContains( 'post', $names );
		$this->assertContains( 'page', $names );
	}

	public function test_is_a_sequential_list() {
		// array_values() output — must be a JSON array, not an object, once
		// localized. A gap in the keys would serialize as an object.
		$types = Dashboard\get_trackable_post_types();
		$this->assertSame( range( 0, count( $types ) - 1 ), array_keys( $types ) );
	}

	public function test_wp_block_is_first_when_registered() {
		if ( ! post_type_exists( 'wp_block' ) ) {
			$this->markTestSkipped( 'wp_block not registered in this test build' );
		}
		$types = Dashboard\get_trackable_post_types();
		$this->assertSame( 'wp_block', $types[0]['name'] );
	}
}
