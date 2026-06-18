<?php
/**
 * Altis Accelerate analytics API.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\API;

use Altis\Accelerate\Audiences;
use Altis\Accelerate\Blocks;
use Altis\Accelerate\Broadcast;
use Altis\Accelerate\Dashboard;
use Altis\Accelerate\Telemetry;
use Altis\Accelerate\Utils;
use WP_Error;
use WP_Query;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

const API_NAMESPACE = 'accelerate/v1';

/**
 * Cache TTL (seconds) for stats payloads of windows that are still live —
 * i.e., extend up to roughly now. Sized to match the dashboard's realtime
 * poll cadence (`REALTIME_INTERVAL_SECONDS` in
 * `src/accelerate/components/shared/StickyPeriodBar.tsx`). If you change
 * one, change the other or you'll get either wasted polls (TTL > poll) or
 * a hot ClickHouse path (TTL < poll).
 */
const LIVE_WINDOW_CACHE_TTL = 15;

/**
 * Bootstrap analytics API.
 *
 * @return void
 */
function setup() {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_endpoints' );
	add_action( 'init', __NAMESPACE__ . '\\register_default_aggregations' );

	// Set up remote API endpoints (HMAC-authenticated).
	require_once __DIR__ . '/remote.php';
	Remote\setup();
}

/**
 * Register APi routes.
 *
 * @return void
 */
function register_endpoints() {
	$date_args = [
		'start' => [
			'type' => 'string',
			'format' => 'date-time',
			'required' => true,
		],
		'end' => [
			'type' => 'string',
			'format' => 'date-time',
			'required' => true,
		],
		'interval' => [
			'type'    => 'string',
			'default' => 'P1D',
			'enum'    => [ 'PT1M', 'PT1H', 'P1D', 'P7D' ],
		],
	];

	register_rest_route( API_NAMESPACE, 'stats', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_stats',
		'permission_callback' => __NAMESPACE__ . '\\check_analytics_permission',
		'args' => array_merge( [
			'path' => [
				'type' => 'string',
			],
		], $date_args ),
	] );

	register_rest_route( API_NAMESPACE, 'stats/aggregations', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_stats_aggregations',
		'permission_callback' => __NAMESPACE__ . '\\check_analytics_permission',
		'args' => array_merge( [
			'include' => [
				'type'    => 'array',
				'items'   => [ 'type' => 'integer' ],
				'default' => [],
			],
			'fields' => [
				'type'    => 'string',
				'default' => '',
			],
		], $date_args ),
	] );

	register_rest_route( API_NAMESPACE, 'top', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_top',
		'permission_callback' => __NAMESPACE__ . '\\check_analytics_permission',
		'args' => array_merge( [
			'type' => [
				'type' => 'string',
			],
			'author' => [
				'type' => 'integer',
			],
			'search' => [
				'type' => 'string',
			],
			'page' => [
				'type' => 'integer',
				'default' => 1,
			],
			'include' => [
				'type' => 'array',
				'items' => [
					'type' => 'integer',
				],
				'default' => [],
			],
		], $date_args ),
	] );

	register_rest_route( API_NAMESPACE, 'top-engaged', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_top_engaged',
		'permission_callback' => __NAMESPACE__ . '\\check_analytics_permission',
		'args' => array_merge( [
			'type' => [
				'type' => 'string',
			],
		], $date_args ),
	] );

	register_rest_route( API_NAMESPACE, 'diff', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_diff',
		'permission_callback' => __NAMESPACE__ . '\\check_analytics_permission',
		'args' => array_merge( [
			'ids' => [
				'type' => 'array',
				'items' => [
					'type' => 'number',
				],
			],
		], $date_args ),
	] );
}

/**
 * Check user permissions for viewing analytics data.
 *
 * @return bool
 */
function check_analytics_permission() : bool {
	return current_user_can( 'edit_posts' );
}

/**
 * Handle stats endpoint.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_Error|array
 */
function get_stats( WP_REST_Request $request ) {
	$start = strtotime( $request['start'] );
	$end = strtotime( $request['end'] );

	$filter = new Filter();
	if ( $request['filter'] && is_array( $request['filter'] ) ) {
		foreach ( $request['filter'] as $key => $value ) {
			if ( property_exists( $filter, $key ) ) {
				// todo: validate/sanitize values.
				$filter->$key = $value;
			}
		}
	}
	return get_graph_data( $start, $end, $request['interval'], $filter );
}

/**
 * Handle stats/aggregations endpoint.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_Error|array
 */
function get_stats_aggregations( WP_REST_Request $request ) {
	$start = strtotime( $request['start'] );
	$end = strtotime( $request['end'] );

	$filter = new Filter();
	if ( $request['filter'] && is_array( $request['filter'] ) ) {
		foreach ( $request['filter'] as $key => $value ) {
			if ( property_exists( $filter, $key ) ) {
				$filter->$key = $value;
			}
		}
	}
	if ( ! empty( $request['include'] ) ) {
		$filter->include = array_map( 'absint', $request['include'] );
	}

	$fields = array_filter( array_map( 'trim', explode( ',', $request['fields'] ?? '' ) ) );

	return get_aggregations( $start, $end, $filter, $fields ?: null );
}

/**
 * Handle top content endpoint.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_Error|WP_REST_Response
 */
function get_top( WP_REST_Request $request ) {
	$start = strtotime( $request['start'] );
	$end = strtotime( $request['end'] );

	$filter = new Filter();
	if ( $request['search'] ) {
		$filter->search = $request['search'];
	}
	if ( $request['type'] ) {
		$filter->type = $request['type'];
	}
	if ( $request['user'] ) {
		$filter->user = (int) $request['user'];
	}
	if ( $request['page'] ) {
		$filter->page = (int) $request['page'];
	}
	if ( $request['include'] ) {
		$filter->include = array_map( 'absint', $request['include'] );
	}
	$data = get_top_data( $start, $end, $filter );

	if ( is_wp_error( $data ) ) {
		return $data;
	}

	$response = new WP_REST_Response( $data['posts'], 200, [
		'X-WP-Total' => $data['total'],
		'X-WP-TotalPages' => $data['max_pages'],
	] );

	return $response;
}

/**
 * Handle top engaged-time endpoint.
 *
 * Returns the top posts/pages by AVERAGE engaged time per visit for the active
 * period, shaped for the dashboard's "Engaged time" list tile. Engaged time is
 * recorded on `_session.stop` events (column `engaged`, milliseconds) which
 * carry `post_id`, so grouping by `post_id` ranks content by engagement.
 *
 * Engaged time is supplementary — on a ClickHouse error this returns an empty
 * array rather than a 500, mirroring the soft-fail in get_graph_data().
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response
 */
