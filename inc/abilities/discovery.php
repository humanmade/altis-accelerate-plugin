<?php
/**
 * Accelerate Abilities API - Discovery Domain.
 *
 * Domain A: Discovery & Context (Eyes)
 * Read-only abilities that provide context to prevent AI hallucinations.
 *
 * @package Altis\Accelerate\Abilities\Discovery
 */

namespace Altis\Accelerate\Abilities\Discovery;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Helpers;
use Altis\Accelerate\API;
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\GlobalBlocks;
use WP_Error;

/**
 * Register all discovery abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_get_performance_summary();
	register_list_active_experiments();
	register_list_experiments();
	register_get_audience_segments();
	register_get_audience_fields();
	register_get_top_content();
	register_get_post_performance();
	register_get_content_diff();
	register_get_traffic_breakdown();
	register_get_taxonomy_performance();
	register_get_site_context();
}

/**
 * Register accelerate/get-performance-summary ability.
 *
 * Retrieves aggregated performance metrics with granular control.
 *
 * @return void
 */
function register_get_performance_summary() : void {
	wp_register_ability( 'accelerate/get-performance-summary', [
		'label'       => __( 'Get Performance Summary', 'altis' ),
		'description' => __( 'Retrieve aggregated performance metrics for blocks, posts, experiments, or the entire site.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'entity_type' => [
					'type'        => 'string',
					'enum'        => [ 'block', 'post', 'experiment', 'site' ],
					'default'     => 'site',
					'description' => __( 'Type of entity to get performance for.', 'altis' ),
				],
				'entity_id' => [
					'type'        => 'integer',
					'description' => __( 'Required for block/post/experiment entity types.', 'altis' ),
				],
				'date_range_preset' => [
					'type'        => 'string',
					'enum'        => [ '1h', '4h', '12h', '24h', '7d', '30d', '90d' ],
					'description' => __( 'Preset date range. If provided, date_range is ignored.', 'altis' ),
				],
				'date_range' => Abilities\get_date_range_schema(),
				'granularity' => [
					'type'        => 'string',
					'enum'        => [ '5min', '15min', '30min', '1h', 'hourly', 'daily', 'weekly', 'aggregate', 'auto' ],
					'default'     => 'auto',
					'description' => __( 'Time series granularity. Use "auto" to select based on date range.', 'altis' ),
				],
				'segment' => [
					'type'        => 'string',
					'description' => __( 'Optional audience segment filter, e.g., "mobile", "returning".', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'views'               => [ 'type' => 'integer' ],
				'visitors'            => [ 'type' => 'integer' ],
				'conversions'         => [ 'type' => 'integer' ],
				'conversion_rate'     => [ 'type' => 'number' ],
				'confidence_interval' => [ 'type' => 'object' ],
				'time_series'         => [ 'type' => 'array' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_performance_summary',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Querying Accelerate Analytics Engine for performance data...', 'altis' ),
		],
	] );
}

/**
 * Execute get-performance-summary ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Performance data or error.
 */
function execute_get_performance_summary( array $input ) {
	$entity_type = $input['entity_type'] ?? 'site';
	$entity_id = $input['entity_id'] ?? null;

	// Parse date range with preset support.
	$preset = $input['date_range_preset'] ?? null;
	if ( $preset ) {
		$dates = Helpers\resolve_preset_to_dates( $preset );
	} else {
		$dates = Abilities\parse_date_range( $input, 7 );
	}

	// Handle granularity.
	$granularity = $input['granularity'] ?? 'auto';

	// Auto-select granularity based on preset or duration.
	if ( $granularity === 'auto' ) {
		if ( $preset ) {
			$granularity = Helpers\get_auto_granularity( $preset );
		} else {
			// Calculate based on duration.
			$duration = $dates['end'] - $dates['start'];
			if ( $duration <= 3600 ) {
				$granularity = '5min';
			} elseif ( $duration <= 14400 ) {
				$granularity = '15min';
			} elseif ( $duration <= 43200 ) {
				$granularity = '30min';
			} elseif ( $duration <= 86400 ) {
				$granularity = '1h';
			} elseif ( $duration <= 604800 ) {
				$granularity = 'daily';
			} else {
				$granularity = 'weekly';
			}
		}
	}

	// Map granularity to interval.
	$interval = Helpers\granularity_to_interval( $granularity );

	// Build filter.
	$filter = new API\Filter();

	if ( $entity_type === 'post' && $entity_id ) {
		$filter->include = [ $entity_id ];
	}

	// Get site-wide or filtered data.
	$data = API\get_graph_data(
		$dates['start'],
		$dates['end'],
		$interval,
		$filter
	);

	if ( is_wp_error( $data ) ) {
		return $data;
	}

	// Build response.
	$summary = $data['stats']['summary'] ?? [];
	$views = $summary['views'] ?? 0;
	$visitors = $summary['visitors'] ?? 0;

	$result = [
		'views'           => $views,
		'visitors'        => $visitors,
		'returning'       => $summary['returning'] ?? 0,
		'bounce_rate'     => $visitors > 0 ? round( ( $summary['bounce'] ?? 0 ) / $visitors * 100, 2 ) : 0,
		'conversion_rate' => 0,
	];

	// Add time series if not aggregate.
	if ( ( $input['granularity'] ?? 'daily' ) !== 'aggregate' && ! empty( $data['by_interval'] ) ) {
		$result['time_series'] = array_map( function ( $date, $values ) {
			return array_merge( [ 'date' => $date ], $values );
		}, array_keys( $data['by_interval'] ), array_values( $data['by_interval'] ) );
	}

	return $result;
}

/**
 * Register accelerate/list-active-experiments ability.
 *
 * Returns a registry of all currently running experiments.
 *
 * @return void
 */
function register_list_active_experiments() : void {
	wp_register_ability( 'accelerate/list-active-experiments', [
		'label'       => __( 'List Active Experiments', 'altis' ),
		'description' => __( 'Returns all currently running A/B tests and personalization rules. Essential for checking before making changes.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'type' => [
					'type'        => 'string',
					'enum'        => [ 'all', 'abtest', 'personalization' ],
					'default'     => 'all',
					'description' => __( 'Filter by experiment type.', 'altis' ),
				],
				'post_id' => [
					'type'        => 'integer',
					'description' => __( 'Filter experiments by specific post.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'  => 'array',
			'items' => [
				'type'       => 'object',
				'properties' => [
					'id'             => [ 'type' => 'integer' ],
					'type'           => [ 'type' => 'string' ],
					'title'          => [ 'type' => 'string' ],
					'status'         => [ 'type' => 'string' ],
					'start_time'     => [ 'type' => 'string' ],
					'variants_count' => [ 'type' => 'integer' ],
				],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_list_active_experiments',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Fetching active experiments...', 'altis' ),
		],
	] );
}

/**
 * Execute list-active-experiments ability.
 *
 * @param array $input Input parameters.
 * @return array List of active experiments.
 */
function execute_list_active_experiments( array $input ) : array {
	$type = $input['type'] ?? 'all';
	$post_id = $input['post_id'] ?? null;
	$experiments = [];

	// Query synced patterns (wp_block) with A/B test or personalization.
	$args = [
		'post_type'      => 'wp_block',
		'post_status'    => 'publish',
		'posts_per_page' => 100,
		'meta_query'     => [
			'relation' => 'OR',
		],
	];

	// Add meta queries based on type.
	if ( $type === 'all' || $type === 'abtest' ) {
		$args['meta_query'][] = [
			'key'     => '_xb_abtest',
			'compare' => 'EXISTS',
		];
	}

	if ( $type === 'all' || $type === 'personalization' ) {
		$args['meta_query'][] = [
			'key'     => '_xb_personalization',
			'compare' => 'EXISTS',
		];
	}

	$query = new \WP_Query( $args );

	foreach ( $query->posts as $post ) {
		$is_abtest = get_post_meta( $post->ID, '_xb_abtest', true );
		$is_personalization = get_post_meta( $post->ID, '_xb_personalization', true );

		// Determine experiment type.
		$experiment_type = 'standard';
		if ( $is_abtest ) {
			$experiment_type = 'abtest';
		} elseif ( $is_personalization ) {
			$experiment_type = 'personalization';
		}

		// Get variant count from block content.
		$blocks = parse_blocks( $post->post_content );
		$variant_count = 0;
		foreach ( $blocks as $block ) {
			if ( $block['blockName'] === 'altis/variant' ) {
				$variant_count++;
			}
		}

		$experiments[] = [
			'id'             => $post->ID,
			'type'           => $experiment_type,
			'title'          => $post->post_title,
			'status'         => 'active',
			'start_time'     => $post->post_date_gmt,
			'variants_count' => max( $variant_count, 1 ),
			'edit_url'       => get_edit_post_link( $post->ID, 'raw' ),
		];
	}

	return $experiments;
}

/**
 * Register accelerate/list-experiments ability.
 *
 * Historical experiment discovery with filtering, pagination, and date ranges.
 * Queries the experiments table directly for all experiment types and statuses.
 *
 * @return void
 */
function register_list_experiments() : void {
	wp_register_ability( 'accelerate/list-experiments', [
		'label'       => __( 'List Experiments', 'altis' ),
		'description' => __( 'Discover historical and active experiments with filtering by status, type, date range, post, and annotations. Supports pagination.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'status' => [
					'type'        => 'string',
					'enum'        => [ 'all', 'active', 'running', 'completed', 'paused', 'draft' ],
					'default'     => 'all',
					'description' => __( 'Filter by status. "active" returns running, paused, and draft.', 'altis' ),
				],
				'type' => [
					'type'        => 'string',
					'enum'        => [ 'all', 'abtest', 'personalization' ],
					'default'     => 'all',
					'description' => __( 'Filter by experiment type.', 'altis' ),
				],
				'date_range' => Abilities\get_date_range_schema(),
				'subject_post_id' => [
					'type'        => 'integer',
					'description' => __( 'Filter by the WordPress post being tested.', 'altis' ),
				],
				'annotation_key' => [
					'type'        => 'string',
					'description' => __( 'Filter experiments that have this annotation key.', 'altis' ),
				],
				'annotation_value' => [
					'type'        => 'string',
					'description' => __( 'Filter by annotation value (requires annotation_key).', 'altis' ),
				],
				'page' => [
					'type'    => 'integer',
					'minimum' => 1,
					'default' => 1,
					'description' => __( 'Page number for pagination.', 'altis' ),
				],
				'per_page' => [
					'type'    => 'integer',
					'minimum' => 1,
					'maximum' => 100,
					'default' => 50,
					'description' => __( 'Results per page (max 100).', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'experiments' => [
					'type'  => 'array',
					'items' => [
						'type'       => 'object',
						'properties' => [
							'experiment_id'        => [ 'type' => 'integer' ],
							'block_id'             => [ 'type' => 'integer' ],
							'test_id'              => [ 'type' => 'string' ],
							'type'                 => [ 'type' => 'string' ],
							'status'               => [ 'type' => 'string' ],
							'title'                => [ 'type' => 'string' ],
							'goal'                 => [ 'type' => 'string' ],
							'started_at'           => [ 'type' => [ 'string', 'null' ] ],
							'ended_at'             => [ 'type' => [ 'string', 'null' ] ],
							'has_winner'           => [ 'type' => 'boolean' ],
							'winner_variant_index' => [ 'type' => [ 'integer', 'null' ] ],
							'annotations'          => [
								'type'                 => 'object',
								'additionalProperties' => [ 'type' => 'string' ],
							],
						],
					],
				],
				'total' => [ 'type' => 'integer' ],
				'pages' => [ 'type' => 'integer' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_list_experiments',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Querying experiment history...', 'altis' ),
		],
	] );
}

/**
 * Execute list-experiments ability.
 *
 * @param array $input Input parameters.
 * @return array Paginated experiment list.
 */
function execute_list_experiments( array $input ) : array {
	$status          = $input['status'] ?? 'all';
	$type            = $input['type'] ?? 'all';
	$subject_post_id = $input['subject_post_id'] ?? null;
	$annotation_key  = $input['annotation_key'] ?? null;
	$annotation_value = $input['annotation_value'] ?? null;
	$page            = max( 1, $input['page'] ?? 1 );
	$per_page        = min( 100, max( 1, $input['per_page'] ?? 50 ) );

	// Build WHERE clauses for Experiment::query().
	$where = [];

	// Status filter.
	switch ( $status ) {
		case 'active':
			$where['status'] = [
				'compare' => 'IN',
				'value'   => [
					Experiments\Experiment::STATUS_DRAFT,
					Experiments\Experiment::STATUS_RUNNING,
					Experiments\Experiment::STATUS_PAUSED,
				],
			];
			break;
		case 'all':
			// No filter.
			break;
		default:
			$where['status'] = $status;
			break;
	}

	// Type filter.
	if ( $type !== 'all' ) {
		$where['type'] = $type;
	}

	// Subject post filter.
	if ( $subject_post_id ) {
		$where['subject_post_id'] = $subject_post_id;
	}

	// Date range filter on start_time (stored as milliseconds).
	if ( ! empty( $input['date_range'] ) ) {
		$dates = Abilities\parse_date_range( $input );
		if ( $dates['start'] ) {
			$where['start_time'] = [
				'compare' => '>=',
				'value'   => $dates['start'] * 1000,
			];
		}
		// end_time filter uses a separate key — handle via raw approach.
		// Instead, use a combined approach: filter start_time for the range.
		// For 'until', we add a second condition. Foundry supports only one
		// clause per field, so we post-filter the end bound in PHP.
	}
	$date_end_ms = null;
	if ( ! empty( $input['date_range']['end'] ) ) {
		$date_end_ms = strtotime( $input['date_range']['end'] ) * 1000;
	}

	// When post-filtering is needed (annotations or date-end), fetch all
	// matching rows so PHP filtering sees the complete dataset.
	$needs_post_filter = $annotation_key || $date_end_ms;
	$fetch_per_page    = $needs_post_filter ? 10000 : $per_page;
	$fetch_page        = $needs_post_filter ? 1 : $page;

	$query = Experiments\Experiment::query(
		$where,
		[
			'page'     => $fetch_page,
			'per_page' => $fetch_per_page,
			'order_by' => [ 'created_at' => 'DESC' ],
		]
	);

	$query_results = $query->get_results();
	if ( is_wp_error( $query_results ) ) {
		$query_results = [];
	}

	// Capture SQL total before converting QueryResults to a plain array.
	$sql_total = 0;
	if ( $query_results instanceof \Foundry\Database\QueryResults ) {
		$sql_total = $query_results->get_total_available();
		$results   = $query_results->as_array();
	} else {
		$results = $query_results;
	}

	// Post-filter: date end bound.
	if ( $date_end_ms ) {
		$results = array_filter( $results, function ( $exp ) use ( $date_end_ms ) {
			$start = $exp->get_start_time();
			return $start === null || $start <= $date_end_ms;
		} );
	}

	// Post-filter: annotations.
	if ( $annotation_key ) {
		$results = array_filter( $results, function ( $exp ) use ( $annotation_key, $annotation_value ) {
			$annotations = $exp->get_annotations();
			if ( ! isset( $annotations[ $annotation_key ] ) ) {
				return false;
			}
			if ( $annotation_value !== null ) {
				return $annotations[ $annotation_key ] === $annotation_value;
			}
			return true;
		} );
	}

	$results = array_values( $results );
	$total   = $needs_post_filter ? count( $results ) : $sql_total;

	// Apply pagination for post-filtered results.
	if ( $needs_post_filter ) {
		$offset  = ( $page - 1 ) * $per_page;
		$results = array_slice( $results, $offset, $per_page );
	}

	// Format output.
	$experiments = [];
	foreach ( $results as $experiment ) {
		$start_time  = $experiment->get_start_time();
		$end_time    = $experiment->get_end_time();
		$exp_results = $experiment->get_results();
		$has_winner  = isset( $exp_results['winner'] ) && $exp_results['winner'] !== null;

		$title = $experiment->get_title();
		if ( empty( $title ) ) {
			$post = get_post( $experiment->get_subject_post_id() );
			$title = $post ? $post->post_title : '';
		}

		$experiments[] = [
			'experiment_id'        => $experiment->get_id(),
			'block_id'             => $experiment->get_subject_post_id(),
			'test_id'              => $experiment->get_test_id(),
			'type'                 => $experiment->get_type(),
			'status'               => $experiment->get_status(),
			'title'                => $title,
			'goal'                 => $experiment->get_goal(),
			'started_at'           => $start_time ? gmdate( 'c', intval( $start_time / 1000 ) ) : null,
			'ended_at'             => $end_time ? gmdate( 'c', intval( $end_time / 1000 ) ) : null,
			'has_winner'           => $has_winner,
			'winner_variant_index' => $has_winner ? (int) $exp_results['winner'] : null,
			'annotations'          => $experiment->get_annotations(),
		];
	}

	$pages = $per_page > 0 ? (int) ceil( $total / $per_page ) : 1;

	return [
		'experiments' => $experiments,
		'total'       => $total,
		'pages'       => $pages,
	];
}

/**
 * Register accelerate/get-audience-segments ability.
 *
 * Provides detailed definitions of available personalization segments.
 *
 * @return void
 */
function register_get_audience_segments() : void {
	wp_register_ability( 'accelerate/get-audience-segments', [
		'label'       => __( 'Get Audience Segments', 'altis' ),
		'description' => __( 'List all defined audience segments with their targeting rules. Useful for discovering personalization opportunities.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'include_estimates' => [
					'type'        => 'boolean',
					'default'     => false,
					'description' => __( 'Include audience size estimates (slower).', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'  => 'array',
			'items' => [
				'type'       => 'object',
				'properties' => [
					'id'          => [ 'type' => 'integer' ],
					'title'       => [ 'type' => 'string' ],
					'description' => [ 'type' => 'string' ],
					'rules'       => [ 'type' => 'object' ],
					'estimate'    => [ 'type' => 'object' ],
				],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_audience_segments',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Loading audience segments...', 'altis' ),
		],
	] );
}

/**
 * Execute get-audience-segments ability.
 *
 * @param array $input Input parameters.
 * @return array List of audience segments.
 */
function execute_get_audience_segments( array $input ) : array {
	$include_estimates = $input['include_estimates'] ?? false;

	// Query all audience posts.
	$audiences = Audiences\query_audiences( [
		'posts_per_page' => 100,
	] );

	$segments = [];

	foreach ( $audiences as $audience ) {
		$config = Audiences\get_audience( $audience->ID );

		$segment = [
			'id'          => $audience->ID,
			'title'       => $audience->post_title,
			'description' => $audience->post_excerpt,
			'rules'       => $config['audience'] ?? [],
			'status'      => $audience->post_status,
		];

		// Include estimates if requested.
		if ( $include_estimates && ! empty( $config['audience'] ) ) {
			$estimate = Audiences\get_estimate( $config['audience'] );
			if ( $estimate && ! is_wp_error( $estimate ) ) {
				$segment['estimate'] = [
					'count'   => $estimate['count'] ?? 0,
					'total'   => $estimate['total'] ?? 0,
					'percent' => $estimate['total'] > 0
						? round( ( $estimate['count'] / $estimate['total'] ) * 100, 2 )
						: 0,
				];
			}
		}

		$segments[] = $segment;
	}

	return $segments;
}

/**
 * Register accelerate/get-audience-fields ability.
 *
 * Lists all available targeting fields and their possible values.
 *
 * @return void
 */
function register_get_audience_fields() : void {
	wp_register_ability( 'accelerate/get-audience-fields', [
		'label'       => __( 'Get Audience Fields', 'altis' ),
		'description' => __( 'List all available targeting fields and their values. Enables natural language to boolean logic translation.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'refresh' => [
					'type'        => 'boolean',
					'default'     => false,
					'description' => __( 'Force refresh of cached field data.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'  => 'array',
			'items' => [
				'type'       => 'object',
				'properties' => [
					'name'      => [ 'type' => 'string' ],
					'label'     => [ 'type' => 'string' ],
					'type'      => [ 'type' => 'string' ],
					'operators' => [ 'type' => 'array' ],
					'values'    => [ 'type' => 'array' ],
				],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_audience_fields',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Fetching targeting field definitions...', 'altis' ),
		],
	] );
}

/**
 * Execute get-audience-fields ability.
 *
 * @param array $input Input parameters.
 * @return array List of audience fields.
 */
function execute_get_audience_fields( array $input ) : array {
	$field_data = Audiences\get_field_data();

	if ( empty( $field_data ) || is_wp_error( $field_data ) ) {
		return [];
	}

	$fields = [];

	foreach ( $field_data as $field ) {
		// Determine operators based on field type.
		$operators = $field['type'] === 'number'
			? [ '=', '!=', 'gt', 'gte', 'lt', 'lte' ]
			: [ '=', '!=', '*=', '!*', '^=' ];

		$field_entry = [
			'name'      => $field['name'],
			'label'     => $field['label'],
			'type'      => $field['type'],
			'operators' => $operators,
		];

		// Add values for string fields.
		if ( $field['type'] === 'string' && ! empty( $field['data'] ) ) {
			$field_entry['values'] = array_map( function ( $item ) {
				return [
					'value'   => $item['value'],
					'count'   => $item['count'] ?? 0,
					'percent' => $item['percent'] ?? 0,
				];
			}, array_slice( $field['data'], 0, 50 ) );
		}

		// Add stats for numeric fields.
		if ( $field['type'] === 'number' && ! empty( $field['stats'] ) ) {
			$field_entry['stats'] = $field['stats'];
		}

		$fields[] = $field_entry;
	}

	return $fields;
}

/**
 * Register accelerate/get-top-content ability.
 *
 * Returns best-performing content with full metrics.
 *
 * @return void
 */
function register_get_top_content() : void {
	wp_register_ability( 'accelerate/get-top-content', [
		'label'       => __( 'Get Top Content', 'altis' ),
		'description' => __( 'Returns best-performing content ranked by views, with full metrics.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'type' => [
					'type'        => 'string',
					'description' => __( 'Post type filter (e.g., "post", "page").', 'altis' ),
				],
				'limit' => [
					'type'    => 'integer',
					'default' => 10,
					'minimum' => 1,
					'maximum' => 50,
				],
				'date_range' => Abilities\get_date_range_schema(),
			],
		],
		'output_schema' => [
			'type'  => 'array',
			'items' => [
				'type'       => 'object',
				'properties' => [
					'id'          => [ 'type' => 'integer' ],
					'title'       => [ 'type' => 'string' ],
					'type'        => [ 'type' => 'string' ],
					'views'       => [ 'type' => 'integer' ],
					'conversions' => [ 'type' => 'integer' ],
					'url'         => [ 'type' => 'string' ],
				],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_top_content',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing top performing content...', 'altis' ),
		],
	] );
}

/**
 * Execute get-top-content ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Top content list or error.
 */
function execute_get_top_content( array $input ) {
	$dates = Abilities\parse_date_range( $input, 7 );
	$limit = min( $input['limit'] ?? 10, 50 );

	$filter = new API\Filter();

	if ( ! empty( $input['type'] ) ) {
		$filter->type = $input['type'];
	}

	$data = API\get_top_data( $dates['start'], $dates['end'], $filter );

	if ( is_wp_error( $data ) ) {
		return $data;
	}

	$results = [];

	foreach ( array_slice( $data['posts'] ?? [], 0, $limit ) as $post ) {
		$results[] = [
			'id'          => $post['id'],
			'title'       => $post['title'],
			'type'        => $post['type']['name'] ?? 'post',
			'views'       => $post['views'] ?? 0,
			'conversions' => $post['lift']['conversions'] ?? 0,
			'url'         => $post['url'] ?? '',
			'edit_url'    => $post['editUrl'] ?? '',
		];
	}

	return $results;
}

/**
 * Register accelerate/get-post-performance ability.
 *
 * Focused analytics for a single post or synced pattern.
 *
 * @return void
 */
function register_get_post_performance() : void {
	wp_register_ability( 'accelerate/get-post-performance', [
		'label'       => __( 'Get Post Performance', 'altis' ),
		'description' => __( 'Get detailed performance metrics for a specific post, page, or synced pattern including views, conversions, and period comparison.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'post_id' => [
					'type'        => 'integer',
					'description' => __( 'WordPress post, page, or wp_block ID.', 'altis' ),
				],
				'date_range' => Helpers\get_date_range_with_preset_schema(),
			],
			'required' => [ 'post_id' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'post'       => [ 'type' => 'object' ],
				'metrics'    => [ 'type' => 'object' ],
				'comparison' => [ 'type' => [ 'object', 'null' ] ],
				'experiment' => [ 'type' => [ 'object', 'null' ] ],
				'period'     => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_post_performance',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Fetching post performance...', 'altis' ),
		],
	] );
}

/**
 * Execute get-post-performance ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Post performance data or error.
 */
function execute_get_post_performance( array $input ) {
	$post_id = $input['post_id'] ?? 0;

	if ( ! $post_id ) {
		return new WP_Error( 'missing_post_id', __( 'post_id is required.', 'altis' ) );
	}

	$post = get_post( $post_id );
	if ( ! $post ) {
		return new WP_Error( 'invalid_post', __( 'Post not found.', 'altis' ) );
	}

	$dates = Helpers\parse_date_range_with_preset( $input, 7 );
	$comparison = Helpers\get_comparison_period( $dates['start'], $dates['end'] );

	// Fetch analytics for this specific post.
	$filter = new API\Filter();
	$filter->include = [ $post_id ];

	$current_data = API\get_top_data( $dates['start'], $dates['end'], $filter );
	$previous_data = API\get_top_data( $comparison['start'], $comparison['end'], $filter );

	if ( is_wp_error( $current_data ) ) {
		return $current_data;
	}

	// Extract this post's metrics from results.
	$current_metrics = null;
	foreach ( $current_data['posts'] ?? [] as $p ) {
		if ( (int) $p['id'] === $post_id ) {
			$current_metrics = $p;
			break;
		}
	}

	$previous_metrics = null;
	if ( ! is_wp_error( $previous_data ) ) {
		foreach ( $previous_data['posts'] ?? [] as $p ) {
			if ( (int) $p['id'] === $post_id ) {
				$previous_metrics = $p;
				break;
			}
		}
	}

	$views = $current_metrics['views'] ?? 0;
	$visitors = $current_metrics['visitors'] ?? 0;
	$conversions = $current_metrics['lift']['conversions'] ?? 0;
	$prev_views = $previous_metrics['views'] ?? 0;

	$velocity = Helpers\calculate_velocity( $views, $prev_views );

	// Build comparison data.
	$comparison_data = null;
	if ( $previous_metrics ) {
		$prev_conversions = $previous_metrics['lift']['conversions'] ?? 0;
		$comparison_data = [
			'views'            => $prev_views,
			'conversions'      => $prev_conversions,
			'views_change'     => $prev_views > 0 ? round( ( ( $views - $prev_views ) / $prev_views ) * 100, 2 ) : null,
			'conversion_change' => $prev_conversions > 0 ? round( ( ( $conversions - $prev_conversions ) / $prev_conversions ) * 100, 2 ) : null,
		];
	}

	// Check for experiment state.
	$experiment_data = null;
	if ( $post->post_type === 'wp_block' ) {
		$experiment = Experiments\Experiment::get_active_for_post( $post_id, 'block' );
		if ( ! $experiment ) {
			$completed = Experiments\Experiment::query(
				[
					'subject_post_id' => $post_id,
					'test_id'         => 'block',
					'status'          => Experiments\Experiment::STATUS_COMPLETED,
				],
				[
					'per_page' => 1,
					'order_by' => [ 'updated_at' => 'DESC' ],
				]
			)->get_results();
			$experiment = ! empty( $completed ) ? $completed[0] : null;
		}
		if ( $experiment ) {
			$results = $experiment->get_results();
			$experiment_data = [
				'type'   => $experiment->get_type(),
				'status' => $experiment->get_status(),
				'goal'   => $experiment->get_goal(),
				'winner' => $results['winner'] ?? null,
			];
		}
	}

	// Check for title/featured image tests on regular posts.
	if ( $post->post_type !== 'wp_block' ) {
		foreach ( [ 'titles', 'featured_images' ] as $test_id ) {
			$experiment = Experiments\Experiment::get_active_for_post( $post_id, $test_id );
			if ( $experiment ) {
				$results = $experiment->get_results();
				$experiment_data = [
					'type'    => $experiment->get_type(),
					'test_id' => $test_id,
					'status'  => $experiment->get_status(),
					'goal'    => $experiment->get_goal(),
					'winner'  => $results['winner'] ?? null,
				];
				break;
			}
		}
	}

	return [
		'post' => [
			'id'           => $post_id,
			'title'        => $post->post_title,
			'type'         => $post->post_type,
			'status'       => $post->post_status,
			'url'          => get_permalink( $post_id ),
			'edit_url'     => get_edit_post_link( $post_id, 'raw' ),
			'publish_date' => get_the_date( 'c', $post_id ),
			'author'       => get_the_author_meta( 'display_name', $post->post_author ),
		],
		'metrics' => [
			'views'           => $views,
			'visitors'        => $visitors,
			'conversions'     => $conversions,
			'conversion_rate' => $views > 0 ? round( ( $conversions / $views ) * 100, 2 ) : 0,
			'velocity'        => $velocity,
		],
		'comparison' => $comparison_data,
		'experiment' => $experiment_data,
		'period' => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}

/**
 * Register accelerate/get-content-diff ability.
 *
 * Compares content performance between two time periods.
 *
 * @return void
 */
function register_get_content_diff() : void {
	wp_register_ability( 'accelerate/get-content-diff', [
		'label'       => __( 'Get Content Performance Diff', 'altis' ),
		'description' => __( 'Compare content performance between two time periods to identify trends.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'post_ids' => [
					'type'  => 'array',
					'items' => [ 'type' => 'integer' ],
					'description' => __( 'Post IDs to compare.', 'altis' ),
				],
				'current_period'    => Abilities\get_date_range_schema(),
				'comparison_period' => Abilities\get_date_range_schema(),
			],
			'required' => [ 'post_ids', 'current_period' ],
		],
		'output_schema' => [
			'type' => 'object',
			'additionalProperties' => [
				'type'       => 'object',
				'properties' => [
					'current'        => [ 'type' => 'object' ],
					'previous'       => [ 'type' => 'object' ],
					'change_percent' => [ 'type' => 'number' ],
				],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_content_diff',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Comparing content performance across time periods...', 'altis' ),
		],
	] );
}

