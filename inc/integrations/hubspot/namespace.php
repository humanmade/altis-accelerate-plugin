<?php
/**
 * HubSpot integration.
 *
 * Captures three client-side HubSpot signals — form submissions, marketing
 * email arrivals and chat engagement — as Accelerate events and durable
 * endpoint attributes, making each a targetable audience criterion. Signal
 * capture is purely client-side; an optional private app token powers a
 * server-side ID → name directory sync so audience values read as asset
 * names rather than GUIDs.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\Integrations\HubSpot;

use Altis\Accelerate\Audiences;
use Altis\Accelerate\Utils;
use WP_REST_Request;
use WP_REST_Server;

const OPTION_ENABLED = 'accelerate_hubspot_enabled';
const OPTION_TOKEN = 'accelerate_hubspot_token';
const OPTION_DIRECTORIES = 'accelerate_hubspot_directories';
const CRON_HOOK = 'altis.accelerate.hubspot.sync';

// Cap directory entries localized to the client so the inline config can't
// balloon on portals with thousands of marketing emails.
const DIRECTORY_CAP = 500;

/**
 * Set up the HubSpot integration.
 *
 * The settings/REST surface is always available (so the feature can be
 * enabled); signal capture, audience fields and the directory sync only
 * activate when the setting is on.
 *
 * @return void
 */
function setup() : void {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_routes' );

	// Keep the cron schedule in step with the setting.
	add_action( 'update_option_' . OPTION_ENABLED, __NAMESPACE__ . '\\handle_enabled_change', 10, 2 );
	add_action( 'add_option_' . OPTION_ENABLED, function ( $option, $value ) {
		handle_enabled_change( false, $value );
	}, 10, 2 );

	if ( ! is_enabled() ) {
		return;
	}

	// After the default audience field maps (init priority 10).
	add_action( 'init', __NAMESPACE__ . '\\register_audience_fields', 11 );

	add_action( CRON_HOOK, __NAMESPACE__ . '\\sync_directories' );
	if ( ! wp_next_scheduled( CRON_HOOK ) ) {
		wp_schedule_event( time(), 'daily', CRON_HOOK );
	}

	// Fires within the front-end tracker's wp_head print, after the main
	// tracker script is registered.
	add_action( 'altis.analytics.enqueue_scripts', __NAMESPACE__ . '\\enqueue_scripts' );
}

/**
 * Whether the HubSpot integration is enabled via settings.
 *
 * @return bool
 */
function is_enabled() : bool {
	return (bool) get_option( OPTION_ENABLED, false );
}

/**
 * Get the stored private app access token.
 *
 * @return string Empty string when not configured.
 */
function get_token() : string {
	return (string) get_option( OPTION_TOKEN, '' );
}

/**
 * Get the synced ID → name directories.
 *
 * @return array { forms: array, emails: array, synced_at: ?int, error: ?string }
 */
function get_directories() : array {
	$directories = get_option( OPTION_DIRECTORIES, [] );
	return wp_parse_args( is_array( $directories ) ? $directories : [], [
		'forms' => [],
		'emails' => [],
		'synced_at' => null,
		'error' => null,
	] );
}

/**
 * Schedule or clear the sync cron when the setting changes.
 *
 * @param mixed $old_value Previous option value.
 * @param mixed $value New option value.
 * @return void
 */
