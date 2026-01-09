<?php
/**
 * Altis Product Telemetry.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\Telemetry;

use Altis\Accelerate;
use Altis\Accelerate\Blocks;
use Segment\Segment;
use WP_REST_Request;
use WP_REST_Server;
use WP_User;

const ACTION_OPT_IN = 'altis_tracking_opt_in';
const META_OPT_IN = 'altis_tracking_opt_in';
const SEGMENT_ID = '3iYB0mSdukHIgcvgVC1znVCCIpWN5m2J';
const API_NAMESPACE = 'accelerate/v1';

/**
 * Register hooks.
 *
 * @return void
 */
function bootstrap() {
	// Do not run on CI.
	if ( getenv( 'CI' ) || ( defined( 'CI' ) && CI ) ) {
		return;
	}

	add_action( 'admin_init', __NAMESPACE__ . '\\handle_opt_in_form' );
	add_action( 'admin_head', __NAMESPACE__ . '\\load_segment_js' );
	add_action( 'admin_footer', __NAMESPACE__ . '\\render_identity_tag' );
	add_action( 'in_admin_header', __NAMESPACE__ . '\\render_opt_in_form' );
	add_action( 'profile_personal_options', __NAMESPACE__ . '\\user_profile_options' );
	add_action( 'personal_options_update', __NAMESPACE__ . '\\handle_profile_form' );

	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_api_routes' );

	// Content event tracking.
	add_action( 'save_post', __NAMESPACE__ . '\\track_new_or_updated_content', 10, 3 );
}

/**
 * Get the segment ID for tracking.
 *
 * @return string
 */
function get_segment_id() : string {
	if ( defined( 'ALTIS_SEGMENT_ID' ) ) {
		return ALTIS_SEGMENT_ID;
	}
	return SEGMENT_ID;
}

/**
 * Initialize segment.io.
 *
 * @return bool True if Segment has initialised successfully.
 */
function initialize() : bool {
	static $initialized;

	// Run once.
	if ( is_bool( $initialized ) ) {
		return $initialized;
	}

	// Do not run during imports.
	if ( defined( 'WP_IMPORTING' ) && WP_IMPORTING ) {
		$initialized = false;
		return $initialized;
	}

	if ( ! is_user_logged_in() ) {
		$initialized = false;
		return $initialized;
	}

	// Connect.
	Segment::init( get_segment_id() );

	// Identify the site (not user - site-level identity).
	$site = get_segmentio_user_details();
	$context = get_segment_context();

	if ( ! $site['opt_in'] ) {
		Segment::identify( [
			'anonymousId' => $site['id'],
			'context' => $context,
		] );
	} else {
		Segment::identify( [
			'userId' => $site['id'],
			'traits' => $site['traits'],
			'context' => $context,
		] );
	}

	// Note: Segment::group() removed - with site-level identity, the site IS the user.
	// Group analytics not needed and not available on Mixpanel free plan.

	$initialized = true;
	return $initialized;
}

/**
 * Track an event in Segment.io.
 *
 * @param array $message The event details.
 * @return void
 */
function track( array $message ) {
	if ( ! initialize() ) {
		return;
	}

	// Add user ID if missing.
	if ( ! isset( $message['userId'] ) ) {
		$user = get_segmentio_user_details();
		$message['userId'] = $user['id'];
	}

	// Add context with client IP for correct geolocation.
	if ( ! isset( $message['context'] ) ) {
		$message['context'] = [];
	}
	$message['context'] = array_merge( get_segment_context(), $message['context'] );

	// Add domain to event properties for visibility in event lists.
	if ( ! isset( $message['properties'] ) ) {
		$message['properties'] = [];
	}
	if ( ! isset( $message['properties']['domain'] ) ) {
		$message['properties']['domain'] = get_normalized_domain();
	}

	Segment::track( $message );
}

/**
 * Check if the site has opted in to tracking.
 *
 * Uses site-level consent (option) rather than per-user consent.
 * On first check, migrates any existing user consent to site-level.
 *
 * @return boolean|null Null if never been asked, true/false otherwise.
 */
