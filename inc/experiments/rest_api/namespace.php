<?php
/**
 * Experiments REST API.
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Experiments\Rest_API;

use Altis\Accelerate\Experiments;
use Altis\Accelerate\GlobalBlocks\Connections;
use WP_Query;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Hooks up the experiments REST API endpoints.
 */
function setup() {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_routes' );
}

/**
 * Register experiments API endpoints.
 */
function register_routes() {
	register_rest_route( 'accelerate/v1', 'experiments', [
		[
			'methods' => WP_REST_Server::READABLE,
			'callback' => __NAMESPACE__ . '\\get_experiments',
			'permission_callback' => __NAMESPACE__ . '\\check_permission',
			'args' => [
				'status' => [
					'type' => 'string',
					'default' => '',
					'enum' => [ '', 'running', 'paused', 'completed', 'draft', 'active' ],
					'sanitize_callback' => 'sanitize_text_field',
				],
				'type' => [
					'type' => 'string',
					'default' => '',
					'enum' => [ '', 'block', 'personalization', 'titles', 'featured_images' ],
					'sanitize_callback' => 'sanitize_text_field',
				],
				'search' => [
					'type' => 'string',
					'default' => '',
					'sanitize_callback' => 'sanitize_text_field',
				],
				'orderby' => [
					'type' => 'string',
					'default' => 'status',
					'enum' => [ 'status', 'start_time', 'title' ],
					'sanitize_callback' => 'sanitize_text_field',
				],
				'order' => [
					'type' => 'string',
					'default' => 'desc',
					'enum' => [ 'asc', 'desc' ],
					'sanitize_callback' => 'sanitize_text_field',
				],
				'page' => [
					'type' => 'integer',
					'default' => 1,
					'minimum' => 1,
					'sanitize_callback' => 'absint',
				],
				'per_page' => [
					'type' => 'integer',
					'default' => 20,
					'minimum' => 1,
					'maximum' => 100,
					'sanitize_callback' => 'absint',
				],
			],
		],
	] );
}

/**
 * Check user can edit posts.
 *
 * @return bool
 */
function check_permission() : bool {
	return current_user_can( 'edit_posts' );
}

/**
 * Get experiments list.
 *
 * @param WP_REST_Request $request The REST request object.
 * @return WP_REST_Response
 */
function get_experiments( WP_REST_Request $request ) : WP_REST_Response {
	$type_filter = $request->get_param( 'type' );
	$status_filter = $request->get_param( 'status' );
	$search = $request->get_param( 'search' );
	$orderby = $request->get_param( 'orderby' );
	$order = $request->get_param( 'order' );
	$page = $request->get_param( 'page' );
	$per_page = $request->get_param( 'per_page' );

	$experiments = [];

	// 1. A/B Block experiments.
	if ( ! $type_filter || $type_filter === 'block' ) {
		$block_query = new WP_Query( [
			'post_type' => 'wp_block',
			'post_status' => [ 'publish', 'draft' ],
			'posts_per_page' => -1,
			'no_found_rows' => true,
			's' => $search ?: null,
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
			'meta_query' => [
				[
					'key' => '_xb_type',
					'value' => 'abtest',
				],
			],
		] );

		foreach ( $block_query->posts as $post ) {
			$experiments[] = format_experiment( $post, 'block' );
		}
	}

	// 2. Personalization blocks.
	if ( ! $type_filter || $type_filter === 'personalization' ) {
		$personalization_query = new WP_Query( [
			'post_type' => 'wp_block',
			'post_status' => [ 'publish', 'draft' ],
			'posts_per_page' => -1,
			'no_found_rows' => true,
			's' => $search ?: null,
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
			'meta_query' => [
				[
					'key' => '_xb_type',
					'value' => 'personalization',
				],
			],
		] );

		foreach ( $personalization_query->posts as $post ) {
			$experiments[] = format_experiment( $post, 'personalization' );
		}
	}

	// 3. Title tests.
	if ( ! $type_filter || $type_filter === 'titles' ) {
		$supported_types = get_post_types_by_support( 'altis.experiments.titles' );
		if ( ! empty( $supported_types ) ) {
			$title_query = new WP_Query( [
				'post_type' => $supported_types,
				'post_status' => [ 'publish', 'draft' ],
				'posts_per_page' => -1,
				'no_found_rows' => true,
				's' => $search ?: null,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				'meta_query' => [
					[
						'key' => '_altis_ab_test_titles_variants',
						'compare' => 'EXISTS',
					],
				],
			] );

			foreach ( $title_query->posts as $post ) {
				$experiments[] = format_experiment( $post, 'titles' );
			}
		}
	}

	// 4. Featured image tests.
	if ( ! $type_filter || $type_filter === 'featured_images' ) {
		$supported_types = get_post_types_by_support( 'altis.experiments.featured_images' );
		if ( ! empty( $supported_types ) ) {
			$image_query = new WP_Query( [
				'post_type' => $supported_types,
				'post_status' => [ 'publish', 'draft' ],
				'posts_per_page' => -1,
				'no_found_rows' => true,
				's' => $search ?: null,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				'meta_query' => [
					[
						'key' => '_altis_ab_test_featured_images_variants',
						'compare' => 'EXISTS',
					],
				],
			] );

			foreach ( $image_query->posts as $post ) {
				$experiments[] = format_experiment( $post, 'featured_images' );
			}
		}
	}

	// Apply status filter.
	if ( $status_filter ) {
		$experiments = array_filter( $experiments, function ( $experiment ) use ( $status_filter ) {
			if ( $status_filter === 'active' ) {
				return in_array( $experiment['status'], [ 'running', 'paused' ], true );
			}
			return $experiment['status'] === $status_filter;
		} );
		$experiments = array_values( $experiments );
	}

	// Sort experiments.
	usort( $experiments, function ( $a, $b ) use ( $orderby, $order ) {
		$result = 0;

		switch ( $orderby ) {
			case 'title':
				$result = strcasecmp( $a['title'], $b['title'] );
				break;

			case 'start_time':
				$a_time = $a['start_time'] ? strtotime( $a['start_time'] ) : 0;
				$b_time = $b['start_time'] ? strtotime( $b['start_time'] ) : 0;
				$result = $a_time - $b_time;
				break;

			case 'status':
			default:
				// Active first, then completed, then draft.
				$status_order = [
					'running' => 0,
					'paused' => 1,
					'completed' => 2,
					'draft' => 3,
				];
				$a_order = $status_order[ $a['status'] ] ?? 4;
				$b_order = $status_order[ $b['status'] ] ?? 4;
				$result = $a_order - $b_order;

				// Within same status, sort by start_time desc.
				if ( $result === 0 ) {
					$a_time = $a['start_time'] ? strtotime( $a['start_time'] ) : 0;
					$b_time = $b['start_time'] ? strtotime( $b['start_time'] ) : 0;
					$result = $b_time - $a_time;
				}
				break;
		}

		return $order === 'desc' ? -$result : $result;
	} );

	// Pagination.
	$total = count( $experiments );
	$total_pages = (int) ceil( $total / $per_page );
	$offset = ( $page - 1 ) * $per_page;
	$experiments = array_slice( $experiments, $offset, $per_page );

	$response = new WP_REST_Response( $experiments );
	$response->header( 'X-WP-Total', $total );
	$response->header( 'X-WP-TotalPages', $total_pages );

	return $response;
}

