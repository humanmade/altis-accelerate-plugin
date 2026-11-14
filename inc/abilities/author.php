<?php
/**
 * Accelerate Abilities API - Author Domain.
 *
 * Author-centric analytics abilities for tracking author performance.
 *
 * @package Altis\Accelerate\Abilities\Author
 */

namespace Altis\Accelerate\Abilities\Author;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Helpers;
use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_Error;

/**
 * Register all author abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_get_author_performance();
	register_get_author_content();
}

/**
 * Register accelerate/get-author-performance ability.
 *
 * Performance metrics for a specific author or all authors.
 *
 * @return void
 */
function register_get_author_performance() : void {
	wp_register_ability( 'accelerate/get-author-performance', [
		'label'       => __( 'Get Author Performance', 'altis' ),
		'description' => __( 'Get performance metrics for a specific author or compare all authors.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'author_id' => [
					'type'        => 'integer',
					'description' => __( 'Specific author ID. Omit to get all authors.', 'altis' ),
				],
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'limit' => [
					'type'    => 'integer',
					'default' => 20,
					'minimum' => 1,
					'maximum' => 100,
				],
				'order_by' => [
					'type'    => 'string',
					'enum'    => [ 'views', 'conversions', 'conversion_rate', 'posts_count' ],
					'default' => 'views',
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'authors' => [ 'type' => 'array' ],
				'period'  => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_author_performance',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing author performance...', 'altis' ),
		],
	] );
}

/**
 * Execute get-author-performance ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Author performance data or error.
 */
function execute_get_author_performance( array $input ) {
	$author_id = $input['author_id'] ?? null;
	$limit = min( $input['limit'] ?? 20, 100 );
	$order_by = $input['order_by'] ?? 'views';

	// Parse date range.
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );

	// Get top content data, scoped to the author's posts.
	$filter = new API\Filter();
	if ( $author_id ) {
		$author_post_ids = get_posts( [
			'author'         => $author_id,
			'post_type'      => get_post_types( [ 'public' => true ] ),
			'post_status'    => 'publish',
			'fields'         => 'ids',
			'posts_per_page' => -1,
		] );

		if ( ! empty( $author_post_ids ) ) {
			$filter->include = $author_post_ids;
		}
	}

	$data = API\get_top_data( $dates['start'], $dates['end'], $filter );

	if ( is_wp_error( $data ) ) {
		return $data;
	}

	// Aggregate by author.
	$author_metrics = [];

	foreach ( $data['posts'] ?? [] as $post ) {
		$post_author = get_post_field( 'post_author', $post['id'] );
		if ( ! $post_author ) {
			continue;
		}

		$post_author = (int) $post_author;

		if ( ! isset( $author_metrics[ $post_author ] ) ) {
			$user = get_user_by( 'id', $post_author );
			$author_metrics[ $post_author ] = [
				'author_id'     => $post_author,
				'author_name'   => $user ? $user->display_name : __( 'Unknown', 'altis' ),
				'author_avatar' => $user ? get_avatar_url( $post_author, [ 'size' => 48 ] ) : '',
				'posts_count'   => 0,
				'total_views'   => 0,
				'total_visitors' => 0,
				'total_conversions' => 0,
				'conversion_views'  => 0, // Views only from posts that track conversions.
				'top_post'      => null,
				'top_post_views' => 0,
			];
		}

		$views = $post['views'] ?? 0;
		$visitors = $post['visitors'] ?? 0;
		$conversions = $post['lift']['conversions'] ?? 0;

		$author_metrics[ $post_author ]['posts_count']++;
		$author_metrics[ $post_author ]['total_views'] += $views;
		$author_metrics[ $post_author ]['total_visitors'] += $visitors;
		$author_metrics[ $post_author ]['total_conversions'] += $conversions;

		// Only count views from posts that have a goal set (i.e. actually track conversions).
		$has_goal = get_post_meta( $post['id'], '_goal', true ) || get_post_meta( $post['id'], '_xb_goal', true );
		if ( $has_goal ) {
			$author_metrics[ $post_author ]['conversion_views'] += $views;
		}

		// Track top post.
		if ( $views > $author_metrics[ $post_author ]['top_post_views'] ) {
			$author_metrics[ $post_author ]['top_post'] = [
				'post_id' => $post['id'],
				'title'   => $post['title'],
				'views'   => $views,
			];
			$author_metrics[ $post_author ]['top_post_views'] = $views;
		}
	}

	// Calculate derived metrics.
	foreach ( $author_metrics as &$author ) {
		// Conversion rate is only meaningful for posts that track conversions.
		$author['conversion_rate'] = $author['conversion_views'] > 0
			? round( ( $author['total_conversions'] / $author['conversion_views'] ) * 100, 2 )
			: 0;
		$author['avg_views_per_post'] = $author['posts_count'] > 0
			? round( $author['total_views'] / $author['posts_count'], 2 )
			: 0;

		// Remove temporary tracking fields.
		unset( $author['top_post_views'], $author['conversion_views'] );
	}
	unset( $author );

	// Sort by specified field.
	$sort_map = [
		'views'           => 'total_views',
		'conversions'     => 'total_conversions',
		'conversion_rate' => 'conversion_rate',
		'posts_count'     => 'posts_count',
	];
	$sort_field = $sort_map[ $order_by ] ?? 'total_views';

	usort( $author_metrics, fn( $a, $b ) => $b[ $sort_field ] <=> $a[ $sort_field ] );

	return [
		'authors' => array_slice( array_values( $author_metrics ), 0, $limit ),
		'period'  => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}