function get_top_engaged( WP_REST_Request $request ) : WP_REST_Response {
	$start = strtotime( $request['start'] );
	$end = strtotime( $request['end'] );

	$table = defined( 'ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE' ) ? ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE : 'analytics';
	$query_params = [
		'blog_id' => get_current_blog_id(),
		'start' => (int) $start,
		'end' => (int) $end,
	];

	// Apply the same path / post / audience filter the other breakdowns honor,
	// so the Engaged-time card stays consistent with the rest of the page when
	// a filter is active. Mirrors the filtered branch of get_graph_data — the
	// predicates apply identically to _session.stop rows.
	$filter = new Filter();
	if ( $request['filter'] && is_array( $request['filter'] ) ) {
		foreach ( $request['filter'] as $key => $value ) {
			if ( property_exists( $filter, $key ) ) {
				$filter->$key = $value;
			}
		}
	}
	$query_where = [ '1=1' ];
	if ( $filter->path ) {
		$url_path = home_url( $filter->path );
		if ( parse_url( $url_path, PHP_URL_SCHEME ) === 'http' ) {
			$url_path_alt = 'https' . substr( $url_path, 4 );
		} else {
			$url_path_alt = 'http' . substr( $url_path, 5 );
		}
		$query_where[] = 'url = {path:String} OR url = {path_alt:String}';
		$query_params['path'] = $url_path;
		$query_params['path_alt'] = $url_path_alt;
	}
	if ( $filter->include ) {
		$query_where[] = 'post_id IN {include:Array(String)}';
		$query_params['include'] = array_map( 'strval', $filter->include );
	}
	if ( $filter->audience ) {
		[ $audience_where, $audience_params ] = Audiences\build_audience_query( $filter->audience );
		$query_where[] = $audience_where;
		$query_params = array_merge( $query_params, $audience_params );
	}
	$query_where = sprintf( 'AND (%s)', implode( ') AND (', $query_where ) );

	// Rank by AVERAGE engaged time per visit (total engaged seconds ÷ distinct
	// page sessions), not the summed total — same definition as the "Avg.
	// engaged time" KPI tile. A summed total just rewards high-traffic pages
	// with meaningless multi-hour figures; the average answers "which content
	// actually holds attention".
	$res = Utils\query(
		"SELECT
			post_id,
			sum( engaged ) / 1000 / uniqCombined64( page_session_id ) as engaged_seconds
		FROM {$table}
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64},3)
			AND event_timestamp <= toDateTime64({end:UInt64},3)
			AND event_type = '_session.stop'
			AND engaged > 0
			AND post_id != ''
			{$query_where}
		GROUP BY post_id
		ORDER BY engaged_seconds DESC
		LIMIT 100",
		$query_params
	);
	// NB: over-fetch (100, not 10) because analytics post_ids include rows for
	// revisions / trashed / non-public content that the WP_Query publish +
	// post-type filter below drops. Ranking by average surfaces those first, so
	// a tight LIMIT can leave zero published posts after filtering. The trim to
	// the top 10 published post/page happens post-filter.

	if ( is_wp_error( $res ) ) {
		// Engaged time is supplementary — never fail over it.
		trigger_error( $res->get_error_message(), E_USER_WARNING );
		return new WP_REST_Response( [], 200 );
	}

	// post_id => engaged seconds, preserving the ClickHouse rank order.
	$engaged_by_id = [];
	foreach ( $res as $row ) {
		$id = $row->post_id;
		if ( ! is_numeric( $id ) ) {
			continue;
		}
		$id = intval( $id );
		if ( ! isset( $engaged_by_id[ $id ] ) ) {
			$engaged_by_id[ $id ] = (float) $row->engaged_seconds;
		}
	}

	if ( empty( $engaged_by_id ) ) {
		return new WP_REST_Response( [], 200 );
	}

	// Restrict to the requested post types (posts/pages) so wp_block and
	// broadcast rows drop out, and resolve titles. Preserve the ClickHouse
	// engaged ordering via orderby=post__in.
	$post_types = $request['type'] ? explode( ',', $request['type'] ) : [ 'post', 'page' ];
	$query = new WP_Query( [
		'post_type' => $post_types,
		'post_status' => 'publish',
		'post__in' => array_keys( $engaged_by_id ),
		'orderby' => 'post__in',
		'order' => 'asc',
		'posts_per_page' => -1,
		'ignore_sticky_posts' => true,
	] );

	$items = [];
	foreach ( $query->posts as $post ) {
		$title = trim( wp_strip_all_tags( get_the_title( $post->ID ) ) );
		$items[] = [
			'id' => intval( $post->ID ),
			'title' => html_entity_decode( $title, ENT_QUOTES ),
			'engaged_seconds' => $engaged_by_id[ $post->ID ],
		];
		// Trim to the top 10 after the post_type filter.
		if ( count( $items ) >= 10 ) {
			break;
		}
	}

	return new WP_REST_Response( $items, 200 );
}

/**
 * Handle diff endpoint.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_Error|array
 */
function get_diff( WP_REST_Request $request ) {
	$start = strtotime( $request['start'] );
	$end = strtotime( $request['end'] );
	$post_ids = $request['ids'] ?? [];

	return get_post_diff_data( $post_ids, $start, $end, $request['interval'] );
}


/**
 * Get global page view stats.
 *
 * @param int $start The start timestamp.
 * @param int $end The end timestamp.
 * @param string $resolution Resolution for histogram data.
 * @param Filter|null $filter Query filter object.
 * @return array|WP_error
 */