/**
 * Format an experiment for the REST API response.
 *
 * @param \WP_Post $post The post object.
 * @param string   $type The experiment type.
 * @return array
 */
function format_experiment( $post, string $type ) : array {
	$status = get_experiment_status( $post, $type );
	$variant_count = get_variant_count( $post, $type );
	$conversion_rate = null;
	$lift = null;
	$winner = null;
	$start_time = null;
	$end_time = null;

	// A/B test types have lifecycle data.
	if ( $type !== 'personalization' ) {
		$test_id = get_test_id( $type );
		$results = Experiments\get_ab_test_results_for_post( $test_id, $post->ID );

		if ( ! empty( $results['variants'] ) && count( $results['variants'] ) > 0 ) {
			// Find best variant conversion rate.
			$best_rate = 0;
			$control_rate = 0;

			foreach ( $results['variants'] as $index => $variant ) {
				$rate = $variant['rate'] ?? 0;
				if ( $index === 0 ) {
					$control_rate = $rate;
				}
				if ( $rate > $best_rate ) {
					$best_rate = $rate;
				}
			}

			if ( $best_rate > 0 ) {
				$conversion_rate = round( $best_rate * 100, 1 );
			}

			if ( $control_rate > 0 && $best_rate > $control_rate ) {
				$lift = round( ( ( $best_rate - $control_rate ) / $control_rate ) * 100, 1 );
			}

			$winner = $results['winner'] ?? null;
		}

		$start_ms = Experiments\get_ab_test_start_time_for_post( $test_id, $post->ID );
		$is_started = Experiments\is_ab_test_started_for_post( $test_id, $post->ID );

		if ( $is_started && $start_ms ) {
			$start_time = gmdate( 'c', intval( $start_ms / 1000 ) );
		}

		$end_ms = Experiments\get_ab_test_end_time_for_post( $test_id, $post->ID );
		if ( $is_started && $end_ms ) {
			$end_time = gmdate( 'c', intval( $end_ms / 1000 ) );
		}
	}

	// Usage count.
	$usage_count = 1;
	$usage_label = '';

	if ( $post->post_type === 'wp_block' ) {
		$usage_count = get_block_usage_count( $post->ID );
		// translators: %d: number of posts this block is used in.
		$usage_label = sprintf( _n( 'Used in %d post', 'Used in %d posts', $usage_count, 'altis' ), $usage_count );
	} else {
		// translators: %s: post title.
		$usage_label = sprintf( __( 'On: %s', 'altis' ), get_the_title( $post->ID ) );
	}

	// Block types return raw content for frontend preview; post types return thumbnail.
	$raw_content = null;
	$thumbnail_url = null;

	if ( in_array( $type, [ 'block', 'personalization' ], true ) ) {
		$raw_content = $post->post_content;
	} elseif ( in_array( $type, [ 'titles', 'featured_images' ], true ) ) {
		$thumbnail_url = get_the_post_thumbnail_url( $post->ID, 'medium' ) ?: null;
	}

	return [
		'id' => $post->ID,
		'title' => $post->post_title,
		'type' => $type,
		'status' => $status,
		'post_type' => $post->post_type,
		'variant_count' => $variant_count,
		'conversion_rate' => $conversion_rate,
		'lift' => $lift,
		'winner' => $winner,
		'start_time' => $start_time,
		'end_time' => $end_time,
		'usage_count' => $usage_count,
		'usage_label' => $usage_label,
		'edit_url' => get_edit_post_link( $post->ID, 'raw' ),
		'raw_content' => $raw_content,
		'thumbnail_url' => $thumbnail_url,
	];
}