/**
 * Execute get-content-diff ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Comparison data or error.
 */
function execute_get_content_diff( array $input ) {
	$post_ids = $input['post_ids'] ?? [];

	if ( empty( $post_ids ) ) {
		return new WP_Error( 'missing_post_ids', __( 'post_ids is required.', 'altis' ) );
	}

	// Current period.
	$current_end = isset( $input['current_period']['end'] )
		? strtotime( $input['current_period']['end'] )
		: time();
	$current_start = isset( $input['current_period']['start'] )
		? strtotime( $input['current_period']['start'] )
		: strtotime( '-7 days', $current_end );

	// Comparison period (default: same duration before current).
	$duration = $current_end - $current_start;
	$comparison_end = isset( $input['comparison_period']['end'] )
		? strtotime( $input['comparison_period']['end'] )
		: $current_start;
	$comparison_start = isset( $input['comparison_period']['start'] )
		? strtotime( $input['comparison_period']['start'] )
		: $comparison_end - $duration;

	$results = [];

	foreach ( $post_ids as $post_id ) {
		$filter = new API\Filter();
		$filter->include = [ $post_id ];

		// Get current period data.
		$current_data = API\get_graph_data( $current_start, $current_end, '1 day', $filter );
		$current_views = 0;
		$current_visitors = 0;
		if ( ! is_wp_error( $current_data ) ) {
			$current_views = $current_data['stats']['summary']['views'] ?? 0;
			$current_visitors = $current_data['stats']['summary']['visitors'] ?? 0;
		}

		// Get comparison period data.
		$comparison_data = API\get_graph_data( $comparison_start, $comparison_end, '1 day', $filter );
		$comparison_views = 0;
		$comparison_visitors = 0;
		if ( ! is_wp_error( $comparison_data ) ) {
			$comparison_views = $comparison_data['stats']['summary']['views'] ?? 0;
			$comparison_visitors = $comparison_data['stats']['summary']['visitors'] ?? 0;
		}

		// Calculate change.
		$change_percent = $comparison_views > 0
			? round( ( ( $current_views - $comparison_views ) / $comparison_views ) * 100, 2 )
			: ( $current_views > 0 ? 100 : 0 );

		$results[ $post_id ] = [
			'current'        => [
				'views'    => $current_views,
				'visitors' => $current_visitors,
			],
			'previous'       => [
				'views'    => $comparison_views,
				'visitors' => $comparison_visitors,
			],
			'change_percent' => $change_percent,
		];
	}

	return $results;
}