function get_graph_data( $start, $end, $resolution = 'P1D', ?Filter $filter = null ) {
	$query_where = [ '1=1' ];
	$query_params = [
		'blog_id' => get_current_blog_id(),
		'start' => (int) $start,
		'end' => (int) $end,
	];

	if ( ! empty( $filter ) ) {
		if ( $filter->path ) {
			$url_path = home_url( $filter->path );
			if ( parse_url( $url_path, PHP_URL_SCHEME ) === 'http' ) {
				$url_path_alt = 'https' . substr( $url_path, 4 );
			} else {
				$url_path_alt = 'http' . substr( $url_path, 5 );
			}
			$query_where[] = "url = {path:String} OR url = {path_alt:String}";
			$query_params['path'] = $url_path;
			$query_params['path_alt'] = $url_path_alt;
		}

		if ( $filter->include ) {
			$query_where[] = 'post_id IN {include:Array(String)}';
			$query_params['include'] = array_map( 'strval', $filter->include );
		}

		if ( $filter->audience ) {
			// Get the audience query and params.
			[ $audience_where, $audience_params ] = Audiences\build_audience_query( $filter->audience );
			$query_where[] = $audience_where;
			$query_params = array_merge( $query_params, $audience_params );
		}
	}

	$query_where = sprintf( 'AND (%s)', implode( ') AND (', $query_where ) );

	// Derive timezone from WP site settings; fall back to UTC for non-IANA offset strings.
	$tz = wp_timezone_string() ?: 'UTC';
	if ( preg_match( '/^[+-]\d/', $tz ) ) {
		$tz = 'UTC';
	}
	$query_params['tz'] = $tz;

	// Map ISO 8601 interval to ClickHouse interval syntax.
	$ch_intervals = [
		'PT1M' => '1 minute',
		'PT1H' => '1 hour',
		'P1D'  => '1 day',
		'P7D'  => '7 day',
	];
	if ( ! isset( $ch_intervals[ $resolution ] ) ) {
		return new WP_Error(
			'analytics.error.resolution',
			sprintf( 'Unsupported interval "%s". Use PT1M, PT1H, P1D, or P7D.', $resolution ),
			[ 'status' => 400 ]
		);
	}
	$ch_resolution = $ch_intervals[ $resolution ];

	$has_filters        = ! empty( $filter->path ) || ! empty( $filter->include ) || ! empty( $filter->audience );
	$is_hourly          = $resolution === 'PT1H';
	$is_daily_or_larger = $resolution === 'P1D' || $resolution === 'P7D';
	$date_range_days    = ( $end - $start ) / DAY_IN_SECONDS;

	// Enforce (interval, date range) coupling from periods.ts.
	$range_limits = [
		'PT1M' => [ 'max' => 1 ],
		'PT1H' => [ 'max' => 7 ],
		'P1D'  => [ 'max' => 90 ],
		'P7D'  => [ 'min' => 14, 'max' => 90 ],
	];
	$limits = $range_limits[ $resolution ];
	if ( $date_range_days > $limits['max'] || ( isset( $limits['min'] ) && $date_range_days < $limits['min'] ) ) {
		return new WP_Error(
			'analytics.invalid_range',
			sprintf( 'Interval "%s" is not valid for a %.0f-day date range.', $resolution, $date_range_days ),
			[ 'status' => 400 ]
		);
	}

	// Filtered queries hit the raw analytics table; restrict to safe intervals.
	if ( $has_filters && ! in_array( $resolution, [ 'PT1M', 'P1D' ], true ) ) {
		return new WP_Error(
			'analytics.invalid_resolution',
			sprintf( 'Interval "%s" cannot be used with path, post, or audience filters. Use P1D instead.', $resolution ),
			[ 'status' => 400 ]
		);
	}

	// Use hourly materialized view for all non-realtime, non-filtered queries.
	$use_hourly_view = ! $has_filters && ( $is_hourly || $is_daily_or_larger );

	// Embed start/end directly — ClickHouse does not substitute named
	// parameters inside ORDER BY ... WITH FILL, so {start}/{end} would
	// silently use epoch (1970) there. These are validated integers, not
	// user-controlled strings, so direct interpolation is safe.
	$fill_start = (int) $start;
	$fill_end   = (int) $end;

	if ( $use_hourly_view ) {
		$query =
			"SELECT
				toStartOfInterval(hour, INTERVAL {$ch_resolution}, {tz:String}) as `date`,
				sum(views) as views,
				uniqCombined64Merge(unique_visitors) as uniques,
				uniqCombined64Merge(returning_visitors) as returning,
				uniqCombined64Merge(bounce_visitors) as bounce
			FROM analytics_hourly
			WHERE
				blog_id = {blog_id:String}
				AND hour >= toStartOfHour(toDateTime64({start:UInt64},3))
				AND hour <= toStartOfHour(toDateTime64({end:UInt64},3))
			GROUP BY `date`
			WITH TOTALS
			ORDER BY `date` ASC
				WITH FILL
					FROM toStartOfInterval(toDateTime($fill_start), INTERVAL {$ch_resolution}, {tz:String})
					TO toStartOfInterval(toDateTime($fill_end), INTERVAL {$ch_resolution}, {tz:String})
					STEP INTERVAL {$ch_resolution}";
	} else {
		$query =
			"SELECT
				toStartOfInterval(event_timestamp, INTERVAL {$ch_resolution}, {tz:String}) as `date`,
				count() as views,
				uniqCombined64(endpoint_id) as uniques,
				uniqCombined64If(endpoint_id, endpoint_sessions > 1) as returning,
				uniqCombined64If(endpoint_id, endpoint_views < 2) as bounce
			FROM analytics
			WHERE
				blog_id = {blog_id:String}
				AND event_timestamp >= toDateTime64({start:UInt64},3)
				AND event_timestamp <= toDateTime64({end:UInt64},3)
				AND event_type = 'pageView'
				{$query_where}
			GROUP BY `date`
			WITH TOTALS
			ORDER BY `date` ASC
				WITH FILL
					FROM toStartOfInterval(toDateTime($fill_start), INTERVAL {$ch_resolution}, {tz:String})
					TO toStartOfInterval(toDateTime($fill_end), INTERVAL {$ch_resolution}, {tz:String})
					STEP INTERVAL {$ch_resolution}";
	}

	$key = Utils\get_cache_key( 'analytics:stats', $query, $query_params, $filter );
	$cache = wp_cache_get( $key, 'altis' );
	if ( $cache ) {
		return $cache;
	}

	// WITH TOTALS returns the per-interval rows AND a window-wide totals row in
	// one round-trip. The totals row is re-aggregated over every input row, so
	// the uniqCombined64 HLL sketches are merged across the whole window —
	// exact, interval-independent distinct counts. This is why the headline
	// numbers can't just sum the per-bucket counts below: those sketches only
	// dedupe within a bucket, so a visitor active in N buckets would count N
	// times and the total would depend on the chosen resolution.
	$res = Utils\query( $query, $query_params, 'totals' );

	if ( is_wp_error( $res ) ) {
		return $res;
	}

	$data = [
		'by_interval' => [],
		'stats' => [
			'summary' => [
				'views' => 0,
				'visitors' => 0,
				'returning' => 0,
				'bounce' => 0,
			],
		],
	];

	foreach ( ( $res['data'] ?: [] ) as $row ) {
		if ( empty( $row->date ) ) {
			continue;
		}
		$data['by_interval'][ $row->date ] = [
			'views' => (int) $row->views,
			'visitors' => (int) $row->uniques,
			'returning' => (int) $row->returning,
			'bounce' => (int) $row->bounce,
		];
	}

	// Headline summary totals from the WITH TOTALS row (merged sketches over the
	// whole window). `views` is a plain sum and so interval-agnostic; it comes
	// from the same row for a single source of truth.
	$totals = $res['totals'] ?? null;
	if ( is_object( $totals ) ) {
		$data['stats']['summary']['views']     = (int) ( $totals->views ?? 0 );
		$data['stats']['summary']['visitors']  = (int) ( $totals->uniques ?? 0 );
		$data['stats']['summary']['returning'] = (int) ( $totals->returning ?? 0 );
		$data['stats']['summary']['bounce']    = (int) ( $totals->bounce ?? 0 );
	}

	// Engaged time. The client flushes engaged time as an additive delta on
	// each _session.stop event, so a plain sum() over stop rows is exact —
	// the same correctness model as count() over pageView rows. No per-session
	// reassembly needed: a visit that hides the tab twice contributes two
	// deltas that sum to the visit total. Engaged reads/sessions are HLL
	// counts of the page sessions / sessions those deltas belong to.
	// engaged is in milliseconds in the tracker. engaged_first_seen is the
	// earliest engaged event in range, letting the UI flag periods that
	// predate engaged tracking.
	//
	// Unfiltered windows read the analytics_hourly rollup (same table the
	// main graph query uses) — additive deltas pre-aggregate as plain sums
	// and mergeable HLL sketches, so this is a few thousand rows instead of
	// every stop event. Filtered windows compute from the raw table's
	// materialized `engaged` column, reusing $query_where / $query_params so
	// path / include / audience drilldowns apply identically.
	$data['stats']['summary']['engaged'] = [
		'total_seconds' => 0.0,
		'avg_seconds'   => 0.0,
		'pageviews'     => 0,
		'sessions'      => 0,
		'first_seen'    => null,
	];

	if ( $use_hourly_view ) {
		$engaged_res = Utils\query(
			"SELECT
				sum( engaged_ms ) / 1000 as total_engaged_seconds,
				uniqCombined64Merge( engaged_reads ) as engaged_pageviews,
				uniqCombined64Merge( engaged_sessions ) as engaged_sessions,
				minIf( hour, engaged_ms > 0 ) as engaged_first_seen
			FROM analytics_hourly
			WHERE
				blog_id = {blog_id:String}
				AND hour >= toStartOfHour(toDateTime64({start:UInt64},3))
				AND hour <= toStartOfHour(toDateTime64({end:UInt64},3))",
			$query_params
		);
	} else {
		$engaged_table = defined( 'ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE' ) ? ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE : 'analytics';
		$engaged_res = Utils\query(
			"SELECT
				sum( engaged ) / 1000 as total_engaged_seconds,
				uniqCombined64( page_session_id ) as engaged_pageviews,
				uniqCombined64( session_id ) as engaged_sessions,
				min( event_timestamp ) as engaged_first_seen
			FROM {$engaged_table}
			WHERE
				blog_id = {blog_id:String}
				AND event_timestamp >= toDateTime64({start:UInt64},3)
				AND event_timestamp <= toDateTime64({end:UInt64},3)
				AND event_type = '_session.stop'
				AND engaged > 0
				{$query_where}",
			$query_params
		);
	}

	$has_engaged = false;
	if ( is_wp_error( $engaged_res ) ) {
		// Engaged time is supplementary — never fail graph data over it.
		trigger_error( $engaged_res->get_error_message(), E_USER_WARNING );
	} elseif ( is_array( $engaged_res ) && ! empty( $engaged_res ) ) {
		$engaged_row       = $engaged_res[0];
		$engaged_pageviews = (int) ( $engaged_row->engaged_pageviews ?? 0 );
		if ( $engaged_pageviews > 0 ) {
			$first_seen_raw = $engaged_row->engaged_first_seen ?? null;
			$first_seen_ts  = $first_seen_raw ? strtotime( (string) $first_seen_raw ) : false;
			$total_seconds  = (float) ( $engaged_row->total_engaged_seconds ?? 0 );
			$data['stats']['summary']['engaged'] = [
				'total_seconds' => $total_seconds,
				'avg_seconds'   => $total_seconds / $engaged_pageviews,
				'pageviews'     => $engaged_pageviews,
				'sessions'      => (int) ( $engaged_row->engaged_sessions ?? 0 ),
				'first_seen'    => $first_seen_ts ? gmdate( 'c', $first_seen_ts ) : null,
			];
			$has_engaged = true;
		}
	}

	// Preserve the existing empty-window contract: when the main graph query
	// returned no rows we historically surfaced an error. Keep doing so unless
	// engaged data exists for the window, in which case return the (otherwise
	// zeroed) payload so engaged time still reaches the dashboard.
	if ( ! $res && ! $has_engaged ) {
		return new WP_Error( 'analytics.error' );
	}

	// Completed windows (ended >1h ago) are stable; live windows stay
	// fresh at the dashboard's realtime poll cadence.
	$ttl = ( (int) $end + HOUR_IN_SECONDS < time() )
		? 5 * MINUTE_IN_SECONDS
		: LIVE_WINDOW_CACHE_TTL;
	wp_cache_set( $key, $data, 'altis', $ttl );

	return $data;
}

