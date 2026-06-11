<?php
/**
 * Remote API endpoints for server-to-site communication.
 *
 * These endpoints are authenticated via HMAC signing rather than
 * WordPress user authentication, allowing accelerateplugin.com
 * to fetch data from connected sites.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\API\Remote;

use Altis\Accelerate\API;
use Altis\Accelerate\API\Filter;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

use function Altis\Accelerate\get_config;

const TIMESTAMP_TOLERANCE = 300; // 5 minutes

/**
 * Bootstrap remote API.
 *
 * @return void
 */
function setup() {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_endpoints' );
}

/**
 * Register remote API routes.
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
			'type' => 'string',
			'default' => '1 day',
		],
		'tz' => [
			'type' => 'string',
			'default' => '',
		],
	];

	register_rest_route( API\API_NAMESPACE, 'remote/top', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_remote_top',
		'permission_callback' => __NAMESPACE__ . '\\verify_hmac_signature',
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

	// Posts endpoint for resolving post metadata by ID.
	register_rest_route( API\API_NAMESPACE, 'remote/posts', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_remote_posts',
		'permission_callback' => __NAMESPACE__ . '\\verify_hmac_signature',
		'args' => [
			'ids' => [
				'type' => 'array',
				'items' => [ 'type' => 'integer' ],
				'required' => true,
			],
		],
	] );

	// Ping endpoint for heartbeat checks.
	register_rest_route( API\API_NAMESPACE, 'remote/ping', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_remote_ping',
		'permission_callback' => __NAMESPACE__ . '\\verify_hmac_signature',
	] );

	// Stats endpoint for weekly email.
	register_rest_route( API\API_NAMESPACE, 'remote/stats', [
		'method' => WP_REST_Server::READABLE,
		'callback' => __NAMESPACE__ . '\\get_remote_stats',
		'permission_callback' => __NAMESPACE__ . '\\verify_hmac_signature',
		'args' => [
			'period' => [
				'type' => 'string',
				'default' => '7days',
				'enum' => [ '7days', '30days', '90days' ],
			],
			'limit' => [
				'type' => 'integer',
				'default' => 5,
				'minimum' => 1,
				'maximum' => 20,
			],
		],
	] );
}

/**
 * Verify HMAC signature from incoming request.
 *
 * @param WP_REST_Request $request The request object.
 * @return bool|WP_Error True if valid, WP_Error otherwise.
 */
function verify_hmac_signature( WP_REST_Request $request ) {
	$config = get_config();

	if ( ! $config || empty( $config['pass'] ) ) {
		return new WP_Error(
			'rest_forbidden',
			__( 'Site is not configured for remote access.', 'altis-accelerate' ),
			[ 'status' => 403 ]
		);
	}

	$signature_header = $request->get_header( 'X-Accelerate-Signature' );
	$timestamp_header = $request->get_header( 'X-Accelerate-Timestamp' );

	if ( ! $signature_header || ! $timestamp_header ) {
		return new WP_Error(
			'rest_forbidden',
			__( 'Missing authentication headers.', 'altis-accelerate' ),
			[ 'status' => 403 ]
		);
	}

	// Check timestamp is within tolerance.
	$timestamp = (int) $timestamp_header;
	$now = time();

	if ( abs( $now - $timestamp ) > TIMESTAMP_TOLERANCE ) {
		return new WP_Error(
			'rest_forbidden',
			__( 'Request timestamp is too old or too far in the future.', 'altis-accelerate' ),
			[ 'status' => 403 ]
		);
	}

	// Parse the signature header (format: sha256=<signature>).
	if ( strpos( $signature_header, 'sha256=' ) !== 0 ) {
		return new WP_Error(
			'rest_forbidden',
			__( 'Invalid signature format.', 'altis-accelerate' ),
			[ 'status' => 403 ]
		);
	}

	$provided_signature = substr( $signature_header, 7 ); // Remove 'sha256=' prefix.

	// Rebuild the signature payload using the actual request URI,
	// which includes the /wp-json prefix and original query string encoding.
	$method = $request->get_method();
	$request_uri = $_SERVER['REQUEST_URI'] ?? '';
	$parsed = wp_parse_url( $request_uri );
	$path = $parsed['path'] ?? '';
	if ( ! empty( $parsed['query'] ) ) {
		$path .= '?' . $parsed['query'];
	}

	// Get body for POST requests.
	$body = '';
	if ( $method === 'POST' ) {
		$body = $request->get_body();
	}

	// Build the signature payload: timestamp.method.path.body
	$signature_payload = implode( '.', [
		$timestamp,
		$method,
		$path,
		$body,
	] );

	// Calculate expected signature.
	$expected_signature = hash_hmac( 'sha256', $signature_payload, $config['pass'] );

	// Use timing-safe comparison.
	if ( ! hash_equals( $expected_signature, $provided_signature ) ) {
		return new WP_Error(
			'rest_forbidden',
			__( 'Invalid signature.', 'altis-accelerate' ),
			[ 'status' => 403 ]
		);
	}

	return true;
}

/**
 * Handle remote ping endpoint for heartbeat checks.
 *
 * Returns lightweight site info: plugin version, WP version, PHP version, and site URL.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response
 */
function get_remote_ping( WP_REST_Request $request ) {
	return new WP_REST_Response( [
		'ok'          => true,
		'version'     => \Altis\Accelerate\VERSION,
		'wp_version'  => get_bloginfo( 'version' ),
		'php_version' => PHP_VERSION,
		'site_url'    => site_url(),
	] );
}

