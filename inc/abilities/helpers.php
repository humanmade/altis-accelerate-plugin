<?php
/**
 * Accelerate Abilities API - Shared Helpers.
 *
 * Utility functions shared across ability domains for date presets,
 * velocity calculations, and ClickHouse data handling.
 *
 * @package Altis\Accelerate\Abilities\Helpers
 */

namespace Altis\Accelerate\Abilities\Helpers;

/**
 * Get the ClickHouse analytics table name.
 *
 * Honors the ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE override (used by the test
 * environment) and falls back to the default `analytics` table.
 *
 * @return string Table name.
 */
function get_analytics_table() : string {
	return defined( 'ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE' ) ? ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE : 'analytics';
}

/**
 * Date preset configurations.
 *
 * Maps preset names to their durations in seconds.
 *
 * @return array Preset name to seconds mapping.
 */
function get_preset_durations() : array {
	return [
		'1h'  => 3600,
		'4h'  => 14400,
		'12h' => 43200,
		'24h' => 86400,
		'7d'  => 604800,
		'30d' => 2592000,
		'90d' => 7776000,
	];
}

/**
 * Resolve a preset to start/end timestamps.
 *
 * @param string $preset The preset name (1h, 4h, 12h, 24h, 7d, 30d, 90d).
 * @return array Array with 'start' and 'end' timestamps.
 */
function resolve_preset_to_dates( string $preset ) : array {
	$presets = get_preset_durations();

	if ( ! isset( $presets[ $preset ] ) ) {
		// Default to 7 days.
		$preset = '7d';
	}

	$end = time();
	$start = $end - $presets[ $preset ];

	return [
		'start' => $start,
		'end'   => $end,
	];
}

/**
 * Get auto granularity for a preset.
 *
 * Maps presets to appropriate granularity values:
 * - 1h  → 5min
 * - 4h  → 15min
 * - 12h → 30min
 * - 24h → 1h
 * - 7d  → daily
 * - 30d → daily
 * - 90d → weekly
 *
 * @param string $preset The preset name.
 * @return string The appropriate granularity.
 */
function get_auto_granularity( string $preset ) : string {
	$mapping = [
		'1h'  => '5min',
		'4h'  => '15min',
		'12h' => '30min',
		'24h' => '1h',
		'7d'  => 'daily',
		'30d' => 'daily',
		'90d' => 'weekly',
	];

	return $mapping[ $preset ] ?? 'daily';
}

/**
 * Convert granularity to ClickHouse interval format.
 *
 * @param string $granularity The granularity value.
 * @return string ClickHouse interval string.
 */
function granularity_to_interval( string $granularity ) : string {
	$mapping = [
		'5min'   => 'PT5M',
		'15min'  => 'PT15M',
		'30min'  => 'PT30M',
		'1h'     => 'PT1H',
		'hourly' => 'PT1H',
		'daily'  => 'P1D',
		'weekly' => 'P7D',
	];

	return $mapping[ $granularity ] ?? 'P1D';
}

/**
 * Safely get a value from a ClickHouse row.
 *
 * ClickHouse results can be either stdClass objects or arrays
 * depending on the query format. This helper handles both.
 *
 * @param mixed  $row     The row (stdClass or array).
 * @param string $key     The key to retrieve.
 * @param mixed  $default Default value if not found.
 * @return mixed The value or default.
 */
function get_clickhouse_row_value( $row, string $key, $default = null ) {
	if ( is_object( $row ) ) {
		return $row->$key ?? $default;
	}

	if ( is_array( $row ) ) {
		return $row[ $key ] ?? $default;
	}

	return $default;
}

/**
 * Calculate velocity (momentum) between two values.
 *
 * @param int $current  Current period value.
 * @param int $previous Previous period value.
 * @return array Array with 'percent' and 'direction' (rising|stable|falling).
 */
function calculate_velocity( int $current, int $previous ) : array {
	if ( $previous === 0 ) {
		$percent = $current > 0 ? 100.0 : 0.0;
	} else {
		$percent = round( ( ( $current - $previous ) / $previous ) * 100, 2 );
	}

	// Determine direction based on threshold.
	if ( $percent > 10 ) {
		$direction = 'rising';
	} elseif ( $percent < -10 ) {
		$direction = 'falling';
	} else {
		$direction = 'stable';
	}

	return [
		'percent'   => $percent,
		'direction' => $direction,
	];
}

/**
 * Parse date range from input, supporting both presets and explicit dates.
 *
 * @param array $input        Input containing date_range or date_range_preset.
 * @param int   $default_days Default days if nothing specified.
 * @return array Array with 'start' and 'end' timestamps.
 */