/**
 * Get term aggregations (top URLs, countries, browsers, OS, referrers, search terms).
 * Runs as a separate request so the graph data is not blocked.
 *
 * @param int $start The start timestamp.
 * @param int $end The end timestamp.
 * @param Filter|null $filter Query filter object.
 * @return array|WP_Error
 */
function get_aggregations( $start, $end, ?Filter $filter = null, ?array $fields = null ) {
	$query_params = [
		'blog_id' => get_current_blog_id(),
		'start'   => (int) $start,
		'end'     => (int) $end,
	];

	$query_where = '';
	if ( ! empty( $filter ) ) {
		if ( $filter->path ) {
			$url_path     = home_url( $filter->path );
			$url_path_alt = strpos( $url_path, 'https' ) === 0
				? 'http' . substr( $url_path, 5 )
				: 'https' . substr( $url_path, 4 );
			$query_where             .= ' AND (url = {path:String} OR url = {path_alt:String})';
			$query_params['path']     = $url_path;
			$query_params['path_alt'] = $url_path_alt;
		}
		if ( $filter->include ) {
			$query_where            .= ' AND (post_id IN {include:Array(String)})';
			$query_params['include'] = array_map( 'strval', $filter->include );
		}
		if ( $filter->audience ) {
			[ $audience_where, $audience_params ] = Audiences\build_audience_query( $filter->audience );
			$query_where  .= sprintf( ' AND (%s)', $audience_where );
			$query_params  = array_merge( $query_params, $audience_params );
		}
	}

	$all_aggs = apply_filters( 'altis.analytics.ui.graph_aggregations', [] );

	if ( $fields ) {
		$aggs = array_intersect_key( $all_aggs, array_flip( array_intersect( $fields, array_keys( $all_aggs ) ) ) );
	} else {
		$aggs = $all_aggs;
	}

	$key   = Utils\get_cache_key( 'analytics:aggregations', $query_params, $query_where, array_keys( $aggs ) );
	$cache = wp_cache_get( $key, 'altis' );
	if ( $cache ) {
		return $cache;
	}

	$base_where = $query_where;
	$result     = [];

	foreach ( $aggs as $key_name => $agg_options ) {
		$field       = $agg_options['field'];
		$aggregation = $agg_options['aggregation'];

		if ( empty( $agg_options['is_expression'] ) && ! preg_match( '/^[a-zA-Z0-9_\[\]\']+$/', $field ) ) {
			trigger_error( sprintf( 'Field name "%s" is not valid for term aggregation', $field ), E_USER_WARNING );
			continue;
		}

		if ( ! preg_match( '/^[a-zA-Z0-9]+\(.*?\)$/', $aggregation ) ) {
			trigger_error( sprintf( 'Aggregation function "%s" is not valid for term aggregation', $aggregation ), E_USER_WARNING );
			continue;
		}

		$agg_where = $base_where;
		if ( ! empty( $agg_options['where'] ) ) {
			$agg_where .= sprintf( ' AND (%s)', $agg_options['where'] );
		}

		$res = Utils\query(
			"SELECT
				{$field} as `key`,
				{$aggregation} as `value`
			FROM analytics
			WHERE
				blog_id = {blog_id:String}
				AND event_timestamp >= toDateTime64({start:UInt64},3)
				AND event_timestamp <= toDateTime64({end:UInt64},3)
				AND event_type = {event_type:String}
				{$agg_where}
			GROUP BY {$field}
			ORDER BY `value` DESC
			LIMIT {limit:UInt8}",
			array_merge(
				$query_params,
				[
					'event_type' => $agg_options['event'],
					'limit'      => $agg_options['limit'],
				],
				$agg_options['where_params'] ?? []
			)
		);

		if ( is_wp_error( $res ) ) {
			trigger_error( $res->get_error_message(), E_USER_WARNING );
			continue;
		}

		$callback            = $agg_options['parse_result'] ?? __NAMESPACE__ . '\\collect_aggregation';
		$result[ $key_name ] = call_user_func( $callback, $res );
	}

	$ttl = ( (int) $end + HOUR_IN_SECONDS < time() )
		? 5 * MINUTE_IN_SECONDS
		: LIVE_WINDOW_CACHE_TTL;
	wp_cache_set( $key, $result, 'altis', $ttl );

	return $result;
}

