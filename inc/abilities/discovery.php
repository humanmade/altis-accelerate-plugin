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
	register_get_audience_segments();
	register_get_audience_fields();
	register_get_top_content();
	register_get_content_diff();
	register_get_traffic_breakdown();
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
				'date_range' => Abilities\get_date_range_schema(),
				'granularity' => [
					'type'        => 'string',
					'enum'        => [ 'hourly', 'daily', 'weekly', 'aggregate' ],
					'default'     => 'daily',
					'description' => __( 'Time series granularity.', 'altis' ),
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

	// Parse date range.
	$dates = Abilities\parse_date_range( $input, 7 );

	// Map granularity to interval.
	$intervals = [
		'hourly'    => '1 hour',
		'daily'     => '1 day',
		'weekly'    => '1 week',
		'aggregate' => '1 day',
	];
	$interval = $intervals[ $input['granularity'] ?? 'daily' ];

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
