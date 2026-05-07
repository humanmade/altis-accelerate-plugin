<?php
/**
 * Tests for the variant helper functions in inc/abilities/variants.php.
 *
 * @package Altis\Accelerate\Tests
 */

namespace Altis\Accelerate\Tests;

use Altis\Accelerate\Abilities\Variants;
use WP_UnitTestCase;

class VariantHelpersTest extends WP_UnitTestCase {

	/**
	 * Test wp_block post ID for use across tests.
	 *
	 * @var int
	 */
	protected $block_id;

	public function set_up() {
		parent::set_up();

		// Create a synced pattern with two altis/variant blocks.
		$this->block_id = self::factory()->post->create( [
			'post_title'   => 'Test Block',
			'post_type'    => 'wp_block',
			'post_content' => implode( "\n", [
				'<!-- wp:altis/variant {"title":"Control"} -->',
				'<!-- wp:paragraph --><p>Control content</p><!-- /wp:paragraph -->',
				'<!-- /wp:altis/variant -->',
				'<!-- wp:altis/variant {"title":"Variant B","percentage":50} -->',
				'<!-- wp:heading --><h2>Heading B</h2><!-- /wp:heading -->',
				'<!-- /wp:altis/variant -->',
			] ),
		] );
	}

	// -- validate_block_post() --

	public function test_validate_block_post_returns_post_for_valid_block() {
		$result = Variants\validate_block_post( $this->block_id );
		$this->assertInstanceOf( 'WP_Post', $result );
		$this->assertEquals( 'wp_block', $result->post_type );
	}

	public function test_validate_block_post_rejects_zero_id() {
		$result = Variants\validate_block_post( 0 );
		$this->assertWPError( $result );
		$this->assertEquals( 'missing_block_id', $result->get_error_code() );
	}

	public function test_validate_block_post_rejects_non_block_post() {
		$page_id = self::factory()->post->create( [ 'post_type' => 'page' ] );
		$result = Variants\validate_block_post( $page_id );
		$this->assertWPError( $result );
		$this->assertEquals( 'invalid_block', $result->get_error_code() );
	}

	public function test_validate_block_post_rejects_nonexistent_id() {
		$result = Variants\validate_block_post( 999999 );
		$this->assertWPError( $result );
	}

	// -- get_variant_blocks() --

	public function test_get_variant_blocks_returns_variants() {
		$variants = Variants\get_variant_blocks( $this->block_id );
		$this->assertCount( 2, $variants );
		$this->assertEquals( 'altis/variant', $variants[0]['blockName'] );
		$this->assertEquals( 'altis/variant', $variants[1]['blockName'] );
	}

	public function test_get_variant_blocks_preserves_attributes() {
		$variants = Variants\get_variant_blocks( $this->block_id );
		$this->assertEquals( 'Control', $variants[0]['attrs']['title'] );
		$this->assertEquals( 'Variant B', $variants[1]['attrs']['title'] );
		$this->assertEquals( 50, $variants[1]['attrs']['percentage'] );
	}

	public function test_get_variant_blocks_has_inner_blocks() {
		$variants = Variants\get_variant_blocks( $this->block_id );
		$this->assertNotEmpty( $variants[0]['innerBlocks'] );
		$this->assertEquals( 'core/paragraph', $variants[0]['innerBlocks'][0]['blockName'] );
		$this->assertEquals( 'core/heading', $variants[1]['innerBlocks'][0]['blockName'] );
	}

