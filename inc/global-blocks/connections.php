<?php
/**
 * This file is to hold all the functionality for the shadow taxonomy
 * to connect the `wp_block` post type to the `post` post type.
 */

namespace Altis\Accelerate\GlobalBlocks\Connections;

use Altis\Accelerate\GlobalBlocks;
use WP_Post;
use WP_Query;
use WP_Term;

const POST_POST_TYPE = 'post';
const RELATIONSHIP_TAXONOMY = 'wp_block_to_post';
const BLOCK_USAGE_COUNT_CACHE_KEY_FORMAT = 'block_usage_count_%d';

/**
 * Altis\GlobalBlocks\Connections Bootstrap.
 */
function bootstrap() {
	add_action( 'init',                                __NAMESPACE__ . '\\register_relationship_taxonomy' );
	add_action( 'wp_insert_post',                      __NAMESPACE__ . '\\maybe_create_shadow_term', 10, 2 );
	add_action( 'before_delete_post',                  __NAMESPACE__ . '\\delete_shadow_term' );
	add_action( 'post_updated',                        __NAMESPACE__ . '\\synchronize_associated_terms', 10, 3 );
	add_filter( 'manage_wp_block_posts_columns',       __NAMESPACE__ . '\\manage_wp_block_posts_columns' );
	add_action( 'manage_wp_block_posts_custom_column', __NAMESPACE__ . '\\usage_column_output', 10, 2 );
}

/**
 * Get post types that can use reusable blocks and should have the relationship for the shadow taxonomy.
 *
 * @return array
 */
function get_post_types_with_reusable_blocks() : array {
	$post_types = get_post_types( [ 'public' => true ] );
	$post_types[] = GlobalBlocks\BLOCK_POST_TYPE;
	$post_types = array_unique( $post_types );
	return apply_filters( 'altis_post_types_with_reusable_blocks', $post_types );
}

/**
 * Register relationship taxonomy to relate `wp_block` post type to `post` post type.
 */
function register_relationship_taxonomy() {
	register_taxonomy(
		RELATIONSHIP_TAXONOMY,
		get_post_types_with_reusable_blocks(),
		[
			'rewrite'       => false,
			'show_ui'       => false,
			'meta_box_cb'   => false,
			'public'        => false,
		]
	);
}

/**
 * Create new shadow term for any new `wp_block` post to allow for relationships if one does not exist.
 *
 * @param int     $post_id Post ID to maybe create the shadow term for.
 * @param WP_Post $post    Post object to maybe create the shadow term for.
 *
 * @return bool Whether or not the term was created.
 */
function maybe_create_shadow_term( int $post_id, WP_Post $post ) : bool {
	if ( $post->post_type !== GlobalBlocks\BLOCK_POST_TYPE ) {
		return false;
	}

	if ( 'auto-draft' === $post->post_status ) {
		return false;
	}

	$term = get_associated_term( $post_id, RELATIONSHIP_TAXONOMY );

	// If no term exists, create the term.
	if ( ! $term ) {
		return create_shadow_taxonomy_term( $post_id, $post, RELATIONSHIP_TAXONOMY );
	}

	// Verify that the shadow term name and slug are in sync with the post title and slug.
	if ( shadow_term_in_sync( $term, $post ) ) {
		return false;
	}

	// If not, update the term.
	$term_data = wp_update_term(
		$term->term_id,
		RELATIONSHIP_TAXONOMY,
		[
			'name' => $post->post_title,
			'slug' => $post->post_name,
		]
	);

	return ! is_wp_error( $term_data );
}

/**
 * Creates the shadow term and set the term meta to create the association.
 *
 * @param int    $post_id   Post ID.
 * @param WP_Post $post     WP Post Object.
 *
 * @return bool True if created or false if an error occurred.
 */
function create_shadow_taxonomy_term( int $post_id, WP_Post $post ) : bool {
	$shadow_term = wp_insert_term(
		$post->post_title,
		RELATIONSHIP_TAXONOMY,
		[
			'slug' => $post->post_name
		]
	 );

	if ( is_wp_error( $shadow_term ) ) {
		return false;
	}

	$shadow_term_id = $shadow_term['term_id'];

	update_term_meta( $shadow_term_id, 'shadow_post_id', $post_id );
	update_post_meta( $post_id, 'shadow_term_id', $shadow_term_id );

	return true;
}

/**
 * Deletes a shadow taxonomy term before the associated post is deleted.
 *
 * @param int $post_id Post ID to delete the shadow taxonomy term for.
 *
 * @return bool True if successfully deleted, false if the post is the wrong post_type or if there is no associated term.
 */
function delete_shadow_term( int $post_id ) : bool {
	$post_type = get_post_type( $post_id );

	if ( $post_type !== GlobalBlocks\BLOCK_POST_TYPE ) {
		return false;
	}

	$term = get_associated_term( $post_id, RELATIONSHIP_TAXONOMY );

	if ( ! $term ) {
		return false;
	}

	$term_deleted = wp_delete_term( $term->term_id, RELATIONSHIP_TAXONOMY );

	return ! is_wp_error( $term_deleted );
}

/**
 * Gets the associated post object for a given term_id.
 *
 * @param int $term_id Term ID to retreive the associated post object for.
 *
 * @return WP_Post|null The associated post object or null if no post is found.
 */
function get_associated_post( int $term_id ) {
	$post_id = get_associated_post_id( $term_id );

	return get_post( $post_id );
}

