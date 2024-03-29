<?php
/**
 * Altis Analytics Data Export Cron Job.
 */

namespace Altis\Accelerate\Export\Cron;

use Altis\Accelerate\Utils;

/**
 * Frequency of the export job
 */
const ALTIS_ACCELERATE_EXPORT_CRON_FREQUENCY = 'ten_minutes';
const ALTIS_ACCELERATE_EXPORT_CRON_FREQUENCY_INTERVAL = 600;

/**
 * Option name to keep last processed file information.
 */
const ALTIS_ACCELERATE_EXPORT_LAST_PROCESSED_KEY = 'altis.analytics.export.last_processed_key';

/**
 * Bootstrap the functionality.
 *
 * @return void
 */
function bootstrap() : void {
	// Do not run during install as we can't add anything to the options table so early.
	if ( defined( 'WP_INSTALLING' ) && WP_INSTALLING ) {
		return;
	}

	// Do not run this unless this is the main site of the main network, to avoid duplication.
	if ( ! is_main_network() || ! is_main_site() ) {
		return;
	}

	/**
	 * Filter to allow disabling the functionality altogether.
	 *
	 * @param bool Whether to enable the data export cron job.
	 */
	if ( ! apply_filters( 'altis.accelerate.export.cron.enabled', true ) ) {
		return;
	}

	// Setup cron interval.
	/* phpcs:ignore WordPress.WP.CronInterval.ChangeDetected */
	add_filter( 'cron_schedules', __NAMESPACE__ . '\setup_cron_interval' );

	// Hook our cron job handler.
	add_action( 'altis.accelerate.export.cron', __NAMESPACE__ . '\cron_handler' );

	// Setup cron schedule.
	add_action( 'admin_footer', __NAMESPACE__ . '\setup_cron_schedule' );
}

/**
 * Schedule data export background task.
 *
 * @return void
 */
function setup_cron_schedule() : void {
	/**
	 * Filter the cron job schedule interval.
	 *
	 * @param string Cron schedule name.
	 */
	$frequency = apply_filters( 'altis.accelerate.export.cron.frequency', ALTIS_ACCELERATE_EXPORT_CRON_FREQUENCY );

	// Setup cron Schedule.
	if ( ! wp_next_scheduled( 'altis.accelerate.export.cron' ) ) {
		wp_schedule_event( time(), $frequency, 'altis.accelerate.export.cron' );
	}
}

/**
 * Add a ten minute cron job interval.
 *
 * @param array $schedules WP Cron intervals.
 *
 * @return array
 */
function setup_cron_interval( $schedules ) : array {
	// If $schedules is null / false etc due to bad-acting 3rd party code, make it an array.
	if ( ! $schedules ) {
		$schedules = [];
	}
	return array_merge( $schedules, [
		ALTIS_ACCELERATE_EXPORT_CRON_FREQUENCY => [
			'interval' => ALTIS_ACCELERATE_EXPORT_CRON_FREQUENCY_INTERVAL,
			'display' => __( 'Altis Analytics Schedule (10 mins)', 'altis' ),
		],
	] );
}

/**
 * Log an event
 *
 * @param string $message Log entry message.
 * @param int    $level   Log entry level.
 *
 * @return void
 */
function log( string $message, int $level = E_USER_NOTICE ) : void {

	trigger_error( $message, $level );

	/**
	 * Trigger custom handling of logs, eg: for external notifications.
	 *
	 * @param string $message Log message.
	 * @param int    $level   Log level, one of PHP error levels.
	 */
	do_action( 'altis.analytics.export.log', $message, $level );
}

/**
 * Cron job handlers.
 *
 * @return void
 */
function cron_handler() : void {

	// Check if anyone is listening.
	$has_handlers = has_action( 'altis.accelerate.export.data.process' );
	if ( ! $has_handlers ) {
		// No takers ? go home early.
		return;
	}

	// Get the files to process.
	$data = get_analytics_data();
	if ( ! isset( $data ) ) {
		return;
	}

	if ( empty( $data ) ) {
		log( 'Warning: Empty analytics data were found.', E_USER_WARNING );
		return;
	}

	$entries = substr_count( $data, "\n" );
	log( sprintf( 'Success: Found %d analytics events, delivering payload to subscribers..', $entries ) );

	/**
	 * Process analytics data exported from S3.
	 *
	 * @param string $data NDJSON data for analytics events since last job run.
	 */
	do_action( 'altis.accelerate.export.data.process', $data );
}

/**
 * Get analytics data from ClickHouse.
 *
 * @return string NDJSON string of analytics data.
 */
function get_analytics_data() : ? string {
	// Check the last processed file key.
	$last_processed_key = get_option( ALTIS_ACCELERATE_EXPORT_LAST_PROCESSED_KEY, 0 );

	/**
	 * Limit the query to X number of rows, in case the last timestamp isn't found.
	 *
	 * @param int Number of files to limit the query to.
	 */
	$max_rows = apply_filters( 'altis.accelerate.export.cron.max_rows', 15000 );

	// Increase the timeout for this large request.
	add_filter( 'altis.accelerate.clickhouse_request_args', function ( array $args ) : array {
		$args['timeout'] = ALTIS_ACCELERATE_EXPORT_CRON_FREQUENCY_INTERVAL;
		return $args;
	} );

	// Fetch max timestamp for next batch.
	$next_processed = Utils\query(
		'SELECT toUnixTimestamp64Milli(max(event_timestamp)) as `key` FROM analytics
			WHERE event_timestamp >= toDateTime64(intDiv({last_key:UInt64},1000),3)
			ORDER BY event_timestamp ASC LIMIT {max_rows:UInt64}',
		[
			'last_key' => $last_processed_key ?: 0,
			'max_rows' => $max_rows,
		],
		'object'
	);

	if ( is_wp_error( $next_processed ) ) {
		// Log the error.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		log( 'Error: Could not fetch max date for next analytics data export batch. Got: ' . $next_processed->get_error_message(), E_USER_ERROR );
		return null;
	}

	$next_processed_key = (int) $next_processed->key;

	// Fetch batch of NDJSON.
	$result = Utils\query(
		'SELECT * FROM analytics
			WHERE event_timestamp >= toDateTime64(intDiv({last_key:UInt64},1000),3) AND event_timestamp < toDateTime64(intDiv({next_key:UInt64},1000),3)
			ORDER BY event_timestamp ASC LIMIT {max_rows:UInt16}',
		[
			'last_key' => $last_processed_key,
			'next_key' => $next_processed_key,
			'max_rows' => $max_rows,
		],
		'raw'
	);

	if ( is_wp_error( $result ) ) {
		// Log the error.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		log( 'Error: Could not fetch list of analytics data files. Got: ' . $result->get_error_message(), E_USER_ERROR );
		return null;
	}

	// Nothing more to do if there's nothing to fetch.
	if ( empty( $result ) ) {
		log( 'Warning: No analytics data files were found, consider increasing the interval of the data export via the `altis.accelerate.export.cron.frequency` filter.', E_USER_WARNING );
		return null;
	}

	// Update last processed key.
	if ( $next_processed_key ) {
		update_option( ALTIS_ACCELERATE_EXPORT_LAST_PROCESSED_KEY, $next_processed_key );
	}

	return $result;
}