	public function test_get_variant_blocks_returns_empty_for_standard_block() {
		$standard_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => '<!-- wp:paragraph --><p>Just a paragraph</p><!-- /wp:paragraph -->',
		] );
		$variants = Variants\get_variant_blocks( $standard_id );
		$this->assertEmpty( $variants );
	}

	public function test_get_variant_blocks_reindexes_from_zero() {
		$variants = Variants\get_variant_blocks( $this->block_id );
		$this->assertArrayHasKey( 0, $variants );
		$this->assertArrayHasKey( 1, $variants );
	}

	// -- build_variant_block() --

	public function test_build_variant_block_with_block_markup() {
		$block = Variants\build_variant_block(
			'<!-- wp:heading --><h2>Hello</h2><!-- /wp:heading -->',
			[ 'title' => 'Test Variant' ]
		);
		$this->assertEquals( 'altis/variant', $block['blockName'] );
		$this->assertEquals( 'Test Variant', $block['attrs']['title'] );
		$this->assertNotEmpty( $block['innerBlocks'] );
		$this->assertEquals( 'core/heading', $block['innerBlocks'][0]['blockName'] );
	}

	public function test_build_variant_block_wraps_plain_text() {
		$block = Variants\build_variant_block( 'Just plain text' );
		$this->assertEquals( 'altis/variant', $block['blockName'] );
		$this->assertNotEmpty( $block['innerBlocks'] );
		$this->assertEquals( 'core/paragraph', $block['innerBlocks'][0]['blockName'] );
	}

	public function test_build_variant_block_escapes_html_in_plain_text() {
		$block = Variants\build_variant_block( '<script>alert("xss")</script>' );
		$serialized = serialize_blocks( [ $block ] );
		$this->assertStringNotContainsString( '<script>', $serialized );
	}

	public function test_build_variant_block_with_all_attributes() {
		$block = Variants\build_variant_block( 'Content', [
			'title'      => 'My Variant',
			'percentage' => 30,
			'audience'   => 42,
			'fallback'   => true,
		] );
		$this->assertEquals( 'My Variant', $block['attrs']['title'] );
		$this->assertEquals( 30, $block['attrs']['percentage'] );
		$this->assertEquals( 42, $block['attrs']['audience'] );
		$this->assertTrue( $block['attrs']['fallback'] );
	}

	public function test_build_variant_block_omits_empty_attributes() {
		$block = Variants\build_variant_block( 'Content', [] );
		$this->assertArrayNotHasKey( 'title', $block['attrs'] );
		$this->assertArrayNotHasKey( 'audience', $block['attrs'] );
	}

	public function test_build_variant_block_with_multiple_blocks() {
		$markup = implode( "\n", [
			'<!-- wp:heading --><h2>Title</h2><!-- /wp:heading -->',
			'<!-- wp:paragraph --><p>Body text</p><!-- /wp:paragraph -->',
			'<!-- wp:image {"id":123} --><figure class="wp-block-image"><img src="test.jpg" alt=""/></figure><!-- /wp:image -->',
		] );
		$block = Variants\build_variant_block( $markup, [ 'title' => 'Rich Variant' ] );
		// Filter out empty/null blockName entries from parser.
		$named_blocks = array_filter( $block['innerBlocks'], function ( $b ) {
			return ! empty( $b['blockName'] );
		} );
		$this->assertGreaterThanOrEqual( 3, count( $named_blocks ) );
	}

	// -- save_variant_blocks() --

	public function test_save_variant_blocks_updates_post_content() {
		$new_variant = Variants\build_variant_block( 'New content', [ 'title' => 'New' ] );
		$variants = Variants\get_variant_blocks( $this->block_id );
		$variants[] = $new_variant;

		$result = Variants\save_variant_blocks( $this->block_id, $variants );
		$this->assertTrue( $result );

		// Re-read and verify.
		$updated = Variants\get_variant_blocks( $this->block_id );
		$this->assertCount( 3, $updated );
		$this->assertEquals( 'New', $updated[2]['attrs']['title'] );
	}

	public function test_save_variant_blocks_roundtrips_correctly() {
		$variants = Variants\get_variant_blocks( $this->block_id );
		$result = Variants\save_variant_blocks( $this->block_id, $variants );
		$this->assertTrue( $result );

		$reloaded = Variants\get_variant_blocks( $this->block_id );
		$this->assertCount( 2, $reloaded );
		$this->assertEquals( 'Control', $reloaded[0]['attrs']['title'] );
		$this->assertEquals( 'Variant B', $reloaded[1]['attrs']['title'] );
	}
}
