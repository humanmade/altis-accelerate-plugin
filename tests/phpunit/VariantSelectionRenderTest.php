<?php
/**
 * Variant-selection render_block tests.
 *
 * `inc/global-blocks/namespace.php::render_block()` is the function that
 * actually wraps content in `<global-block>` / `<ab-test-block>` /
 * `<personalization-block>` custom elements on the server-rendered page.
 * It's the last server-side step before the variant-selection JS in
 * `src/experiments.js` takes over on the client.
 *
 * What this test DOES prove:
 *   - Non-string `$block_content` short-circuits the wrapping logic (note:
 *     because the function is typed `: string`, `false` is coerced to `''`
 *     on return — we assert no wrapper appears, not strict-identity).
 *   - Missing or non-wp_block referenced post returns content untouched
 *     (the safety fallback).
 *   - Content that already contains a wrapper element is not double-wrapped
 *     (a real regression hazard after the WP 6.9 render-pass change).
 *   - The right custom-element tag is emitted per `_xb_type` meta.
 *   - A/B test wrappers receive `traffic-percentage`, `paused`, and `winner`
 *     attributes when the corresponding post-meta is set.
 *
 * What this test does NOT prove:
 *   - Client-side variant *selection* (that's in `src/experiments.js` and
 *     covered by `src/__tests__/experiments-bucketing.test.ts`).
 *   - Preview rendering (`$altis_block_preview`) — a separate server-side
 *     code path triggered only inside the editor.
 *   - parse_blocks() resilience to genuinely malformed content (parse_blocks
 *     is upstream WP behaviour).
 *
 * See `docs/test-coverage-audit.md` → P2 #7.
 */

namespace Altis\Accelerate\GlobalBlocks;

use WP_Block;
use WP_UnitTestCase;

class VariantSelectionRenderTest extends WP_UnitTestCase {

	/** @var int */
	protected $standard_block_id;

	/** @var int */
	protected $abtest_block_id;

	/** @var int */
	protected $personalization_block_id;

