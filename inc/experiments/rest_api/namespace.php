<?php
/**
 * Experiments REST API.
 *
 * Provides a unified endpoint for listing, filtering, and paginating experiments
 * from the dedicated experiments table. The collection endpoint returns a
 * UI-compatible shape consumed by the React overview dashboard.
 *
 * @package Altis\Accelerate\Experiments\REST_API
 */

namespace Altis\Accelerate\Experiments\REST_API;

use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\GlobalBlocks\Connections;
use WP_Error;
use WP_Post;
use WP_Query;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

const REST_NAMESPACE = 'accelerate/v1';

/**
 * Register REST routes.
 */
function register_routes() {
	register_rest_route( REST_NAMESPACE, '/experiments', [
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => __NAMESPACE__ . '\\get_experiments',
			'permission_callback' => __NAMESPACE__ . '\\can_view_experiments',
			'args'                => get_collection_params(),
		],
	] );

	register_rest_route( REST_NAMESPACE, '/experiments/(?P<id>\d+)', [
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => __NAMESPACE__ . '\\get_experiment',
			'permission_callback' => __NAMESPACE__ . '\\can_view_experiments',
			'args'                => [
				'id' => [
					'type'              => 'integer',
					'required'          => true,
					'sanitize_callback' => 'absint',
				],
			],
		],
	] );

	register_rest_route( REST_NAMESPACE, '/experiments/counts', [
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => __NAMESPACE__ . '\\get_experiment_counts',
			'permission_callback' => __NAMESPACE__ . '\\can_view_experiments',
		],
	] );
}

/**
 * Permission callback: check if user can view experiments.
 *
 * @return bool
 */
function can_view_experiments() : bool {
	return current_user_can( 'edit_posts' );
}

/**
 * Get collection query parameters (UI-compatible).
 *
 * @return array<string, array<string, mixed>>
 */
function get_collection_params() : array {
	return [
		'status' => [
			'type'              => 'string',
			'default'           => '',
			'enum'              => [ '', 'running', 'paused', 'completed', 'draft', 'active' ],
			'sanitize_callback' => 'sanitize_text_field',
		],
		'type' => [
			'type'              => 'string',
			'default'           => '',
			'enum'              => [ '', 'block', 'personalization', 'titles', 'featured_images', 'post_tests' ],
			'sanitize_callback' => 'sanitize_text_field',
		],
		'search' => [
			'type'              => 'string',
			'default'           => '',
			'sanitize_callback' => 'sanitize_text_field',
		],
		'orderby' => [
			'type'              => 'string',
			'default'           => 'status',
			'enum'              => [ 'status', 'start_time', 'title' ],
			'sanitize_callback' => 'sanitize_text_field',
		],
		'order' => [
			'type'              => 'string',
			'default'           => 'DESC',
			'enum'              => [ 'ASC', 'DESC' ],
			'sanitize_callback' => 'sanitize_text_field',
		],
		'page' => [
			'type'              => 'integer',
			'default'           => 1,
			'minimum'           => 1,
			'sanitize_callback' => 'absint',
		],
		'per_page' => [
			'type'              => 'integer',
			'default'           => 20,
			'minimum'           => 1,
			'maximum'           => 100,
			'sanitize_callback' => 'absint',
		],
	];
}

/**
 * GET /accelerate/v1/experiments
 *
 * List experiments with filtering, sorting, and pagination.
 * Returns UI-compatible experiment objects for the React overview dashboard.
 *
 * @param WP_REST_Request $request Request object.
 * @return WP_REST_Response|WP_Error
 */
