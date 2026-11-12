<?php
/**
 * Accelerate Abilities API - Query Domain.
 *
 * DIY query abilities for custom analytics exploration.
 *
 * @package Altis\Accelerate\Abilities\Query
 */

namespace Altis\Accelerate\Abilities\Query;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Helpers;
use Altis\Accelerate\Utils;
use WP_Error;

/**
 * Register all query abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_query_events();
	register_get_event_schema();
	register_aggregate();
	register_search_content();
}

/**
 * Register accelerate/query-events ability.
 *
 * Raw event query with custom filters.
 *
 * @return void
 */
function register_query_events() : void {
	wp_register_ability( 'accelerate/query-events', [
		'label'       => __( 'Query Events', 'altis' ),
		'description' => __( 'Query raw analytics events with custom filters.', 'altis' ),
		'category'    => 'accelerate-integration',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
				'filters' => [
					'type'  => 'array',
					'items' => [
						'type'       => 'object',
						'properties' => [
							'field' => [
								'type'        => 'string',
								'description' => __( 'Field name to filter on.', 'altis' ),
							],
							'operator' => [
								'type' => 'string',
								'enum' => [ 'eq', 'neq', 'contains', 'gt', 'lt', 'in' ],
							],
							'value' => [
								'type' => [ 'string', 'number', 'array' ],
							],
						],
						'required' => [ 'field', 'operator', 'value' ],
					],
				],
				'fields' => [
					'type'        => 'array',
					'items'       => [ 'type' => 'string' ],
					'description' => __( 'Fields to return. Omit for all fields.', 'altis' ),
				],
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'limit' => [
					'type'    => 'integer',
					'default' => 100,
					'minimum' => 1,
					'maximum' => 10000,
				],
				'offset' => [
					'type'    => 'integer',
					'default' => 0,
					'minimum' => 0,
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'events'        => [ 'type' => 'array' ],
				'total_count'   => [ 'type' => 'integer' ],
				'query_time_ms' => [ 'type' => 'number' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_query_events',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Querying analytics events...', 'altis' ),
		],
	] );
}

/**
 * Execute query-events ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Query results or error.
 */
function execute_query_events( array $input ) {
	$filters = $input['filters'] ?? [];
	$fields = $input['fields'] ?? [];
	$limit = min( $input['limit'] ?? 100, 10000 );
	$offset = $input['offset'] ?? 0;

	$dates = Helpers\parse_date_range_with_preset( $input, 7 );
	$blog_id = get_current_blog_id();
	$table = Helpers\get_analytics_table();

	$start_time = microtime( true );

	// Build field list.
	$available_fields = get_available_fields();
	$select_fields = empty( $fields ) ? '*' : implode( ', ', array_filter( $fields, fn( $f ) => isset( $available_fields[ $f ] ) ) );

	if ( empty( $select_fields ) ) {
		$select_fields = '*';
	}

	// Build WHERE clauses from filters.
	$where_clauses = [
		"blog_id = {blog_id:String}",
		// Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
		"toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))",
		"toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))",
		"event_timestamp >= toDateTime64({start:UInt64}, 3)",
		"event_timestamp <= toDateTime64({end:UInt64}, 3)",
	];

	$params = [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'] * 1000,
		'end'     => $dates['end'] * 1000,
	];

	$param_index = 0;
	foreach ( $filters as $filter ) {
		$field = sanitize_field_name( $filter['field'] ?? '' );
		$operator = $filter['operator'] ?? 'eq';
		$value = $filter['value'] ?? '';

		if ( empty( $field ) ) {
			continue;
		}

		$param_key = "p{$param_index}";
		$param_index++;

		switch ( $operator ) {
			case 'eq':
				$where_clauses[] = "{$field} = {{$param_key}:String}";
				$params[ $param_key ] = (string) $value;
				break;

			case 'neq':
				$where_clauses[] = "{$field} != {{$param_key}:String}";
				$params[ $param_key ] = (string) $value;
				break;

			case 'contains':
				$where_clauses[] = "{$field} LIKE {{$param_key}:String}";
				$params[ $param_key ] = '%' . (string) $value . '%';
				break;

			case 'gt':
				$where_clauses[] = "{$field} > {{$param_key}:Float64}";
				$params[ $param_key ] = (float) $value;
				break;

			case 'lt':
				$where_clauses[] = "{$field} < {{$param_key}:Float64}";
				$params[ $param_key ] = (float) $value;
				break;

			case 'in':
				if ( is_array( $value ) ) {
					$in_values = array_map( fn( $v ) => "'" . addslashes( $v ) . "'", $value );
					$where_clauses[] = "{$field} IN (" . implode( ', ', $in_values ) . ')';
				}
				break;
		}
	}

	$where_sql = implode( ' AND ', $where_clauses );

	// Get total count first.
	$count_query = "SELECT count() as total FROM {$table} WHERE {$where_sql}";
	$count_result = Utils\query( $count_query, $params );

	$total_count = 0;
	if ( ! is_wp_error( $count_result ) && is_array( $count_result ) && ! empty( $count_result ) ) {
		$total_count = (int) Helpers\get_clickhouse_row_value( $count_result[0], 'total', 0 );
	}

	// Get events.
	$query = "SELECT {$select_fields}
		FROM {$table}
		WHERE {$where_sql}
		ORDER BY event_timestamp DESC
		LIMIT {$limit}
		OFFSET {$offset}";

	$result = Utils\query( $query, $params );

	$query_time = round( ( microtime( true ) - $start_time ) * 1000, 2 );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$events = [];
	if ( is_array( $result ) ) {
		foreach ( $result as $row ) {
			$event = [];
			if ( is_object( $row ) ) {
				$event = (array) $row;
			} elseif ( is_array( $row ) ) {
				$event = $row;
			}
			$events[] = $event;
		}
	}

	return [
		'events'        => $events,
		'total_count'   => $total_count,
		'query_time_ms' => $query_time,
	];
}

