<?php
/**
 * Tests that ACF block markup survives Accelerate variant workflows.
 *
 * @package Altis\Accelerate\Tests
 */

namespace Altis\Accelerate\Tests;

use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Abilities\Variants;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\GlobalBlocks;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/integrations/acf/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';

class ACFBlockPreservationTest extends WP_UnitTestCase {

	public function set_up() : void {
		parent::set_up();

		$admin_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		wp_set_current_user( $admin_id );
		Experiments\flush_experiment_resolver_cache();
	}

	public function tear_down() : void {
		global $wpdb;

		$table = $wpdb->prefix . 'accelerate_experiments';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		wp_set_current_user( 0 );
		Experiments\flush_experiment_resolver_cache();

		parent::tear_down();
	}

	/**
	 * ACF and block-binding fixtures.
	 *
	 * @return array Fixture list.
	 */
	public static function content_provider() : array {
		return [
			'acf v2 with mode' => [
				implode( "\n", [
					'<!-- wp:acf/testimonial {"name":"acf/testimonial","data":{"heading":"Buy now","_heading":"field_abc123","button_url":"https://example.com/x?a=1&b=2","_button_url":"field_def456"},"mode":"preview","align":"wide","anchor":"cta-1","className":"is-style-x"} /-->',
				] ),
			],
			'acf v3 without mode' => [
				implode( "\n", [
					'<!-- wp:acf/feature-card {"name":"acf/feature-card","data":{"heading":"No mode","_heading":"field_abc123","summary":"Stored as block data","_summary":"field_def456"},"align":"full"} /-->',
				] ),
			],
			'acf with innerblocks' => [
				implode( "\n", [
					'<!-- wp:acf/container {"name":"acf/container","data":{"heading":"Wrapped","_heading":"field_abc123"},"mode":"preview"} -->',
					'<!-- wp:paragraph --><p>Nested copy</p><!-- /wp:paragraph -->',
					'<!-- wp:buttons -->',
					'<div class="wp-block-buttons"><!-- wp:button {"url":"https://example.com"} --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://example.com">Go</a></div><!-- /wp:button --></div>',
					'<!-- /wp:buttons -->',
					'<!-- /wp:acf/container -->',
				] ),
			],
			'core paragraph with acf binding' => [
				implode( "\n", [
					'<!-- wp:paragraph {"metadata":{"bindings":{"content":{"source":"acf/field","args":{"key":"field_abc123"}}}}} -->',
					'<p>Fallback</p>',
					'<!-- /wp:paragraph -->',
				] ),
			],
		];
	}

	/**
	 * @dataProvider content_provider
	 */
	public function test_build_variant_block_preserves_inner_blocks( string $markup ) : void {
		$variant = Variants\build_variant_block( $markup, [ 'title' => 'ACF Fixture' ] );

		$this->assertBlocksEqual( $markup, $variant['innerBlocks'] );
	}

	/**
	 * @dataProvider content_provider
	 */
	public function test_save_variant_blocks_preserves_acf_attributes( string $markup ) : void {
		$block_id = $this->make_block();
		$variant = Variants\build_variant_block( $markup, [ 'title' => 'ACF Fixture' ] );

		$result = Variants\save_variant_blocks( $block_id, [ $variant ] );

		$this->assertTrue( $result );

		$variants = Variants\get_variant_blocks( $block_id );
		$this->assertCount( 1, $variants );
		$this->assertBlocksEqual( $markup, $variants[0]['innerBlocks'] );
	}

	/**
	 * @dataProvider content_provider
	 */
	public function test_apply_winner_preserves_acf_content( string $markup ) : void {
		$block_id = $this->make_block();
		$variants = [
			Variants\build_variant_block( '<!-- wp:paragraph --><p>Control</p><!-- /wp:paragraph -->', [ 'title' => 'Control' ] ),
			Variants\build_variant_block( $markup, [ 'title' => 'Winner' ] ),
		];

		$result = Variants\save_variant_blocks( $block_id, $variants );
		$this->assertTrue( $result );

		update_post_meta( $block_id, '_xb_type', 'abtest' );

		$applied = GlobalBlocks\apply_winner( $block_id, 1 );

		$this->assertTrue( $applied );
		$this->assertSame( 'standard', get_post_meta( $block_id, '_xb_type', true ) );
		$this->assertBlocksEqual( $markup, parse_blocks( get_post( $block_id )->post_content ) );
	}

	/**
	 * @dataProvider content_provider
	 */
	public function test_abilities_preserve_acf_content( string $markup ) : void {
		$block_id = $this->make_block();

		$add_result = Execution\execute_add_variant( [
			'block_id' => $block_id,
			'content'  => $markup,
			'title'    => 'ACF Fixture',
		] );

		$this->assertIsArray( $add_result );
		$this->assertTrue( $add_result['success'] );

		$variants = Variants\get_variant_blocks( $block_id );
		$this->assertCount( 1, $variants );
		$this->assertBlocksEqual( $markup, $variants[0]['innerBlocks'] );

		$update_result = Execution\execute_update_variant( [
			'block_id'      => $block_id,
			'variant_index' => 0,
			'content'       => $markup,
			'title'         => 'Updated ACF Fixture',
		] );

		$this->assertIsArray( $update_result );
		$this->assertTrue( $update_result['success'] );

		$updated = Variants\get_variant_blocks( $block_id );
		$this->assertCount( 1, $updated );
		$this->assertBlocksEqual( $markup, $updated[0]['innerBlocks'] );
	}

	/**
	 * Create a wp_block post for variant tests.
	 *
	 * @return int Created post ID.
	 */
	protected function make_block() : int {
		return self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_title'   => 'ACF Preservation Block',
			'post_content' => '<!-- wp:paragraph --><p>Original</p><!-- /wp:paragraph -->',
		] );
	}

	/**
	 * Assert parsed block trees match by block name, attrs, and inner blocks.
	 *
	 * @param string|array $expected_markup_or_blocks Expected markup or parsed blocks.
	 * @param string|array $actual_markup_or_blocks   Actual markup or parsed blocks.
	 * @return void
	 */
	protected function assertBlocksEqual( $expected_markup_or_blocks, $actual_markup_or_blocks ) : void {
		$expected = is_string( $expected_markup_or_blocks )
			? parse_blocks( $expected_markup_or_blocks )
			: $expected_markup_or_blocks;
		$actual = is_string( $actual_markup_or_blocks )
			? parse_blocks( $actual_markup_or_blocks )
			: $actual_markup_or_blocks;

		$this->assertSame(
			$this->normalize_blocks( $expected ),
			$this->normalize_blocks( $actual )
		);
	}

	/**
	 * Normalize parsed blocks for stable comparisons.
	 *
	 * @param array $blocks Parsed blocks.
	 * @return array Normalized block tree.
	 */
	protected function normalize_blocks( array $blocks ) : array {
		$normalized = [];

		foreach ( $blocks as $block ) {
			$block_name = $block['blockName'] ?? null;
			if ( ! $block_name && trim( $block['innerHTML'] ?? '' ) === '' ) {
				continue;
			}

			$normalized[] = [
				'blockName'   => $block_name,
				'attrs'       => $block['attrs'] ?? [],
				'innerBlocks' => $this->normalize_blocks( $block['innerBlocks'] ?? [] ),
			];
		}

		return $normalized;
	}
}