function parse_date_range_with_preset( array $input, int $default_days = 7 ) : array {
	// Check for preset first.
	if ( ! empty( $input['date_range_preset'] ) ) {
		return resolve_preset_to_dates( $input['date_range_preset'] );
	}

	// Check nested date_range.preset.
	if ( ! empty( $input['date_range']['preset'] ) ) {
		return resolve_preset_to_dates( $input['date_range']['preset'] );
	}

	// Fall back to explicit dates.
	$end = isset( $input['date_range']['end'] )
		? strtotime( $input['date_range']['end'] )
		: time();

	$start = isset( $input['date_range']['start'] )
		? strtotime( $input['date_range']['start'] )
		: strtotime( "-{$default_days} days", $end );

	return [
		'start' => $start,
		'end'   => $end,
	];
}

/**
 * Get the date range schema definition with preset support.
 *
 * @return array JSON schema for date range with preset.
 */
function get_date_range_with_preset_schema() : array {
	return [
		'type'       => 'object',
		'properties' => [
			'preset' => [
				'type'        => 'string',
				'enum'        => [ '1h', '4h', '12h', '24h', '7d', '30d', '90d' ],
				'description' => __( 'Date range preset. If provided, start/end are ignored.', 'altis' ),
			],
			'start'  => [
				'type'        => 'string',
				'format'      => 'date-time',
				'description' => __( 'Start date/time in ISO 8601 format.', 'altis' ),
			],
			'end'    => [
				'type'        => 'string',
				'format'      => 'date-time',
				'description' => __( 'End date/time in ISO 8601 format.', 'altis' ),
			],
		],
	];
}

/**
 * Get the JSON schema for an audience targeting `rules` object.
 *
 * Shared by create-audience and update-audience so both validate the same
 * nested shape. The rule `operator` enum is the canonical list of comparison
 * operators the audience evaluator actually supports
 * (Altis\Accelerate\Audiences\COMPARISON_OPERATORS).
 *
 * @return array JSON schema for the audience rules object.
 */
function get_audience_rules_schema() : array {
	$operators = defined( 'Altis\\Accelerate\\Audiences\\COMPARISON_OPERATORS' )
		? constant( 'Altis\\Accelerate\\Audiences\\COMPARISON_OPERATORS' )
		: [ '=', '!=', '*=', '!*', '^=', 'gte', 'lte', 'gt', 'lt' ];

	return [
		'type'                 => 'object',
		'description'          => __( 'Audience targeting configuration.', 'altis' ),
		'additionalProperties' => false,
		'properties'           => [
			'include' => [
				'type' => 'string',
				'enum' => [ 'any', 'all', 'none' ],
			],
			'groups' => [
				'type'  => 'array',
				'items' => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'properties'           => [
						'include' => [ 'type' => 'string', 'enum' => [ 'any', 'all', 'none' ] ],
						'rules'   => [
							'type'  => 'array',
							'items' => [
								'type'                 => 'object',
								'additionalProperties' => false,
								'properties'           => [
									'field'    => [ 'type' => 'string' ],
									'operator' => [
										'type' => 'string',
										'enum' => $operators,
									],
									'value'    => [ 'type' => [ 'string', 'number' ] ],
								],
							],
						],
					],
				],
			],
		],
	];
}

/**
 * Get comparison period dates (previous period of same duration).
 *
 * @param int $start Current period start timestamp.
 * @param int $end   Current period end timestamp.
 * @return array Array with 'start' and 'end' timestamps for comparison period.
 */
function get_comparison_period( int $start, int $end ) : array {
	$duration = $end - $start;

	return [
		'start' => $start - $duration,
		'end'   => $start,
	];
}

/**
 * Format a timestamp for display.
 *
 * @param int    $timestamp Unix timestamp.
 * @param string $format    Date format string.
 * @return string Formatted date.
 */
function format_timestamp( int $timestamp, string $format = 'Y-m-d H:i:s' ) : string {
	return gmdate( $format, $timestamp );
}

/**
 * Calculate percentage safely (avoiding division by zero).
 *
 * @param int $value The numerator.
 * @param int $total The denominator.
 * @param int $decimals Number of decimal places.
 * @return float The percentage.
 */
function safe_percentage( int $value, int $total, int $decimals = 2 ) : float {
	if ( $total === 0 ) {
		return 0.0;
	}

	return round( ( $value / $total ) * 100, $decimals );
}

/**
 * Calculate conversion rate safely.
 *
 * @param int $conversions Number of conversions.
 * @param int $impressions Number of impressions.
 * @param int $decimals    Number of decimal places.
 * @return float The conversion rate as a percentage.
 */
function safe_conversion_rate( int $conversions, int $impressions, int $decimals = 2 ) : float {
	return safe_percentage( $conversions, $impressions, $decimals );
}