/**
 * Get global top content data.
 *
 * @param int $start Start timestamp.
 * @param int $end End timestamp.
 * @param Filter|null $filter Query filter object.
 * @return array|WP_Error
 */
function get_top_data( $start, $end, ?Filter $filter = null ) {
	$query_where = [ '1=1' ];
	$query_params = [
		'blog_id' => get_current_blog_id(),
		'start' => (int) $start,
		'end' => (int) $end,
	];

	if ( ! empty( $filter ) ) {
		if ( $filter->type ) {
			$types = explode( ',', $filter->type );
			$types_where = array_map( function ( $type, $idx ) use ( &$query_params ) {
				if ( $type === 'wp_block' ) {
					return "event_type IN ('blockView', 'conversion')";
				}
				if ( $type === 'broadcast' ) {
					return "event_type = 'blockView'";
				}
				$query_params[ 'type_' . $idx ] = $type;
				return sprintf( "event_type = 'pageView' AND attributes['postType'] = {type_%s:String}", $idx );
			}, $types, array_keys( $types ) );
			$query_where[] = sprintf( '(%s)', implode( ') OR (', $types_where ) );
		}
		if ( $filter->path ) {
			$url = home_url( $filter->path );
			$query_where[] = "url = {url:String}";
			$query_params['url'] = $url;
		}
		if ( ! empty( $filter->include ) ) {
			$query_params['include_ids'] = array_map( 'strval', $filter->include );
			$query_where[] = 'item_id IN {include_ids:Array(String)}';
		}
	}

	$query_where = sprintf( ' AND (%s) ', implode( ') AND (', $query_where ) );

	// When include is set, the caller has bounded the result set (e.g. author's posts,
	// taxonomy posts) so we don't need the top-300 limit.
	$limit_clause = ( ! empty( $filter ) && ! empty( $filter->include ) ) ? '' : 'LIMIT 300';

	// Note: This query uses raw analytics table due to complex conditional logic for A/B testing.
	// analytics_daily_items exists but stores fallback/control separately, while this adds them together.
	// Honor the ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE override so the test suite can point this
	// query at its isolated table; defaults to the production `analytics` table.
	$table = defined( 'ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE' ) ? ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE : 'analytics';
	$query =
		"SELECT
			item_id,
			countIf(event_type != 'conversion') as views,
			uniqCombined64If(endpoint_id, event_type != 'conversion') as unique_views,
			(
				uniqCombined64If(endpoint_id, event_type = 'blockView' AND audience = '0') +
				uniqCombined64If(endpoint_id, event_type = 'blockView' AND test_variant_id = '0')
			) as unique_fallback_views,
			uniqCombined64If(endpoint_id, event_type = 'conversion') as unique_conversions,
			(
				uniqCombined64If(endpoint_id, event_type = 'conversion' AND audience = '0') +
				uniqCombined64If(endpoint_id, event_type = 'conversion' AND test_variant_id = '0')
			) as unique_fallback_conversions
		FROM {$table}
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64},3)
			AND event_timestamp <= toDateTime64({end:UInt64},3)
			AND event_type IN ('pageView', 'blockView', 'conversion')
			AND item_id != ''
			{$query_where}
		GROUP BY item_id
		ORDER BY views DESC
		{$limit_clause}"; // LIMIT 300 for Content Explorer; omitted when include filter scopes the query.

	$key = Utils\get_cache_key( 'analytics:top', $query, $query_params, $filter );
	$cache = wp_cache_get( $key, 'altis' );
	if ( $cache ) {
		return $cache;
	}

	$res = Utils\query( $query, $query_params );

	if ( is_wp_error( $res ) ) {
		return $res;
	}

	$processed = [];

	foreach ( $res as $row ) {
		$id = $row->item_id;
		if ( ! is_numeric( $id ) ) {
			continue;
		}
		$id = intval( $id );
		if ( ! isset( $processed[ $id ] ) ) {
			$processed[ $id ] = $row;
		}
	}

	// Ensure reusable blocks are shown if available.
	$post_types = get_post_types( [ 'public' => true ] );
	$post_types[] = 'wp_block';
	$post_types = array_unique( $post_types );

	$post_ids = array_keys( $processed );

	$posts_per_page = 25;
	$default_query_args = [
		'post_type' => $post_types,
		'post_status' => 'publish',
		'posts_per_page' => $posts_per_page,
		'paged' => 1,
		'ignore_sticky_posts' => true,
	];

	if ( ! empty( $filter ) ) {
		if ( $filter->search ) {
			$default_query_args['s'] = $filter->search;
		}
		if ( $filter->type ) {
			$default_query_args['post_type'] = explode( ',', $filter->type );
		}
		if ( $filter->user ) {
			$default_query_args['author'] = $filter->user;
		}
		if ( $filter->page ) {
			$default_query_args['paged'] = $filter->page;
		}
	}

	$query_args = array_merge( $default_query_args, [
		'post__in' => $post_ids,
		'orderby' => 'post__in',
		'order' => 'asc',
	] );

	if ( ! empty( $filter->include ) ) {
		$query_args['post__in'] = array_map( 'absint', $filter->include );
		$query_args['nopaging'] = true;
	}

	// ElasticPress does not support ordering by post__in so remove if we're searching.
	if ( ! empty( $filter ) && $filter->search ) {
		unset( $query_args['orderby'] );
		unset( $query_args['order'] );
	}

	// Get all posts sorted by views.
	$query = new WP_Query( $query_args );

	// Get all remaining posts not in the list to complete the data set if we have some data.
	// If $post_ids is empty post__in is ignored.
	if ( ! empty( $post_ids ) && empty( $filter->include ) ) {
		$page = max( 1, $default_query_args['paged'] - $query->max_num_pages ) - 1; // Zero indexed page value.
		$base_offset = $query->found_posts % $posts_per_page;
		$query_args_not_in = array_merge( $default_query_args, [
			// Make sure our additional query is paging from the end of the initial query.
			'offset' => ( $page * $posts_per_page ) + ( $page === 0 ? 0 : $base_offset ),
			'posts_per_page' => $posts_per_page - ( $page === 0 ? $base_offset : 0 ),
			'post__not_in' => $post_ids,
		] );
		$query_not_in = new WP_Query( $query_args_not_in );

		// Combine queries.
		$query->found_posts += $query_not_in->found_posts;
		$query->max_num_pages = ceil( $query->found_posts / $posts_per_page );
		if ( $query->post_count < $posts_per_page ) {
			$query->post_count += $query_not_in->post_count;
			$query->posts = array_merge( $query->posts, $query_not_in->posts );
			$query->posts = array_values( $query->posts );
		}
	}

	foreach ( $query->posts as $i => $post ) {
		$query->posts[ $i ] = [
			'id' => intval( $post->ID ),
			'slug' => $post->post_name,
			'type' => [
				'name' => $post->post_type,
				'label' => get_post_type_object( $post->post_type )->labels->singular_name,
			],
			'subtype' => null,
			'title' => trim( wp_strip_all_tags( get_the_title( $post->ID ) ) ),
			'date' => $post->post_date,
			'url' => get_post_type_object( $post->post_type )->public ? get_the_permalink( $post->ID ) : null,
			'editUrl' => get_edit_post_link( $post->ID, 'rest' ),
			'author' => [
				'ID' => intval( $post->post_author ),
				'name' => get_the_author_meta( 'display_name', $post->post_author ),
				'avatar' => get_avatar_url( $post->post_author ),
			],
			'thumbnail' => get_block_preview_thumbnail( $post->ID ),
			'rawContent' => get_post_field( 'post_content', $post->ID ),
			'views' => intval( $processed[ $post->ID ]->views ?? 0 ),
			'visitors' => intval( $processed[ $post->ID ]->unique_views ?? 0 ),
			'blocks' => [],
			'variants' => 0,
		];

		if ( $post->post_type === 'wp_block' ) {
			$query->posts[ $i ]['goal'] = get_post_meta( $post->ID, '_goal', true ) ?: 'engagement';
			$type = Blocks\get_block_type( $post );
			$query->posts[ $i ]['subtype'] = [
				'name' => $type,
				'label' => Blocks\get_block_type_label( $type ),
			];
			if ( $type !== 'standard' ) {
				$variants = parse_blocks( $post->post_content );
				$variants = array_filter( $variants, function ( $variant ) { return $variant['blockName'] === 'altis/variant'; } );
				$query->posts[ $i ]['variants'] = count( $variants );
			}
			if ( $query->posts[ $i ]['views'] > 0 ) {
				Telemetry\maybe_track_activation_event( $query->posts[ $i ]['subtype']['label'] . ' View', [
					'title' => $query->posts[ $i ]['title'],
					'thumbnail' => $query->posts[ $i ]['thumbnail'],
					'variants' => $query->posts[ $i ]['variants'],
					'views' => $query->posts[ $i ]['views'],
				] );
			}
		}

		if ( $post->post_type === Broadcast\POST_TYPE ) {
			$query->posts[ $i ]['blocks'] = array_map( 'absint', get_post_meta( $post->ID, 'blocks' ) ) ?: [];
			if ( $query->posts[ $i ]['views'] > 0 ) {
				Telemetry\maybe_track_activation_event( 'Broadcast View', [
					'title' => $query->posts[ $i ]['title'],
					'thumbnail' => $query->posts[ $i ]['thumbnail'],
					'blocks' => count( $query->posts[ $i ]['blocks'] ),
					'views' => $query->posts[ $i ]['views'],
				] );
			}
		}

		if ( $post->post_parent ) {
			$query->posts[ $i ]['parent'] = [
				'title' => trim( wp_strip_all_tags( get_the_title( $post->post_parent ) ) ),
				'editUrl' => get_edit_post_link( $post->post_parent, 'rest' ),
			];
		}

		// Get lift.
		if ( isset( $processed[ $post->ID ]->unique_views, $processed[ $post->ID ]->unique_conversions ) ) {
			$query->posts[ $i ]['lift'] = [
				'views' => (int) $processed[ $post->ID ]->unique_views,
				'conversions' => (int) $processed[ $post->ID ]->unique_conversions,
				'fallback' => [
					'views' => (int) $processed[ $post->ID ]->unique_fallback_views,
					'conversions' => (int) $processed[ $post->ID ]->unique_fallback_conversions,
				],
				'personalized' => [
					'views' => (int) $processed[ $post->ID ]->unique_views - $processed[ $post->ID ]->unique_fallback_views,
					'conversions' => (int) $processed[ $post->ID ]->unique_conversions - $processed[ $post->ID ]->unique_fallback_conversions,
				],
			];
		}
	}

	$response = [
		'posts' => $query->posts,
		'total' => $query->found_posts,
		'max_pages' => $query->max_num_pages,
	];

	$ttl = ( (int) $end + HOUR_IN_SECONDS < time() )
		? 5 * MINUTE_IN_SECONDS
		: LIVE_WINDOW_CACHE_TTL;
	wp_cache_set( $key, $response, 'altis', $ttl );

	return $response;
}

