<?php
/**
 * Accelerate Abilities API - Fuzzy Block Selector.
 *
 * Provides utilities for finding blocks without volatile client IDs.
 * Instead of requiring a UUID, abilities accept a selector object with
 * criteria like block_type, contains_text, anchor_slug, and nth_of_type.
 *
 * @package Altis\Accelerate\Abilities
 */

namespace Altis\Accelerate\Abilities;

use WP_Error;

/**
 * Get the fuzzy selector schema definition for reuse.
 *
 * @return array Fuzzy selector JSON schema.
 */
function get_fuzzy_selector_schema() : array {
	return [
		'type'        => 'object',
		'description' => __( 'Fuzzy selector to find a block without volatile IDs.', 'altis' ),
		'properties'  => [
			'block_type'    => [
				'type'        => 'string',
				'description' => __( 'Block type name, e.g., core/heading, core/paragraph.', 'altis' ),
			],
			'contains_text' => [
				'type'        => 'string',
				'description' => __( 'Text content the block should contain (case-insensitive).', 'altis' ),
			],
			'anchor_slug'   => [
				'type'        => 'string',
				'description' => __( 'HTML anchor/id attribute of the block.', 'altis' ),
			],
			'nth_of_type'   => [
				'type'        => 'integer',
				'minimum'     => 1,
				'default'     => 1,
				'description' => __( '1-indexed position among matching blocks (e.g., 1st, 2nd).', 'altis' ),
			],
		],
	];
}

/**
 * Find a block matching the fuzzy selector.
 *
 * @param int   $post_id  Post ID to search in.
 * @param array $selector Fuzzy selector criteria.
 * @return array|WP_Error Found block data or error.
 */
function resolve_fuzzy_selector( int $post_id, array $selector ) {
	$post = get_post( $post_id );

	if ( ! $post ) {
		return new WP_Error(
			'invalid_post',
			__( 'Post not found.', 'altis' ),
			[ 'status' => 404 ]
		);
	}

	$blocks = parse_blocks( $post->post_content );

	if ( empty( $blocks ) ) {
		return new WP_Error(
			'no_blocks',
			__( 'Post contains no blocks.', 'altis' ),
			[ 'status' => 404 ]
		);
	}

	// Flatten nested blocks for searching.
	$flat_blocks = flatten_blocks( $blocks );

	// Find all matching blocks.
	$matches = [];
	foreach ( $flat_blocks as $index => $block ) {
		if ( block_matches_selector( $block, $selector ) ) {
			$matches[] = [
				'block' => $block,
				'index' => $index,
			];
		}
	}

	if ( empty( $matches ) ) {
		return new WP_Error(
			'no_match',
			__( 'No block matched the selector criteria.', 'altis' ),
			[
				'status'   => 404,
				'selector' => $selector,
			]
		);
	}

	// Handle nth_of_type.
	$nth = $selector['nth_of_type'] ?? 1;

	if ( $nth > count( $matches ) ) {
		return new WP_Error(
			'nth_out_of_range',
			sprintf(
				/* translators: 1: Number of matches found, 2: Requested nth value */
				__( 'Only %1$d blocks match the selector, but nth_of_type is %2$d.', 'altis' ),
				count( $matches ),
				$nth
			),
			[
				'status'       => 400,
				'matches'      => count( $matches ),
				'nth_of_type'  => $nth,
			]
		);
	}

	return $matches[ $nth - 1 ];
}

/**
 * Check if a block matches the selector criteria.
 *
 * @param array $block    Block data from parse_blocks().
 * @param array $selector Selector criteria.
 * @return bool Whether the block matches.
 */
function block_matches_selector( array $block, array $selector ) : bool {
	// Skip null/whitespace blocks.
	if ( empty( $block['blockName'] ) ) {
		return false;
	}

	// Check block_type.
	if ( ! empty( $selector['block_type'] ) ) {
		if ( $block['blockName'] !== $selector['block_type'] ) {
			return false;
		}
	}

	// Check contains_text (case-insensitive).
	if ( ! empty( $selector['contains_text'] ) ) {
		$inner_html = implode( '', $block['innerContent'] ?? [] );
		$inner_text = wp_strip_all_tags( $inner_html );

		if ( stripos( $inner_text, $selector['contains_text'] ) === false ) {
			return false;
		}
	}

	// Check anchor_slug.
	if ( ! empty( $selector['anchor_slug'] ) ) {
		$anchor = $block['attrs']['anchor'] ?? '';

		if ( $anchor !== $selector['anchor_slug'] ) {
			return false;
		}
	}

	return true;
}

/**
 * Recursively flatten nested blocks into a single array.
 *
 * @param array $blocks Array of blocks from parse_blocks().
 * @param int   $depth  Current depth (for nested blocks).
 * @return array Flattened array of blocks.
 */
function flatten_blocks( array $blocks, int $depth = 0 ) : array {
	$flat = [];

	foreach ( $blocks as $block ) {
		// Skip null/whitespace blocks.
		if ( empty( $block['blockName'] ) ) {
			continue;
		}

		// Add block with depth metadata.
		$block['_depth'] = $depth;
		$flat[] = $block;

		// Recursively add inner blocks.
		if ( ! empty( $block['innerBlocks'] ) ) {
			$flat = array_merge( $flat, flatten_blocks( $block['innerBlocks'], $depth + 1 ) );
		}
	}

	return $flat;
}

/**
 * Find all blocks of a specific type in a post.
 *
 * @param int    $post_id    Post ID to search in.
 * @param string $block_type Block type name (e.g., 'core/heading').
 * @return array Array of matching blocks.
 */
function find_blocks_by_type( int $post_id, string $block_type ) : array {
	$post = get_post( $post_id );

	if ( ! $post ) {
		return [];
	}

	$blocks = parse_blocks( $post->post_content );
	$flat_blocks = flatten_blocks( $blocks );

	return array_filter( $flat_blocks, function ( $block ) use ( $block_type ) {
		return $block['blockName'] === $block_type;
	} );
}

/**
 * Count blocks matching selector criteria in a post.
 *
 * @param int   $post_id  Post ID to search in.
 * @param array $selector Selector criteria.
 * @return int Number of matching blocks.
 */
function count_matching_blocks( int $post_id, array $selector ) : int {
	$post = get_post( $post_id );

	if ( ! $post ) {
		return 0;
	}

	$blocks = parse_blocks( $post->post_content );
	$flat_blocks = flatten_blocks( $blocks );

	$count = 0;
	foreach ( $flat_blocks as $block ) {
		if ( block_matches_selector( $block, $selector ) ) {
			$count++;
		}
	}

	return $count;
}
