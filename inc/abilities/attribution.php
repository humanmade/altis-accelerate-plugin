<?php
/**
 * Accelerate Abilities API - Attribution Domain.
 *
 * Traffic source attribution and UTM analytics abilities.
 *
 * @package Altis\Accelerate\Abilities\Attribution
 */

namespace Altis\Accelerate\Abilities\Attribution;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Helpers;
use Altis\Accelerate\API;
use Altis\Accelerate\Utils;
use WP_Error;

/**
 * Register all attribution abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_get_attribution_comparison();
	register_get_source_breakdown();
	register_get_utm_performance();
	register_get_landing_pages();
}

/**
 * Register accelerate/get-attribution-comparison ability.
 *
 * Compare first-touch vs last-touch attribution.
 *
 * @return void
 */
function register_get_attribution_comparison() : void {
	wp_register_ability( 'accelerate/get-attribution-comparison', [
		'label'       => __( 'Get Attribution Comparison', 'altis' ),
		'description' => __( 'Compare first-touch vs last-touch attribution to identify best introducers and closers.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'conversion_goal' => [
					'type'        => 'string',
					'description' => __( 'Filter by specific conversion goal.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'channels' => [ 'type' => 'array' ],
				'insights' => [ 'type' => 'object' ],
				'period'   => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_attribution_comparison',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Comparing attribution models...', 'altis' ),
		],
	] );
}

/**
 * Execute get-attribution-comparison ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Attribution comparison data or error.
 */
function execute_get_attribution_comparison( array $input ) {
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );

	$blog_id = get_current_blog_id();
	$table = Helpers\get_analytics_table();
	$bot_where = Utils\bot_exclusion_clause();

	// Query first-touch attribution (initial_referer).
	$first_touch_query = "SELECT
		multiIf(
			initial_referer = '', 'Direct',
			initial_referer LIKE '%google%' OR initial_referer LIKE '%bing%' OR initial_referer LIKE '%yahoo%', 'Organic Search',
			initial_referer LIKE '%facebook%' OR initial_referer LIKE '%twitter%' OR initial_referer LIKE '%linkedin%' OR initial_referer LIKE '%instagram%', 'Social',
			initial_referer LIKE '%email%' OR initial_referer LIKE '%newsletter%', 'Email',
			'Referral'
		) as channel,
		uniqCombined64(endpoint_id) as conversions
	FROM {$table}
	WHERE
		blog_id = {blog_id:String}
		-- Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
		AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
		AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
		AND event_timestamp >= toDateTime64({start:UInt64}, 3)
		AND event_timestamp <= toDateTime64({end:UInt64}, 3)
		AND event_type = 'click'{$bot_where}
	GROUP BY channel";

	$first_touch_result = Utils\query( $first_touch_query, [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'],
		'end'     => $dates['end'],
	] );

	// Query last-touch attribution (session referer).
	$last_touch_query = "SELECT
		multiIf(
			attributes['referer'] = '', 'Direct',
			attributes['referer'] LIKE '%google%' OR attributes['referer'] LIKE '%bing%' OR attributes['referer'] LIKE '%yahoo%', 'Organic Search',
			attributes['referer'] LIKE '%facebook%' OR attributes['referer'] LIKE '%twitter%' OR attributes['referer'] LIKE '%linkedin%' OR attributes['referer'] LIKE '%instagram%', 'Social',
			attributes['referer'] LIKE '%email%' OR attributes['referer'] LIKE '%newsletter%', 'Email',
			'Referral'
		) as channel,
		uniqCombined64(endpoint_id) as conversions
	FROM {$table}
	WHERE
		blog_id = {blog_id:String}
		-- Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
		AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
		AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
		AND event_timestamp >= toDateTime64({start:UInt64}, 3)
		AND event_timestamp <= toDateTime64({end:UInt64}, 3)
		AND event_type = 'click'{$bot_where}
	GROUP BY channel";

	$last_touch_result = Utils\query( $last_touch_query, [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'],
		'end'     => $dates['end'],
	] );

	// Build lookup for first touch.
	$first_touch = [];
	if ( ! is_wp_error( $first_touch_result ) && is_array( $first_touch_result ) ) {
		foreach ( $first_touch_result as $row ) {
			$channel = Helpers\get_clickhouse_row_value( $row, 'channel', 'Unknown' );
			$first_touch[ $channel ] = (int) Helpers\get_clickhouse_row_value( $row, 'conversions', 0 );
		}
	}

	// Build lookup for last touch.
	$last_touch = [];
	if ( ! is_wp_error( $last_touch_result ) && is_array( $last_touch_result ) ) {
		foreach ( $last_touch_result as $row ) {
			$channel = Helpers\get_clickhouse_row_value( $row, 'channel', 'Unknown' );
			$last_touch[ $channel ] = (int) Helpers\get_clickhouse_row_value( $row, 'conversions', 0 );
		}
	}

	// Merge and calculate deltas.
	$all_channels = array_unique( array_merge( array_keys( $first_touch ), array_keys( $last_touch ) ) );
	$channels = [];

	$best_introducer = null;
	$best_introducer_delta = 0;
	$best_closer = null;
	$best_closer_delta = 0;
	$most_undervalued = null;
	$most_undervalued_delta = PHP_INT_MIN;

	foreach ( $all_channels as $channel ) {
		$ft = $first_touch[ $channel ] ?? 0;
		$lt = $last_touch[ $channel ] ?? 0;
		$delta = $ft - $lt;
		$delta_percent = $lt > 0 ? round( ( $delta / $lt ) * 100, 2 ) : ( $delta > 0 ? 100 : 0 );

		$channels[] = [
			'name'                   => $channel,
			'first_touch_conversions' => $ft,
			'last_touch_conversions'  => $lt,
			'delta'                  => $delta,
			'delta_percent'          => $delta_percent,
		];

		// Track insights.
		if ( $delta > $best_introducer_delta ) {
			$best_introducer = $channel;
			$best_introducer_delta = $delta;
		}

		if ( $delta < $best_closer_delta ) {
			$best_closer = $channel;
			$best_closer_delta = $delta;
		}

		// Most undervalued = highest positive delta (first touch >> last touch).
		if ( $delta > $most_undervalued_delta && $delta > 0 ) {
			$most_undervalued = $channel;
			$most_undervalued_delta = $delta;
		}
	}

	// Sort by first touch conversions.
	usort( $channels, fn( $a, $b ) => $b['first_touch_conversions'] <=> $a['first_touch_conversions'] );

	return [
		'channels' => $channels,
		'insights' => [
			'best_introducer'   => $best_introducer,
			'best_closer'       => $best_closer,
			'most_undervalued'  => $most_undervalued,
		],
		'period' => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}