/**
 * Get the best thumbnail size available to use with Content Explorer.
 *
 * @return string
 */
function get_available_thumbnail_size() : string {
	$sizes = [ 'post-thumbnail', 'thumbnail', 'medium', 'medium_large', 'full' ];

	foreach ( $sizes as $size ) {
		if ( has_image_size( $size ) ) {
			return $size;
		}
	}

	return $size; // Return the fallback size.
}

/**
 * Get block preview thumbnail URL.
 *
 * @param int $post_id Post ID.
 * @param int $variant_id Variant index to show.
 *
 * @return string
 */
function get_block_preview_thumbnail( ?int $post_id, int $variant_id = 0, $width = 210, $height = 94 ) : string {
	$post = get_post( $post_id );
	$thumbnail = '';

	if ( empty( $post ) ) {
		return '';
	}

	if ( post_type_supports( $post->post_type, 'thumbnail' ) ) {
		$thumbnail_id = 0;
		if ( $post->post_type === 'attachment' ) {
			$thumbnail_id = $post->ID;
		} else {
			$thumbnail_id = get_post_thumbnail_id( $post ) ?: 0;
		}

		$thumbnail = $thumbnail_id ? wp_get_attachment_image_url( $thumbnail_id, get_available_thumbnail_size() ) : '';
	}

	// Get block thumbnail from screen grab API.
	if ( $post->post_type === 'wp_block' && Dashboard\is_block_thumbnail_allowed( $post->ID ) ) {
		$version = strtotime( $post->post_modified_gmt );

		$preview_url = sprintf(
			'%s?preview-block-id=%d&key=%s&variant-id=%d&version=%s&width=%d&height=%d',
			get_home_url( '/' ),
			$post->ID,
			Dashboard\get_block_thumbnail_request_hmac( $post->ID ),
			$variant_id,
			$version,
			$width,
			$height,
		);

		$thumbnail = add_query_arg(
			[
				'url' => urlencode( $preview_url ),
				'width' => $width,
				'height' => $height,
				 // Get children of preview container for block themes to account for wide/full align etc...
				'selector' => wp_is_block_theme() ? '.altis-block-preview%20>%20*' : '.altis-block-preview',
				'version' => $version,
			],
			'https://eu.accelerate.altis.cloud/block-image'
		);
	}

	return $thumbnail;
}