/**
 * Handle remote stats endpoint for weekly email.
 *
 * Returns aggregated stats suitable for email reports.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_Error|WP_REST_Response
 */
function get_remote_stats( WP_REST_Request $request ) {
	$period = $request['period'] ?? '7days';
	$limit = (int) ( $request['limit'] ?? 5 );

	// Calculate date range based on period.
	$periods = [
		'7days' => '-7 days',
		'30days' => '-30 days',
		'90days' => '-90 days',
	];

	$start = strtotime( $periods[ $period ] ?? '-7 days' );
	$end = time();

	$blog_id = (string) get_current_blog_id();

	// Get total views and visitors.
	$totals = \Altis\Accelerate\Utils\query(
		"SELECT
			sum(views) as views,
			uniqCombined64Merge(unique_visitors) as visitors
		FROM analytics_daily
		WHERE
			blog_id = {blog_id:String}
			AND day >= toDate(toDateTime64({start:UInt64}, 3))
			AND day <= toDate(toDateTime64({end:UInt64}, 3))",
		[
			'blog_id' => $blog_id,
			'start' => $start,
			'end' => $end,
		],
		'object'
	);

	if ( is_wp_error( $totals ) ) {
		return $totals;
	}

	// Get top pages.
	$top_pages_result = \Altis\Accelerate\Utils\query(
		"SELECT
			url,
			any(item_id) as item_id,
			count() as views
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
		GROUP BY url
		ORDER BY views DESC
		LIMIT {limit:UInt8}",
		[
			'blog_id' => $blog_id,
			'start' => $start,
			'end' => $end,
			'limit' => $limit,
		]
	);

	$top_pages = [];
	if ( ! is_wp_error( $top_pages_result ) ) {
		foreach ( $top_pages_result as $row ) {
			$url = $row->url ?? '';
			$title = '';

			$post_id = intval( $row->item_id ?? 0 );
			if ( $post_id ) {
				$title = get_the_title( $post_id );
			}

			$top_pages[] = [
				'url'   => $url,
				'title' => $title,
				'views' => (int) ( $row->views ?? 0 ),
			];
		}
	}

	// Get top referrers.
	$top_referrers_result = \Altis\Accelerate\Utils\query(
		"SELECT
			referer as source,
			uniqCombined64(endpoint_id) as visitors
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp >= toDateTime64({start:UInt64}, 3)
			AND event_timestamp <= toDateTime64({end:UInt64}, 3)
			AND event_type = 'pageView'
			AND referer != ''
		GROUP BY referer
		ORDER BY visitors DESC
		LIMIT 50",
		[
			'blog_id' => $blog_id,
			'start' => $start,
			'end' => $end,
		]
	);

	$top_referrers = [];
	if ( ! is_wp_error( $top_referrers_result ) ) {
		// Extract domain from referrer and aggregate by domain.
		$domains = [];
		foreach ( $top_referrers_result as $row ) {
			$domain = wp_parse_url( $row->source ?? '', PHP_URL_HOST );
			if ( ! $domain ) {
				continue;
			}
			if ( ! isset( $domains[ $domain ] ) ) {
				$domains[ $domain ] = 0;
			}
			$domains[ $domain ] += (int) ( $row->visitors ?? 0 );
		}

		// Sort by visitors and limit.
		arsort( $domains );
		$domains = array_slice( $domains, 0, $limit, true );

		foreach ( $domains as $domain => $visitors ) {
			$top_referrers[] = [
				'source' => $domain,
				'visitors' => $visitors,
			];
		}
	}

	return new WP_REST_Response( [
		'views' => (int) ( $totals->views ?? 0 ),
		'visitors' => (int) ( $totals->visitors ?? 0 ),
		'top_pages' => $top_pages,
		'top_referrers' => $top_referrers,
		'period' => $period,
	] );
}

/**
 * Handle remote posts endpoint.
 *
 * Returns metadata (title, URL, type) for the given post IDs.
 * Used by the website to resolve post titles for email reports.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response
 */
function get_remote_posts( WP_REST_Request $request ) {
	$post_ids = array_map( 'absint', $request['ids'] ?? [] );

	if ( empty( $post_ids ) || count( $post_ids ) > 100 ) {
		return new WP_REST_Response( [] );
	}

	$posts = get_posts( [
		'post__in'       => $post_ids,
		'post_type'      => 'any',
		'post_status'    => 'any',
		'posts_per_page' => count( $post_ids ),
		'orderby'        => 'post__in',
	] );

	$result = [];
	foreach ( $posts as $post ) {
		$post_type_obj = get_post_type_object( $post->post_type );
		$result[] = [
			'id'    => (int) $post->ID,
			'title' => trim( wp_strip_all_tags( get_the_title( $post->ID ) ) ),
			'url'   => $post_type_obj && $post_type_obj->public ? get_the_permalink( $post->ID ) : null,
			'type'  => $post->post_type,
		];
	}

	return new WP_REST_Response( $result );
}

/**
 * Handle remote top content endpoint.
 *
 * This is essentially the same as the regular /top endpoint but
 * authenticated via HMAC rather than WordPress user session.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_Error|WP_REST_Response
 */
function get_remote_top( WP_REST_Request $request ) {
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
	$data = API\get_top_data( $start, $end, $filter );

	if ( is_wp_error( $data ) ) {
		return $data;
	}

	$response = new WP_REST_Response( $data['posts'], 200, [
		'X-WP-Total' => $data['total'],
		'X-WP-TotalPages' => $data['max_pages'],
	] );

	return $response;
}