function handle_enabled_change( $old_value, $value ) : void {
	if ( $value ) {
		if ( ! wp_next_scheduled( CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', CRON_HOOK );
		}
		return;
	}
	wp_clear_scheduled_hook( CRON_HOOK );
}

/**
 * Per-signal configuration.
 *
 * No UI — sites wanting e.g. forms but not chat tracking can filter.
 *
 * @return array { forms: bool, email: bool, chat: bool }
 */
function get_signals() : array {
	/**
	 * Filters which HubSpot signals are captured.
	 *
	 * @param array $signals Map of signal name to enabled state.
	 */
	$signals = (array) apply_filters( 'altis.accelerate.hubspot.signals', [
		'forms' => true,
		'email' => true,
		'chat' => true,
	] );

	return array_map( 'boolval', $signals );
}

/**
 * Register the HubSpot endpoint attributes as audience fields.
 *
 * Names (not IDs) are registered for targeting — the client writes parallel
 * `*_ids` attributes for stability/debugging, but marketers build audiences
 * on readable values. Value suggestions in the audience editor come from the
 * existing distinct-values query for array fields.
 *
 * @return void
 */
function register_audience_fields() : void {
	Audiences\register_field( 'endpoint.Attributes.hubspot_forms_submitted', __( 'HubSpot forms submitted', 'altis' ), [
		'column' => 'endpoint_attributes[\'hubspot_forms_submitted\']',
		'description' => __( 'HubSpot forms a visitor has ever submitted, by form name.', 'altis' ),
		'array' => true,
	] );
	Audiences\register_field( 'endpoint.Attributes.hubspot_emails_arrived', __( 'HubSpot email arrivals', 'altis' ), [
		'column' => 'endpoint_attributes[\'hubspot_emails_arrived\']',
		'description' => __( 'HubSpot marketing emails a visitor has ever arrived from, by email name.', 'altis' ),
		'array' => true,
	] );
	Audiences\register_field( 'endpoint.Attributes.hubspot_chat_engaged', __( 'HubSpot chat engagement', 'altis' ), [
		'column' => 'endpoint_attributes[\'hubspot_chat_engaged\']',
		'description' => __( 'Whether a visitor has ever started a conversation with the HubSpot chat widget.', 'altis' ),
		'array' => true,
	] );
}

/**
 * Enqueue the HubSpot signals bundle alongside the tracker.
 *
 * Only called when the integration is enabled — when disabled neither the
 * script nor its config exist in the page at all.
 *
 * @return void
 */
function enqueue_scripts() : void {
	$handles = Utils\register_assets(
		'hubspot',
		[
			'dependencies' => [ 'altis-accelerate-accelerate' ],
			'in-footer' => false,
		],
		true
	);

	if ( empty( $handles['script'] ) ) {
		return;
	}

	$directories = get_directories();

	wp_add_inline_script(
		$handles['script'],
		sprintf(
			'var Altis = Altis || {}; Altis.Analytics = Altis.Analytics || {};' .
			'Altis.Analytics.Integrations = Altis.Analytics.Integrations || {};' .
			'Altis.Analytics.Integrations.HubSpot = %s;',
			wp_json_encode( [
				'Signals' => get_signals(),
				'FormDirectory' => (object) array_slice( $directories['forms'], 0, DIRECTORY_CAP, true ),
				'EmailDirectory' => (object) array_slice( $directories['emails'], 0, DIRECTORY_CAP, true ),
			] )
		),
		'before'
	);
}

/**
 * Register REST routes for the manual sync trigger.
 *
 * @return void
 */
function register_routes() : void {
	register_rest_route( 'accelerate/v1', 'hubspot/sync', [
		[
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => __NAMESPACE__ . '\\handle_sync_request',
			'permission_callback' => function () : bool {
				return current_user_can( 'manage_options' );
			},
		],
	] );
}

/**
 * Handle a manual directory sync request.
 *
 * @param WP_REST_Request $request The REST request.
 * @return \WP_REST_Response|\WP_Error
 */
function handle_sync_request( WP_REST_Request $request ) {
	if ( ! get_token() ) {
		return new \WP_Error( 'hubspot.no_token', __( 'Add a HubSpot private app token before syncing.', 'altis' ), [ 'status' => 400 ] );
	}

	sync_directories();

	return rest_ensure_response( get_sync_status() );
}

/**
 * Sync status summary for the settings UI.
 *
 * @return array
 */
function get_sync_status() : array {
	$directories = get_directories();

	return [
		'synced_at' => $directories['synced_at'],
		'form_count' => count( $directories['forms'] ),
		'email_count' => count( $directories['emails'] ),
		'error' => $directories['error'],
	];
}

/**
 * Sync the form and email ID → name directories from HubSpot.
 *
 * A failed fetch for either directory keeps the last-good map for that
 * directory and records the error; raw-ID capture continues regardless.
 *
 * @return void
 */
function sync_directories() : void {
	$token = get_token();
	if ( ! $token ) {
		return;
	}

	$existing = get_directories();
	$error = null;

	$forms = fetch_forms_directory( $token );
	if ( is_wp_error( $forms ) ) {
		$error = $forms->get_error_message();
		$forms = $existing['forms'];
	}

	$emails = fetch_emails_directory( $token );
	if ( is_wp_error( $emails ) ) {
		$error = $error ? $error . '; ' . $emails->get_error_message() : $emails->get_error_message();
		$emails = $existing['emails'];
	}

	update_option( OPTION_DIRECTORIES, [
		'forms' => $forms,
		'emails' => $emails,
		'synced_at' => time(),
		'error' => $error,
	], false );
}