/**
 * Gets the associated shadow post_id of a given term_id.
 *
 * @param int $term_id Term ID to retreive the post_id for.
 *
 * @return int The post_id or 0 if no associated post is found.
 */
function get_associated_post_id( int $term_id ) : int {
	$post_id = get_term_meta( $term_id, 'shadow_post_id', true );

	return $post_id ? intval( $post_id ) : 0;
}

/**
 * Gets the associated term object for a given post_id.
 *
 * @param int $post_id Post ID to retreive the associated term object for.
 *
 * @return bool|WP_Term Returns the associated term object or false if no term is found.
 */
function get_associated_term( int $post_id ) {
	$term_id = get_associated_term_id( $post_id );

	return get_term_by( 'id', $term_id, RELATIONSHIP_TAXONOMY );
}

/**
 * Gets the associated shadow term ID of a given post object
 *
 * @param int $post Post ID to get shadow term for.
 *
 * @return int The term_id or 0 if no associated term was found.
 */
function get_associated_term_id( int $post_id ) : int {
	$shadow_term_id = get_post_meta( $post_id, 'shadow_term_id', true );

	return $shadow_term_id ? intval( $shadow_term_id ) : 0;
}

/**
 * Checks to see if the current term and its associated post have the same title and slug.
 * While we generally rely on term and post meta to track association, it is important that these two value stay synced.
 *
 * @param WP_Term $term Term object to check.
 * @param WP_Post $post Post object to check.
 *
 * @return bool True if a match is found, or false if no match is found.
 */
function shadow_term_in_sync( WP_Term $term, WP_Post $post ) : bool {
	return ( $term->name === $post->post_title && $term->slug === $post->post_name );
}

/**
 * Parse the post content to find reusable blocks and set the relationship
 * with the shadow taxonomy term for each reusable block.
 *
 * @param int     $post_id     The ID of the post that has been updated.
 * @param WP_Post $post_after  New state of the post data.
 * @param WP_Post $post_before Old state of the post data.
 *
 * @return bool False if post is an invalid post type, the content from $post_before and $post_after
 * are the same, or if there are no reusable blocks. True if the object terms are set successfully.
 */
function synchronize_associated_terms( int $post_id, WP_Post $post_after, WP_Post $post_before ) : bool {
	if ( ! in_array( $post_after->post_type, get_post_types_with_reusable_blocks(), true ) ) {
		return false;
	}

	if ( $post_after->post_content === $post_before->post_content ) {
		return false;
	}

	// Get all the reusable blocks from the content.
	$reusable_blocks = array_reduce(
		parse_blocks( $post_after->post_content ),
		function( $blocks, $block ) {
			if ( $block['blockName'] !== 'core/block' ) {
				return $blocks;
			}

			$blocks[] = $block['attrs'];
			return $blocks;
		},
		[]
	);

	if ( empty( $reusable_blocks ) ) {
		$terms_set = wp_set_object_terms( $post_id, null, RELATIONSHIP_TAXONOMY );

		return ! is_wp_error( $terms_set );
	}

	$shadow_term_ids = [];

	// Loop through the reusable blocks and get the shadow term ID of the block.
	foreach ( $reusable_blocks as $block ) {
		$block_post_id = $block['ref'];
		$shadow_term_ids[] = get_associated_term_id( $block_post_id );

		// Delete usage count cache.
		wp_cache_delete( sprintf( BLOCK_USAGE_COUNT_CACHE_KEY_FORMAT, $block_post_id ) );
	}

	// Set the post relationships to the shadow terms.
	$terms_set = wp_set_object_terms( $post_id, $shadow_term_ids, RELATIONSHIP_TAXONOMY );

	return ! is_wp_error( $terms_set );
}

/**
 * Adds the usage count column to the `wp_block` post list table.
 *
 * @param array $columns - Columns to be filtered.
 *
 * @return array - Filtered columns.
 */
function manage_wp_block_posts_columns( array $columns ) : array {
	unset( $columns['date'] );
	$columns['usage-count'] = __( 'Usage Count', 'altis' );
	$columns['date'] = __( 'Date', 'altis' );

	return $columns;
}

/**
 * Renders the usage count for the post list table custom column.
 *
 * @param string $column - Custom column slug name.
 * @param int $post_id - Post to display data for.
 */
function usage_column_output( $column, $post_id ) {
	if ( $column !== 'usage-count' ) {
		return;
	}

	$term_id = get_associated_term_id( $post_id );

	// Return a blank array if no term_id is found.
	if ( ! $term_id ) {
		return;
	}

	$cache_key = sprintf( BLOCK_USAGE_COUNT_CACHE_KEY_FORMAT, $post_id );

	$count = wp_cache_get( $cache_key );

	if ( $count === false ) {
		// phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		$query_args = [
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'no_found_rows'  => true,
			'post_type'      => get_post_types_with_reusable_blocks(),
			'post_status'    => 'any',
			'tax_query' => [
				[
					'taxonomy' => RELATIONSHIP_TAXONOMY,
					'field' => 'term_id',
					'terms' => $term_id,
				]
			]
		];
		// phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_tax_query

		$query  = new WP_Query();
		$query_results = $query->query( $query_args );
		$count = $query->post_count;

		// Cache for 8 hours since we are busting the cache any time the usage gets changed.
		wp_cache_set( $cache_key, $count, '', 8 * 60 * 60 );
	}

	printf( '<a href="%s">%d</a>', esc_url( get_edit_post_link( $post_id ) ), esc_html( $count ) );
}
