<?php
/**
 * Tests for the render_block_core/post-title filter that re-injects the
 * <ab-test> wrapper for block themes.
 *
 * @package Altis\Accelerate\Tests
 */

namespace Altis\Accelerate\Tests;

use Altis\Accelerate\Experiments;
use Altis\Accelerate\Experiments\Titles;
use WP_Block;
use WP_UnitTestCase;

class TitleBlockFilterTest extends WP_UnitTestCase {

	/**
	 * @var int
	 */
	protected $post_id;

	public function set_up() {
		parent::set_up();

		// Ensure the titles AB test is registered (in case the 'init' hook
		// fired before its callback was added during bootstrap).
		global $post_ab_tests;
		if ( empty( $post_ab_tests['titles'] ) ) {
			Titles\init();
		}

		$this->post_id = self::factory()->post->create( [
			'post_title' => 'Original Title',
			'post_status' => 'publish',
		] );
	}

	/**
	 * Seed a fully running A/B title test with two variants.
	 */
	protected function seed_running_test( array $variants = [ 'Original Title', 'Variant B Title' ] ) : void {
		Experiments\update_ab_test_variants_for_post( 'titles', $this->post_id, $variants );
		Experiments\update_is_ab_test_started_for_post( 'titles', $this->post_id, true );
		Experiments\update_is_ab_test_paused_for_post( 'titles', $this->post_id, false );
		Experiments\update_ab_test_start_time_for_post( 'titles', $this->post_id, ( time() - 3600 ) * 1000 );
		Experiments\update_ab_test_end_time_for_post( 'titles', $this->post_id, ( time() + 86400 ) * 1000 );
	}

	/**
	 * Build a WP_Block instance carrying the post id context.
	 */
	protected function block_instance() : WP_Block {
		return new WP_Block(
			[
				'blockName' => 'core/post-title',
				'attrs' => [],
				'innerBlocks' => [],
				'innerContent' => [],
				'innerHTML' => '',
			],
			[ 'postId' => $this->post_id ]
		);
	}

	public function test_returns_unchanged_when_no_test_configured() {
		$block_content = '<h1 class="wp-block-post-title">Original Title</h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		$this->assertSame( $block_content, $result );
	}

	public function test_returns_unchanged_when_test_not_started() {
		Experiments\update_ab_test_variants_for_post( 'titles', $this->post_id, [ 'Original Title', 'Variant B Title' ] );
		// Not started.
		$block_content = '<h1 class="wp-block-post-title">Original Title</h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		$this->assertSame( $block_content, $result );
	}

	public function test_wraps_plain_heading_when_test_running() {
		$this->seed_running_test();
		$block_content = '<h1 class="wp-block-post-title">Original Title</h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		$this->assertStringContainsString( '<ab-test', $result );
		$this->assertMatchesRegularExpression( '/^<h1 class="wp-block-post-title">\s*<ab-test/', $result );
		$this->assertMatchesRegularExpression( '/<\/ab-test>\s*<\/h1>$/', $result );
	}

	public function test_wraps_inside_anchor_for_linked_heading() {
		$this->seed_running_test();
		$block_content = '<h2 class="wp-block-post-title"><a href="https://example.test/post">Original Title</a></h2>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		$this->assertMatchesRegularExpression( '/<a href="https:\/\/example\.test\/post">\s*<ab-test/', $result );
		$this->assertMatchesRegularExpression( '/<\/ab-test>\s*<\/a>\s*<\/h2>$/', $result );
	}

	public function test_double_wrap_guard() {
		$this->seed_running_test();
		$block_content = '<h1 class="wp-block-post-title"><ab-test test-id="titles">Original Title</ab-test></h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		$this->assertSame( $block_content, $result );
	}

	public function test_returns_winner_text_when_winner_set() {
		$this->seed_running_test();
		Experiments\update_ab_test_results_for_post( 'titles', $this->post_id, [
			'winner' => 1,
			'variants' => [],
		] );
		$block_content = '<h1 class="wp-block-post-title">Original Title</h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		// output_ab_test_html_for_post returns the winning variant text directly —
		// no <ab-test> wrapper is needed. The winning variant replaces the title
		// in the block markup (matches the `the_title` filter path's behaviour).
		$this->assertStringNotContainsString( '<ab-test', $result );
		$this->assertSame( '<h1 class="wp-block-post-title">Variant B Title</h1>', $result );
	}

	public function test_handles_html_entities_in_title() {
		wp_update_post( [ 'ID' => $this->post_id, 'post_title' => 'AT&T Roundup' ] );
		$this->seed_running_test( [ 'AT&T Roundup', 'Variant B Title' ] );
		// Block content emits the entity-encoded form.
		$block_content = '<h1 class="wp-block-post-title">AT&amp;T Roundup</h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		$this->assertStringContainsString( '<ab-test', $result );
		$this->assertMatchesRegularExpression( '/^<h1 class="wp-block-post-title">\s*<ab-test/', $result );
	}

	public function test_returns_unchanged_when_rendered_title_not_found_in_block() {
		$this->seed_running_test();
		// Some upstream filter has mangled the title beyond recognition.
		$block_content = '<h1 class="wp-block-post-title">Completely Different Text</h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$this->block_instance()
		);
		$this->assertSame( $block_content, $result );
	}

	public function test_resolves_post_id_from_block_context() {
		$other_id = self::factory()->post->create( [
			'post_title' => 'Second Post',
			'post_status' => 'publish',
		] );
		Experiments\update_ab_test_variants_for_post( 'titles', $other_id, [ 'Second Post', 'Second Variant' ] );
		Experiments\update_is_ab_test_started_for_post( 'titles', $other_id, true );
		Experiments\update_is_ab_test_paused_for_post( 'titles', $other_id, false );
		Experiments\update_ab_test_start_time_for_post( 'titles', $other_id, ( time() - 3600 ) * 1000 );
		Experiments\update_ab_test_end_time_for_post( 'titles', $other_id, ( time() + 86400 ) * 1000 );

		$instance = new WP_Block(
			[
				'blockName' => 'core/post-title',
				'attrs' => [],
				'innerBlocks' => [],
				'innerContent' => [],
				'innerHTML' => '',
			],
			[ 'postId' => $other_id ]
		);
		$block_content = '<h1 class="wp-block-post-title">Second Post</h1>';
		$result = Titles\add_title_ab_test_to_post_title_block(
			$block_content,
			[ 'blockName' => 'core/post-title' ],
			$instance
		);
		$this->assertStringContainsString( 'post-id="' . $other_id . '"', $result );
	}
}