/**
 * Register accelerate/get-traffic-breakdown ability.
 *
 * Traffic breakdown by source, country, device, or custom dimension.
 *
 * @return void
 */
function register_get_traffic_breakdown() : void {
	wp_register_ability( 'accelerate/get-traffic-breakdown', [
		'label'       => __( 'Get Traffic Breakdown', 'altis' ),
		'description' => __( 'Traffic breakdown by source, country, device, or other dimension.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'dimension' => [
					'type'    => 'string',
					'enum'    => [ 'country', 'browser', 'os', 'referrer' ],
					'default' => 'country',
				],
				'date_range' => Abilities\get_date_range_schema(),
				'limit' => [
					'type'    => 'integer',
					'default' => 10,
					'minimum' => 1,
					'maximum' => 50,
				],
			],
		],
		'output_schema' => [
			'type'  => 'array',
			'items' => [
				'type'       => 'object',
				'properties' => [
					'key'     => [ 'type' => 'string' ],
					'value'   => [ 'type' => 'integer' ],
					'percent' => [ 'type' => 'number' ],
				],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_traffic_breakdown',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing traffic breakdown...', 'altis' ),
		],
	] );
}

/**
 * Execute get-traffic-breakdown ability.
 *
 * @param array $input Input parameters.
 * @return array Traffic breakdown data.
 */