function get_experiments( WP_REST_Request $request ) {
	$status   = $request->get_param( 'status' ) ?: '';
	$type     = $request->get_param( 'type' ) ?: '';
	$search   = $request->get_param( 'search' ) ?: '';
	$orderby  = $request->get_param( 'orderby' ) ?: 'status';
	$order    = $request->get_param( 'order' ) ?: 'DESC';
	$page     = $request->get_param( 'page' ) ?: 1;
	$per_page = $request->get_param( 'per_page' ) ?: 20;

	$where = build_where_clauses( $status, $type, $search );

	$query = Experiment::query( $where, [
		'page'     => $page,
		'per_page' => $per_page,
		'order_by' => build_order_by_args( $orderby, $order ),
	] );

	$results = $query->get_results();

	if ( is_wp_error( $results ) ) {
		return $results;
	}

	$data = [];
	foreach ( $results as $experiment ) {
		$data[] = format_experiment_for_ui( $experiment );
	}

	$response = new WP_REST_Response( $data );
	$response->header( 'X-WP-Total', $results->get_total_available() );
	$response->header( 'X-WP-TotalPages', (int) ceil( $results->get_total_available() / $per_page ) );

	return $response;
}

/**
 * Build Foundry WHERE clauses from request parameters.
 *
 * @param string $status Status filter value.
 * @param string $type   UI type filter value.
 * @param string $search Search term.
 * @return array<string|int, mixed> Foundry-compatible where clauses.
 */
function build_where_clauses( string $status, string $type, string $search ) : array {
	$where = [];

	// Status filter.
	if ( $status === 'active' ) {
		$where['status'] = [
			'compare' => 'IN',
			'value'   => [ 'running', 'paused' ],
		];
	} elseif ( $status !== '' ) {
		$where['status'] = $status;
	}

	// Type filter: map UI types to table type + test_id.
	if ( $type !== '' ) {
		$type_where = map_type_to_where( $type );
		if ( $type_where ) {
			$where['type']    = $type_where['type'];
			$where['test_id'] = $type_where['test_id'];
		}
	}

	// Search: match experiment title or post title.
	if ( $search !== '' ) {
		$where[] = build_search_clause( $search );
	}

	return $where;
}

/**
 * Map a UI type to Foundry WHERE values for type and test_id.
 *
 * | UI type           | Table type        | Table test_id              |
 * |-------------------|-------------------|----------------------------|
 * | block             | abtest            | block                      |
 * | personalization   | personalization   | block                      |
 * | titles            | abtest            | titles                     |
 * | featured_images   | abtest            | featured_images            |
 * | post_tests        | abtest            | titles OR featured_images  |
 *
 * @param string $ui_type UI type value.
 * @return array{ type: string, test_id: string|array }|null
 */
function map_type_to_where( string $ui_type ) : ?array {
	$map = [
		'block'           => [ 'type' => 'abtest', 'test_id' => 'block' ],
		'personalization' => [ 'type' => 'personalization', 'test_id' => 'block' ],
		'titles'          => [ 'type' => 'abtest', 'test_id' => 'titles' ],
		'featured_images' => [ 'type' => 'abtest', 'test_id' => 'featured_images' ],
		'post_tests'      => [
			'type'    => 'abtest',
			'test_id' => [
				'compare' => 'IN',
				'value'   => [ 'titles', 'featured_images' ],
			],
		],
	];

	return $map[ $ui_type ] ?? null;
}

/**
 * Build a Foundry OR clause for search across title and subject_post_id.
 *
 * @param string $search Search term.
 * @return array Foundry nested OR clause.
 */
function build_search_clause( string $search ) : array {
	global $wpdb;

	$like = '%' . $wpdb->esc_like( $search ) . '%';

	$fields = [
		'title' => [
			'compare' => 'LIKE',
			'value'   => $like,
		],
	];

	// Find post IDs matching the search term.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$post_ids = $wpdb->get_col(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_title LIKE %s LIMIT 200",
			$like
		)
	);

	if ( ! empty( $post_ids ) ) {
		$fields['subject_post_id'] = [
			'compare' => 'IN',
			'value'   => array_map( 'intval', $post_ids ),
		];
	}

	return [
		'relation' => 'OR',
		'fields'   => $fields,
	];
}