/**
 * Process a terms aggregation into key value pairs.
 *
 * @param array|null $aggregation A terms aggregation result from Elasticsearch.
 * @return array
 */
function collect_aggregation( ?array $aggregation ) : array {
	if ( empty( $aggregation ) ) {
		return [];
	}
	$data = [];
	foreach ( $aggregation as $bucket ) {
		$data[ $bucket->key ] = (int) $bucket->value;
	}
	return $data;
}

/**
 * Make relative to the current site rather than absolute.
 *
 * @param string $base_url The site's base URL.
 * @param array $data An associative list of URLs and view counts.
 * @return array
 */
function relativize_urls( string $base_url, array $data ) : array {
	$relativized = [];
	$len = strlen( $base_url );
	foreach ( $data as $url => $count ) {
		// Normalize schemes.
		$url = str_replace( [ 'http://', 'https://' ], parse_url( $base_url, PHP_URL_SCHEME ) . '://', $url );
		if ( substr( $url, 0, $len ) === $base_url ) {
			$url = substr( $url, $len );
		}

		if ( empty( $relativized[ $url ] ) ) {
			$relativized[ $url ] = $count;
		} else {
			$relativized[ $url ] += $count;
		}
	}
	return $relativized;
}


/**
 * Register default term aggregations for the stats API.
 *
 * @return void
 */
function register_default_aggregations() {
	register_term_aggregation( "url", 'by_url', [
		'title' => __( 'Top URLs', 'altis-accelerate' ),
		'total' => 'stats.summary.views',
		'filter_key' => 'path',
		'parse_result' => function ( $res ) {
			return relativize_urls( home_url(), collect_aggregation( $res ) );
		},
	] );
	register_term_aggregation( "attributes['outbound_host']", 'by_outbound_host', [
		'title' => __( 'Outbound clicks', 'altis-accelerate' ),
		'event' => 'linkClick',
		'limit' => 10,
	] );
	// UTM-tagged traffic. The tracker prefixes URL query vars with `qv_`,
	// so utm_campaign on the URL lands as `qv_utm_campaign` in attributes.
	register_term_aggregation( "attributes['qv_utm_campaign']", 'by_campaign', [
		'title' => __( 'Top campaigns', 'altis-accelerate' ),
		'where' => "attributes['qv_utm_campaign'] != ''",
		'limit' => 10,
	] );
	// Cross-tab pairs for the UTM card's dropdown views. Pair counts can't
	// be reconstructed from marginal aggregations client-side, so we
	// compute them in ClickHouse. `multiIf` keeps partial values clean
	// ("twitter" instead of "twitter / ", "spring-sale" instead of
	// " / spring-sale") — the " / " separator only appears when both
	// fields are present.
	$pair_expr = function ( $a, $b ) {
		return "multiIf("
			. "attributes['{$a}'] != '' AND attributes['{$b}'] != '', "
			. "concat(attributes['{$a}'], ' / ', attributes['{$b}']), "
			. "attributes['{$a}'] != '', attributes['{$a}'], "
			. "attributes['{$b}']"
		. ")";
	};
	register_term_aggregation(
		$pair_expr( 'qv_utm_source', 'qv_utm_campaign' ),
		'by_source_campaign',
		[
			'title' => __( 'Source / campaign', 'altis-accelerate' ),
			'where' => "attributes['qv_utm_source'] != '' OR attributes['qv_utm_campaign'] != ''",
			'limit' => 10,
			'is_expression' => true,
		]
	);
	register_term_aggregation(
		$pair_expr( 'qv_utm_source', 'qv_utm_medium' ),
		'by_source_medium',
		[
			'title' => __( 'Source / medium', 'altis-accelerate' ),
			'where' => "attributes['qv_utm_source'] != '' OR attributes['qv_utm_medium'] != ''",
			'limit' => 10,
			'is_expression' => true,
		]
	);
	register_term_aggregation( "referer", 'by_referer', [
		'title' => __( 'Referrers', 'altis-accelerate' ),
		'where' => sprintf( "referer NOT ILIKE '%s%%'", home_url() ),
		'limit' => 10,
		'parse_result' => function ( $res ) {
			$result = collect_aggregation( $res );
			if ( isset( $result[''] ) ) {
				$result[ __( 'Direct traffic', 'altis' ) ] = $result[''];
				unset( $result[''] );
			}
			arsort( $result );
			return $result;
		},
	] );
	register_term_aggregation( 'country', 'by_country', [
		'title' => __( 'Countries', 'altis-accelerate' ),
		'limit' => 100,
	] );
	register_term_aggregation( 'model', 'by_browser', [
		'title' => __( 'Browsers', 'altis-accelerate' ),
	] );
	register_term_aggregation( 'platform', 'by_os', [
		'title' => __( 'Operating System', 'altis-accelerate' ),
	] );
	register_term_aggregation( "search", 'by_search_term', [
		'title' => __( 'On-site Search Terms', 'altis-accelerate' ),
		'where' => "search != ''",
	] );
}

