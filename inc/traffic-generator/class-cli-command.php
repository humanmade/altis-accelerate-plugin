<?php

namespace Altis\Accelerate\Traffic_Generator;

use WP_CLI;
use function Altis\Accelerate\get_config;

class CLI_Command {
	/**
	 * Generates traffic for testing purposes.
	 *
	 * ## OPTIONS
	 *
	 * [--from=<date>]
	 * : Start date for traffic generation (strtotime).
	 *
	 * [--to=<date>]
	 * : End date for traffic generation (strtotime).
	 *
	 * [--posts=<ids>]
	 * : Comma-separated list of post IDs to generate traffic for.
	 *
	 * [--post_types=<types>]
	 * : Comma-separated list of post types to generate traffic for.
	 *
	 * [--user=<id>]
	 * : User ID to generate traffic
	 *
	 * [--batch-size=<number>]
	 * : Number of events to send in each batch (default: 100).
	 *
	 * [--per-user=<number>]
	 * : Number of events per user before creating a new user (default: 10).
	 *
	 * [--event-type=<type>]
	 * : Type of event to generate (default: pageView).
	 *
	 * [--browsers=<browsers>]
	 * : Comma-separated list of browser names to randomize across (default: Firefox).
	 *
	 * [--countries=<countries>]
	 * : Comma-separated list of country codes to randomize across (default: US).
	 *
	 * [--referers=<referers>]
	 * : Comma-separated list of referer URLs to randomize across (default: empty).
	 *
	 * --count=<number>
	 * : Number of requests to simulate.
	 *
	 */
	function posts( $args, $assoc_args ) {
		// Parse arguments
		$count = absint( $assoc_args['count'] ?? 100 );
		$from = $assoc_args['from'] ?? 'yesterday';
		$to = $assoc_args['to'] ?? 'now';
		$posts = isset( $assoc_args['posts'] ) ? array_map( 'absint', explode( ',', $assoc_args['posts'] ) ) : [];
		$user_id = isset( $assoc_args['user'] ) ? absint( $assoc_args['user'] ) : null;
		$batch_size = absint( $assoc_args['batch-size'] ?? 100 );
		$per_user = absint( $assoc_args['per-user'] ?? 10 );
		$post_types = isset( $assoc_args['post_types'] ) ? explode( ',', $assoc_args['post_types'] ) : [ 'post' ];
		$event_type = $assoc_args['event-type'] ?? 'pageView';
		$browsers = isset( $assoc_args['browsers'] ) ? explode( ',', $assoc_args['browsers'] ) : [ 'Firefox' ];
		$countries = isset( $assoc_args['countries'] ) ? explode( ',', $assoc_args['countries'] ) : [ 'US' ];
		$referers = isset( $assoc_args['referers'] ) ? explode( ',', $assoc_args['referers'] ) : [ '' ];

		if ( empty( $assoc_args['event-type'] ) && $post_types === [ 'wp_block' ] ) {
			$event_type = 'blockview';
		}
		// Parse dates
		$start_time = strtotime( $from );
		$end_time = strtotime( $to );

		if ( ! $start_time || ! $end_time ) {
			WP_CLI::error( 'Invalid date format for --from or --to parameters.' );
		}

		if ( $start_time >= $end_time ) {
			WP_CLI::error( 'Start date must be before end date.' );
		}

		// Get config
		$config = get_config();
		if ( ! $config ) {
			WP_CLI::error( 'Altis Accelerate is not configured. Please set up the plugin first.' );
		}

		// Get endpoint URL
		$log_endpoint = defined( 'ALTIS_ACCELERATE_LOG_ENDPOINT' ) ? ALTIS_ACCELERATE_LOG_ENDPOINT : 'https://eu.accelerate.altis.cloud/log';

		// If no posts specified, get a random selection
		if ( empty( $posts ) ) {
			$post_query = new \WP_Query( [
				'post_type' => $assoc_args['post_types'] ? explode( ',', $assoc_args['post_types'] ) : 'post',
				'post_status' => 'publish',
				'posts_per_page' => 50,
				'orderby' => 'rand',
				'fields' => 'ids',
			] );
			$posts = $post_query->posts;
		}

		if ( empty( $posts ) ) {
			WP_CLI::error( 'No posts found to generate traffic for.' );
		}

		WP_CLI::log( sprintf( 'Generating %d traffic events between %s and %s (per-user: %d, batch size: %d, browsers: %s, countries: %s, referers: %s)...', $count, date( 'Y-m-d H:i:s', $start_time ), date( 'Y-m-d H:i:s', $end_time ), $per_user, $batch_size, implode( ', ', $browsers ), implode( ', ', $countries ), implode( ', ', $referers ) ) );

		$progress = WP_CLI\Utils\make_progress_bar( 'Generating traffic', $count );

		// Generate events with per-user batching
		$events_batch = [];
		$events_sent = 0;
		$current_user_uuid = null;
		$events_for_current_user = 0;

		for ( $i = 0; $i < $count; $i++ ) {
			// Generate a random timestamp between start and end
			$timestamp = rand( $start_time, $end_time );

			// Pick a random post
			$post_id = $posts[ array_rand( $posts ) ];
			$post = get_post( $post_id );

			if ( ! $post ) {
				continue;
			}

			// Check if we need a new user (first event or reached per-user limit)
			if ( $current_user_uuid === null || $events_for_current_user >= $per_user ) {
				// Send current batch if it exists
				if ( ! empty( $events_batch ) ) {
					$this->send_events_batch( $log_endpoint, $config['app_id'], $events_batch );
					$events_sent += count( $events_batch );
					$events_batch = [];
				}

				// Create new user
				$current_user_uuid = wp_generate_uuid4();
				$events_for_current_user = 0;
			}

			// Generate post-specific attributes
			$post_attributes = [
				'url' => get_permalink( $post ),
				'title' => $post->post_title,
				'postId' => (string) $post->ID,
				'pageType' => 'single',
			];

			if ( $post->post_type === 'wp_block' ) {
				$post_attributes['blockId'] = $post->ID;
			}

			// Pick a random browser
			$selected_browser = $browsers[ array_rand( $browsers ) ];

			// Pick a random country
			$selected_country = $countries[ array_rand( $countries ) ];

			// Pick a random referer
			$selected_referer = $referers[ array_rand( $referers ) ];

			// Add referer to post attributes
			$post_attributes['referer'] = $selected_referer;

			// Generate event data with the current user UUID
			$event_data = $this->generate_event_data( $timestamp, $post_attributes, $user_id, $current_user_uuid, $event_type, $selected_browser, $selected_country );
			$events_batch[] = $event_data;
			$events_for_current_user++;

			$progress->tick();

			// Send batch when it reaches the batch size or when we've processed all events
			if ( count( $events_batch ) >= $batch_size || $i === $count - 1 ) {
				$this->send_events_batch( $log_endpoint, $config['app_id'], $events_batch );
				$events_sent += count( $events_batch );
				$events_batch = [];

				// Reset user if we sent due to batch size (not end of events)
				if ( $i !== $count - 1 ) {
					$current_user_uuid = null;
					$events_for_current_user = 0;
				}
			}
		}

		$progress->finish();
		WP_CLI::success( sprintf( 'Generated %d traffic events successfully in batches.', $events_sent ) );
	}

