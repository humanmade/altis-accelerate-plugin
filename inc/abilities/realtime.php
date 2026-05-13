<?php
/**
 * Accelerate Abilities API - Realtime Domain.
 *
 * Real-time analytics abilities for trending content and concurrent visitors.
 *
 * @package Altis\Accelerate\Abilities\Realtime
 */

namespace Altis\Accelerate\Abilities\Realtime;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Helpers;
use Altis\Accelerate\Utils;
use WP_Error;

/**
 * Register all realtime abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_get_trending_content();
	register_get_concurrent_visitors();
}

/**
 * Register accelerate/get-trending-content ability.
 *
 * Content ranked by current momentum (velocity).
 *
 * @return void
 */
function register_get_trending_content() : void {
	wp_register_ability( 'accelerate/get-trending-content', [
		'label'       => __( 'Get Trending Content', 'altis' ),
		'description' => __( 'Get content ranked by current momentum (velocity) - rising, stable, or falling.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'window' => [
					'type'        => 'string',
					'enum'        => [ '1h', '4h', '12h', '24h' ],
					'default'     => '1h',
					'description' => __( 'Time window for velocity calculation.', 'altis' ),
				],
				'metric' => [
					'type'    => 'string',
					'enum'    => [ 'views', 'conversions', 'visitors' ],
					'default' => 'views',
				],
				'content_type' => [
					'type'    => 'string',
					'enum'    => [ 'post', 'page', 'block', 'all' ],
					'default' => 'all',
				],
				'limit' => [
					'type'    => 'integer',
					'default' => 20,
					'minimum' => 1,
					'maximum' => 50,
				],
				'min_threshold' => [
					'type'        => 'integer',
					'default'     => 10,
					'description' => __( 'Minimum metric value to include.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'trending' => [ 'type' => 'array' ],
				'window'   => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_trending_content',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing trending content...', 'altis' ),
		],
	] );
}

/**
 * Execute get-trending-content ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Trending content data or error.
 */
function execute_get_trending_content( array $input ) {
	$window = $input['window'] ?? '1h';
	$metric = $input['metric'] ?? 'views';
	$content_type = $input['content_type'] ?? 'all';
	$limit = min( $input['limit'] ?? 20, 50 );
	$min_threshold = $input['min_threshold'] ?? 10;

	// Get current and previous window timestamps.
	$current_dates = Helpers\resolve_preset_to_dates( $window );
	$previous_dates = Helpers\get_comparison_period( $current_dates['start'], $current_dates['end'] );

	// Build query parameters.
	$blog_id = get_current_blog_id();

	// Query current period.
	$current_result = Utils\query(
		"SELECT
			attributes['postId'] as post_id,
			uniqCombined64(endpoint_id) as visitors,
			count() as views
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND attributes['postId'] != ''
		GROUP BY post_id
		ORDER BY views DESC
		LIMIT 200",
		[
			'blog_id' => (string) $blog_id,
			'start'   => $current_dates['start'] * 1000,
			'end'     => $current_dates['end'] * 1000,
		]
	);

	if ( is_wp_error( $current_result ) ) {
		return $current_result;
	}

	// Query previous period.
	$previous_result = Utils\query(
		"SELECT
			attributes['postId'] as post_id,
			uniqCombined64(endpoint_id) as visitors,
			count() as views
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND attributes['postId'] != ''
		GROUP BY post_id",
		[
			'blog_id' => (string) $blog_id,
			'start'   => $previous_dates['start'] * 1000,
			'end'     => $previous_dates['end'] * 1000,
		]
	);

	// Build previous lookup.
	$previous_lookup = [];
	if ( ! is_wp_error( $previous_result ) && is_array( $previous_result ) ) {
		foreach ( $previous_result as $row ) {
			$post_id = Helpers\get_clickhouse_row_value( $row, 'post_id' );
			$previous_lookup[ $post_id ] = [
				'views'    => (int) Helpers\get_clickhouse_row_value( $row, 'views', 0 ),
				'visitors' => (int) Helpers\get_clickhouse_row_value( $row, 'visitors', 0 ),
			];
		}
	}

	// Process results.
	$trending = [];

	if ( is_array( $current_result ) ) {
		foreach ( $current_result as $row ) {
			$post_id = Helpers\get_clickhouse_row_value( $row, 'post_id' );
			$current_views = (int) Helpers\get_clickhouse_row_value( $row, 'views', 0 );
			$current_visitors = (int) Helpers\get_clickhouse_row_value( $row, 'visitors', 0 );

			// Skip if below threshold.
			$current_metric_value = $metric === 'visitors' ? $current_visitors : $current_views;
			if ( $current_metric_value < $min_threshold ) {
				continue;
			}

			// Get post details.
			$post = get_post( $post_id );
			if ( ! $post || $post->post_status !== 'publish' ) {
				continue;
			}

			// Filter by content type.
			if ( $content_type !== 'all' && $post->post_type !== $content_type ) {
				continue;
			}

			// Calculate velocity.
			$previous = $previous_lookup[ $post_id ] ?? [ 'views' => 0, 'visitors' => 0 ];
			$previous_metric_value = $metric === 'visitors' ? $previous['visitors'] : $previous['views'];

			$velocity = Helpers\calculate_velocity( $current_metric_value, $previous_metric_value );

			$trending[] = [
				'post_id'        => (int) $post_id,
				'title'          => $post->post_title,
				'url'            => get_permalink( $post_id ),
				'current_count'  => $current_metric_value,
				'previous_count' => $previous_metric_value,
				'velocity_percent' => $velocity['percent'],
				'direction'      => $velocity['direction'],
			];
		}
	}

	// Sort by velocity (rising first, then by current count).
	usort( $trending, function ( $a, $b ) {
		// Prioritize rising content.
		if ( $a['direction'] !== $b['direction'] ) {
			$order = [ 'rising' => 0, 'stable' => 1, 'falling' => 2 ];
			return $order[ $a['direction'] ] <=> $order[ $b['direction'] ];
		}
		// Then by velocity percentage.
		return $b['velocity_percent'] <=> $a['velocity_percent'];
	} );

	return [
		'trending' => array_slice( $trending, 0, $limit ),
		'window'   => [
			'start' => gmdate( 'c', $current_dates['start'] ),
			'end'   => gmdate( 'c', $current_dates['end'] ),
		],
	];
}

