<?php
/**
 * Accelerate Abilities API - Engagement Domain.
 *
 * Engagement metrics abilities for quality beyond view counts.
 *
 * @package Altis\Accelerate\Abilities\Engagement
 */

namespace Altis\Accelerate\Abilities\Engagement;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Helpers;
use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_Error;

/**
 * Register all engagement abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_get_engagement_metrics();
}

/**
 * Register accelerate/get-engagement-metrics ability.
 *
 * Quality metrics beyond basic view counts.
 *
 * @return void
 */
function register_get_engagement_metrics() : void {
	wp_register_ability( 'accelerate/get-engagement-metrics', [
		'label'       => __( 'Get Engagement Metrics', 'altis' ),
		'description' => __( 'Get quality engagement metrics like bounce rate, time on page, scroll depth, and recirculation.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'entity_type' => [
					'type'    => 'string',
					'enum'    => [ 'post', 'site' ],
					'default' => 'site',
				],
				'entity_id' => [
					'type'        => 'integer',
					'description' => __( 'Post ID when entity_type is "post".', 'altis' ),
				],
				'date_range' => Helpers\get_date_range_with_preset_schema(),
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'avg_time_on_page_seconds' => [ 'type' => 'number' ],
				'bounce_rate'              => [ 'type' => 'number' ],
				'pages_per_session'        => [ 'type' => 'number' ],
				'recirculation_rate'       => [ 'type' => 'number' ],
				'return_visitor_rate'      => [ 'type' => 'number' ],
				'scroll_depth'             => [ 'type' => 'object' ],
				'exit_pages'               => [ 'type' => 'array' ],
				'period'                   => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_engagement_metrics',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing engagement metrics...', 'altis' ),
		],
	] );
}

/**
 * Execute get-engagement-metrics ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Engagement metrics or error.
 */