	/**
	 * Generate event data for analytics.
	 *
	 * @param int $timestamp The event timestamp.
	 * @param array $dynamic_attributes Additional attributes to merge into the event.
	 * @param int|null $user_id Optional user ID.
	 * @param string|null $user_uuid Optional user UUID to use instead of generating one.
	 * @param string $event_type Event type (default: pageView).
	 * @param string $browser Browser name (default: Firefox).
	 * @param string $country Country code (default: US).
	 * @return array
	 */
	private function generate_event_data( int $timestamp, array $dynamic_attributes = [], ?int $user_id = null, ?string $user_uuid = null, string $event_type = 'pageView', string $browser = 'Firefox', string $country = 'US' ): array {
		// Generate unique IDs
		$event_id = wp_generate_uuid4();
		$user_uuid = $user_uuid ?: wp_generate_uuid4();
		$session_id = wp_generate_uuid4();

		// Build endpoint data similar to get_client_side_data()
		$endpoint = [
			'Attributes' => [
				'DeviceMake' => [ 'Apple' ],
				'DeviceModel' => [ 'Macintosh' ],
				'lastSession' => [ $session_id ],
				'lastPageSession' => [ $session_id ],
			],
			'Demographic' => [
				'AppVersion' => '',
				'Locale' => 'en_us',
				'Make' => 'Gecko',
				'Model' => $browser,
				'ModelVersion' => $this->get_browser_version( $browser ),
				'Platform' => 'Mac OS',
				'PlatformVersion' => '10.15',
			],
			'Location' => [
				'Country' => $country,
			],
			'Metrics' => [
				'sessions' => 1.0,
				'pageViews' => 1.0,
			],
		];

		// Add author info (remove this since it's not in the working format)
		// This would need to be passed in via dynamic_attributes if needed
		// $author = get_user_by( 'id', $post->post_author );
		// if ( $author ) {
		// 	$endpoint['Attributes']['author'] = [ $author->user_nicename ];
		// 	$endpoint['Attributes']['authorId'] = [ (string) $author->ID ];
		// }

		// Add user data if specified (remove this since it's not in the working format)
		if ( $user_id ) {
			$user = get_user_by( 'id', $user_id );
			if ( $user ) {
				$endpoint['User'] = [
					'UserId' => (string) $user->ID,
					'UserAttributes' => [
						'Roles' => array_keys( $user->caps ),
					],
				];
				$endpoint['Attributes']['loggedIn'] = [ 'true' ];
			}
		}

		// Build event structure similar to accelerate.js
		$event = [
			'EventType' => $event_type,
			'Timestamp' => gmdate( 'Y-m-d\TH:i:s.v\Z', $timestamp ), // ISO 8601 format with milliseconds
			'AppPackageName' => sanitize_key( get_bloginfo( 'name' ) ),
			'AppTitle' => get_bloginfo( 'name' ),
			'AppVersionCode' => '',
			'Attributes' => array_merge( [
				'date' => gmdate( 'Y-m-d\TH:i:s.v\Z', $timestamp ),
				'session' => $session_id,
				'pageSession' => $session_id,
				'host' => parse_url( home_url(), PHP_URL_HOST ),
				'queryString' => '',
				'hash' => '',
				'referer' => '',
				'blog' => home_url(),
				'network' => network_home_url(),
				'blogId' => (string) get_current_blog_id(),
				'networkId' => (string) get_current_network_id(),
			], $dynamic_attributes ),
			'Metrics' => [
				'elapsed' => 0,
				'scrollDepthMax' => 0,
				'scrollDepthNow' => 0,
				'hour' => (int) date( 'G', $timestamp ),
				'day' => (int) date( 'N', $timestamp ),
				'month' => (int) date( 'n', $timestamp ),
				'year' => (int) date( 'Y', $timestamp ),
			],
			'Session' => [
				'Id' => $session_id,
				'StartTimestamp' => gmdate( 'Y-m-d\TH:i:s.v\Z', $timestamp ),
			],
		];

		// Return individual event data to be batched later
		return [
			'user_uuid' => $user_uuid,
			'event_id' => $event_id,
			'endpoint' => $endpoint,
			'event' => $event,
		];
	}