/**
 * Register accelerate/get-source-breakdown ability.
 *
 * Detailed traffic source analysis.
 *
 * @return void
 */
function register_get_source_breakdown() : void {
	wp_register_ability( 'accelerate/get-source-breakdown', [
		'label'       => __( 'Get Source Breakdown', 'altis' ),
		'description' => __( 'Get detailed traffic source analysis by source, medium, campaign, or referrer.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'group_by' => [
					'type'    => 'string',
					'enum'    => [ 'source', 'medium', 'campaign', 'referrer_domain' ],
					'default' => 'source',
				],
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
				'sources' => [ 'type' => 'array' ],
				'period'  => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_source_breakdown',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing traffic sources...', 'altis' ),
		],
	] );
}

/**
 * Execute get-source-breakdown ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Source breakdown data or error.
 */
function execute_get_source_breakdown( array $input ) {
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );
	$group_by = $input['group_by'] ?? 'source';
	$limit = min( $input['limit'] ?? 20, 100 );

	$blog_id = get_current_blog_id();
	$table = Helpers\get_analytics_table();
	$bot_where = Utils\bot_exclusion_clause();

	// Map group_by to field.
	$field_map = [
		'source'          => "multiIf(
			initial_referer = '', 'Direct',
			initial_referer LIKE '%google%', 'Google',
			initial_referer LIKE '%bing%', 'Bing',
			initial_referer LIKE '%facebook%', 'Facebook',
			initial_referer LIKE '%twitter%', 'Twitter',
			initial_referer LIKE '%linkedin%', 'LinkedIn',
			initial_referer LIKE '%instagram%', 'Instagram',
			domain(initial_referer)
		)",
		'medium'          => "multiIf(
			initial_referer = '', 'none',
			initial_referer LIKE '%google%' OR initial_referer LIKE '%bing%' OR initial_referer LIKE '%yahoo%', 'organic',
			initial_referer LIKE '%facebook%' OR initial_referer LIKE '%twitter%' OR initial_referer LIKE '%linkedin%', 'social',
			initial_referer LIKE '%email%' OR initial_referer LIKE '%newsletter%', 'email',
			'referral'
		)",
		'campaign'        => "attributes['utm_campaign']",
		'referrer_domain' => "domain(initial_referer)",
	];

	$field = $field_map[ $group_by ] ?? $field_map['source'];

	$query = "SELECT
		{$field} as source_key,
		count() as views,
		uniqCombined64(endpoint_id) as visitors,
		countIf(event_type = 'click') as conversions
	FROM {$table}
	WHERE
		blog_id = {blog_id:String}
		-- Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
		AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
		AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
		AND event_timestamp >= toDateTime64({start:UInt64}, 3)
		AND event_timestamp <= toDateTime64({end:UInt64}, 3)
		AND event_type IN ('pageView', 'click'){$bot_where}
	GROUP BY source_key
	ORDER BY views DESC
	LIMIT {$limit}";

	$result = Utils\query( $query, [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'],
		'end'     => $dates['end'],
	] );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	// Calculate totals for percentages.
	$total_views = 0;
	$sources = [];

	if ( is_array( $result ) ) {
		foreach ( $result as $row ) {
			$views = (int) Helpers\get_clickhouse_row_value( $row, 'views', 0 );
			$total_views += $views;
		}

		foreach ( $result as $row ) {
			$key = Helpers\get_clickhouse_row_value( $row, 'source_key', 'Unknown' );
			$views = (int) Helpers\get_clickhouse_row_value( $row, 'views', 0 );
			$visitors = (int) Helpers\get_clickhouse_row_value( $row, 'visitors', 0 );
			$conversions = (int) Helpers\get_clickhouse_row_value( $row, 'conversions', 0 );

			if ( empty( $key ) ) {
				$key = $group_by === 'campaign' ? '(no campaign)' : 'Unknown';
			}

			$sources[] = [
				'key'             => $key,
				'views'           => $views,
				'visitors'        => $visitors,
				'conversions'     => $conversions,
				'conversion_rate' => $visitors > 0 ? round( ( $conversions / $visitors ) * 100, 2 ) : 0,
				'percent_of_total' => $total_views > 0 ? round( ( $views / $total_views ) * 100, 2 ) : 0,
			];
		}
	}

	return [
		'sources' => $sources,
		'period'  => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}