	public function set_up() {
		parent::set_up();

		// render_block() reads post_author and calls get_user_by(), which
		// returns false for author 0. Real author needed.
		$author = self::factory()->user->create( [ 'role' => 'editor' ] );

		$this->standard_block_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_status'  => 'publish',
			'post_author'  => $author,
			'post_title'   => 'Standard',
			'post_content' => '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->',
		] );

		$this->abtest_block_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_status'  => 'publish',
			'post_author'  => $author,
			'post_title'   => 'AB Test',
			'post_content' => '<!-- wp:altis/variant --><!-- wp:paragraph --><p>A</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->',
		] );
		update_post_meta( $this->abtest_block_id, '_xb_type', 'abtest' );

		$this->personalization_block_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_status'  => 'publish',
			'post_author'  => $author,
			'post_title'   => 'Personalization',
			'post_content' => '<!-- wp:altis/variant --><!-- wp:paragraph --><p>P</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->',
		] );
		update_post_meta( $this->personalization_block_id, '_xb_type', 'personalization' );
	}

	/**
	 * Build a `WP_Block` mock with the minimum needed for `render_block`:
	 * a `blockName` and an `attrs.ref` pointing at the target block post.
	 */
	private function build_block( int $ref_post_id ) : WP_Block {
		return new WP_Block( [
			'blockName'    => 'core/block',
			'attrs'        => [ 'ref' => $ref_post_id ],
			'innerBlocks'  => [],
			'innerHTML'    => '',
			'innerContent' => [],
		] );
	}

	// -- Defensive early-return paths -------------------------------------

	public function test_non_string_content_short_circuits_wrapping() {
		// The function's declared return type is `string`, so a `false` input
		// will be coerced to `''` on return; we can't get false back. What
		// we CAN verify is that the wrapping path is never entered when
		// content isn't a string — no wrapper tag appears in the result.
		$block = $this->build_block( $this->standard_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->standard_block_id ] ];

		$result = render_block( false, $parsed, $block );

		$this->assertStringNotContainsString( '<global-block', (string) $result );
		$this->assertStringNotContainsString( '<ab-test-block', (string) $result );
	}

	public function test_missing_referenced_post_returns_content_untouched() {
		// Pass a non-existent ref ID.
		$block = $this->build_block( 999999 );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => 999999 ] ];
		$content = '<p>fallback content</p>';

		$result = render_block( $content, $parsed, $block );

		$this->assertSame( $content, $result );
	}

	public function test_non_wp_block_post_type_returns_content_untouched() {
		$regular_post = self::factory()->post->create( [ 'post_type' => 'post' ] );
		$block = $this->build_block( $regular_post );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $regular_post ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertSame( '<p>x</p>', $result );
	}

	public function test_already_wrapped_content_is_not_double_wrapped() {
		// Simulates the WP 6.9+ double-resolution bug surface: if the
		// content already contains one of our wrappers, leave it alone.
		$content = '<global-block block-id="1" attributes="{}" metrics="{}"><p>x</p></global-block>';
		$block = $this->build_block( $this->standard_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->standard_block_id ] ];

		$result = render_block( $content, $parsed, $block );

		$this->assertSame( $content, $result );
		// Belt-and-braces — there must be exactly one wrapper tag.
		$this->assertSame( 1, substr_count( $result, '<global-block' ) );
	}

	// -- Wrapper-tag selection per _xb_type --------------------------------

	public function test_standard_block_emits_global_block_wrapper() {
		$block = $this->build_block( $this->standard_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->standard_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertStringContainsString( '<global-block ', $result );
		$this->assertStringNotContainsString( '<ab-test-block ', $result );
		$this->assertStringNotContainsString( '<personalization-block ', $result );
	}

	public function test_abtest_block_emits_ab_test_block_wrapper() {
		$block = $this->build_block( $this->abtest_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->abtest_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertStringContainsString( '<ab-test-block ', $result );
		$this->assertStringNotContainsString( '<global-block ', $result );
	}

	public function test_personalization_block_emits_personalization_wrapper() {
		$block = $this->build_block( $this->personalization_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->personalization_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertStringContainsString( '<personalization-block ', $result );
	}

	// -- A/B test wrapper attributes --------------------------------------

	public function test_abtest_wrapper_includes_traffic_percentage_attribute() {
		\Altis\Accelerate\Experiments\update_ab_test_traffic_percentage_for_post(
			'block', $this->abtest_block_id, 75
		);
		$block = $this->build_block( $this->abtest_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->abtest_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertStringContainsString( 'traffic-percentage="75"', $result );
	}

	public function test_abtest_wrapper_uses_default_traffic_percentage_when_unset() {
		// Per get_ab_test_traffic_percentage_for_post(), the default is 35.
		$block = $this->build_block( $this->abtest_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->abtest_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertStringContainsString( 'traffic-percentage="35"', $result );
	}

	public function test_abtest_wrapper_emits_paused_attribute_when_paused() {
		\Altis\Accelerate\Experiments\update_is_ab_test_paused_for_post(
			'block', $this->abtest_block_id, true
		);
		$block = $this->build_block( $this->abtest_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->abtest_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		// The `paused` attribute is a presence flag (no value).
		$this->assertStringContainsString( ' paused', $result );
	}

	public function test_abtest_wrapper_emits_winner_attribute_when_results_have_winner() {
		\Altis\Accelerate\Experiments\update_ab_test_results_for_post(
			'block', $this->abtest_block_id, [
				'timestamp' => 1,
				'winner'    => 1,
				'variants'  => [],
				'aggs'      => [],
			]
		);
		$block = $this->build_block( $this->abtest_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->abtest_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertStringContainsString( 'winner="1"', $result );
	}

	// -- Empty / corrupted block_post content -----------------------------

	public function test_abtest_block_with_no_variants_in_post_content_still_wraps() {
		// An A/B test block whose post content has zero `altis/variant`
		// children — a corruption case. The wrapper should still appear
		// (client JS handles the no-variants case via its own fallback);
		// what we DON'T want is a PHP fatal.
		$empty_post = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_status'  => 'publish',
			'post_author'  => self::factory()->user->create(),
			'post_content' => '',
		] );
		update_post_meta( $empty_post, '_xb_type', 'abtest' );

		$block = $this->build_block( $empty_post );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $empty_post ] ];

		$result = render_block( '<p>placeholder</p>', $parsed, $block );

		$this->assertStringContainsString( '<ab-test-block ', $result );
	}

	public function test_standard_block_with_empty_post_content_wraps_a_noscript_fallback() {
		$empty_post = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_status'  => 'publish',
			'post_author'  => self::factory()->user->create(),
			'post_content' => '',
		] );

		$block = $this->build_block( $empty_post );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $empty_post ] ];

		$result = render_block( '<p>fallback</p>', $parsed, $block );

		// For standard (non-A/B) blocks, the original content is wrapped in
		// <noscript> so JS-disabled clients still see something.
		$this->assertStringContainsString( '<noscript>', $result );
		$this->assertStringContainsString( '<global-block ', $result );
	}

	// -- Block id surfaced for the client to use --------------------------

	public function test_wrapper_includes_the_block_post_id() {
		$block = $this->build_block( $this->standard_block_id );
		$parsed = [ 'blockName' => 'core/block', 'attrs' => [ 'ref' => $this->standard_block_id ] ];

		$result = render_block( '<p>x</p>', $parsed, $block );

		$this->assertStringContainsString( sprintf( 'block-id="%d"', $this->standard_block_id ), $result );
	}
}