function execute_get_traffic_breakdown( array $input ) : array {
	$dimension = $input['dimension'] ?? 'country';
	$limit = min( $input['limit'] ?? 10, 50 );

	// Get field data which includes breakdown.
	$field_data = Audiences\get_field_data();

	if ( empty( $field_data ) || is_wp_error( $field_data ) ) {
		return [];
	}

	// Map dimension to field name.
	$field_map = [
		'country'  => 'endpoint.Location.Country',
		'browser'  => 'endpoint.Demographic.Model',
		'os'       => 'endpoint.Demographic.Platform',
		'referrer' => 'attributes.referer',
	];

	$field_name = $field_map[ $dimension ] ?? $field_map['country'];

	// Find the matching field.
	$target_field = null;
	foreach ( $field_data as $field ) {
		if ( $field['name'] === $field_name ) {
			$target_field = $field;
			break;
		}
	}

	if ( ! $target_field || empty( $target_field['data'] ) ) {
		return [];
	}

	// Format results, filtering out zero-count entries.
	$results = [];
	foreach ( $target_field['data'] as $item ) {
		$count = (int) ( $item['count'] ?? 0 );
		if ( $count > 0 ) {
			$results[] = [
				'key'     => $item['value'] ?? 'Unknown',
				'value'   => $count,
				'percent' => $item['percent'] ?? 0,
			];
		}
	}

	// Sort by count descending and apply limit.
	usort( $results, fn( $a, $b ) => $b['value'] <=> $a['value'] );

	return array_slice( $results, 0, $limit );
}

