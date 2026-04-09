<?php
/**
 * Accelerate Abilities API - Variant Helpers.
 *
 * Shared functions for variant block manipulation used by both the
 * primitive variant abilities and the convenience abilities
 * (create-ab-test, create-personalization-rule).
 *
 * @package Altis\Accelerate\Abilities\Variants
 */

namespace Altis\Accelerate\Abilities\Variants;

use Altis\Accelerate\Experiments;
use Altis\Accelerate\GlobalBlocks;
use WP_Error;
use WP_Post;

/**
 * Validate that a post ID refers to an existing wp_block post.
 *
 * @param int $post_id Post ID to validate.
 * @return WP_Post|WP_Error The post object or error.
 */
function validate_block_post( int $post_id ) {
	if ( ! $post_id ) {
		return new WP_Error( 'missing_block_id', __( 'block_id is required.', 'altis' ) );
	}

	$post = get_post( $post_id );

	if ( ! $post || $post->post_type !== 'wp_block' ) {
		return new WP_Error( 'invalid_block', __( 'Block not found or not a synced pattern.', 'altis' ) );
	}

	return $post;
}

/**
 * Get variant blocks from a wp_block post.
 *
 * Parses the post content and returns only altis/variant blocks,
 * re-indexed from zero.
 *
 * @param int $post_id wp_block post ID.
 * @return array Array of variant block arrays.
 */
function get_variant_blocks( int $post_id ) : array {
	$post = get_post( $post_id );
	if ( ! $post ) {
		return [];
	}

	$blocks = parse_blocks( $post->post_content );
	$variants = array_filter( $blocks, function ( $block ) {
		return $block['blockName'] === 'altis/variant';
	} );

	return array_values( $variants );
}

/**
 * Save variant blocks to a wp_block post.
 *
 * Serializes the variant blocks, updates the post content, and triggers
 * the metadata sync that normally runs via rest_after_insert_wp_block.
 *
 * @param int   $post_id  wp_block post ID.
 * @param array $variants Array of variant block arrays.
 * @return true|WP_Error True on success or WP_Error.
 */
function save_variant_blocks( int $post_id, array $variants ) {
	$new_content = serialize_blocks( $variants );

	$updated = wp_update_post( [
		'ID'           => $post_id,
		'post_content' => $new_content,
	], true );

	if ( is_wp_error( $updated ) ) {
		return $updated;
	}

	// Trigger metadata sync. save_variants() is normally only called via
	// rest_after_insert_wp_block, so we call it manually after wp_update_post.
	$post = get_post( $post_id );
	if ( $post ) {
		GlobalBlocks\save_variants( $post );
	}

	return true;
}

/**
 * Build a single altis/variant block array.
 *
 * Accepts either WordPress block markup or plain text/HTML. Plain text
 * is automatically wrapped in a paragraph block.
 *
 * @param string $content Block markup or plain text content.
 * @param array  $attrs   Optional variant attributes (title, percentage, audience, fallback).
 * @return array A single altis/variant block array.
 */
function build_variant_block( string $content, array $attrs = [] ) : array {
	$inner_blocks = parse_blocks( $content );

	// If parsing produced nothing useful, wrap as a paragraph block.
	if ( empty( $inner_blocks ) || ( count( $inner_blocks ) === 1 && empty( $inner_blocks[0]['blockName'] ) ) ) {
		$inner_blocks = parse_blocks(
			'<!-- wp:paragraph --><p>' . esc_html( $content ) . '</p><!-- /wp:paragraph -->'
		);
	}

	// Build clean attrs — only include keys that have values.
	$block_attrs = [];
	if ( ! empty( $attrs['title'] ) ) {
		$block_attrs['title'] = $attrs['title'];
	}
	if ( isset( $attrs['percentage'] ) ) {
		$block_attrs['percentage'] = (int) $attrs['percentage'];
	}
	if ( ! empty( $attrs['audience'] ) ) {
		$block_attrs['audience'] = (int) $attrs['audience'];
	}
	if ( ! empty( $attrs['fallback'] ) ) {
		$block_attrs['fallback'] = true;
	}

	return [
		'blockName'    => 'altis/variant',
		'attrs'        => $block_attrs,
		'innerBlocks'  => $inner_blocks,
		'innerHTML'    => '',
		'innerContent' => [],
	];
}

/**
 * Sync a post's experiment state to the experiments table.
 *
 * Wrapper around Experiments\sync_experiment_to_table() that determines
 * the experiment type from post meta when not provided.
 *
 * @param int         $post_id wp_block post ID.
 * @param string|null $type    Optional experiment type ('abtest' or 'personalization').
 * @return void
 */
function sync_post_experiment( int $post_id, ?string $type = null ) : void {
	if ( ! $type ) {
		$is_personalization = get_post_meta( $post_id, '_xb_personalization', true );
		$type = $is_personalization
			? Experiments\Experiment::TYPE_PERSONALIZATION
			: Experiments\Experiment::TYPE_ABTEST;
	}

	Experiments\sync_experiment_to_table( 'block', $post_id, $type );
}