/**
 * Get the status of an experiment.
 *
 * @param \WP_Post $post The post object.
 * @param string   $type The experiment type.
 * @return string
 */
function get_experiment_status( $post, string $type ) : string {
	if ( $type === 'personalization' ) {
		return $post->post_status === 'publish' ? 'running' : 'draft';
	}

	$test_id = get_test_id( $type );
	$is_started = Experiments\is_ab_test_started_for_post( $test_id, $post->ID );

	if ( ! $is_started ) {
		return 'draft';
	}

	$has_ended = Experiments\has_ab_test_ended_for_post( $test_id, $post->ID );
	if ( $has_ended ) {
		return 'completed';
	}

	// Check if expired (end_time passed but not marked ended).
	$end_time = Experiments\get_ab_test_end_time_for_post( $test_id, $post->ID );
	$now_ms = \Altis\Accelerate\Utils\milliseconds();
	if ( $end_time && $end_time <= $now_ms ) {
		return 'completed';
	}

	$is_paused = Experiments\is_ab_test_paused_for_post( $test_id, $post->ID );
	if ( $is_paused ) {
		return 'paused';
	}

	return 'running';
}

/**
 * Get the test ID for an experiment type.
 *
 * @param string $type The experiment type.
 * @return string
 */
function get_test_id( string $type ) : string {
	switch ( $type ) {
		case 'block':
			return 'block';
		case 'titles':
			return 'titles';
		case 'featured_images':
			return 'featured_images';
		default:
			return $type;
	}
}

/**
 * Get the variant count for an experiment.
 *
 * @param \WP_Post $post The post object.
 * @param string   $type The experiment type.
 * @return int
 */
function get_variant_count( $post, string $type ) : int {
	if ( $type === 'personalization' || $type === 'block' ) {
		// Count inner altis/variant blocks.
		$blocks = parse_blocks( $post->post_content );
		$count = 0;
		foreach ( $blocks as $block ) {
			if ( ! empty( $block['innerBlocks'] ) ) {
				foreach ( $block['innerBlocks'] as $inner ) {
					if ( isset( $inner['blockName'] ) && $inner['blockName'] === 'altis/variant' ) {
						$count++;
					}
				}
			}
			// Also count top-level variant blocks.
			if ( isset( $block['blockName'] ) && $block['blockName'] === 'altis/variant' ) {
				$count++;
			}
		}
		return max( $count, 0 );
	}

	$test_id = get_test_id( $type );
	$variants = Experiments\get_ab_test_variants_for_post( $test_id, $post->ID );
	return count( $variants );
}

/**
 * Get the usage count for a block.
 *
 * @param int $post_id The post ID.
 * @return int
 */
function get_block_usage_count( int $post_id ) : int {
	$term_id = Connections\get_associated_term_id( $post_id );

	if ( ! $term_id ) {
		return 0;
	}

	$cache_key = sprintf( Connections\BLOCK_USAGE_COUNT_CACHE_KEY_FORMAT, $post_id );
	$count = wp_cache_get( $cache_key );

	if ( $count === false ) {
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		$query = new WP_Query( [
			'posts_per_page' => -1,
			'fields' => 'ids',
			'no_found_rows' => true,
			'post_type' => Connections\get_post_types_with_reusable_blocks(),
			'post_status' => 'any',
			'tax_query' => [
				[
					'taxonomy' => Connections\RELATIONSHIP_TAXONOMY,
					'field' => 'term_id',
					'terms' => $term_id,
				],
			],
		] );

		$count = $query->post_count;
		wp_cache_set( $cache_key, $count, '', 8 * 60 * 60 );
	}

	return (int) $count;
}