/**
 * Register accelerate/get-taxonomy-performance ability.
 *
 * Performance metrics grouped by WordPress taxonomy.
 *
 * @return void
 */
function register_get_taxonomy_performance() : void {
	wp_register_ability( 'accelerate/get-taxonomy-performance', [
		'label'       => __( 'Get Taxonomy Performance', 'altis' ),
		'description' => __( 'Get performance metrics grouped by WordPress taxonomy (categories, tags, etc).', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'taxonomy' => [
					'type'        => 'string',
					'default'     => 'category',
					'description' => __( 'WordPress taxonomy name (category, post_tag, or custom).', 'altis' ),
				],
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'limit' => [
					'type'    => 'integer',
					'default' => 20,
					'minimum' => 1,
					'maximum' => 100,
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'terms'  => [ 'type' => 'array' ],
				'period' => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_taxonomy_performance',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing taxonomy performance...', 'altis' ),
		],
	] );
}

/**
 * Execute get-taxonomy-performance ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Taxonomy performance data or error.
 */
function execute_get_taxonomy_performance( array $input ) {
	$taxonomy = $input['taxonomy'] ?? 'category';
	$limit = min( $input['limit'] ?? 20, 100 );

	// Validate taxonomy exists.
	if ( ! taxonomy_exists( $taxonomy ) ) {
		return new WP_Error( 'invalid_taxonomy', __( 'Specified taxonomy does not exist.', 'altis' ) );
	}

	// Parse date range.
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );

	// Get all terms for the taxonomy.
	$terms = get_terms( [
		'taxonomy'   => $taxonomy,
		'hide_empty' => true,
	] );

	if ( is_wp_error( $terms ) ) {
		return $terms;
	}

	// Collect all post IDs across terms, then fetch analytics scoped to those posts.
	$all_term_post_ids = [];
	$term_to_posts = [];
	foreach ( $terms as $term ) {
		$post_ids = get_objects_in_term( $term->term_id, $taxonomy );
		if ( is_wp_error( $post_ids ) || empty( $post_ids ) ) {
			continue;
		}
		$term_to_posts[ $term->term_id ] = array_map( 'intval', $post_ids );
		$all_term_post_ids = array_merge( $all_term_post_ids, $term_to_posts[ $term->term_id ] );
	}
	$all_term_post_ids = array_unique( $all_term_post_ids );

	// Use include filter to scope analytics to taxonomy posts specifically,
	// rather than relying on the generic top-300 to contain them.
	$filter = new API\Filter();
	if ( ! empty( $all_term_post_ids ) ) {
		$filter->include = $all_term_post_ids;
	}
	$data = API\get_top_data( $dates['start'], $dates['end'], $filter );

	if ( is_wp_error( $data ) ) {
		return $data;
	}

	// Map post IDs to their metrics.
	$post_metrics = [];
	foreach ( $data['posts'] ?? [] as $post ) {
		$post_metrics[ $post['id'] ] = [
			'views'       => $post['views'] ?? 0,
			'conversions' => $post['lift']['conversions'] ?? 0,
		];
	}

	// Aggregate metrics by term.
	$term_metrics = [];
	foreach ( $terms as $term ) {
		$post_ids = $term_to_posts[ $term->term_id ] ?? [];
		if ( empty( $post_ids ) ) {
			continue;
		}

		$total_views = 0;
		$total_conversions = 0;

		foreach ( $post_ids as $post_id ) {
			if ( isset( $post_metrics[ $post_id ] ) ) {
				$total_views += $post_metrics[ $post_id ]['views'];
				$total_conversions += $post_metrics[ $post_id ]['conversions'];
			}
		}

		// Calculate underserved score (demand/supply ratio).
		$post_count = count( $post_ids );
		$underserved_score = $post_count > 0 ? round( $total_views / $post_count, 2 ) : 0;

		$term_metrics[] = [
			'term_id'          => $term->term_id,
			'name'             => $term->name,
			'slug'             => $term->slug,
			'post_count'       => $post_count,
			'views'            => $total_views,
			'conversions'      => $total_conversions,
			'conversion_rate'  => $total_views > 0 ? round( ( $total_conversions / $total_views ) * 100, 2 ) : 0,
			'underserved_score' => $underserved_score,
		];
	}

	// Sort by views descending.
	usort( $term_metrics, fn( $a, $b ) => $b['views'] <=> $a['views'] );

	return [
		'terms'  => array_slice( $term_metrics, 0, $limit ),
		'period' => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}

