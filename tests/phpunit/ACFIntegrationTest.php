<?php
/**
 * Tests for the ACF integration helpers.
 *
 * @package Altis\Accelerate\Tests
 */

namespace Altis\Accelerate\Tests;

use Altis\Accelerate\Integrations\ACF;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/integrations/acf/namespace.php';

class ACFIntegrationTest extends WP_UnitTestCase {

	public function tear_down() : void {
		if ( class_exists( 'WP_Block_Type_Registry' ) && \WP_Block_Type_Registry::get_instance()->is_registered( 'acf/meta-block' ) ) {
			unregister_block_type( 'acf/meta-block' );
		}

		parent::tear_down();
	}

	public function test_status_helpers_are_inactive_without_acf() : void {
		$this->assertFalse( ACF\is_active() );
		$this->assertFalse( ACF\is_pro() );
		$this->assertFalse( ACF\supports_blocks() );
		$this->assertNull( ACF\get_version() );
		$this->assertFalse( ACF\meets_recommended_version() );
	}

	public function test_get_status_returns_inactive_shape_without_acf() : void {
		$this->assertSame(
			[
				'active'                  => false,
				'pro'                     => false,
				'version'                 => null,
				'blocks'                  => false,
				'meetsRecommendedVersion' => false,
			],
			ACF\get_status()
		);
	}

	public function test_is_acf_block_detects_acf_block_names() : void {
		$acf_blocks = parse_blocks( '<!-- wp:acf/testimonial {"name":"acf/testimonial","data":{}} /-->' );
		$core_blocks = parse_blocks( '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->' );

		$this->assertTrue( ACF\is_acf_block( $acf_blocks[0] ) );
		$this->assertFalse( ACF\is_acf_block( $core_blocks[0] ) );
		$this->assertFalse( ACF\is_acf_block( [ 'blockName' => null ] ) );
	}

	public function test_find_acf_blocks_finds_nested_acf_blocks() : void {
		$markup = implode( "\n", [
			'<!-- wp:altis/variant {"title":"Control"} -->',
			'<!-- wp:group -->',
			'<div class="wp-block-group">',
			'<!-- wp:paragraph --><p>Intro</p><!-- /wp:paragraph -->',
			'<!-- wp:acf/testimonial {"name":"acf/testimonial","data":{"heading":"Buy now","_heading":"field_abc123"},"mode":"preview"} /-->',
			'</div>',
			'<!-- /wp:group -->',
			'<!-- /wp:altis/variant -->',
		] );

		$acf_blocks = ACF\find_acf_blocks( parse_blocks( $markup ) );

		$this->assertCount( 1, $acf_blocks );
		$this->assertSame( 'acf/testimonial', $acf_blocks[0]['blockName'] );
		$this->assertSame( 'Buy now', $acf_blocks[0]['attrs']['data']['heading'] );
	}

	public function test_block_uses_post_meta_detects_registered_acf_settings() : void {
		register_block_type( 'acf/meta-block', [
			'title' => 'Meta Block',
			'acf'   => [
				'usePostMeta' => true,
			],
		] );

		$this->assertTrue( ACF\block_uses_post_meta( 'acf/meta-block' ) );
		$this->assertFalse( ACF\block_uses_post_meta( 'acf/missing-block' ) );
	}

	public function test_validate_content_markup_rejects_use_post_meta_blocks() : void {
		$filter = function ( bool $uses_post_meta, string $block_name ) : bool {
			return $block_name === 'acf/meta-block' ? true : $uses_post_meta;
		};
		add_filter( 'altis.accelerate.acf.block_uses_post_meta', $filter, 10, 2 );

		try {
			$error = ACF\validate_content_markup( '<!-- wp:acf/meta-block {"name":"acf/meta-block","data":{}} /-->' );
		} finally {
			remove_filter( 'altis.accelerate.acf.block_uses_post_meta', $filter, 10 );
		}

		$this->assertWPError( $error );
		$this->assertSame( 'altis.accelerate.acf.unsupported_post_meta_block', $error->get_error_code() );
		$this->assertStringContainsString( 'acf/meta-block', $error->get_error_message() );
	}

	public function test_validate_content_markup_allows_plain_acf_and_empty_content() : void {
		$this->assertNull( ACF\validate_content_markup( '<!-- wp:acf/plain-block {"name":"acf/plain-block","data":{}} /-->' ) );
		$this->assertNull( ACF\validate_content_markup( '' ) );
		$this->assertNull( ACF\validate_content_markup( 'No block markup here.' ) );
	}
}