/**
 * Build Foundry order_by args from request parameters.
 *
 * @param string $orderby Column to sort by (status, start_time, title).
 * @param string $order   Direction (ASC or DESC).
 * @return array<string, string> Foundry order_by array.
 */
function build_order_by_args( string $orderby, string $order ) : array {
	$direction = strtoupper( $order ) === 'ASC' ? 'ASC' : 'DESC';

	switch ( $orderby ) {
		case 'status':
			// Use special key for CASE-based priority ordering, with start_time tiebreaker.
			return [
				'__status_priority' => 'ASC',
				'start_time'        => 'DESC',
			];
		case 'start_time':
			return [ 'start_time' => $direction ];
		case 'title':
			return [ 'title' => $direction ];
		default:
			return [ 'id' => 'DESC' ];
	}
}

/**
 * Derive the UI type from an experiment's type and test_id.
 *
 * @param Experiment $experiment Experiment model.
 * @return string UI type: block, personalization, titles, or featured_images.
 */
function map_to_ui_type( Experiment $experiment ) : string {
	if ( $experiment->get_type() === 'personalization' ) {
		return 'personalization';
	}
	return $experiment->get_test_id() ?: 'block';
}

/**
 * Count block variants from post content.
 *
 * Falls back to parsing the post content for altis/variant blocks
 * when variants_snapshot is not available.
 *
 * @param WP_Post $post Post object.
 * @return int Number of variants.
 */
function count_block_variants( WP_Post $post ) : int {
	$blocks = parse_blocks( $post->post_content );
	$count  = 0;

	foreach ( $blocks as $block ) {
		if ( $block['blockName'] === 'altis/variant' ) {
			$count++;
		}
		if ( ! empty( $block['innerBlocks'] ) ) {
			foreach ( $block['innerBlocks'] as $inner ) {
				if ( $inner['blockName'] === 'altis/variant' ) {
					$count++;
				}
			}
		}
	}

	return $count;
}

/**
 * Get the usage count for a wp_block post via the Connections taxonomy.
 *
 * @param int $post_id Post ID (must be a wp_block post).
 * @return array{ count: int, label: string }
 */
function get_block_usage_count( int $post_id ) : array {
	$term_id = Connections\get_associated_term_id( $post_id );
	if ( ! $term_id ) {
		return [ 'count' => 0, 'label' => '' ];
	}

	$cache_key = sprintf( Connections\BLOCK_USAGE_COUNT_CACHE_KEY_FORMAT, $post_id );
	$count     = wp_cache_get( $cache_key );

	if ( $count === false ) {
		// phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		$query = new WP_Query( [
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'no_found_rows'  => true,
			'post_type'      => Connections\get_post_types_with_reusable_blocks(),
			'post_status'    => 'any',
			'tax_query'      => [
				[
					'taxonomy' => Connections\RELATIONSHIP_TAXONOMY,
					'field'    => 'term_id',
					'terms'    => $term_id,
				],
			],
		] );
		// phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_tax_query

		$count = $query->post_count;
		wp_cache_set( $cache_key, $count, '', 8 * 60 * 60 );
	}

	$count = (int) $count;
	if ( $count === 0 ) {
		return [ 'count' => 0, 'label' => '' ];
	}

	return [
		'count' => $count,
		'label' => sprintf(
			/* translators: %d: number of pages using this block */
			_n( 'Used on %d page', 'Used on %d pages', $count, 'altis' ),
			$count
		),
	];
}

/**
 * Format an Experiment model for the UI-compatible REST response shape.
 *
 * @param Experiment $experiment Experiment model.
 * @return array<string, mixed>
 */