/**
 * Register accelerate/get-site-context ability.
 *
 * Returns the site's design system so agents can create content that
 * matches the brand: color palette, typography, spacing, and available
 * block types with their style variations.
 *
 * @return void
 */
function register_get_site_context() : void {
	wp_register_ability( 'accelerate/get-site-context', [
		'label'       => __( 'Get Site Context', 'altis' ),
		'description' => __( 'Get the site\'s design system: color palette, typography, spacing, and available block types with style variations. Use this before creating or editing content to match the site\'s visual language.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'include_blocks' => [
					'type'        => 'boolean',
					'default'     => false,
					'description' => __( 'Include the full list of registered block types and their style variations. Can be verbose.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'site'       => [ 'type' => 'object' ],
				'colors'     => [ 'type' => 'object' ],
				'typography' => [ 'type' => 'object' ],
				'spacing'    => [ 'type' => 'object' ],
				'blocks'     => [ 'type' => [ 'array', 'null' ] ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_site_context',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Loading site design context...', 'altis' ),
		],
	] );
}

/**
 * Execute get-site-context ability.
 *
 * @param array $input Input parameters.
 * @return array Site context data.
 */
function execute_get_site_context( array $input ) {
	$include_blocks = ! empty( $input['include_blocks'] );

	// -- Site basics --
	$site = [
		'name'        => get_bloginfo( 'name' ),
		'description' => get_bloginfo( 'description' ),
		'url'         => home_url(),
		'language'    => get_bloginfo( 'language' ),
		'has_theme_json' => function_exists( 'wp_theme_has_theme_json' ) && wp_theme_has_theme_json(),
	];

	// -- Color palette --
	$colors = [ 'palette' => [], 'gradients' => [] ];
	if ( function_exists( 'wp_get_global_settings' ) ) {
		$color_settings = wp_get_global_settings( [ 'color' ] );

		// Merge theme + custom palettes, preferring theme.
		$palette = [];
		foreach ( [ 'theme', 'custom', 'default' ] as $origin ) {
			foreach ( $color_settings['palette'][ $origin ] ?? [] as $color ) {
				$palette[] = [
					'slug'   => $color['slug'] ?? '',
					'name'   => $color['name'] ?? '',
					'color'  => $color['color'] ?? '',
					'origin' => $origin,
				];
			}
		}
		$colors['palette'] = $palette;

		// Gradients.
		$gradients = [];
		foreach ( [ 'theme', 'custom', 'default' ] as $origin ) {
			foreach ( $color_settings['gradients'][ $origin ] ?? [] as $gradient ) {
				$gradients[] = [
					'slug'     => $gradient['slug'] ?? '',
					'name'     => $gradient['name'] ?? '',
					'gradient' => $gradient['gradient'] ?? '',
				];
			}
		}
		$colors['gradients'] = $gradients;

		// Global text and background colors.
		$global_styles = wp_get_global_styles( [ 'color' ] );
		$colors['background'] = $global_styles['background'] ?? null;
		$colors['text'] = $global_styles['text'] ?? null;
	}

	// -- Typography --
	$typography = [ 'font_families' => [], 'font_sizes' => [] ];
	if ( function_exists( 'wp_get_global_settings' ) ) {
		$type_settings = wp_get_global_settings( [ 'typography' ] );

		foreach ( [ 'theme', 'custom', 'default' ] as $origin ) {
			foreach ( $type_settings['fontFamilies'][ $origin ] ?? [] as $family ) {
				$typography['font_families'][] = [
					'slug'        => $family['slug'] ?? '',
					'name'        => $family['name'] ?? '',
					'font_family' => $family['fontFamily'] ?? '',
					'origin'      => $origin,
				];
			}
		}

		foreach ( [ 'theme', 'custom', 'default' ] as $origin ) {
			foreach ( $type_settings['fontSizes'][ $origin ] ?? [] as $size ) {
				$typography['font_sizes'][] = [
					'slug'   => $size['slug'] ?? '',
					'name'   => $size['name'] ?? '',
					'size'   => $size['size'] ?? '',
					'origin' => $origin,
				];
			}
		}
	}

	// -- Spacing --
	$spacing = [];
	if ( function_exists( 'wp_get_global_settings' ) ) {
		$spacing_settings = wp_get_global_settings( [ 'spacing' ] );
		$spacing = [
			'sizes' => $spacing_settings['spacingSizes']['theme']
				?? $spacing_settings['spacingSizes']['default']
				?? [],
			'units' => $spacing_settings['units'] ?? [ 'px', 'em', 'rem', 'vh', 'vw', '%' ],
		];
	}

	// -- Block types and style variations (optional, can be verbose) --
	$blocks = null;
	if ( $include_blocks ) {
		$blocks = [];
		$registry = \WP_Block_Type_Registry::get_instance();
		$styles_registry = \WP_Block_Styles_Registry::get_instance();

		foreach ( $registry->get_all_registered() as $name => $block_type ) {
			// Skip private/internal blocks.
			if ( strpos( $name, 'core/' ) !== 0 && strpos( $name, 'altis/' ) !== 0 ) {
				continue;
			}

			$block_info = [
				'name'        => $name,
				'title'       => $block_type->title ?? $name,
				'category'    => $block_type->category ?? null,
				'description' => $block_type->description ?? null,
			];

			// Add style variations if any.
			$styles = $styles_registry->get_registered_styles_for_block( $name );
			if ( ! empty( $styles ) ) {
				$block_info['styles'] = array_map( function ( $style ) {
					return [
						'name'  => $style['name'] ?? '',
						'label' => $style['label'] ?? '',
					];
				}, $styles );
			}

			$blocks[] = $block_info;
		}
	}

	return [
		'site'       => $site,
		'colors'     => $colors,
		'typography' => $typography,
		'spacing'    => $spacing,
		'blocks'     => $blocks,
	];
}