function is_site_opted_in() : ?bool {
	$site_opt_in = get_option( 'accelerate_telemetry_enabled', null );

	// If site option exists, use it.
	if ( $site_opt_in !== null ) {
		return (bool) $site_opt_in;
	}

	// Migration: Check if ANY user previously opted in.
	global $wpdb;
	$any_opted_in = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT COUNT(*) FROM $wpdb->usermeta WHERE meta_key = %s AND meta_value = '1' LIMIT 1",
			META_OPT_IN
		)
	);

	if ( $any_opted_in > 0 ) {
		// Migrate: At least one user opted in, so site is opted in.
		update_option( 'accelerate_telemetry_enabled', true );
		return true;
	}

	// Check if any user explicitly opted out (vs never asked).
	$any_responded = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT COUNT(*) FROM $wpdb->usermeta WHERE meta_key = %s LIMIT 1",
			META_OPT_IN
		)
	);

	if ( $any_responded > 0 ) {
		// Someone responded but all said no.
		update_option( 'accelerate_telemetry_enabled', false );
		return false;
	}

	// No one has ever been asked.
	return null;
}

/**
 * Check user has opted in to tracking.
 *
 * @deprecated Use is_site_opted_in() for site-level consent.
 * @param WP_User|null $user Current user object if available.
 * @return boolean|null
 */
function is_user_opted_in( ?WP_User $user = null ) : ?bool {
	// Now delegates to site-level consent.
	return is_site_opted_in();
}

/**
 * Return an automatic, pseudo-anonymous ID for the current user.
 *
 * @return string
 */
function get_anonymous_id() : string {
	$current_user = wp_get_current_user();
	return substr( sha1( $current_user->ID . $current_user->user_registered ), 0, 8 );
}

/**
 * Return a known ID for the current user.
 *
 * @deprecated Use get_site_id() for site-level identity.
 * @return string
 */
function get_id() : string {
	return get_site_id();
}

/**
 * Normalize a domain for consistent site identification.
 *
 * Strips protocol, www prefix, trailing slashes, and converts to lowercase.
 * Preserves subdomains (e.g., staging.alpha.tld remains distinct from alpha.tld).
 * For subdirectory installs, includes the path to differentiate sites.
 * For localhost variants, replaces with a fun persistent identifier.
 *
 * @return string Normalized domain string (e.g., "example.com", "staging.example.com", or "local-feral-quantum-axolotl").
 */
function get_normalized_domain() : string {
	$site_url = get_site_url();

	// Parse URL and extract host.
	$parsed = wp_parse_url( $site_url );
	$host = $parsed['host'] ?? $site_url;

	// Remove www prefix (but keep other subdomains like staging.example.com).
	$host = preg_replace( '/^www\./i', '', $host );

	// Convert to lowercase.
	$host = strtolower( $host );

	// For localhost variants, use the fun persistent identifier instead.
	if ( is_localhost( $host ) ) {
		$local_id = get_local_install_id();
		if ( $local_id ) {
			return $local_id;
		}
	}

	// Add path for subdirectory installs (excluding trailing slash).
	if ( ! empty( $parsed['path'] ) && $parsed['path'] !== '/' ) {
		$host .= rtrim( $parsed['path'], '/' );
	}

	return $host;
}

/**
 * Get the site-level identifier for analytics.
 *
 * Returns a SHA-256 hash of the normalized domain for privacy.
 * This is the primary identifier used for all Mixpanel tracking.
 *
 * @return string 64-character hexadecimal hash.
 */
function get_site_id() : string {
	return hash( 'sha256', get_normalized_domain() );
}

/**
 * Get site-level traits for analytics identification.
 *
 * These traits are sent with Segment identify() calls to build the site profile.
 *
 * @return array<string, mixed> Site traits for Segment identify call.
 */
function get_site_traits() : array {
	global $wp_version;

	$domain = get_normalized_domain();
	$site_url = get_site_url();
	$parsed = wp_parse_url( $site_url );
	$host = $parsed['host'] ?? '';

	// Determine if this is a local/test site (for filtering in analytics).
	$is_internal = is_localhost( $host ) || strpos( $domain, 'local-' ) === 0;

	$traits = [
		'domain'            => $domain,
		'site_name'         => get_bloginfo( 'name' ),
		'environment'       => wp_get_environment_type(),
		'multisite'         => is_multisite(),
		'plugin_version'    => Accelerate\VERSION,
		'wordpress_version' => $wp_version,
		'php_version'       => PHP_VERSION,
		'locale'            => get_locale(),
		'is_internal'       => $is_internal,
		'is_connected'      => ! empty( Accelerate\get_accelerate_dashboard_access_token() ),
	];

	/**
	 * Filter site traits delivered to segment.io.
	 *
	 * @param array $traits Site traits to send to Segment.io.
	 */
	$traits = (array) apply_filters( 'altis.telemetry.site_traits', $traits );

	return $traits;
}