/**
 * Register accelerate/get-event-schema ability.
 *
 * Discover available event fields.
 *
 * @return void
 */
function register_get_event_schema() : void {
	wp_register_ability( 'accelerate/get-event-schema', [
		'label'       => __( 'Get Event Schema', 'altis' ),
		'description' => __( 'Discover available analytics event fields and their types.', 'altis' ),
		'category'    => 'accelerate-integration',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
				'refresh' => [
					'type'    => 'boolean',
					'default' => false,
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'fields' => [ 'type' => 'array' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_event_schema',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Fetching event schema...', 'altis' ),
		],
	] );
}

/**
 * Execute get-event-schema ability.
 *
 * @param array $input Input parameters.
 * @return array Event schema.
 */
function execute_get_event_schema( array $input ) : array {
	$fields = get_available_fields();

	$schema = [];
	foreach ( $fields as $name => $info ) {
		$schema[] = [
			'name'           => $name,
			'type'           => $info['type'],
			'description'    => $info['description'],
			'example_values' => $info['examples'] ?? [],
		];
	}

	return [
		'fields' => $schema,
	];
}

/**
 * Register accelerate/aggregate ability.
 *
 * Custom aggregations over analytics data.
 *
 * @return void
 */
function register_aggregate() : void {
	wp_register_ability( 'accelerate/aggregate', [
		'label'       => __( 'Aggregate Analytics', 'altis' ),
		'description' => __( 'Perform custom aggregations over analytics data with flexible dimensions and metrics.', 'altis' ),
		'category'    => 'accelerate-integration',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
				'dimensions' => [
					'type'        => 'array',
					'items'       => [ 'type' => 'string' ],
					'description' => __( 'Fields to group by.', 'altis' ),
				],
				'metrics' => [
					'type'  => 'array',
					'items' => [
						'type'       => 'object',
						'properties' => [
							'field' => [ 'type' => 'string' ],
							'function' => [
								'type' => 'string',
								'enum' => [ 'count', 'countDistinct', 'sum', 'avg', 'min', 'max' ],
							],
						],
						'required' => [ 'field', 'function' ],
					],
				],
				'filters' => [
					'type'  => 'array',
					'items' => [
						'type'       => 'object',
						'properties' => [
							'field'    => [ 'type' => 'string' ],
							'operator' => [ 'type' => 'string' ],
							'value'    => [ 'type' => [ 'string', 'number' ] ],
						],
					],
				],
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'limit' => [
					'type'    => 'integer',
					'default' => 100,
					'minimum' => 1,
					'maximum' => 1000,
				],
			],
			'required' => [ 'metrics' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'rows'          => [ 'type' => 'array' ],
				'query_time_ms' => [ 'type' => 'number' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_aggregate',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Running aggregation query...', 'altis' ),
		],
	] );
}

/**
 * Execute aggregate ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Aggregation results or error.
 */
