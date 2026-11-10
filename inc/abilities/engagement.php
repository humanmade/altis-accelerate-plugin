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
			'additionalProperties' => false,
			'properties' => [
				'entity_type' => [
					'type'    => 'string',
					'enum'    => [ 'post', 'site' ],
					'default' => 'site',
				],
				'entity_id' => [
					'type'        => 'integer',
					'description' => __( 'Post ID when entity_type is "post". The alias "post_id" is also accepted.', 'altis' ),
				],
				'post_id' => [
					'type'        => 'integer',
					'description' => __( 'Alias for "entity_id" — used when entity_type is "post" to match sibling abilities.', 'altis' ),
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
				'engaged_seconds_total'    => [ 'type' => 'number' ],
				'engaged_seconds_avg'      => [ 'type' => 'number' ],
				'engaged_sessions'         => [ 'type' => 'integer' ],
				'engaged_pageviews'        => [ 'type' => 'integer' ],
				'engaged_first_seen'       => [ 'type' => [ 'string', 'null' ] ],
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
	// Accept "post_id" as an alias for "entity_id" to match sibling abilities.
	$entity_id = $input['entity_id'] ?? ( $input['post_id'] ?? null );

	// Validate entity_id for post type.
	if ( $entity_type === 'post' && ! $entity_id ) {
		return new WP_Error( 'missing_entity_id', __( 'entity_id (or its alias post_id) is required when entity_type is "post".', 'altis' ) );
	}

	// Parse date range.
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );

	$blog_id = get_current_blog_id();
	$table = Helpers\get_analytics_table();

	$params = [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'],
		'end'     => $dates['end'],
	];

	$is_post_scoped = $entity_type === 'post' && $entity_id;
	if ( $is_post_scoped ) {
		$params['post_id'] = (string) $entity_id;
	}

	// Get overall stats.
	$filter = new API\Filter();
	if ( $is_post_scoped ) {
		$filter->include = [ $entity_id ];
	}

	$stats_data = API\get_graph_data( $dates['start'], $dates['end'], 'P1D', $filter );

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

	// Session metrics. For post-scoped queries we still aggregate sessions over
	// the whole site, then keep only sessions that contained the target post —
	// otherwise pages_per_session collapses to "views of the same post" instead
	// of "where this post appeared in a multi-page session".
	$session_filter = $is_post_scoped
		? "HAVING sumIf( 1, attributes['postId'] = {post_id:String} ) > 0"
		: '';

	$session_query = "SELECT
		avg(session_pages) as avg_pages_per_session
	FROM (
		SELECT
			session_id,
			countIf( event_type = 'pageView' ) as session_pages
		FROM {$table}
		WHERE
			blog_id = {blog_id:String}
			-- Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
			AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
			AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND notEmpty( toString( session_id ) )
		GROUP BY session_id
		{$session_filter}
	)";

	$session_result = Utils\query( $session_query, $params );
	if ( is_wp_error( $session_result ) ) {
		return $session_result;
	}

	$pages_per_session = 1.0;
	if ( is_array( $session_result ) && ! empty( $session_result ) ) {
		$pages_per_session = round( (float) Helpers\get_clickhouse_row_value( $session_result[0], 'avg_pages_per_session', 1 ), 2 );
	}

	// Recirculation = share of qualifying sessions that visited more than one
	// distinct post. For post-scoped queries we keep only sessions containing
	// the target post, then count distinct postIds across all pageviews in the
	// session.
	$recirc_query = "SELECT
		countIf(distinct_pages > 1) as recirculated,
		count() as total
	FROM (
		SELECT
			session_id,
			uniqExact( attributes['postId'] ) as distinct_pages
		FROM {$table}
		WHERE
			blog_id = {blog_id:String}
			AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
			AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND notEmpty( toString( session_id ) )
			AND attributes['postId'] != ''
		GROUP BY session_id
		{$session_filter}
	)";

	$recirc_result = Utils\query( $recirc_query, $params );
	if ( is_wp_error( $recirc_result ) ) {
		return $recirc_result;
	}

	$recirculation_rate = 0;
	if ( is_array( $recirc_result ) && ! empty( $recirc_result ) ) {
		$recirculated = (int) Helpers\get_clickhouse_row_value( $recirc_result[0], 'recirculated', 0 );
		$total = (int) Helpers\get_clickhouse_row_value( $recirc_result[0], 'total', 0 );
		$recirculation_rate = $total > 0 ? round( ( $recirculated / $total ) * 100, 2 ) : 0;
	}

	// Exit pages = the post on the last pageView per session (site-wide only).
	$exit_pages = [];
	if ( $entity_type === 'site' ) {
		$exit_query = "SELECT
			last_post_id as post_id,
			count() as exit_count
		FROM (
			SELECT argMax( attributes['postId'], event_timestamp ) as last_post_id
			FROM {$table}
			WHERE
				blog_id = {blog_id:String}
				AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
				AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
				AND event_timestamp >= toDateTime64({start:UInt64}, 3)
				AND event_timestamp <= toDateTime64({end:UInt64}, 3)
				AND event_type = 'pageView'
				AND notEmpty( toString( session_id ) )
				AND attributes['postId'] != ''
			GROUP BY session_id
		)
		WHERE last_post_id != ''
		GROUP BY post_id
		ORDER BY exit_count DESC
		LIMIT 10";

		$exit_result = Utils\query( $exit_query, $params );
		if ( is_wp_error( $exit_result ) ) {
			return $exit_result;
		}

		if ( is_array( $exit_result ) ) {
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

	// Scroll depth: derived from metrics['scrollDepthMax'] carried on every
	// pageView (frontend tracker, src/accelerate.js getMetrics()). We aggregate
	// the max recorded depth per (session, post) so reloads don't double-count,
	// then report the percentage of those samples that crossed each threshold.
	$scroll_post_filter = $is_post_scoped ? "AND attributes['postId'] = {post_id:String}" : '';
	$scroll_query = "SELECT
		if( count() > 0, countIf( max_scroll >= 25 )  * 100 / count(), 0 ) as p25,
		if( count() > 0, countIf( max_scroll >= 50 )  * 100 / count(), 0 ) as p50,
		if( count() > 0, countIf( max_scroll >= 75 )  * 100 / count(), 0 ) as p75,
		if( count() > 0, countIf( max_scroll >= 100 ) * 100 / count(), 0 ) as p100
	FROM (
		SELECT max( metrics['scrollDepthMax'] ) as max_scroll
		FROM {$table}
		WHERE
			blog_id = {blog_id:String}
			AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
			AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND notEmpty( toString( session_id ) )
			{$scroll_post_filter}
		GROUP BY session_id, attributes['postId']
	)";

	$scroll_result = Utils\query( $scroll_query, $params );
	if ( is_wp_error( $scroll_result ) ) {
		return $scroll_result;
	}

	$scroll_depth = [
		'p25'  => 0,
		'p50'  => 0,
		'p75'  => 0,
		'p100' => 0,
	];
	if ( is_array( $scroll_result ) && ! empty( $scroll_result ) ) {
		$scroll_depth = [
			'p25'  => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p25', 0 ), 2 ),
			'p50'  => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p50', 0 ), 2 ),
			'p75'  => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p75', 0 ), 2 ),
			'p100' => round( (float) Helpers\get_clickhouse_row_value( $scroll_result[0], 'p100', 0 ), 2 ),
		];
	}

	// Time on page: max( metrics['elapsed'] ) per (session, post) is the dwell
	// time recorded on that page before the visitor navigated away or the
	// session stopped. elapsed is in milliseconds in the tracker.
	$time_query = "SELECT avg( time_on_page ) as avg_time_seconds
	FROM (
		SELECT max( metrics['elapsed'] ) / 1000 as time_on_page
		FROM {$table}
		WHERE
			blog_id = {blog_id:String}
			AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
			AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type IN ( 'pageView', '_session.stop' )
			AND notEmpty( toString( session_id ) )
			{$scroll_post_filter}
		GROUP BY session_id, attributes['postId']
		HAVING time_on_page > 0
	)";

	$time_result = Utils\query( $time_query, $params );
	if ( is_wp_error( $time_result ) ) {
		return $time_result;
	}

	$avg_time = 0;
	if ( is_array( $time_result ) && ! empty( $time_result ) ) {
		$avg_time = round( (float) Helpers\get_clickhouse_row_value( $time_result[0], 'avg_time_seconds', 0 ), 2 );
	}

	// Engaged time now rides the standard stats pipeline: get_graph_data()
	// computes it from the raw analytics table (reusing the same path / include
	// / audience filters) and returns it under stats.summary.engaged. This
	// ability is just a mapping layer over that shared result. Defaults to zero
	// when get_graph_data() errored, mirroring how bounce/returning degrade.
	$engaged = ! is_wp_error( $stats_data )
		? ( $stats_data['stats']['summary']['engaged'] ?? [] )
		: [];

	$engaged_seconds_total = round( (float) ( $engaged['total_seconds'] ?? 0 ), 2 );
	$engaged_seconds_avg   = round( (float) ( $engaged['avg_seconds'] ?? 0 ), 2 );
	$engaged_pageviews     = (int) ( $engaged['pageviews'] ?? 0 );
	$engaged_sessions      = (int) ( $engaged['sessions'] ?? 0 );
	$engaged_first_seen    = $engaged['first_seen'] ?? null;

	return [
		'avg_time_on_page_seconds' => $avg_time,
		'bounce_rate'              => $bounce_rate,
		'pages_per_session'        => $pages_per_session,
		'recirculation_rate'       => $recirculation_rate,
		'return_visitor_rate'      => $returning_rate,
		'scroll_depth'             => $scroll_depth,
		'exit_pages'               => $exit_pages,
		'engaged_seconds_total'    => $engaged_seconds_total,
		'engaged_seconds_avg'      => $engaged_seconds_avg,
		'engaged_sessions'         => $engaged_sessions,
		'engaged_pageviews'        => $engaged_pageviews,
		'engaged_first_seen'       => $engaged_first_seen,
		'period' => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}
