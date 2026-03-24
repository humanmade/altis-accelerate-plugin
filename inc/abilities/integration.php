<?php
/**
 * Accelerate Abilities API - Integration Domain.
 *
 * Domain D: Integration & Export (Voice)
 * Connecting Accelerate to the broader business intelligence stack.
 *
 * @package Altis\Accelerate\Abilities\Integration
 */

namespace Altis\Accelerate\Abilities\Integration;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Export;
use WP_Error;

/**
 * Register all integration abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_export_events();
	register_get_export_status();
}

/**
 * Register accelerate/export-events ability.
 *
 * Exports raw analytics events for external analysis.
 *
 * @return void
 */
function register_export_events() : void {
	wp_register_ability( 'accelerate/export-events', [
		'label'       => __( 'Export Events', 'altis' ),
		'description' => __( 'Export raw analytics events for a specific date. Enables BI tools to correlate experimentation data with business metrics.', 'altis' ),
		'category'    => 'accelerate-integration',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'date' => [
					'type'        => 'string',
					'format'      => 'date',
					'description' => __( 'Date to export (YYYY-MM-DD format).', 'altis' ),
				],
				'format' => [
					'type'        => 'string',
					'enum'        => [ 'json', 'csv' ],
					'default'     => 'json',
					'description' => __( 'Export file format.', 'altis' ),
				],
			],
			'required' => [ 'date' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'      => [ 'type' => 'boolean' ],
				'export_url'   => [ 'type' => 'string' ],
				'total_events' => [ 'type' => 'integer' ],
				'format'       => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_export_events',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_manage_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Preparing analytics export...', 'altis' ),
		],
	] );
}

/**
 * Execute export-events ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Export result or error.
 */
function execute_export_events( array $input ) {
	$date = $input['date'] ?? '';
	$format = $input['format'] ?? 'json';

	if ( empty( $date ) ) {
		return new WP_Error( 'missing_date', __( 'date is required.', 'altis' ) );
	}

	// Validate date format.
	$timestamp = strtotime( $date );
	if ( ! $timestamp ) {
		return new WP_Error( 'invalid_date', __( 'Invalid date format. Use YYYY-MM-DD.', 'altis' ) );
	}

	// Check date is not in the future.
	if ( $timestamp > time() ) {
		return new WP_Error( 'future_date', __( 'Cannot export data for future dates.', 'altis' ) );
	}

	// Check date is within retention period (90 days).
	$retention_days = 90;
	$oldest_allowed = strtotime( "-{$retention_days} days" );
	if ( $timestamp < $oldest_allowed ) {
		return new WP_Error(
			'date_out_of_range',
			sprintf(
				/* translators: %d: retention period in days */
				__( 'Data older than %d days is not available due to retention policy.', 'altis' ),
				$retention_days
			)
		);
	}

	// Check if export feature is enabled.
	if ( ! function_exists( 'Altis\\Accelerate\\Export\\get_export_url' ) ) {
		// Export feature not available, provide REST API alternative.
		$export_url = add_query_arg( [
			'date'   => $date,
			'format' => $format,
		], rest_url( 'accelerate/v1/export' ) );

		return [
			'success'      => true,
			'export_url'   => $export_url,
			'total_events' => 0,
			'format'       => $format,
			'note'         => __( 'Export URL generated. Access requires authentication.', 'altis' ),
		];
	}

	// Use native export function if available.
	$export_url = Export\get_export_url( $date );

	if ( is_wp_error( $export_url ) ) {
		return $export_url;
	}

	return [
		'success'      => true,
		'export_url'   => $export_url,
		'date'         => $date,
		'format'       => $format,
		'total_events' => get_event_count_for_date( $date ),
	];
}

/**
 * Get approximate event count for a date.
 *
 * @param string $date Date in YYYY-MM-DD format.
 * @return int Event count.
 */
function get_event_count_for_date( string $date ) : int {
	$timestamp = strtotime( $date );
	$start = $timestamp * 1000;
	$end = ( $timestamp + 86400 ) * 1000;

	// Query for count.
	$result = \Altis\Accelerate\Utils\query(
		"SELECT COUNT() as count
		FROM analytics
		WHERE blog_id = {blog_id:String}
		AND event_timestamp >= toDateTime64({start:UInt64},3)
		AND event_timestamp < toDateTime64({end:UInt64},3)",
		[
			'blog_id' => (string) get_current_blog_id(),
			'start'   => $start,
			'end'     => $end,
		],
		'array'
	);

	if ( is_wp_error( $result ) || empty( $result ) ) {
		return 0;
	}

	// Result row may be array or object depending on query format.
	$row = $result[0];
	$count = is_array( $row ) ? ( $row['count'] ?? 0 ) : ( $row->count ?? 0 );

	return (int) $count;
}

/**
 * Register accelerate/get-export-status ability.
 *
 * Check status/availability of export data for a date.
 *
 * @return void
 */
function register_get_export_status() : void {
	wp_register_ability( 'accelerate/get-export-status', [
		'label'       => __( 'Get Export Status', 'altis' ),
		'description' => __( 'Check availability and status of export data for a specific date.', 'altis' ),
		'category'    => 'accelerate-integration',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'date' => [
					'type'        => 'string',
					'format'      => 'date',
					'description' => __( 'Date to check (YYYY-MM-DD format).', 'altis' ),
				],
			],
			'required' => [ 'date' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'available'    => [ 'type' => 'boolean' ],
				'total_events' => [ 'type' => 'integer' ],
				'export_url'   => [ 'type' => 'string' ],
				'retention'    => [ 'type' => 'object' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_export_status',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Checking export availability...', 'altis' ),
		],
	] );
}

/**
 * Execute get-export-status ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Status result or error.
 */
function execute_get_export_status( array $input ) {
	$date = $input['date'] ?? '';

	if ( empty( $date ) ) {
		return new WP_Error( 'missing_date', __( 'date is required.', 'altis' ) );
	}

	// Validate date format.
	$timestamp = strtotime( $date );
	if ( ! $timestamp ) {
		return new WP_Error( 'invalid_date', __( 'Invalid date format. Use YYYY-MM-DD.', 'altis' ) );
	}

	$retention_days = 90;
	$oldest_allowed = strtotime( "-{$retention_days} days" );
	$is_available = $timestamp <= time() && $timestamp >= $oldest_allowed;

	$result = [
		'available' => $is_available,
		'date'      => $date,
		'retention' => [
			'days'         => $retention_days,
			'oldest_date'  => gmdate( 'Y-m-d', $oldest_allowed ),
			'expires_in'   => $is_available
				? max( 0, $retention_days - ceil( ( time() - $timestamp ) / 86400 ) )
				: 0,
		],
	];

	if ( $is_available ) {
		$result['total_events'] = get_event_count_for_date( $date );
		$result['export_url'] = add_query_arg( [
			'date' => $date,
		], rest_url( 'accelerate/v1/export' ) );
	} else {
		$result['total_events'] = 0;

		if ( $timestamp > time() ) {
			$result['reason'] = __( 'Date is in the future.', 'altis' );
		} else {
			$result['reason'] = __( 'Data has expired due to retention policy.', 'altis' );
		}
	}

	return $result;
}