function execute_aggregate( array $input ) {
	$dimensions = $input['dimensions'] ?? [];
	$metrics = $input['metrics'] ?? [];
	$filters = $input['filters'] ?? [];
	$limit = min( $input['limit'] ?? 100, 1000 );

	if ( empty( $metrics ) ) {
		return new WP_Error( 'missing_metrics', __( 'At least one metric is required.', 'altis' ) );
	}

	$dates = Helpers\parse_date_range_with_preset( $input, 7 );
	$blog_id = get_current_blog_id();
	$table = Helpers\get_analytics_table();

	$start_time = microtime( true );

	// Build SELECT clause.
	$select_parts = [];

	// Add dimensions.
	foreach ( $dimensions as $dim ) {
		$safe_dim = sanitize_field_name( $dim );
		if ( $safe_dim ) {
			$select_parts[] = "{$safe_dim} as dim_{$safe_dim}";
		}
	}

	// Add metrics.
	$function_map = [
		'count'         => 'count()',
		'countDistinct' => 'uniqCombined64(%s)',
		'sum'           => 'sum(%s)',
		'avg'           => 'avg(%s)',
		'min'           => 'min(%s)',
		'max'           => 'max(%s)',
	];

	foreach ( $metrics as $idx => $metric ) {
		$field = sanitize_field_name( $metric['field'] ?? '' );
		$func = $metric['function'] ?? 'count';

		if ( ! isset( $function_map[ $func ] ) ) {
			continue;
		}

		if ( $func === 'count' ) {
			$select_parts[] = "count() as metric_{$idx}";
		} else {
			$select_parts[] = sprintf( $function_map[ $func ], $field ) . " as metric_{$idx}";
		}
	}

	if ( empty( $select_parts ) ) {
		return new WP_Error( 'invalid_query', __( 'No valid fields or metrics specified.', 'altis' ) );
	}

	$select_sql = implode( ', ', $select_parts );

	// Build WHERE clause.
	$where_clauses = [
		"blog_id = {blog_id:String}",
		// Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
		"toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))",
		"toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))",
		"event_timestamp >= toDateTime64({start:UInt64}, 3)",
		"event_timestamp <= toDateTime64({end:UInt64}, 3)",
	];

	$params = [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'] * 1000,
		'end'     => $dates['end'] * 1000,
	];

	$param_index = 0;
	foreach ( $filters as $filter ) {
		$field = sanitize_field_name( $filter['field'] ?? '' );
		$operator = $filter['operator'] ?? 'eq';
		$value = $filter['value'] ?? '';

		if ( empty( $field ) ) {
			continue;
		}

		$param_key = "f{$param_index}";
		$param_index++;

		switch ( $operator ) {
			case 'eq':
				$where_clauses[] = "{$field} = {{$param_key}:String}";
				$params[ $param_key ] = (string) $value;
				break;

			case 'neq':
				$where_clauses[] = "{$field} != {{$param_key}:String}";
				$params[ $param_key ] = (string) $value;
				break;

			case 'gt':
				$where_clauses[] = "{$field} > {{$param_key}:Float64}";
				$params[ $param_key ] = (float) $value;
				break;

			case 'lt':
				$where_clauses[] = "{$field} < {{$param_key}:Float64}";
				$params[ $param_key ] = (float) $value;
				break;
		}
	}

	$where_sql = implode( ' AND ', $where_clauses );

	// Build GROUP BY.
	$group_by = '';
	if ( ! empty( $dimensions ) ) {
		$group_fields = array_filter( array_map( 'Altis\\Accelerate\\Abilities\\Query\\sanitize_field_name', $dimensions ) );
		if ( ! empty( $group_fields ) ) {
			$group_by = 'GROUP BY ' . implode( ', ', $group_fields );
		}
	}

	// Build query.
	$query = "SELECT {$select_sql}
		FROM {$table}
		WHERE {$where_sql}
		{$group_by}
		LIMIT {$limit}";

	$result = Utils\query( $query, $params );

	$query_time = round( ( microtime( true ) - $start_time ) * 1000, 2 );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$rows = [];
	if ( is_array( $result ) ) {
		foreach ( $result as $row ) {
			$row_data = [];
			if ( is_object( $row ) ) {
				$row_data = (array) $row;
			} elseif ( is_array( $row ) ) {
				$row_data = $row;
			}
			$rows[] = $row_data;
		}
	}

	return [
		'rows'          => $rows,
		'query_time_ms' => $query_time,
	];
}

/**
 * Register accelerate/search-content ability.
 *
 * Find content by title/URL/text.
 *
 * @return void
 */
function register_search_content() : void {
	wp_register_ability( 'accelerate/search-content', [
		'label'       => __( 'Search Content', 'altis' ),
		'description' => __( 'Search for content by title, URL, or text content.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
				'query' => [
					'type'        => 'string',
					'description' => __( 'Search query.', 'altis' ),
				],
				'search_in' => [
					'type'    => 'string',
					'enum'    => [ 'title', 'url', 'content' ],
					'default' => 'title',
				],
				'post_type' => [
					'type'        => 'string',
					'description' => __( 'Filter by post type.', 'altis' ),
				],
				'limit' => [
					'type'    => 'integer',
					'default' => 20,
					'minimum' => 1,
					'maximum' => 100,
				],
			],
			'required' => [ 'query' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'results' => [ 'type' => 'array' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_search_content',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Searching content...', 'altis' ),
		],
	] );
}