/**
 * Register accelerate/get-utm-performance ability.
 *
 * UTM parameter performance metrics.
 *
 * @return void
 */
function register_get_utm_performance() : void {
	wp_register_ability( 'accelerate/get-utm-performance', [
		'label'       => __( 'Get UTM Performance', 'altis' ),
		'description' => __( 'Get UTM parameter performance metrics grouped by campaign, source, medium, term, or content.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
				'date_range' => Helpers\get_date_range_with_preset_schema(),
				'group_by' => [
					'type'    => 'string',
					'enum'    => [ 'campaign', 'source', 'medium', 'term', 'content' ],
					'default' => 'campaign',
				],
				'campaign' => [
					'type'        => 'string',
					'description' => __( 'Filter by specific campaign name.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'campaigns' => [ 'type' => 'array' ],
				'period'    => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_utm_performance',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing UTM performance...', 'altis' ),
		],
	] );
}

/**
 * Execute get-utm-performance ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error UTM performance data or error.
 */
function execute_get_utm_performance( array $input ) {
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );
	$group_by = $input['group_by'] ?? 'campaign';
	$campaign_filter = $input['campaign'] ?? null;

	$blog_id = get_current_blog_id();
	$table = Helpers\get_analytics_table();
	$bot_where = Utils\bot_exclusion_clause();

	// Map group_by to UTM parameter.
	$utm_map = [
		'campaign' => 'utm_campaign',
		'source'   => 'utm_source',
		'medium'   => 'utm_medium',
		'term'     => 'utm_term',
		'content'  => 'utm_content',
	];

	$utm_field = $utm_map[ $group_by ] ?? 'utm_campaign';

	// Build campaign filter.
	$campaign_where = '';
	$params = [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'],
		'end'     => $dates['end'],
	];

	if ( $campaign_filter ) {
		$campaign_where = "AND attributes['utm_campaign'] = {campaign:String}";
		$params['campaign'] = $campaign_filter;
	}

	$query = "SELECT
		attributes['{$utm_field}'] as campaign_key,
		count() as views,
		uniqCombined64(endpoint_id) as visitors,
		countIf(event_type = 'click') as conversions
	FROM {$table}
	WHERE
		blog_id = {blog_id:String}
		-- Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
		AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
		AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
		AND event_timestamp >= toDateTime64({start:UInt64}, 3)
		AND event_timestamp <= toDateTime64({end:UInt64}, 3)
		AND event_type IN ('pageView', 'click')
		AND attributes['{$utm_field}'] != ''{$bot_where}
		{$campaign_where}
	GROUP BY campaign_key
	ORDER BY views DESC
	LIMIT 50";

	$result = Utils\query( $query, $params );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$campaigns = [];

	if ( is_array( $result ) ) {
		foreach ( $result as $row ) {
			$name = Helpers\get_clickhouse_row_value( $row, 'campaign_key', 'Unknown' );
			$views = (int) Helpers\get_clickhouse_row_value( $row, 'views', 0 );
			$visitors = (int) Helpers\get_clickhouse_row_value( $row, 'visitors', 0 );
			$conversions = (int) Helpers\get_clickhouse_row_value( $row, 'conversions', 0 );

			$campaigns[] = [
				'name'            => $name,
				'views'           => $views,
				'visitors'        => $visitors,
				'conversions'     => $conversions,
				'conversion_rate' => $visitors > 0 ? round( ( $conversions / $visitors ) * 100, 2 ) : 0,
			];
		}
	}

	return [
		'campaigns' => $campaigns,
		'period'    => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}

/**
 * Register accelerate/get-landing-pages ability.
 *
 * Entry page analysis.
 *
 * @return void
 */
function register_get_landing_pages() : void {
	wp_register_ability( 'accelerate/get-landing-pages', [
		'label'       => __( 'Get Landing Pages', 'altis' ),
		'description' => __( 'Get top landing (entry) pages with engagement and conversion metrics.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'additionalProperties' => false,
			'properties' => [
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
				'pages'  => [ 'type' => 'array' ],
				'period' => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_landing_pages',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Analyzing landing pages...', 'altis' ),
		],
	] );
}

/**
 * Execute get-landing-pages ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Landing page data or error.
 */
function execute_get_landing_pages( array $input ) {
	$dates = Helpers\parse_date_range_with_preset( $input, 7 );
	$limit = min( $input['limit'] ?? 20, 100 );

	$blog_id = get_current_blog_id();
	$table = Helpers\get_analytics_table();
	$bot_where = Utils\bot_exclusion_clause();

	// Query landing pages (first page view in session).
	$query = "SELECT
		first_post_id as post_id,
		count() as entries,
		countIf(session_pages = 1) as bounces,
		avg(session_duration) / 1000 as avg_time_seconds,
		countIf(session_conversions > 0) as converting_sessions,
		count() as total_sessions
	FROM (
		SELECT
			session_id,
			argMin(attributes['postId'], event_timestamp) as first_post_id,
			count() as session_pages,
			max(toUnixTimestamp64Milli(event_timestamp)) - min(toUnixTimestamp64Milli(event_timestamp)) as session_duration,
			countIf(event_type = 'click') as session_conversions
		FROM {$table}
		WHERE
			blog_id = {blog_id:String}
			-- Day-bucket prune: lets the toStartOfDay(event_timestamp) sort-key column prune to the window's days (a raw event_timestamp predicate alone can't). Safe superset filter.
			AND toStartOfDay(event_timestamp) >= toStartOfDay(toDateTime64({start:UInt64}, 3))
			AND toStartOfDay(event_timestamp) <= toStartOfDay(toDateTime64({end:UInt64}, 3))
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND notEmpty( toString( session_id ) ){$bot_where}
		GROUP BY session_id
	)
	WHERE first_post_id != ''
	GROUP BY first_post_id
	ORDER BY entries DESC
	LIMIT {$limit}";

	$result = Utils\query( $query, [
		'blog_id' => (string) $blog_id,
		'start'   => $dates['start'],
		'end'     => $dates['end'],
	] );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$pages = [];

	if ( is_array( $result ) ) {
		foreach ( $result as $row ) {
			$post_id = Helpers\get_clickhouse_row_value( $row, 'post_id' );
			$post = get_post( $post_id );

			if ( ! $post ) {
				continue;
			}

			$entries = (int) Helpers\get_clickhouse_row_value( $row, 'entries', 0 );
			$bounces = (int) Helpers\get_clickhouse_row_value( $row, 'bounces', 0 );
			$avg_time = round( (float) Helpers\get_clickhouse_row_value( $row, 'avg_time_seconds', 0 ), 2 );
			$converting = (int) Helpers\get_clickhouse_row_value( $row, 'converting_sessions', 0 );
			$total = (int) Helpers\get_clickhouse_row_value( $row, 'total_sessions', 0 );

			$pages[] = [
				'post_id'         => (int) $post_id,
				'title'           => $post->post_title,
				'url'             => get_permalink( $post_id ),
				'entries'         => $entries,
				'bounce_rate'     => $entries > 0 ? round( ( $bounces / $entries ) * 100, 2 ) : 0,
				'avg_time_on_page' => $avg_time,
				'conversion_rate' => $total > 0 ? round( ( $converting / $total ) * 100, 2 ) : 0,
			];
		}
	}

	return [
		'pages'  => $pages,
		'period' => [
			'start' => gmdate( 'c', $dates['start'] ),
			'end'   => gmdate( 'c', $dates['end'] ),
		],
	];
}
