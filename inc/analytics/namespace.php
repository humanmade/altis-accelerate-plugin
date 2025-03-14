<?php
/**
 * Altis Analytics.
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Analytics;

use Altis\Accelerate\Utils;
use Altis\Accelerate\Audiences;

/**
 * Set up the plugin.
 */
function setup() {
	// Handle async scripts.
	add_filter( 'script_loader_tag', __NAMESPACE__ . '\\async_scripts', 20, 2 );
	// Handle nomodule browser scripts.
	add_filter( 'script_loader_tag', __NAMESPACE__ . '\\nomodule_scripts', 20, 2 );
	// Load analytics scripts super early.
	add_action( 'wp_head', __NAMESPACE__ . '\\enqueue_scripts', 0 );
	// Check whether we are previewing a page.
	add_filter( 'altis.analytics.noop', __NAMESPACE__ . '\\check_preview' );
}

/**
 * Filter to check if current page is a preview.
 *
 * @return bool
 */
function check_preview() : bool {
	return is_preview();
}

/**
 * Returns contextual data to be associated with the user's endpoint
 * as well as custom attributes and metrics to record with every
 * analytics event.
 *
 * @uses apply_filters( 'hm.analytics.data.endpoint', $endpoint );
 * @uses apply_filters( 'hm.analytics.data.attributes', $attributes );
 * @uses apply_filters( 'hm.analytics.data', $data );
 *
 * @return array
 */
function get_client_side_data() : array {
	// Initialise data array.
	$data = [
		'Endpoint' => [],
		'AppPackageName' => sanitize_key( get_bloginfo( 'name' ) ),
		'AppVersion' => '',
		'SiteName' => get_bloginfo( 'name' ),
		'Attributes' => [],
		'Metrics' => [],
	];

	if ( is_user_logged_in() ) {
		$user = wp_get_current_user();
		$data['Endpoint']['User'] = [];
		$data['Endpoint']['User']['UserId'] = $user->get( 'ID' );
		$data['Endpoint']['User']['UserAttributes'] = [
			'Roles' => array_keys( $user->caps ),
		];
		// Privacy friendly indicator of status.
		$data['Attributes']['loggedIn'] = true;
	}

	if ( is_front_page() ) {
		$data['Attributes']['frontPage'] = true;
	}

	if ( is_404() ) {
		$data['Attributes']['404'] = true;
	}

	if ( is_singular() ) {
		$data['Attributes']['postType'] = get_queried_object()->post_type;
		$data['Attributes']['postId'] = get_queried_object_id();

		$author = get_user_by( 'id', get_queried_object()->post_author );
		if ( $author ) {
			$data['Attributes']['author'] = $author->get( 'user_nicename' );
			$data['Attributes']['authorId'] = $author->get( 'ID' );
		}
	}

	if ( is_archive() ) {
		$data['Attributes']['archive'] = true;

		if ( is_date() ) {
			$data['Attributes']['archiveType'] = 'date';
			$data['Attributes']['archiveDate'] = get_the_date();
		}

		if ( is_search() ) {
			$data['Attributes']['archiveType'] = 'search';
			$data['Attributes']['search'] = mb_strtolower( get_search_query() );
		}

		if ( is_post_type_archive() ) {
			$data['Attributes']['archiveType'] = get_post_type();
		}

		if ( is_tag() || is_category() || is_tax() ) {
			$data['Attributes']['archiveType'] = get_queried_object()->taxonomy;
			$data['Attributes']['term'] = get_queried_object()->slug;
		}

		if ( is_author() ) {
			$data['Attributes']['archiveType'] = 'author';
			$data['Attributes']['author'] = get_queried_object()->user_nicename;
		}
	}

	$data['Attributes']['blog'] = home_url();
	$data['Attributes']['network'] = network_home_url();
	$data['Attributes']['blogId'] = get_current_blog_id();
	$data['Attributes']['networkId'] = get_current_network_id();

	/**
	 * Filter the custom analytics endpoint/user data.
	 *
	 * @param array $data
	 */
	$data['Endpoint'] = (object) apply_filters( 'altis.analytics.data.endpoint', $data['Endpoint'] );

	/**
	 * Filter the custom analytics attributes to record with all events.
	 *
	 * @param array $data
	 */
	$data['Attributes'] = (object) apply_filters( 'altis.analytics.data.attributes', $data['Attributes'] );

	/**
	 * Filter the custom analytics metrics to record with all events.
	 *
	 * @param array $data
	 */
	$data['Metrics'] = (object) apply_filters( 'altis.analytics.data.metrics', $data['Metrics'] );

	/**
	 * Filter the custom analytics variable data.
	 *
	 * @param array $data
	 */
	$data = apply_filters( 'altis.analytics.data', $data );

	return $data;
}