function format_experiment_for_ui( Experiment $experiment ) : array {
	$post_id = $experiment->get_subject_post_id();
	$post    = get_post( $post_id );
	$ui_type = map_to_ui_type( $experiment );

	// Title: prefer experiment title, fall back to post title.
	$title = $experiment->get_title();
	if ( empty( $title ) && $post ) {
		$title = $post->post_title;
	}

	// Variant count: from snapshot, fallback to parsing post content.
	$snapshot      = $experiment->get_variants_snapshot();
	$variant_count = $snapshot ? count( $snapshot ) : 0;
	if ( $variant_count === 0 && $post && in_array( $ui_type, [ 'block', 'personalization' ], true ) ) {
		$variant_count = count_block_variants( $post );
	}

	// Results (conversion rate, lift, winner) from the experiment's own results column.
	$conversion_rate = null;
	$lift            = null;
	$winner          = null;

	if ( $ui_type !== 'personalization' ) {
		$results = wp_parse_args( $experiment->get_results(), [
			'timestamp' => 0,
			'winning'   => null,
			'winner'    => null,
			'aggs'      => [],
			'variants'  => [],
		] );

		// Fallback to live post meta results for active experiments.
		if ( empty( $results['variants'] ) && in_array( $experiment->get_status(), [ 'running', 'paused' ], true ) ) {
			$results = \Altis\Accelerate\Experiments\get_ab_test_results_for_post( $experiment->get_test_id(), $post_id );
		}

		if ( ! empty( $results['variants'] ) ) {
			// Overall conversion rate from aggregated results.
			$total_views       = 0;
			$total_conversions = 0;
			foreach ( $results['variants'] as $variant ) {
				$total_views       += $variant['size'] ?? 0;
				$total_conversions += ( $variant['size'] ?? 0 ) * ( $variant['rate'] ?? 0 );
			}
			if ( $total_views > 0 ) {
				$conversion_rate = round( ( $total_conversions / $total_views ) * 100, 1 );
			}

			// Lift: compare best variant to control.
			if ( count( $results['variants'] ) >= 2 ) {
				$control_rate = $results['variants'][0]['rate'] ?? 0;
				$best_rate    = $control_rate;
				foreach ( $results['variants'] as $variant ) {
					if ( ( $variant['rate'] ?? 0 ) > $best_rate ) {
						$best_rate = $variant['rate'];
					}
				}
				if ( $control_rate > 0 ) {
					$lift = round( ( ( $best_rate - $control_rate ) / $control_rate ) * 100, 1 );
				}
			}
		}

		if ( $results['winner'] !== null ) {
			$winner = (int) $results['winner'];
		}
	}

	// Time fields: convert from milliseconds to ISO 8601.
	$start_time = $experiment->get_start_time();
	$end_time   = $experiment->get_end_time();

	// Usage count for wp_block posts.
	$usage_count = 0;
	$usage_label = '';
	if ( $post && $post->post_type === 'wp_block' ) {
		$usage       = get_block_usage_count( $post_id );
		$usage_count = $usage['count'];
		$usage_label = $usage['label'];
	}

	// Raw content for block preview (block/personalization types).
	$raw_content = null;
	if ( $post && in_array( $ui_type, [ 'block', 'personalization' ], true ) ) {
		$raw_content = $post->post_content;
	}

	// Thumbnail URL for title/featured_image types.
	$thumbnail_url = null;
	if ( $post && in_array( $ui_type, [ 'titles', 'featured_images' ], true ) ) {
		$thumbnail_url = get_the_post_thumbnail_url( $post_id, 'medium' ) ?: null;
	}

	// Variant image thumbnails for featured_images experiments.
	// The snapshot may be incomplete, so fall back to the post meta which
	// stores the full set of variant attachment IDs.
	$variant_thumbnails = null;
	if ( $post && $ui_type === 'featured_images' ) {
		// Prefer post meta (complete variant set) over snapshot (may be partial).
		$variant_ids = get_post_meta( $post_id, '_altis_ab_test_featured_images_variants', true );
		if ( empty( $variant_ids ) ) {
			$variant_ids = $snapshot;
		}
		if ( is_array( $variant_ids ) && ! empty( $variant_ids ) ) {
			$variant_thumbnails = array_map( function ( $attachment_id ) {
				return wp_get_attachment_image_url( (int) $attachment_id, 'medium' );
			}, $variant_ids );
			$variant_thumbnails = array_filter( $variant_thumbnails );
			$variant_thumbnails = array_values( $variant_thumbnails );
		}
	}

	// Default title text for titles experiments (control variant).
	$default_title = null;
	if ( $ui_type === 'titles' && $snapshot && ! empty( $snapshot[0] ) ) {
		$default_title = $snapshot[0];
	}

	return [
		'id'              => $experiment->get_id(),
		'title'           => $title ?: '',
		'type'            => $ui_type,
		'status'          => $experiment->get_status(),
		'post_type'       => $post ? $post->post_type : '',
		'variant_count'   => $variant_count,
		'conversion_rate' => $conversion_rate,
		'lift'            => $lift,
		'winner'          => $winner,
		'start_time'      => $start_time ? gmdate( 'c', (int) ( $start_time / 1000 ) ) : null,
		'end_time'        => $end_time ? gmdate( 'c', (int) ( $end_time / 1000 ) ) : null,
		'usage_count'     => $usage_count,
		'usage_label'     => $usage_label,
		'edit_url'        => $post ? get_edit_post_link( $post->ID, 'raw' ) : '',
		'raw_content'         => $raw_content,
		'thumbnail_url'       => $thumbnail_url,
		'variant_thumbnails'  => $variant_thumbnails,
		'default_title'       => $default_title,
	];
}