	/**
	 * Get a realistic version number for a given browser.
	 *
	 * @param string $browser Browser name.
	 * @return string Browser version.
	 */
	private function get_browser_version( string $browser ): string {
		$versions = [
			'Firefox' => [ '136.0', '135.0', '134.0', '133.0', '132.0' ],
			'Chrome' => [ '131.0', '130.0', '129.0', '128.0', '127.0' ],
			'Safari' => [ '18.1', '18.0', '17.6', '17.5', '17.4' ],
			'Edge' => [ '131.0', '130.0', '129.0', '128.0', '127.0' ],
			'Opera' => [ '115.0', '114.0', '113.0', '112.0', '111.0' ],
		];

		if ( isset( $versions[ $browser ] ) ) {
			return $versions[ $browser ][ array_rand( $versions[ $browser ] ) ];
		}

		// Default version for unknown browsers
		return '1.0';
	}

	/**
	 * Get location data for a given country code.
	 *
	 * @param string $country Country code.
	 * @return array Location data.
	 */
	private function get_country_location( string $country ): array {
		$locations = [
			'US' => [
				'Country' => 'United States',
				'Region' => 'California',
				'City' => 'San Francisco',
				'PostalCode' => '94105',
			],
			'GB' => [
				'Country' => 'United Kingdom',
				'Region' => 'England',
				'City' => 'London',
				'PostalCode' => 'SW1A 1AA',
			],
			'DE' => [
				'Country' => 'Germany',
				'Region' => 'Berlin',
				'City' => 'Berlin',
				'PostalCode' => '10115',
			],
			'FR' => [
				'Country' => 'France',
				'Region' => 'Île-de-France',
				'City' => 'Paris',
				'PostalCode' => '75001',
			],
			'CA' => [
				'Country' => 'Canada',
				'Region' => 'Ontario',
				'City' => 'Toronto',
				'PostalCode' => 'M5H 2N2',
			],
			'AU' => [
				'Country' => 'Australia',
				'Region' => 'New South Wales',
				'City' => 'Sydney',
				'PostalCode' => '2000',
			],
			'JP' => [
				'Country' => 'Japan',
				'Region' => 'Tokyo',
				'City' => 'Tokyo',
				'PostalCode' => '100-0001',
			],
			'IN' => [
				'Country' => 'India',
				'Region' => 'Maharashtra',
				'City' => 'Mumbai',
				'PostalCode' => '400001',
			],
			'BR' => [
				'Country' => 'Brazil',
				'Region' => 'São Paulo',
				'City' => 'São Paulo',
				'PostalCode' => '01310-100',
			],
			'ES' => [
				'Country' => 'Spain',
				'Region' => 'Madrid',
				'City' => 'Madrid',
				'PostalCode' => '28001',
			],
		];

		if ( isset( $locations[ $country ] ) ) {
			return $locations[ $country ];
		}

		// Default location for unknown countries
		return [
			'Country' => 'Unknown',
			'Region' => 'Unknown',
			'City' => 'Unknown',
			'PostalCode' => '00000',
		];
	}

