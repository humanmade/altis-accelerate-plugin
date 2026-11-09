<?php
/**
 * Title AB testing feature.
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Experiments\Titles;

use Altis\Accelerate\Experiments;
use Altis\Accelerate\Utils;

/**
 * Bootstrap AB Tests Feature.
 *
 * @return void
 */
function setup() {
	add_action( 'init', __NAMESPACE__ . '\\init' );
}

/**
 * Register the AB test, and output filters.
 */
function init() {
	if ( ! is_admin() ) {
		add_filter( 'the_title', __NAMESPACE__ . '\\add_title_ab_test_to_title', 10, 2 );
		add_filter( 'render_block_core/post-title', __NAMESPACE__ . '\\add_title_ab_test_to_post_title_block', 10, 3 );
	}

	Experiments\register_post_ab_test(
		'titles',
		[
			'label' => __( 'Titles', 'altis-analytics' ),
			'singular_label' => __( 'Title', 'altis-analytics' ),
			'suggestion_prompt' => 'Write a title for this post.',
			'goal' => 'click',
			'closest' => 'a',
			// Exclude all events from the target post page.
			'query_filter' => "post_id != {post_id:String}",
			'query_filter_params' => function ( $post_id ) : array {
				return [
					'post_id' => $post_id,
				];
			},
			// Update the actual post title.
			'winner_callback' => function ( int $post_id, string $title ) {
				wp_update_post( [
					'ID' => $post_id,
					'post_title' => $title,
				] );
			},
			'post_types' => [
				'post',
				'page',
			],
			'show_ui' => true,
			'editor_scripts' => [
				Utils\get_asset_url( 'titles.js' ) => [
					'wp-plugins',
					'wp-blocks',
					'wp-i18n',
					'wp-editor',
					'wp-components',
					'wp-core-data',
					'wp-edit-post',
					'moment',
				],
			],
		]
	);
}

/**
 * Replace title output with the AB Test markup equivalent.
 *
 * @param string $title The current title text.
 * @param integer $post_id The post ID.
 * @return string|null
 */
function add_title_ab_test_to_title( string $title, int $post_id ) : ?string {
	return Experiments\output_ab_test_html_for_post( 'titles', $post_id, $title );
}

/**
 * Re-inject the AB test wrapper into the rendered `core/post-title` block.
 *
 * The block's render callback calls `get_the_title()` then runs the result
 * through `wp_kses_post()` before composing the heading markup. `wp_kses_post()`
 * strips the custom `<ab-test>` element our `the_title` filter would have added,
 * so for block themes the wrapper never reaches the DOM. We re-wrap here, after
 * the block has rendered and sanitised its content.
 *
 * REST requests intentionally bypass this — block previews and headless
 * renderers should not receive an unactivated `<ab-test>` element.
 *
 * @param string    $block_content Block HTML after render.
 * @param array     $block         Parsed block.
 * @param \WP_Block $instance      Block instance (carries Query Loop context).
 * @return string
 */
function add_title_ab_test_to_post_title_block( string $block_content, array $block, \WP_Block $instance ) : string {
	if ( is_admin() || is_feed() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return $block_content;
	}

	// Already wrapped — nothing to do.
	if ( strpos( $block_content, '<ab-test' ) !== false ) {
		return $block_content;
	}

	$post_id = isset( $instance->context['postId'] ) ? (int) $instance->context['postId'] : (int) get_the_ID();
	if ( $post_id <= 0 ) {
		return $block_content;
	}

	// Reconstruct the exact title substring the block emitted into its heading.
	// The block calls get_the_title() then wp_kses_post(), so we mirror that —
	// with our own the_title filter removed so the rendered title is the plain
	// (unwrapped) string the block actually injected.
	$callback = __NAMESPACE__ . '\\add_title_ab_test_to_title';
	$had_filter = remove_filter( 'the_title', $callback, 10 );
	try {
		$rendered_title = wp_kses_post( get_the_title( $post_id ) );
	} finally {
		if ( $had_filter ) {
			add_filter( 'the_title', $callback, 10, 2 );
		}
	}

	if ( $rendered_title === '' ) {
		return $block_content;
	}

	$wrapper = Experiments\output_ab_test_html_for_post( 'titles', $post_id, $rendered_title );

	// No test running / winner already inlined as plain text.
	if ( $wrapper === null || $wrapper === $rendered_title ) {
		return $block_content;
	}

	$position = strpos( $block_content, $rendered_title );
	if ( $position === false ) {
		return $block_content;
	}

	return substr_replace( $block_content, $wrapper, $position, strlen( $rendered_title ) );
}
