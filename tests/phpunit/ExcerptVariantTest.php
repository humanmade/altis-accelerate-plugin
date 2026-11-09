<?php
/**
 * Choosing which variant represents a block in plain text.
 *
 * A page's excerpt becomes its meta description, its social card and the text
 * an LLM summarises. Personalisation and A/B blocks hold several versions of
 * the same copy, only one of which is written for a general audience, so only
 * that one belongs in those places.
 *
 * What this test DOES prove:
 *   - The fallback is found by its attribute, not its position, so reordering
 *     variants in the editor does not change what an excerpt says.
 *   - A variant set with no fallback flag falls back to an untargeted variant
 *     rather than to the first one, which could be targeted.
 *   - A set where every variant is targeted yields nothing, so no audience's
 *     copy is put in front of all the others.
 *   - Real page excerpts include only the fallback of published, unprotected
 *     patterns. The regression test registers the required filters explicitly.
 *
 * What this test does NOT prove:
 *   - Behaviour in feeds, which take the same branch.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\GlobalBlocks;
use WP_UnitTestCase;

class ExcerptVariantTest extends WP_UnitTestCase {

	/**
	 * Preserve core's visibility checks when selecting excerpt content.
	 *
	 * @dataProvider pattern_visibility_cases
	 * @param string $type Pattern type.
	 * @param string $status Publication status.
	 * @param string $password Pattern password.
	 */
	public function test_excerpt_respects_pattern_visibility( string $type, string $status, string $password ) {
		$pattern_id = self::factory()->post->create( [
			'post_type' => 'wp_block',
			'post_status' => $status,
			'post_password' => $password,
			'post_content' => '<!-- wp:altis/variant {"fallback":true} --><!-- wp:paragraph --><p>Fallback copy.</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->'
				. '<!-- wp:altis/variant {"audience":42} --><!-- wp:paragraph --><p>Targeted copy.</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->',
		] );
		update_post_meta( $pattern_id, '_xb_type', $type );
		$post_id = self::factory()->post->create( [
			'post_excerpt' => '',
			'post_content' => sprintf( '<!-- wp:core/block {"ref":%d} /-->', $pattern_id ),
		] );

		// The suite may have no linked account, so bootstrap skips these filters.
		add_filter( 'excerpt_allowed_wrapper_blocks', 'Altis\\Accelerate\\Blocks\\filter_excerpt_allowed_wrapper_blocks' );
		add_filter( 'render_block_core/block', 'Altis\\Accelerate\\GlobalBlocks\\render_block', 10, 3 );
		try {
			$excerpt = get_the_excerpt( $post_id );
		} finally {
			remove_filter( 'excerpt_allowed_wrapper_blocks', 'Altis\\Accelerate\\Blocks\\filter_excerpt_allowed_wrapper_blocks' );
			remove_filter( 'render_block_core/block', 'Altis\\Accelerate\\GlobalBlocks\\render_block', 10 );
		}

		$this->assertSame( $status === 'publish' && $password === '' ? 'Fallback copy.' : '', trim( $excerpt ) );
	}

	/**
	 * Cover restricted patterns and the published control for both block types.
	 *
	 * @return array
	 */
	public static function pattern_visibility_cases() : array {
		$cases = [];
		foreach ( [ 'personalization', 'abtest' ] as $type ) {
			foreach ( [ 'draft', 'private', 'publish' ] as $status ) {
				$cases[ "$type-$status" ] = [ $type, $status, '' ];
			}
			$cases[ "$type-password" ] = [ $type, 'publish', 'test-password' ];
		}
		return $cases;
	}

	/**
	 * Builds the parsed inner blocks of a synced pattern.
	 *
	 * @param array $variants Each entry is an array of block attributes.
	 * @return array Parsed blocks, as parse_blocks() would return them.
	 */
	private function make_variants( array $variants ) : array {
		$content = '';

		foreach ( $variants as $index => $attrs ) {
			$content .= sprintf(
				'<!-- wp:altis/variant %s --><!-- wp:paragraph --><p>COPY %d.</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->',
				wp_json_encode( $attrs ),
				$index
			);
		}

		return parse_blocks( $content );
	}

	/**
	 * Only the variant blocks are returned, and nothing else in the pattern.
	 */
	public function test_get_variants_returns_only_variant_blocks() {
		$blocks = parse_blocks(
			'<!-- wp:paragraph --><p>Not a variant.</p><!-- /wp:paragraph -->'
			. '<!-- wp:altis/variant {"fallback":true} --><!-- wp:paragraph --><p>COPY 0.</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->'
		);

		$variants = GlobalBlocks\get_variants( $blocks );

		$this->assertCount( 1, $variants );
		$this->assertSame( 'altis/variant', $variants[0]['blockName'] );
	}

	/**
	 * The flagged variant wins, wherever it sits.
	 */
	public function test_fallback_is_found_by_attribute_not_position() {
		$blocks = $this->make_variants( [
			[ 'audience' => 42, 'title' => 'Targeted' ],
			[ 'fallback' => true, 'title' => 'Default' ],
		] );

		$fallback = GlobalBlocks\get_fallback_variant( $blocks );

		$this->assertNotNull( $fallback );
		$this->assertTrue( $fallback['attrs']['fallback'] );
		$this->assertSame( 'Default', $fallback['attrs']['title'] );
	}

	/**
	 * Variant sets built through the abilities API may carry no fallback flag.
	 * An untargeted variant is safe to show; the first one may not be.
	 */
	public function test_untargeted_variant_is_used_when_nothing_is_flagged() {
		$blocks = $this->make_variants( [
			[ 'audience' => 42, 'title' => 'Targeted' ],
			[ 'title' => 'Untargeted' ],
		] );

		$fallback = GlobalBlocks\get_fallback_variant( $blocks );

		$this->assertNotNull( $fallback );
		$this->assertSame( 'Untargeted', $fallback['attrs']['title'] );
	}

	/**
	 * When every variant is aimed at someone, none of them can stand for the
	 * block in front of a general audience.
	 */
	public function test_nothing_is_returned_when_every_variant_is_targeted() {
		$blocks = $this->make_variants( [
			[ 'audience' => 42, 'title' => 'One' ],
			[ 'audience' => 43, 'title' => 'Two' ],
		] );

		$this->assertNull( GlobalBlocks\get_fallback_variant( $blocks ) );
	}

	/**
	 * A pattern holding no variants has nothing to choose between.
	 */
	public function test_nothing_is_returned_when_there_are_no_variants() {
		$blocks = parse_blocks( '<!-- wp:paragraph --><p>Just a paragraph.</p><!-- /wp:paragraph -->' );

		$this->assertSame( [], GlobalBlocks\get_variants( $blocks ) );
		$this->assertNull( GlobalBlocks\get_fallback_variant( $blocks ) );
	}
}