/**
 * Register accelerate/get-concurrent-visitors ability.
 *
 * Real-time visitor count with polling guidance.
 *
 * @return void
 */
function register_get_concurrent_visitors() : void {
	wp_register_ability( 'accelerate/get-concurrent-visitors', [
		'label'       => __( 'Get Concurrent Visitors', 'altis' ),
		'description' => __( 'Get real-time concurrent visitor count with polling guidance.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'post_id' => [
					'type'        => 'integer',
					'description' => __( 'Specific post ID. Omit for site-wide count.', 'altis' ),
				],
				'active_window_minutes' => [
					'type'    => 'integer',
					'minimum' => 1,
					'maximum' => 15,
					'default' => 5,
					'description' => __( 'Minutes to consider a visitor "active".', 'altis' ),
				],
				'include_breakdown' => [
					'type'    => 'boolean',
					'default' => false,
					'description' => __( 'Include device/source breakdown.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'concurrent_visitors' => [ 'type' => 'integer' ],
				'breakdown'           => [ 'type' => 'object' ],
				'comparison'          => [ 'type' => 'object' ],
				'polling'             => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_concurrent_visitors',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Counting concurrent visitors...', 'altis' ),
		],
	] );
}

/**
 * Execute get-concurrent-visitors ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Concurrent visitor data or error.
 */