function execute_get_engagement_metrics( array $input ) {
	$entity_type = $input['entity_type'] ?? 'site';
	$entity_id = $input['entity_id'] ?? null;

	// Validate entity_id for post type.
	if ( $entity_type === 'post' && ! $entity_id ) {
		return new WP_Error( 'missing_entity_id', __( 'entity_id is required when entity_type is "post".', 'altis' ) );
	}

	// Parse date range.
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );

	$blog_id = get_current_blog_id();

	// Build post filter.
	$post_filter = '';
	$params = [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'] * 1000,
		'end'     => $dates['end'] * 1000,
	];

	if ( $entity_type === 'post' && $entity_id ) {
		$post_filter = "AND attributes['postId'] = {post_id:String}";
		$params['post_id'] = (string) $entity_id;
	}

	// Get overall stats.
	$filter = new API\Filter();
	if ( $entity_type === 'post' && $entity_id ) {
		$filter->include = [ $entity_id ];
	}

	$stats_data = API\get_graph_data( $dates['start'], $dates['end'], '1 day', $filter );

	$bounce_rate = 0;
	$returning_rate = 0;

	if ( ! is_wp_error( $stats_data ) ) {
		$summary = $stats_data['stats']['summary'] ?? [];
		$visitors = $summary['visitors'] ?? 0;
		$bounces = $summary['bounce'] ?? 0;
		$returning = $summary['returning'] ?? 0;

		$bounce_rate = $visitors > 0 ? round( ( $bounces / $visitors ) * 100, 2 ) : 0;
		$returning_rate = $visitors > 0 ? round( ( $returning / $visitors ) * 100, 2 ) : 0;
	}

	// Query session metrics.
	$session_query = "SELECT
		avg(session_pages) as avg_pages_per_session
	FROM (
		SELECT
			session_id,
			count() as session_pages
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND session_id != ''
			{$post_filter}
		GROUP BY session_id
	)";

	$session_result = Utils\query( $session_query, $params );

	$pages_per_session = 1.0;
	if ( ! is_wp_error( $session_result ) && is_array( $session_result ) && ! empty( $session_result ) ) {
		$pages_per_session = round( (float) Helpers\get_clickhouse_row_value( $session_result[0], 'avg_pages_per_session', 1 ), 2 );
	}

	// Calculate recirculation rate (sessions with > 1 page view).
	$recirc_query = "SELECT
		countIf(session_pages > 1) as recirculated,
		count() as total
	FROM (
		SELECT
			session_id,
			count() as session_pages
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND session_id != ''
			{$post_filter}
		GROUP BY session_id
	)";

	$recirc_result = Utils\query( $recirc_query, $params );

	$recirculation_rate = 0;
	if ( ! is_wp_error( $recirc_result ) && is_array( $recirc_result ) && ! empty( $recirc_result ) ) {
		$recirculated = (int) Helpers\get_clickhouse_row_value( $recirc_result[0], 'recirculated', 0 );
		$total = (int) Helpers\get_clickhouse_row_value( $recirc_result[0], 'total', 0 );
		$recirculation_rate = $total > 0 ? round( ( $recirculated / $total ) * 100, 2 ) : 0;
	}

	// Get exit pages (only for site-wide).
	$exit_pages = [];
	if ( $entity_type === 'site' ) {
		$exit_query = "SELECT
			attributes['postId'] as post_id,
			count() as exit_count
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND attributes['postId'] != ''
		GROUP BY post_id
		HAVING exit_count > 0
		ORDER BY exit_count DESC
		LIMIT 10";

		$exit_result = Utils\query( $exit_query, $params );

		if ( ! is_wp_error( $exit_result ) && is_array( $exit_result ) ) {
			foreach ( $exit_result as $row ) {
				$post_id = Helpers\get_clickhouse_row_value( $row, 'post_id' );
				$post = get_post( $post_id );

				if ( $post ) {
					$exit_pages[] = [
						'post_id'    => (int) $post_id,
						'title'      => $post->post_title,
						'exit_count' => (int) Helpers\get_clickhouse_row_value( $row, 'exit_count', 0 ),
					];
				}
			}
		}
	}

	// Note: Scroll depth and time on page require specific event tracking.
	// These are placeholder values based on what data might be available.
	$scroll_depth = [
		'p25'  => 0,
		'p50'  => 0,
		'p75'  => 0,
		'p100' => 0,
	];

	// Attempt to get scroll depth if tracked.
	$scroll_query = "SELECT
		countIf(scroll_depth >= 25) / count() * 100 as p25,
		countIf(scroll_depth >= 50) / count() * 100 as p50,
		countIf(scroll_depth >= 75) / count() * 100 as p75,
		countIf(scroll_depth >= 100) / count() * 100 as p100
	FROM analytics
	WHERE
		blog_id = {blog_id:String}
		AND event_timestamp >= toDateTime64({start:UInt64}, 3)
		AND event_timestamp <= toDateTime64({end:UInt64}, 3)
		AND event_type = 'scrollDepth'
		{$post_filter}";

	$scroll_result = Utils\query( $scroll_query, $params );

	if ( ! is_wp_error( $scroll_result ) && is_array( $scroll_result ) && ! empty( $scroll_result ) ) {
		$scroll_depth = [
			'p25'  => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p25', 0 ), 2 ),
			'p50'  => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p50', 0 ), 2 ),
			'p75'  => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p75', 0 ), 2 ),
			'p100' => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p100', 0 ), 2 ),
		];
	}

	// Estimate time on page from session duration.
	// This is approximate since we track page views, not page durations.
	$time_query = "SELECT
		avg(session_duration) / 1000 as avg_time_seconds
	FROM (
		SELECT
			session_id,
			max(toUnixTimestamp64Milli(event_timestamp)) - min(toUnixTimestamp64Milli(event_timestamp)) as session_duration
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND session_id != ''
			{$post_filter}
		GROUP BY session_id
		HAVING session_duration > 0
	)";

	$time_result = Utils\query( $time_query, $params );

	$avg_time = 0;
	if ( ! is_wp_error( $time_result ) && is_array( $time_result ) && ! empty( $time_result ) ) {
		$avg_time = round( (float) Helpers\get_clickhouse_row_value( $time_result[0], 'avg_time_seconds', 0 ), 2 );
	}

	return [
		'avg_time_on_page_seconds' => $avg_time,
		'bounce_rate'              => $bounce_rate,
		'pages_per_session'        => $pages_per_session,
		'recirculation_rate'       => $recirculation_rate,
		'return_visitor_rate'      => $returning_rate,
		'scroll_depth'             => $scroll_depth,
		'exit_pages'               => $exit_pages,
		'period' => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}