/**
 * Adds an async attribute to the script tag output.
 *
 * @param string $tag The enqueued HTML script tag.
 * @param string $handle The script handle.
 * @return string The script tag markup.
 */
function async_scripts( string $tag, string $handle ) : string {
	global $wp_scripts;

	if ( ! $wp_scripts->get_data( $handle, 'async' ) || strpos( $tag, 'async' ) !== false ) {
		return $tag;
	}

	$tag = str_replace( '></script>', ' async></script>', $tag );

	return $tag;
}

/**
 * Adds an nomodule attribute to script tag output.
 *
 * @param string $tag The enqueued HTML script tag.
 * @param string $handle The script handle.
 * @return string The script tag markup.
 */
function nomodule_scripts( string $tag, string $handle ) : string {
	global $wp_scripts;

	if ( ! $wp_scripts->get_data( $handle, 'nomodule' ) || strpos( $tag, 'nomodule' ) !== false ) {
		return $tag;
	}

	$tag = str_replace( '></script>', ' nomodule></script>', $tag );

	return $tag;
}

/**
 * Queue up the tracker script and required configuration.
 */
function enqueue_scripts() {
	global $wp_scripts;

	/**
	 * If true prevents any analytics events from actually being sent
	 * to Pinpoint. Useful in situations such as previewing content.
	 *
	 * @param bool $noop Set to true to prevent any analytics events being recorded.
	 */
	$noop = (bool) apply_filters( 'altis.analytics.noop', false );

	/**
	 * Filters whether the consent cookie should be used.
	 *
	 * @param string $consent_enabled If set to true adds support for the WP consent API.
	 */
	$consent_enabled = (bool) apply_filters( 'altis.analytics.consent_enabled', defined( 'WP_CONSENT_API_URL' ) );

	/**
	 * Filters the consent cookie prefix to integrate with the WordPress Consent API.
	 *
	 * @param string $cookie_prefix The consent cookie prefix.
	 */
	$consent_cookie_prefix = apply_filters( 'wp_consent_cookie_prefix', 'wp_consent' );

	/**
	 * Filters always allowed cookie consent categories.
	 *
	 * @param array $consent_always_allowed List of consent categories that are always permitted.
	 */
	$consent_always_allowed = (array) apply_filters( 'altis.consent.always_allow_categories', [
		'functional',
		'statistics-anonymous',
	] );

	/**
	 * Filters whether to exclude bot traffic or not.
	 *
	 * @param string $exclude_bots If set to true allows bots that execute JavaScript to be tracked.
	 */
	$exclude_bots = (bool) apply_filters( 'altis.analytics.exclude_bots', true );

	Utils\register_assets(
		'accelerate',
		[
			'dependencies' => [],
			'in-footer' => false,
		],
		true
	);

	wp_add_inline_script(
		'altis-accelerate-accelerate',
		sprintf(
			'var Altis = Altis || {}; Altis.Analytics = %s;' .
			'Altis.Analytics.onReady = function ( callback ) {' .
				'if ( Altis.Analytics.Ready ) {' .
					'callback();' .
				'} else {' .
					'window.addEventListener( \'altis.analytics.ready\', callback );' .
				'}' .
			'};' .
			'Altis.Analytics.onLoad = function ( callback ) {' .
				'if ( Altis.Analytics.Loaded ) {' .
					'callback();' .
				'} else {' .
					'window.addEventListener( \'altis.analytics.loaded\', callback );' .
				'}' .
			'};',
			wp_json_encode(
				[
					'Ready' => false,
					'Loaded' => false,
					'Consent' => [
						'CookiePrefix' => $consent_cookie_prefix,
						'Enabled' => $consent_enabled,
						'Allowed' => array_values( (array) $consent_always_allowed ),
					],
					'Config' => [
						'PinpointId' => defined( 'ALTIS_ACCELERATE_PINPOINT_ID' ) ? ALTIS_ACCELERATE_PINPOINT_ID : null,
						'PinpointRegion' => defined( 'ALTIS_ACCELERATE_PINPOINT_REGION' ) ? ALTIS_ACCELERATE_PINPOINT_REGION : null,
						'PinpointEndpoint' => defined( 'ALTIS_ACCELERATE_PINPOINT_ENDPOINT' ) ? ALTIS_ACCELERATE_PINPOINT_ENDPOINT : 'https://eu.accelerate.altis.cloud/log',
						'ExcludeBots' => $exclude_bots,
					],
					'Noop' => $noop,
					'Data' => (object) get_client_side_data(),
					'Audiences' => Audiences\get_audience_config(),
				]
			)
		),
		'before'
	);

	// Load async for performance.
	$wp_scripts->add_data( 'altis-accelerate-accelerate', 'async', true );

	/**
	 * Create our own early hook for queueing
	 */
	do_action( 'altis.analytics.enqueue_scripts' );

	// Print queued scripts.
	print_head_scripts();
}