function execute_get_concurrent_visitors( array $input ) {
	$post_id = $input['post_id'] ?? null;
	$active_window = min( max( $input['active_window_minutes'] ?? 5, 1 ), 15 );
	$include_breakdown = $input['include_breakdown'] ?? false;

	$blog_id = get_current_blog_id();
	$now = time();
	$window_start = ( $now - ( $active_window * 60 ) ) * 1000;
	$yesterday_start = ( $now - 86400 - ( $active_window * 60 ) ) * 1000;
	$yesterday_end = ( $now - 86400 ) * 1000;

	// Build post filter.
	$post_filter = $post_id
		? "AND attributes['postId'] = {post_id:String}"
		: '';

	$params = [
		'blog_id'      => (string) $blog_id,
		'window_start' => $window_start,
		'now'          => $now * 1000,
		'yesterday_start' => $yesterday_start,
		'yesterday_end'   => $yesterday_end,
	];

	if ( $post_id ) {
		$params['post_id'] = (string) $post_id;
	}

	// Query current concurrent visitors.
	$current_query = "SELECT
		uniqCombined64(endpoint_id) as concurrent_visitors
	FROM analytics
	WHERE
		blog_id = {blog_id:String}
		AND event_timestamp >= toDateTime64({window_start:UInt64}, 3)
		AND event_timestamp <= toDateTime64({now:UInt64}, 3)
		AND event_type = 'pageView'
		{$post_filter}";

	$current_result = Utils\query( $current_query, $params );

	if ( is_wp_error( $current_result ) ) {
		return $current_result;
	}

	$concurrent = 0;
	if ( is_array( $current_result ) && ! empty( $current_result ) ) {
		$concurrent = (int) Helpers\get_clickhouse_row_value( $current_result[0], 'concurrent_visitors', 0 );
	}

	// Query yesterday's same time for comparison.
	$yesterday_query = "SELECT
		uniqCombined64(endpoint_id) as concurrent_visitors
	FROM analytics
	WHERE
		blog_id = {blog_id:String}
		AND event_timestamp >= toDateTime64({yesterday_start:UInt64}, 3)
		AND event_timestamp <= toDateTime64({yesterday_end:UInt64}, 3)
		AND event_type = 'pageView'
		{$post_filter}";

	$yesterday_result = Utils\query( $yesterday_query, $params );

	$yesterday_concurrent = 0;
	if ( ! is_wp_error( $yesterday_result ) && is_array( $yesterday_result ) && ! empty( $yesterday_result ) ) {
		$yesterday_concurrent = (int) Helpers\get_clickhouse_row_value( $yesterday_result[0], 'concurrent_visitors', 0 );
	}

	$result = [
		'concurrent_visitors' => $concurrent,
		'comparison' => [
			'same_time_yesterday' => $yesterday_concurrent,
			'change_percent' => Helpers\calculate_velocity( $concurrent, $yesterday_concurrent )['percent'],
		],
		'polling' => [
			'recommended_refresh_seconds' => 30,
			'cache_expires_at' => gmdate( 'c', $now + 30 ),
		],
	];

	// Include breakdown if requested.
	if ( $include_breakdown ) {
		$breakdown_query = "SELECT
			endpoint_demographic_platform as os,
			endpoint_demographic_model as browser,
			initial_referer,
			uniqCombined64(endpoint_id) as count
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({window_start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({now:UInt64}, 3)
			AND event_type = 'pageView'
			{$post_filter}
		GROUP BY os, browser, initial_referer";

		$breakdown_result = Utils\query( $breakdown_query, $params );

		$device_breakdown = [
			'desktop' => 0,
			'mobile'  => 0,
			'tablet'  => 0,
		];
		$source_breakdown = [
			'direct'   => 0,
			'organic'  => 0,
			'social'   => 0,
			'referral' => 0,
		];

		if ( ! is_wp_error( $breakdown_result ) && is_array( $breakdown_result ) ) {
			foreach ( $breakdown_result as $row ) {
				$count = (int) Helpers\get_clickhouse_row_value( $row, 'count', 0 );
				$os = Helpers\get_clickhouse_row_value( $row, 'os', '' );
				$referer = Helpers\get_clickhouse_row_value( $row, 'initial_referer', '' );

				// Classify device.
				$os_lower = strtolower( $os );
				if ( strpos( $os_lower, 'ios' ) !== false || strpos( $os_lower, 'android' ) !== false ) {
					$device_breakdown['mobile'] += $count;
				} elseif ( strpos( $os_lower, 'ipad' ) !== false ) {
					$device_breakdown['tablet'] += $count;
				} else {
					$device_breakdown['desktop'] += $count;
				}

				// Classify source.
				if ( empty( $referer ) ) {
					$source_breakdown['direct'] += $count;
				} elseif ( preg_match( '/google|bing|yahoo|duckduckgo/i', $referer ) ) {
					$source_breakdown['organic'] += $count;
				} elseif ( preg_match( '/facebook|twitter|linkedin|instagram|pinterest|reddit/i', $referer ) ) {
					$source_breakdown['social'] += $count;
				} else {
					$source_breakdown['referral'] += $count;
				}
			}
		}

		$result['breakdown'] = [
			'device' => $device_breakdown,
			'source' => $source_breakdown,
		];
	}

	return $result;
}