/**
 * Register accelerate/get-author-content ability.
 *
 * All content by a specific author with metrics.
 *
 * @return void
 */
function register_get_author_content() : void {
	wp_register_ability( 'accelerate/get-author-content', [
		'label'       => __( 'Get Author Content', 'altis' ),
		'description' => __( 'Get all content by a specific author with performance metrics.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'author_id' => [
					'type'        => 'integer',
					'description' => __( 'Author user ID.', 'altis' ),
				],
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'order_by' => [
					'type'    => 'string',
					'enum'    => [ 'views', 'conversions', 'publish_date' ],
					'default' => 'views',
				],
				'limit' => [
					'type'    => 'integer',
					'default' => 50,
					'minimum' => 1,
					'maximum' => 100,
				],
			],
			'required' => [ 'author_id' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'author' => [ 'type' => 'object' ],
				'posts'  => [ 'type' => 'array' ],
				'period' => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_author_content',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Fetching author content...', 'altis' ),
		],
	] );
}

/**
 * Execute get-author-content ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Author content data or error.
 */
function execute_get_author_content( array $input ) {
	$author_id = $input['author_id'] ?? 0;
	$limit = min( $input['limit'] ?? 50, 100 );
	$order_by = $input['order_by'] ?? 'views';

	if ( ! $author_id ) {
		return new WP_Error( 'missing_author_id', __( 'author_id is required.', 'altis' ) );
	}

	// Validate author exists.
	$user = get_user_by( 'id', $author_id );
	if ( ! $user ) {
		return new WP_Error( 'invalid_author', __( 'Author not found.', 'altis' ) );
	}

	// Parse date range.
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );

	// Get comparison period for velocity calculation.
	$comparison = Helpers\get_comparison_period( $dates['start'], $dates['end'] );

	// Get top content data scoped to the author's posts.
	$author_post_ids = get_posts( [
		'author'         => $author_id,
		'post_type'      => get_post_types( [ 'public' => true ] ),
		'post_status'    => 'publish',
		'fields'         => 'ids',
		'posts_per_page' => -1,
	] );

	$filter = new API\Filter();
	if ( ! empty( $author_post_ids ) ) {
		$filter->include = $author_post_ids;
	}

	$current_data = API\get_top_data( $dates['start'], $dates['end'], $filter );
	$previous_data = API\get_top_data( $comparison['start'], $comparison['end'], $filter );

	if ( is_wp_error( $current_data ) ) {
		return $current_data;
	}

	// Build previous period lookup.
	$previous_lookup = [];
	if ( ! is_wp_error( $previous_data ) ) {
		foreach ( $previous_data['posts'] ?? [] as $post ) {
			$previous_lookup[ $post['id'] ] = $post['views'] ?? 0;
		}
	}

	// Format posts with metrics.
	$posts = [];
	foreach ( $current_data['posts'] ?? [] as $post ) {
		$views = $post['views'] ?? 0;
		$conversions = $post['lift']['conversions'] ?? 0;
		$previous_views = $previous_lookup[ $post['id'] ] ?? 0;

		$velocity = Helpers\calculate_velocity( $views, $previous_views );

		$posts[] = [
			'post_id'         => $post['id'],
			'title'           => $post['title'],
			'url'             => $post['url'] ?? '',
			'publish_date'    => get_the_date( 'c', $post['id'] ),
			'views'           => $views,
			'visitors'        => $post['visitors'] ?? 0,
			'conversions'     => $conversions,
			'conversion_rate' => $views > 0 ? round( ( $conversions / $views ) * 100, 2 ) : 0,
			'velocity'        => $velocity,
		];
	}

	// Sort by specified field.
	if ( $order_by === 'publish_date' ) {
		usort( $posts, fn( $a, $b ) => strtotime( $b['publish_date'] ) <=> strtotime( $a['publish_date'] ) );
	} elseif ( $order_by === 'conversions' ) {
		usort( $posts, fn( $a, $b ) => $b['conversions'] <=> $a['conversions'] );
	} else {
		usort( $posts, fn( $a, $b ) => $b['views'] <=> $a['views'] );
	}

	return [
		'author' => [
			'id'     => $author_id,
			'name'   => $user->display_name,
			'avatar' => get_avatar_url( $author_id, [ 'size' => 96 ] ),
		],
		'posts'  => array_slice( $posts, 0, $limit ),
		'period' => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}