/**
 * Execute search-content ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Search results or error.
 */
function execute_search_content( array $input ) {
	$query_string = $input['query'] ?? '';
	$search_in = $input['search_in'] ?? 'title';
	$post_type = $input['post_type'] ?? '';
	$limit = min( $input['limit'] ?? 20, 100 );

	if ( empty( $query_string ) ) {
		return new WP_Error( 'missing_query', __( 'query is required.', 'altis' ) );
	}

	// Build WP_Query args.
	$args = [
		'posts_per_page' => $limit,
		'post_status'    => 'publish',
	];

	if ( $search_in === 'title' ) {
		$args['s'] = $query_string;
		$args['search_columns'] = [ 'post_title' ];
	} elseif ( $search_in === 'content' ) {
		$args['s'] = $query_string;
	} elseif ( $search_in === 'url' ) {
		// Search by slug.
		$args['name'] = sanitize_title( $query_string );
	}

	if ( ! empty( $post_type ) ) {
		$args['post_type'] = $post_type;
	} else {
		$args['post_type'] = [ 'post', 'page' ];
	}

	$query = new \WP_Query( $args );

	$results = [];
	foreach ( $query->posts as $post ) {
		$results[] = [
			'post_id'   => $post->ID,
			'title'     => $post->post_title,
			'url'       => get_permalink( $post->ID ),
			'post_type' => $post->post_type,
			'excerpt'   => wp_trim_words( $post->post_excerpt ?: $post->post_content, 30 ),
		];
	}

	return [
		'results' => $results,
	];
}

/**
 * Get available analytics fields and their metadata.
 *
 * @return array Field definitions.
 */
function get_available_fields() : array {
	return [
		'event_type' => [
			'type'        => 'string',
			'description' => __( 'Type of event (pageView, click, etc).', 'altis' ),
			'examples'    => [ 'pageView', 'click', 'scroll' ],
		],
		'event_timestamp' => [
			'type'        => 'datetime',
			'description' => __( 'When the event occurred.', 'altis' ),
		],
		'session_id' => [
			'type'        => 'string',
			'description' => __( 'Unique session identifier.', 'altis' ),
		],
		'endpoint_id' => [
			'type'        => 'string',
			'description' => __( 'Unique visitor identifier.', 'altis' ),
		],
		'blog_id' => [
			'type'        => 'string',
			'description' => __( 'WordPress blog ID.', 'altis' ),
		],
		'initial_referer' => [
			'type'        => 'string',
			'description' => __( 'First referrer URL in the session.', 'altis' ),
		],
		'endpoint_demographic_platform' => [
			'type'        => 'string',
			'description' => __( 'Operating system.', 'altis' ),
			'examples'    => [ 'Windows', 'macOS', 'iOS', 'Android' ],
		],
		'endpoint_demographic_model' => [
			'type'        => 'string',
			'description' => __( 'Browser name.', 'altis' ),
			'examples'    => [ 'Chrome', 'Firefox', 'Safari' ],
		],
		'endpoint_location_country' => [
			'type'        => 'string',
			'description' => __( 'Visitor country.', 'altis' ),
			'examples'    => [ 'US', 'GB', 'DE' ],
		],
		"attributes['postId']" => [
			'type'        => 'string',
			'description' => __( 'WordPress post ID.', 'altis' ),
		],
		"attributes['referer']" => [
			'type'        => 'string',
			'description' => __( 'Page referrer URL.', 'altis' ),
		],
		"attributes['utm_source']" => [
			'type'        => 'string',
			'description' => __( 'UTM source parameter.', 'altis' ),
		],
		"attributes['utm_medium']" => [
			'type'        => 'string',
			'description' => __( 'UTM medium parameter.', 'altis' ),
		],
		"attributes['utm_campaign']" => [
			'type'        => 'string',
			'description' => __( 'UTM campaign parameter.', 'altis' ),
		],
	];
}

/**
 * Sanitize field name for use in queries.
 *
 * @param string $field Field name.
 * @return string Sanitized field name or empty string if invalid.
 */
function sanitize_field_name( string $field ) : string {
	// Allow specific patterns for ClickHouse fields.
	if ( preg_match( "/^[a-zA-Z_][a-zA-Z0-9_]*(\['[a-zA-Z0-9_]+'\])?$/", $field ) ) {
		return $field;
	}

	// Check if it's in our allowed fields.
	$allowed = get_available_fields();
	if ( isset( $allowed[ $field ] ) ) {
		return $field;
	}

	return '';
}