/**
 * Add a terms aggregation to the global stats query.
 *
 * @param string $field The field name in the ClickHouse database.
 * @param string $short_name Short version of the field name for the aggregation.
 * @param array $options Allows modifying the aggregation query result parsing.
 * @return void
 */
function register_term_aggregation( $field, $short_name, $options = [] ) {
	$options = wp_parse_args( $options, [
		'title' => $short_name,
		'value_title' => __( 'Views', 'altis-accelerate' ),
		'limit' => 5,
		'total' => false,
		'filter_key' => false,
		'field' => $field,
		'aggregation' => 'count()',
		'event' => 'pageView',
		'where' => '',
		'where_params' => [],
		'missing' => __( 'Unknown', 'altis' ),
		'parse_result' => __NAMESPACE__ . '\\collect_aggregation',
		'is_expression' => false,
	] );

	add_filter( 'altis.analytics.ui.graph_aggregations', function ( $aggs ) use ( $short_name, $options ) {
		$aggs[ $short_name ] = $options;
		return $aggs;
	} );
}

/**
 * Get event stats diff for current and previous time period.
 *
 * @param array $post_ids Specific posts to narrow the query down by.
 * @param int $start The start timestamp.
 * @param int $end The end timestamp.
 * @param string|array $resolution Resolution for histogram data. Can be any `toStartOf*` suffix, or array of toStartOfInterval values.
 *                     See https://clickhouse.com/docs/en/sql-reference/functions/date-time-functions#tostartofintervaltime_or_data-interval-x-unit--time_zone
 * @return array|WP_error
 */
function get_post_diff_data( array $post_ids, $start, $end, $resolution = 'P1D' ) {
	if ( empty( $post_ids ) ) {
		return new WP_Error(
			'analytics.error',
			'List of post IDs cannot be empty.'
		);
	}

	$php_intervals = [
		'PT1M' => '1 minute',
		'PT1H' => '1 hour',
		'P1D'  => '1 day',
		'P7D'  => '7 day',
	];
	if ( ! isset( $php_intervals[ $resolution ] ) ) {
		return new WP_Error(
			'analytics.error.resolution',
			sprintf( 'Interval "%s" is not valid. Use one of: PT1M, PT1H, P1D, P7D.', $resolution )
		);
	}
	$php_resolution = $php_intervals[ $resolution ];

	// Real start & end.
	$diff = $end - $start;

	$query_params = [
		'start' => (int) $start,
		'blog_id' => get_current_blog_id(),
		'prev_start' => $start - $diff,
		'end' => $end,
	];

	// Store results from query / cache.
	$data = [];

	$page_view_ids = [];
	$block_view_ids = [];

	foreach ( $post_ids as $id ) {
		$key = Utils\get_cache_key( 'analytics:post_diff:views', $id, $start, $end, $resolution );
		$cache = wp_cache_get( $key, 'altis' );
		if ( $cache ) {
			$data[ $id ] = $cache;
			continue;
		}

		// Determine attribute to filter results on.
		if ( is_numeric( $id ) ) {
			if ( get_post_type( $id ) === 'wp_block' ) {
				$block_view_ids[] = $id;
			} else {
				$page_view_ids[] = $id;
			}
		}
	}

	$query_params['item_ids'] = array_merge( $page_view_ids, $block_view_ids );
	$query_params['item_ids'] = array_map( 'strval', $query_params['item_ids'] );

	// Generate fields for histogram of current date range.
	$buckets = [];
	$bucket_start = $start;
	while ( $bucket_start < $end ) {
		$bucket_end = strtotime( "+{$php_resolution}", $bucket_start );
		$buckets[ $bucket_start ] = sprintf(
			'countIf(event_timestamp >= toDateTime64(%1$d,3) AND event_timestamp < toDateTime64(%2$d,3)) as `%1$d`',
			$bucket_start,
			$bucket_end
		);
		$bucket_start = $bucket_end;
	}
	$bucket_sql = implode( ',', $buckets );

	$res = Utils\query(
		"SELECT
			item_id,
			count() as views,
			countIf(event_timestamp < toDateTime64({start:UInt64},3)) as views_previous,
			countIf(event_timestamp >= toDateTime64({start:UInt64},3)) as views_current,
			{$bucket_sql}
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({prev_start:UInt64},3)
			AND event_timestamp <= toDateTime64({end:UInt64},3)
			AND event_type IN ('pageView', 'blockView')
			AND item_id IN {item_ids:Array(String)}
		GROUP BY item_id
		ORDER BY item_id",
		$query_params
	);

	if ( is_wp_error( $res ) ) {
		return $res;
	}

	if ( count( $post_ids ) > count( $data ) ) {

		// Process aggregation and cache results.
		foreach ( $res as $row ) {
			$id = (int) $row->item_id;
			if ( isset( $data[ $id ] ) ) {
				continue;
			}

			$key = Utils\get_cache_key( 'analytics:post_diff:views', $id, $start, $end, $resolution );

			$data[ $id ] = [
				'previous' => [
					'views' => intval( $row->views_previous ?? 0 ),
				],
				'current' => [
					'views' => intval( $row->views_current ?? 0 ),
					'by_date' => array_map( function ( $bucket_start ) use ( $row ) {
						return [
							'index' => (int) sprintf( '%d000', $bucket_start ),
							'count' => intval( $row->$bucket_start ?? 0 ),
						];
					}, array_keys( $buckets ) ),
				],
			];

			wp_cache_set( $key, $data[ $id ], 'altis', MINUTE_IN_SECONDS * 5 );
		}
	}

	return $data;
}