/**
 * GET /accelerate/v1/experiments/{id}
 *
 * Get a single experiment.
 *
 * @param WP_REST_Request $request Request object.
 * @return WP_REST_Response|WP_Error
 */
function get_experiment( WP_REST_Request $request ) {
	$id = $request->get_param( 'id' );
	$experiment = Experiment::get( $id );

	if ( ! $experiment ) {
		return new WP_Error(
			'experiment_not_found',
			__( 'Experiment not found.', 'altis-analytics' ),
			[ 'status' => 404 ]
		);
	}

	return new WP_REST_Response( prepare_experiment_for_response( $experiment ) );
}

/**
 * GET /accelerate/v1/experiments/counts
 *
 * Get status counts for experiments.
 *
 * @return WP_REST_Response
 */
function get_experiment_counts() : WP_REST_Response {
	global $wpdb;

	$table = $wpdb->prefix . 'accelerate_experiments';
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		"SELECT status, COUNT(*) as count FROM `{$table}` GROUP BY status"
	);

	$counts = [
		'draft'     => 0,
		'running'   => 0,
		'paused'    => 0,
		'completed' => 0,
	];

	if ( $rows ) {
		foreach ( $rows as $row ) {
			if ( isset( $counts[ $row->status ] ) ) {
				$counts[ $row->status ] = (int) $row->count;
			}
		}
	}

	$counts['total'] = array_sum( $counts );

	return new WP_REST_Response( $counts );
}

/**
 * Prepare an experiment for REST API response (original shape).
 *
 * Used by the single /{id} endpoint. Kept for backwards compatibility.
 *
 * @param Experiment $experiment Experiment model.
 * @return array<string, mixed>
 */
function prepare_experiment_for_response( Experiment $experiment ) : array {
	$data = $experiment->to_array();

	// Add the subject post title and edit URL.
	$post = get_post( $experiment->get_subject_post_id() );
	if ( $post ) {
		$data['subject_post_title'] = $post->post_title;
		$data['edit_url']           = get_edit_post_link( $post->ID, 'raw' );
	}

	// Add variant count from snapshot.
	$snapshot = $experiment->get_variants_snapshot();
	$data['variants_count'] = $snapshot ? count( $snapshot ) : 0;

	return $data;
}