/**
 * Get details for Segment identify call.
 *
 * Returns site-level identity instead of user-level identity.
 * The site is the customer, not individual WordPress users.
 *
 * @return array{id: string, opt_in: bool, traits?: array<string, mixed>}
 */
function get_segmentio_user_details() : array {
	$current_user = wp_get_current_user();
	$did_opt_in = is_user_opted_in( $current_user );

	// Site ID is always the same regardless of which WP user is logged in.
	$site_id = get_site_id();

	if ( ! $did_opt_in ) {
		return [
			'id' => $site_id,
			'opt_in' => false,
		];
	}

	return [
		'id' => $site_id,
		'opt_in' => true,
		'traits' => get_site_traits(),
	];
}

/**
 * Check if a host is a localhost variant.
 *
 * Detects localhost, 127.0.0.1, ::1, *.local, *.test, and other local dev patterns.
 *
 * @param string $host The host to check.
 * @return bool True if the host is a localhost variant.
 */
function is_localhost( string $host ) : bool {
	$host = strtolower( $host );

	// Direct localhost matches.
	$localhost_hosts = [
		'localhost',
		'127.0.0.1',
		'::1',
		'0.0.0.0',
	];

	if ( in_array( $host, $localhost_hosts, true ) ) {
		return true;
	}

	// Local development TLD patterns.
	$local_patterns = [
		'/\.local$/',
		'/\.test$/',
		'/\.localhost$/',
		'/\.dev$/',        // Common local dev TLD.
		'/\.ddev\.site$/', // DDEV local dev.
		'/\.lndo\.site$/', // Lando local dev.
	];

	foreach ( $local_patterns as $pattern ) {
		if ( preg_match( $pattern, $host ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Generate a fun Twitch-style local identifier.
 *
 * Creates a memorable name in the format: local-{vibe}-{modifier}-{creature}
 *
 * @return string A fun local identifier like "local-feral-quantum-axolotl".
 */
function generate_fun_local_id() : string {
	$vibes = [
		'feral', 'unhinged', 'paranoid', 'forbidden', 'deranged', 'cosmic', 'rabid',
		'sentient', 'haunted', 'caffeinated', 'malfunctioning', 'vengeful',
		'legallydistinct', 'governmentissued', 'possessed', 'glitched', 'volatile',
		'irradiated', 'delusional', 'manic', 'erratic', 'ominous', 'restless',
		'unstable', 'corrupted', 'fractured', 'rogue', 'mutated', 'anomalous',
		'chaotic', 'cursed', 'hyperactive', 'insomniac', 'distorted', 'hallucinating',
		'sentinel', 'derelict', 'unlicensed', 'unregulated', 'toxic', 'cryptic',
		'nocturnal', 'ferocious', 'obsessive', 'reckless', 'infected', 'synthetic',
		'primal', 'warped',
	];

	$modifiers = [
		'turbo', 'quantum', 'nuclear', 'laser', 'bioengineered', 'bootleg', 'cursed',
		'unstable', 'encrypted', 'blackmarket', 'offbrand', 'militarygrade',
		'interdimensional', 'radioactive', 'mechanized', 'weaponized', 'volatile',
		'sentinel', 'orbital', 'prototype', 'classified', 'experimental', 'synthetic',
		'holographic', 'nanotech', 'plasma', 'forbidden', 'arcane', 'occult',
		'industrial', 'salvaged', 'corrupted', 'fractured', 'overclocked', 'autonomous',
		'reinforced', 'clandestine', 'illegal', 'ferrous', 'tactical', 'ballistic',
		'subterranean', 'derelict', 'chaos', 'volatilecore', 'hyperdrive', 'darkmatter',
		'anomalous',
	];

	$creatures = [
		'axolotl', 'mantis', 'pangolin', 'narwhal', 'eel', 'sloth', 'emu', 'ibis',
		'ayeaye', 'blobfish', 'molerat', 'raccoon', 'lemur', 'gecko', 'salamander',
		'tardigrade', 'gremlin', 'goblin', 'homunculus', 'cryptid', 'skinwalker',
		'wyrm', 'chimera', 'imp', 'basilisk', 'leviathan', 'manticore', 'harpy',
		'gargoyle', 'kelpie', 'wendigo', 'kraken', 'poltergeist', 'specter',
		'apparition', 'slime', 'ooze', 'mimic', 'parasite', 'larva', 'amoeba',
		'cephalopod', 'isopod', 'centipede', 'millipede', 'scorpion', 'tarantula',
		'urchin', 'lamprey',
	];

	// phpcs:ignore WordPress.WP.AlternativeFunctions.rand_mt_rand
	$vibe = $vibes[ mt_rand( 0, count( $vibes ) - 1 ) ];
	// phpcs:ignore WordPress.WP.AlternativeFunctions.rand_mt_rand
	$modifier = $modifiers[ mt_rand( 0, count( $modifiers ) - 1 ) ];
	// phpcs:ignore WordPress.WP.AlternativeFunctions.rand_mt_rand
	$creature = $creatures[ mt_rand( 0, count( $creatures ) - 1 ) ];

	return "local-{$vibe}-{$modifier}-{$creature}";
}

/**
 * Get a unique ID for a local development environment.
 *
 * Generates a persistent, fun identifier for local environments.
 * Format: local-{vibe}-{modifier}-{creature} (e.g., "local-feral-quantum-axolotl")
 *
 * @return string|null Null for non-local environments, fun identifier otherwise.
 */
function get_local_install_id() : ?string {
	$site_url = get_site_url();
	$parsed = wp_parse_url( $site_url );
	$host = $parsed['host'] ?? '';

	// Only generate local IDs for actual localhost variants.
	if ( ! is_localhost( $host ) ) {
		return null;
	}

	// Check for existing persistent ID.
	$id = get_network_option( null, 'accelerate_telemetry_site_id', null );
	if ( ! empty( $id ) ) {
		return $id;
	}

	// Generate a new fun local identifier.
	$generated = generate_fun_local_id();
	update_network_option( null, 'accelerate_telemetry_site_id', $generated );

	return $generated;
}

/**
 * Build the Segment context object.
 *
 * Note: We intentionally do NOT include client IP to avoid collecting PII.
 * Segment/Mixpanel will infer geolocation from the request origin server-side.
 *
 * @see https://segment.com/docs/connections/spec/common/#context
 *
 * @return array Context object for Segment calls.
 */
function get_segment_context() : array {
	return [];
}

/**
 * Get current Altis environment details.
 *
 * @return array
 */
function get_environment_details() : array {
	$id = defined( 'HM_ENV' ) ? HM_ENV : get_site_url();
	$type = wp_get_environment_type();
	if ( $type === 'local' ) {
		// Create distinct_id (important for Mixpanel).
		$id = get_local_install_id();
	}

	$traits = [
		'site_name' => get_site_option( 'site_name', get_option( 'blogname', '' ) ),
		'environment' => $type,
		'domain' => get_site_url(),
		'multisite' => is_multisite(),
		'feature_tier' => defined( 'ALTIS_FEATURE_TIER' ) ? ALTIS_FEATURE_TIER : 'free',
		'environment_tier' => defined( 'ALTIS_ENVIRONMENT_TIER' ) ? ALTIS_ENVIRONMENT_TIER : 'free',
		'support_tier' => defined( 'ALTIS_SUPPORT_TIER' ) ? ALTIS_SUPPORT_TIER : 'free',
		'version' => Accelerate\VERSION,
	];

	/**
	 * Filter environment traits delivered to segment.io.
	 *
	 * @param array $traits Environment traits to send to Segment.io.
	 */
	$traits = (array) apply_filters( 'altis.telemetry.env_traits', $traits );

	return [
		'id' => $id,
		'traits' => $traits,
	];
}

/**
 * Load segment.io JS.
 *
 * @return void
 */
function load_segment_js() {
	global $pagenow;
	$domain = get_normalized_domain();
	?>
	<script>
		// Expose domain globally for trackEvent calls (must be before JS bundles load).
		window.accelerateTelemetryDomain = <?php echo wp_json_encode( $domain ); ?>;

		// Segment - Load
		!function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey="<?php echo esc_js( get_segment_id() ); ?>";analytics.SNIPPET_VERSION="4.13.2";
			analytics.load( <?php echo wp_json_encode( get_segment_id() ) ?> );
			analytics.page( "<?php echo esc_js( $pagenow ); ?>", { domain: <?php echo wp_json_encode( $domain ); ?> } );
		}}();
	</script>
	<?php
}

/**
 * Identify user to segment.io.
 *
 * @return void
 */
function render_identity_tag() {
	$user = get_segmentio_user_details();
	?>
	<script>
		(function () {
			var segment_user = <?php echo wp_json_encode( $user ) ?>;
			if ( ! segment_user.opt_in ) {
				analytics.setAnonymousId( segment_user.id );
			} else {
				analytics.identify( segment_user.id, segment_user.traits );
			}
		})();
	</script>
	<?php
}

/**
 * Opt in or out of tracking.
 *
 * Consent is now stored at the site level (option) to match site-level identity.
 * One admin decision applies to all users on the site.
 *
 * @param boolean $did_opt_in If true will opt the site in.
 * @param WP_User|null $user Deprecated, ignored. Kept for backwards compatibility.
 * @param string $consent_source Source of consent change: 'banner', 'profile', 'settings', or 'api'.
 * @return void
 */
function opt_in( bool $did_opt_in, ?WP_User $user = null, string $consent_source = 'banner' ) {
	$previous_status = is_site_opted_in();

	// Store consent at site level.
	update_option( 'accelerate_telemetry_enabled', $did_opt_in );

	if ( $did_opt_in ) {
		if ( ! initialize() ) {
			return;
		}

		// Re-identify site with full traits on opt-in.
		$site_details = get_segmentio_user_details();
		Segment::identify( [
			'userId' => $site_details['id'],
			'traits' => $site_details['traits'],
			'context' => get_segment_context(),
		] );

		// Track opt-in event.
		track( [
			'event' => 'Telemetry Opted In',
			'properties' => [
				'consent_source' => $consent_source,
				'source' => 'plugin',
			],
		] );
	} elseif ( $previous_status === true ) {
		// Track opt-out if previously opted in.
		track( [
			'event' => 'Telemetry Opted Out',
			'properties' => [
				'previous_status' => 'opted_in',
				'revoke_source' => $consent_source,
				'source' => 'plugin',
			],
		] );
	}

	// Note: Segment::alias() removed - not needed with site-level identity.
	// Modern Mixpanel uses identify() for identity management.
}

/**
 * Display the UI for opting in / out of telemetry.
 *
 * @return void
 */
function render_opt_in_form() {
	$user = wp_get_current_user();

	// Don't render if the site has already made a decision.
	if ( ! is_null( is_site_opted_in() ) ) {
		return;
	}

	?>
	<div class="welcome altis-telemetry-opt-in">
		<h2><?php echo esc_html( sprintf( __( 'Hi %s!', 'altis' ), $user->display_name ) ); ?></h2>
		<p><?php esc_html_e( 'Help us build features you actually need! By sharing how your site uses Accelerate, you help us prioritize improvements and provide better support.', 'altis' ); ?></p>
		<p><?php esc_html_e( 'We only collect site-level usage patterns — never personal data, content, or anything about your visitors.', 'altis' ); ?></p>
		<form method="post" action="">
			<?php wp_nonce_field( 'altis_telemetry_opt_in' ); ?>
			<input type="submit" name="altis_telemetry_opt_in" class="button button-primary" value="<?php esc_attr_e( 'Yes, help improve Accelerate', 'altis' ); ?>" />
			<input type="submit" name="altis_telemetry_opt_out" class="button button-secondary" value="<?php esc_attr_e( 'Not right now', 'altis' ); ?>" />
		</form>
		<p><small><?php esc_html_e( 'You can change this anytime in Accelerate → Settings.', 'altis' ); ?></small></p>
	</div>
	<?php
}

/**
 * Fires after the 'About the User' settings table on the 'Edit User' screen.
 *
 * @param WP_User $user The current WP_User object.
 */
function user_profile_options( WP_User $user ) : void {
	?>
	<table class="form-table">
		<tr>
			<th>
				<label for="altis_telemetry_opt_in"><?php esc_html_e( 'Accelerate Analytics', 'altis' ); ?></label>
			</th>
			<td>
				<input type="checkbox" name="altis_telemetry_opt_in_toggle" id="altis_telemetry_opt_in" <?php checked( is_site_opted_in() ) ?> value="1" />
				<label for="altis_telemetry_opt_in"><?php esc_html_e( 'Help improve Accelerate by sharing site usage data', 'altis' ); ?></label>
				<p class="description"><?php esc_html_e( 'We collect how your site uses Accelerate features — never personal data or content. This is a site-wide setting.', 'altis' ); ?></p>
			</td>
		</tr>
	</table>
	<?php
}

/**
 * Handle opt in form submission.
 *
 * @return void
 */
function handle_opt_in_form() {
	if ( isset( $_POST['altis_telemetry_opt_in'] ) && check_admin_referer( 'altis_telemetry_opt_in' ) ) {
		opt_in( true );
	}
	if ( isset( $_POST['altis_telemetry_opt_out'] ) && check_admin_referer( 'altis_telemetry_opt_in' ) ) {
		opt_in( false );
	}
}

/**
 * Handle user profile opt in field.
 *
 * @param int $user_id The ID of the current user.
 * @return void
 */
function handle_profile_form( int $user_id ) {
	if ( ! check_admin_referer( 'update-user_' . $user_id ) ) {
		return;
	}

	if ( isset( $_POST['altis_telemetry_opt_in_toggle'] ) ) {
		opt_in( true, null, 'profile' );
	} else {
		opt_in( false, null, 'profile' );
	}
}

/**
 * Register the welcome and tracking opt in API route.
 *
 * @return void
 */
function register_api_routes() {
	register_rest_route( API_NAMESPACE, '/telemetry', [
		'methods' => WP_REST_Server::EDITABLE,
		'permission_callback' => function () {
			return is_user_logged_in();
		},
		'callback' => __NAMESPACE__ . '\\handle_telemetry_endpoint',
		'args' => [
			'opt_in' => [
				'type' => 'boolean',
				'default' => false,
			],
		],
	] );
}

/**
 * Handle telemetry API request.
 *
 * @param WP_REST_Request $request The welcome APi reequest object.
 * @return array
 */
function handle_telemetry_endpoint( WP_REST_Request $request ) {
	$current_user = wp_get_current_user();
	$did_opt_in = $request['opt_in'];
	opt_in( $did_opt_in, null, 'api' );

	$data = [
		'id' => $current_user->ID,
		'tracking' => [
			'opt_in' => $did_opt_in,
		],
	];

	if ( $did_opt_in ) {
		$data['tracking_data'] = get_segmentio_user_details();
	}

	return $data;
}

/**
 * Push post save events we're interested in to Segment.
 *
 * @param int $post_id The saved post ID.
 * @param WP_Post $post The post object.
 * @param bool $update True if this is an update and not an insert.
 * @return void
 */
function track_new_or_updated_content( $post_id, $post, $update ) {
	// Bail on auto-save.
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	if ( $post && ! in_array( $post->post_type, [ 'audience', 'wp_block', 'broadcast' ], true ) ) {
		return;
	}

	if ( $update ) {
		$action = 'update';
	} else {
		$action = 'create';
	}

	// Track variant/block type specific events.
	if ( $post->post_type === 'wp_block' ) {
		$xb_type = Blocks\get_block_type( $post );

		// Check if we've already tracked this block's variant type transition.
		// Blocks start as 'standard' and become 'abtest' or 'personalization' when variants are added.
		// We need to detect type CHANGES, not just creation.
		$tracked_type = get_post_meta( $post_id, '_xb_variant_added_tracked', true );

		if ( $xb_type === 'abtest' ) {
			// Check if this is the first A/B test on the site.
			$is_first_abtest = ! get_option( 'accelerate_first_abtest_created' );

			track( [
				'event' => 'Experiments',
				'properties' => [
					'action' => $tracked_type !== 'abtest' ? 'Start' : 'Update',
					'test' => 'block',
					'source' => 'plugin',
				],
			] );

			// Track Variant Added when block becomes an A/B test (type change from standard).
			if ( $tracked_type !== 'abtest' ) {
				update_post_meta( $post_id, '_xb_variant_added_tracked', 'abtest' );

				track( [
					'event' => 'Variant Added',
					'properties' => [
						'variant_type' => 'abtest',
						'is_first_variant' => $is_first_abtest,
						'source' => 'plugin',
					],
				] );

				// Fire activation event on first A/B test.
				if ( $is_first_abtest ) {
					update_option( 'accelerate_first_abtest_created', time() );
					track_activation_event( 'abtest' );
				}
			}
		} elseif ( $xb_type === 'personalization' ) {
			// Check if this is the first personalization on the site.
			$is_first_personalization = ! get_option( 'accelerate_first_personalization_created' );

			// Track Variant Added when block becomes personalized (type change from standard).
			if ( $tracked_type !== 'personalization' ) {
				update_post_meta( $post_id, '_xb_variant_added_tracked', 'personalization' );

				track( [
					'event' => 'Variant Added',
					'properties' => [
						'variant_type' => 'personalization',
						'is_first_variant' => $is_first_personalization,
						'source' => 'plugin',
					],
				] );

				// Fire activation event on first personalization.
				if ( $is_first_personalization ) {
					update_option( 'accelerate_first_personalization_created', time() );
					track_activation_event( 'personalization' );
				}
			}
		}
	}

	// Track broadcast activation.
	if ( $post->post_type === 'broadcast' && $action === 'create' ) {
		$is_first_broadcast = ! get_option( 'accelerate_first_broadcast_created' );

		if ( $is_first_broadcast ) {
			update_option( 'accelerate_first_broadcast_created', time() );
			track_activation_event( 'broadcast' );
		}
	}

	// Track general content event.
	track( [
		'event' => 'Content',
		'properties' => [
			'action' => $action,
			'type' => $post->post_type,
			'source' => 'plugin',

			// Legacy properties.
			'content_type' => $post->post_type,
			'content_action' => $action,
		],
	] );
}

/**
 * Track site connection event.
 *
 * This establishes the site's identity in Mixpanel and should be called
 * after a successful OAuth connection.
 *
 * @return void
 */
function track_site_connected() : void {
	// Store connection timestamp for activation calculation (only once).
	if ( ! get_option( 'accelerate_site_connected_at' ) ) {
		update_option( 'accelerate_site_connected_at', time() );
	}

	// Ensure Segment is initialized.
	if ( ! initialize() ) {
		return;
	}

	// Identify the site with full traits and $created timestamp.
	$site_details = get_segmentio_user_details();
	if ( $site_details['opt_in'] ) {
		Segment::identify( [
			'userId' => $site_details['id'],
			'traits' => array_merge( $site_details['traits'], [
				'$created' => gmdate( 'c' ),
			] ),
			'context' => get_segment_context(),
		] );
	}

	// Track connection event.
	track( [
		'event' => 'Site Connected',
		'properties' => [
			'domain' => get_normalized_domain(),
			'environment' => wp_get_environment_type(),
			'accelerate_version' => Accelerate\VERSION,
			'wordpress_version' => get_bloginfo( 'version' ),
			'php_version' => PHP_VERSION,
			'multisite' => is_multisite(),
			'source' => 'plugin',
		],
	] );
}

/**
 * Fire the Activated event with computed properties.
 *
 * This should be called when a site achieves first value (first variant added).
 *
 * @param string $activation_type Type of activation (abtest, personalization, broadcast).
 * @return void
 */
function track_activation_event( string $activation_type ) : void {
	// Calculate days since site connected.
	$connected_at = (int) get_option( 'accelerate_site_connected_at', time() );
	$days_since_signup = (int) floor( ( time() - $connected_at ) / DAY_IN_SECONDS );

	// Update site profile with activation data.
	if ( initialize() ) {
		$site_details = get_segmentio_user_details();
		if ( $site_details['opt_in'] ) {
			Segment::identify( [
				'userId' => $site_details['id'],
				'traits' => array_merge( $site_details['traits'], [
					'activated' => true,
					'activated_at' => gmdate( 'c' ),
					'days_to_activate' => $days_since_signup,
					'activation_type' => $activation_type,
				] ),
				'context' => get_segment_context(),
			] );
		}
	}

	// Track activation event.
	track( [
		'event' => 'Activated',
		'properties' => [
			'activation_type' => $activation_type,
			'days_since_signup' => $days_since_signup,
			'source' => 'plugin',
		],
	] );
}

/**
 * Track one-off activation events to support customer comms.
 *
 * @deprecated Use track_activation_event() for PLG activation tracking.
 * @param string $action The action name
 * @param array $properties Optional extra properties.
 * @return void
 */
function maybe_track_activation_event( string $action, array $properties = [] ) : void {
	static $activated;

	$activated = $activated ?? (array) get_option( 'altis_activations', [] );
	if ( in_array( $action, $activated, true ) ) {
		return;
	}

	// Track events that have happened.
	$activated[] = $action;
	update_option( 'altis_activations', $activated );

	track( [
		'event' => 'Activation',
		'properties' => array_merge( [
			'action' => $action,
		], $properties ),
	] );
}
