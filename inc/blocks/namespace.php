<?php
/**
 * Experience Block functions.
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Blocks;

use Altis\Accelerate;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\Utils;
use WP_Post;

const POST_TYPE = 'wp_block';

/**
 * Include and set up Experience Blocks.
 */
function setup() {
	require_once __DIR__ . '/shim/register.php';
	require_once __DIR__ . '/broadcast/register.php';

	if ( Utils\is_feature_enabled( 'broadcast' ) ) {
		Broadcast\setup();
	}

	Shim\setup();

	// Register API endpoints for getting XB analytics data.
	REST_API\setup();

	// Register globally useful scripts.
	add_action( 'admin_enqueue_scripts', __NAMESPACE__ . '\\register_scripts', 1 );

	// Support excerpts.
	add_filter( 'excerpt_allowed_wrapper_blocks', __NAMESPACE__ . '\\filter_excerpt_allowed_wrapper_blocks' );
}

/**
 * Reads and returns a block.json file to pass shared settings
 * between JS and PHP to the register blocks functions.
 *
 * @param string $name The directory name of the block relative to this file.
 * @return array|null The JSON data as an associative array or null on error.
 */
function get_block_settings( string $name ) : ?array {
	$json_path = __DIR__ . '/' . $name . '/block.json';

	// Check name is valid.
	if ( ! file_exists( $json_path ) ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		trigger_error( sprintf( 'Error reading %/block.json: file does not exist.', $name ), E_USER_WARNING );
		return null;
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	$json = file_get_contents( $json_path );

	// Decode the settings.
	$settings = json_decode( $json, ARRAY_A );

	// Check JSON is valid.
	if ( json_last_error() !== JSON_ERROR_NONE ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		trigger_error( sprintf( 'Error decoding %/block.json: %s', $name, json_last_error_msg() ), E_USER_WARNING );
		return null;
	}

	return $settings;
}

/**
 * Get the XB type, excluding the altis/ namespace prefix.
 *
 * Falls back to 'personalization' for backlwards compatibility.
 *
 * @param int|WP_Post $post Post object or ID for the XB.
 * @return string
 */
function get_block_type( $post ) : string {
	$post = get_post( $post );
	$type = get_post_meta( $post->ID, '_xb_type', true ) ?: 'standard';
	return str_replace( 'altis/', '', $type );
}

/**
 * Readable block name based on the XB name.
 *
 * @param string $block_name Name of the XB.
 * @return string
 */
function get_block_type_label( string $block_name ) : string {
	$types = [
		'standard' => __( 'Synced Pattern', 'altis' ),
		'abtest' => __( 'A/B Test', 'altis' ),
		'personalization' => __( 'Personalized Content', 'altis' ),
	];

	$type = str_replace( 'altis/', '', $block_name );

	return ( $types[ $type ] ?? __( 'Unknown', 'altis' ) );
}

/**
 * Register discrete scripts for use in multiple places.
 *
 * @return void
 */
function register_scripts() {
	$data = Utils\register_assets(
		'blocks/data',
		[
			'dependencies' => [
				'wp-api-fetch',
				'wp-url',
				'wp-data',
			],
		]
	);

	$ui = Utils\register_assets(
		'blocks/ui',
		[
			'dependencies' => [
				$data['script'],
				'wp-components',
				'wp-i18n',
				'wp-html-entities',
			]
		]
	);

	wp_add_inline_script(
		$ui['script'],
		sprintf(
			'window.Altis = window.Altis || {};' .
			'window.Altis.Analytics = window.Altis.Analytics || {};' .
			'window.Altis.Analytics.Experiments = window.Altis.Analytics.Experiments || {};' .
			'window.Altis.Analytics.Experiments.BuildURL = %s;' .
			'window.Altis.Analytics.Experiments.Goals = %s;',
			wp_json_encode( plugins_url( 'build', Accelerate\PLUGIN_FILE ) ),
			wp_json_encode( (object) Experiments\get_goals() )
		),
		'before'
	);
}

/**
 * Get the Experience Block views data.
 *
 * @param int $block_id The Experience block client ID to get data for.
 * @param array $args Filter args.
 *     - int|null $args['post_id'] An optional post ID to limit results by.
 *     - int $args['days'] The number of days to get data for.
 *     - int $args['offset'] The offset for number of days prior to start query from.
 *     - string $args['vary_on'] The field to distinguish variants on.
 * @return array|\WP_Error
 */
function get_views( $block_id, $args = [] ) {
	if ( ! empty( $args ) && is_numeric( $args ) ) {
		_deprecated_argument(
			__FUNCTION__,
			'3.1.0',
			__( 'The $post_id argument has been deprecated in favours of args array. Please use [ \'post_id\' => 123 ] instead.' )
		);
		$args = [ 'post_id' => $args ];
	}

	// Get filter arguments.
	$args = wp_parse_args( $args, [
		'post_id' => null,
		'start' => null,
		'end' => null,
	] );

	// Work out a column to group by, else use empty string for a standard block with no variants.
	$block_type = get_block_type( $block_id );
	$vary_on = "''";
	if ( $block_type !== 'standard' ) {
		$vary_on = $block_type === 'abtest' ? 'test_variant_id' : 'audience';
	}

	$query_params = [
		'blog_id' => get_current_blog_id(),
		'block_id' => $block_id,
	];

	$query_where = '';

	// Add post ID query filter.
	if ( $args['post_id'] ) {
		$query_where .= "AND post_id = {post_id:String}";
		$query_params['post_id'] = $args['post_id'];
	}

	// Set date range.
	if ( $args['start'] ) {
		$query_where .= " AND event_timestamp >= toDateTime64({start:UInt64},3)";
		$query_params['start'] = strtotime( $args['start'] );
	}
	if ( $args['end'] ) {
		$query_where .= " AND event_timestamp <= toDateTime64({end:UInt64},3)";
		$query_params['end'] = strtotime( $args['end'] );
	}

	$query =
		"SELECT
			{$vary_on} as variant,
			countIf(event_type = 'blockLoad') as loads,
			countIf(event_type = 'blockView') as views,
			countIf(event_type = 'conversion') as conversions,
			uniqCombined64If(endpoint_id, event_type = 'blockLoad') as unique_loads,
			uniqCombined64If(endpoint_id, event_type = 'blockView') as unique_views,
			uniqCombined64If(endpoint_id, event_type = 'conversion') as unique_conversions,
			groupUniqArray(post_id) as post_ids
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_type IN ('blockLoad', 'blockView', 'conversion')
			AND block_id = {block_id:String}
			{$query_where}
		GROUP BY variant WITH ROLLUP
		ORDER BY variant ASC";

	$key = Utils\get_cache_key( 'block_views', $block_id, $args );
	$cache = wp_cache_get( $key, 'altis-xbs' );
	if ( $cache ) {
		return $cache;
	}

	$result = Utils\query( $query, $query_params );

	if ( ! $result ) {
		$data = [
			'start' => $args['start'],
			'end' => $args['end'],
			'loads' => 0,
			'views' => 0,
			'conversions' => 0,
			'unique' => [
				'loads' => 0,
				'views' => 0,
				'conversions' => 0,
			],
			'variants' => [],
		];
		wp_cache_set( $key, $data, 'altis-xbs', MINUTE_IN_SECONDS );
		return $data;
	}

	if ( ! is_array( $result ) ) {
		$result = [ $result ];
	}

	// Collect metrics.
	$data = array_reduce(
		$result,
		function ( $data, $row ) use ( $args ) {
			// Rolled up aggregate values.
			if ( $row->variant === '' ) {
				$data['loads'] = (int) $row->loads;
				$data['views'] = (int) $row->views;
				$data['conversions'] = (int) $row->conversions;
				$data['unique'] = [
					'loads' => (int) $row->unique_loads,
					'views' => (int) $row->unique_views,
					'conversions' => (int) $row->unique_conversions,
				];
			} else {
				$data['variants'][] = [
					'id' => (int) $row->variant,
					'loads' => (int) $row->loads,
					'views' => (int) $row->views,
					'conversions' => (int) $row->conversions,
					'unique' => [
						'loads' => (int) $row->unique_loads,
						'views' => (int) $row->unique_views,
						'conversions' => (int) $row->unique_conversions,
					],
				];
			}

			if ( $args['post_id'] ) {
				$data['post_id'] = (int) $args['post_id'];
			} else {
				$data['posts'] = array_merge( $data['posts'] ?? [], $row->post_ids );
				$data['posts'] = array_map( 'intval', $data['posts'] );
				$data['posts'] = array_unique( $data['posts'] );
				$data['posts'] = array_filter( $data['posts'] );
			}

			return $data;
		},
		[
			'start' => $args['start'],
			'end' => $args['end'],
			'loads' => 0,
			'views' => 0,
			'conversions' => 0,
			'unique' => [
				'loads' => 0,
				'views' => 0,
				'conversions' => 0,
			],
			'variants' => [],
		]
	);

	wp_cache_set( $key, $data, 'altis-xbs', MINUTE_IN_SECONDS * 5 );

	return $data;
}

/**
 * Allow the ab-test and personalization blocks to contribute towards an excerpt.
 *
 * @param array $allowed_blocks The current array of allowed wrapper blocks;
 *
 * @return array The updated wrapper blocks.
 */
function filter_excerpt_allowed_wrapper_blocks( array $allowed_blocks ) : array {
	$allowed_blocks[] = 'core/block';
	$allowed_blocks[] = 'altis/broadcast';

	return $allowed_blocks;
}