	/**
	 * Send a batch of events to the analytics endpoint.
	 * All events in the batch should belong to the same user.
	 *
	 * @param string $endpoint The analytics endpoint URL.
	 * @param string $app_id The application ID.
	 * @param array $events_batch Array of event data to send.
	 * @return bool
	 */
	private function send_events_batch( string $endpoint, string $app_id, array $events_batch ): bool {
		if ( empty( $events_batch ) ) {
			return true;
		}

		// All events should belong to the same user now
		$first_event = $events_batch[0];
		$user_uuid = $first_event['user_uuid'];

		$events = [];
		foreach ( $events_batch as $event_data ) {
			$event_id = $event_data['event_id'];
			$events[ $event_id ] = $event_data['event'];
		}

		// Build the request structure for a single user
		$batch_item = [
			$user_uuid => [
				'Endpoint' => $first_event['endpoint'],
				'Events' => $events,
			],
		];

		$body = wp_json_encode( [
			'app_id' => $app_id,
			'events' => [
				'BatchItem' => $batch_item,
			],
		] );

		print_r( $batch_item );

		// Debug output removed for cleaner logs
		$response = wp_remote_post( $endpoint, [
			'body' => $body,
			'headers' => [
				'Content-Type' => 'application/json',
			],
			'timeout' => 30,
		] );

		if ( is_wp_error( $response ) ) {
			WP_CLI::warning( sprintf( 'Failed to send batch: %s', $response->get_error_message() ) );
			return false;
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		if ( $response_code < 200 || $response_code >= 300 ) {
			WP_CLI::warning( sprintf( 'Batch send failed with response code: %d %s', $response_code, wp_remote_retrieve_body( $response ) ) );
			return false;
		}

		return true;
	}
}
