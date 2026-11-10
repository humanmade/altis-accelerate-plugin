<?php
/**
 * Altis Product Telemetry.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\Telemetry;

use Altis\Accelerate;
use Altis\Accelerate\Blocks;
use PostHog\PostHog;
use WP_REST_Request;
use WP_REST_Server;
use WP_User;

const ACTION_OPT_IN = 'altis_tracking_opt_in';
const META_OPT_IN = 'altis_tracking_opt_in';
const POSTHOG_API_KEY = 'phc_vdXjjK22hC3Ccjv6Sg3nPLbjwtCY3bfuBep3mKSwUN6W';
const POSTHOG_HOST = 'https://eu.i.posthog.com';
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
	add_action( 'admin_head', __NAMESPACE__ . '\\load_posthog_js' );
	add_action( 'admin_footer', __NAMESPACE__ . '\\render_posthog_identity_tag' );
	// Product usage is an explicit option alongside the account connection in Settings.
	add_action( 'profile_personal_options', __NAMESPACE__ . '\\user_profile_options' );
	add_action( 'personal_options_update', __NAMESPACE__ . '\\handle_profile_form' );

	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_api_routes' );

	// Content event tracking.
	add_action( 'save_post', __NAMESPACE__ . '\\track_new_or_updated_content', 10, 3 );
}

/**
 * Get the PostHog API key for tracking.
 *
 * @return string
 */
function get_posthog_api_key() : string {
	if ( defined( 'ALTIS_POSTHOG_API_KEY' ) ) {
		return ALTIS_POSTHOG_API_KEY;
	}
	return POSTHOG_API_KEY;
}

/**
 * Initialize PostHog.
 *
 * @return bool True if PostHog has initialised successfully.
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
	PostHog::init( get_posthog_api_key(), [
		'host' => POSTHOG_HOST,
	] );

	// Identify the site (not user - site-level identity).
	$site = get_site_details();

	if ( $site['opt_in'] ) {
		PostHog::identify( [
			'distinctId' => $site['id'],
			'$set' => $site['traits'],
		] );
	}
	// Anonymous sites: no identify call needed.
	// PostHog uses the distinctId on each capture() call directly.

	$initialized = true;
	return $initialized;
}

/**
 * Track an event in PostHog.
 *
 * @param array $message The event details.
 * @return void
 */
function track( array $message ) {
	if ( ! initialize() ) {
		return;
	}

	// Add distinct ID if missing.
	if ( ! isset( $message['distinctId'] ) ) {
		$user = get_site_details();
		$message['distinctId'] = $user['id'];
	}

	// Add domain to event properties for visibility in event lists.
	if ( ! isset( $message['properties'] ) ) {
		$message['properties'] = [];
	}
	if ( ! isset( $message['properties']['domain'] ) ) {
		$message['properties']['domain'] = get_normalized_domain();
	}

	$message = enrich_message_with_site_group( $message );

	PostHog::capture( $message );
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
 * This is the primary identifier used for all PostHog tracking.
 *
 * @return string 64-character hexadecimal hash.
 */
function get_site_id() : string {
	return hash( 'sha256', get_normalized_domain() );
}

/**
 * Shared 'site' group key bridging website + plugin PostHog identities.
 *
 * MUST stay byte-identical to accelerate-website
 * inc/posthog/namespace.php site_group_key(). Host only — no path, no
 * localhost casing — unlike get_site_id()/get_normalized_domain().
 *
 * @return string 64-character hexadecimal hash.
 */
function get_site_group_key() : string {
	$host = wp_parse_url( get_site_url(), PHP_URL_HOST );
	if ( ! $host ) {
		$host = get_site_url();
	}
	$host = preg_replace( '#^www\.#', '', strtolower( $host ) );
	return hash( 'sha256', $host );
}

/**
 * Add the shared site group + dashboard id to a capture message.
 * Pure + side-effect-free so it can be asserted in tests.
 *
 * @param array $message The PostHog capture message.
 * @return array The enriched message.
 */
function enrich_message_with_site_group( array $message ) : array {
	$message['properties'] = $message['properties'] ?? [];

	// Merge, don't overwrite — preserve any caller-provided groups.
	$message['properties']['$groups'] = array_merge(
		$message['properties']['$groups'] ?? [],
		[ 'site' => get_site_group_key() ]
	);

	$dashboard_site_id = (int) get_option( 'accelerate_dashboard_site_id' );
	if ( $dashboard_site_id ) {
		$message['properties']['dashboard_site_id'] = $dashboard_site_id;
	}

	return $message;
}

/**
 * Get site-level traits for analytics identification.
 *
 * These traits are sent with PostHog identify() calls to build the site profile.
 *
 * @return array<string, mixed> Site traits for PostHog identify call.
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

	$dashboard_site_id = (int) get_option( 'accelerate_dashboard_site_id' );
	if ( $dashboard_site_id ) {
		$traits['dashboard_site_id'] = $dashboard_site_id;
	}

	/**
	 * Filter site traits delivered to PostHog.
	 *
	 * @param array $traits Site traits to send to PostHog.
	 */
	$traits = (array) apply_filters( 'altis.telemetry.site_traits', $traits );

	return $traits;
}

/**
 * Get details for PostHog identify call.
 *
 * Returns site-level identity instead of user-level identity.
 * The site is the customer, not individual WordPress users.
 *
 * @return array{id: string, opt_in: bool, traits?: array<string, mixed>}
 */
function get_site_details() : array {
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
 * Get current Altis environment details.
 *
 * @return array
 */
function get_environment_details() : array {
	$id = defined( 'HM_ENV' ) ? HM_ENV : get_site_url();
	$type = wp_get_environment_type();
	if ( $type === 'local' ) {
		// Create distinct_id for PostHog.
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
	 * Filter environment traits delivered to PostHog.
	 *
	 * @param array $traits Environment traits to send to PostHog.
	 */
	$traits = (array) apply_filters( 'altis.telemetry.env_traits', $traits );

	return [
		'id' => $id,
		'traits' => $traits,
	];
}

/**
 * Load PostHog JS SDK.
 *
 * @return void
 */
function load_posthog_js() {
	global $pagenow;
	$domain = get_normalized_domain();
	?>
	<script>
		// Expose domain globally for trackEvent calls (must be before JS bundles load).
		window.accelerateTelemetryDomain = <?php echo wp_json_encode( $domain ); ?>;
		window.accelerateTelemetrySiteGroup = <?php echo wp_json_encode( get_site_group_key() ); ?>;

		// PostHog - Load
		!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
		posthog.init(<?php echo wp_json_encode( get_posthog_api_key() ); ?>, {
			api_host: <?php echo wp_json_encode( POSTHOG_HOST ); ?>,
			person_profiles: 'always',
			capture_pageview: false,
			capture_pageleave: false
		});
		posthog.group( 'site', window.accelerateTelemetrySiteGroup );
		posthog.capture('$pageview', {
			page: <?php echo wp_json_encode( $pagenow ); ?>,
			domain: <?php echo wp_json_encode( $domain ); ?>
		});
	</script>
	<?php
}

/**
 * Identify site to PostHog.
 *
 * @return void
 */
function render_posthog_identity_tag() {
	$user = get_site_details();
	?>
	<script>
		(function () {
			var siteUser = <?php echo wp_json_encode( $user ) ?>;
			if ( siteUser.opt_in ) {
				posthog.identify( siteUser.id, siteUser.traits );
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

	// Clear any soft-dismiss state so it doesn't interfere later.
	delete_option( 'accelerate_telemetry_dismissed' );

	if ( $did_opt_in ) {
		if ( ! initialize() ) {
			return;
		}

		// Re-identify site with full traits on opt-in.
		$site_details = get_site_details();
		PostHog::identify( [
			'distinctId' => $site_details['id'],
			'$set' => $site_details['traits'],
		] );

		// Track opt-in event.
		track( [
			'event' => 'telemetry_opted_in',
			'properties' => [
				'consent_source' => $consent_source,
				'source' => 'plugin',
			],
		] );
	} elseif ( $previous_status === true ) {
		// Track opt-out if previously opted in.
		track( [
			'event' => 'telemetry_opted_out',
			'properties' => [
				'previous_status' => 'opted_in',
				'revoke_source' => $consent_source,
				'source' => 'plugin',
			],
		] );
	}
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

	// Only show on Accelerate pages (user has navigated here intentionally).
	if ( ! \Altis\Accelerate\Admin\is_altis_screen() ) {
		return;
	}

	// Check dismissal state — soft dismiss hides for 14 days, 2nd dismiss is permanent.
	$dismissed = get_option( 'accelerate_telemetry_dismissed', null );
	if ( is_array( $dismissed ) ) {
		$count = $dismissed['count'] ?? 0;

		// 2nd dismiss = permanent opt-out.
		if ( $count >= 2 ) {
			opt_in( false );
			return;
		}

		// 1st dismiss = hide for 14 days.
		$timestamp = $dismissed['timestamp'] ?? 0;
		if ( time() - $timestamp < 14 * DAY_IN_SECONDS ) {
			return;
		}
	}

	?>
	<div class="tailwind altis-telemetry-opt-in">
		<div class="rounded-lg border border-border bg-background p-6 max-w-2xl">
			<div class="!flex !items-center !gap-3 !mb-3">
				<div class="!flex !items-center !justify-center !w-9 !h-9 !rounded-lg bg-brand/15 text-brand">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
				</div>
				<h2 class="!text-lg !font-semibold !text-foreground !m-0 !p-0 !leading-snug">
					<?php echo esc_html( sprintf( __( 'Hi %s!', 'altis' ), $user->display_name ) ); ?>
				</h2>
			</div>
			<p class="!text-sm !text-muted-foreground !mt-0 !mb-0">
				<?php esc_html_e( 'We\'re building personalized site insights — like testing benchmarks and performance stats — for Accelerate users. Enable now and your data will be ready when they launch. This also helps us understand which features matter most so we can build the right things.', 'altis' ); ?>
			</p>
			<p class="!text-xs !text-muted-foreground !mt-1.5 !mb-0">
				<?php esc_html_e( 'We only collect site-level usage patterns — never personal data, content, or anything about your visitors.', 'altis' ); ?>
			</p>
			<form method="post" action="" class="!flex !items-center !gap-3 !mt-4">
				<?php wp_nonce_field( 'altis_telemetry_opt_in' ); ?>
				<input type="submit" name="altis_telemetry_opt_in" class="!inline-flex !items-center !justify-center !rounded-md !bg-brand !text-white !text-sm !font-medium !px-4 !py-2 !border-0 !cursor-pointer hover:!bg-brand/90 !shadow-none" value="<?php esc_attr_e( 'Enable site insights', 'altis' ); ?>" />
				<input type="submit" name="altis_telemetry_opt_out" class="!inline-flex !items-center !justify-center !rounded-md !bg-transparent !text-muted-foreground !text-sm !font-medium !px-4 !py-2 !border !border-border !cursor-pointer hover:!bg-muted !shadow-none" value="<?php esc_attr_e( 'Not right now', 'altis' ); ?>" />
			</form>
			<p class="!text-xs !text-muted-foreground !mt-3 !mb-0">
				<?php esc_html_e( 'You can change this anytime in Accelerate → Settings.', 'altis' ); ?>
			</p>
		</div>
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
				<label for="altis_telemetry_opt_in"><?php esc_html_e( 'Enable site insights for Accelerate', 'altis' ); ?></label>
				<p class="description"><?php esc_html_e( 'We\'re building personalized site insights like testing benchmarks and performance stats. Keep this enabled so your data is ready when they launch. This also helps us understand which features matter most so we can build the right things. This is a site-wide setting.', 'altis' ); ?></p>
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
		$dismissed = get_option( 'accelerate_telemetry_dismissed', null );
		$count = is_array( $dismissed ) ? ( $dismissed['count'] ?? 0 ) : 0;
		$count++;

		if ( $count >= 2 ) {
			// 2nd dismiss = permanent opt-out.
			delete_option( 'accelerate_telemetry_dismissed' );
			opt_in( false );
		} else {
			// 1st dismiss = soft dismiss for 14 days.
			update_option( 'accelerate_telemetry_dismissed', [
				'count'     => $count,
				'timestamp' => time(),
			] );
		}
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
		$data['tracking_data'] = get_site_details();
	}

	return $data;
}

/**
 * Push post save events we're interested in to PostHog.
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
				'event' => 'experiment_updated',
				'properties' => [
					'action' => $tracked_type !== 'abtest' ? 'start' : 'update',
					'test' => 'block',
					'source' => 'plugin',
				],
			] );

			// Track Variant Added when block becomes an A/B test (type change from standard).
			if ( $tracked_type !== 'abtest' ) {
				update_post_meta( $post_id, '_xb_variant_added_tracked', 'abtest' );

				track( [
					'event' => 'variant_added',
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
					'event' => 'variant_added',
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
		'event' => 'content_saved',
		'properties' => [
			'action' => $action,
			'type' => $post->post_type,
			'source' => 'plugin',
		],
	] );
}

/**
 * Track site connection event.
 *
 * This establishes the site's identity in PostHog and should be called
 * after a successful OAuth connection.
 *
 * @return void
 */
function track_site_connected() : void {
	// Store connection timestamp for activation calculation (only once).
	if ( ! get_option( 'accelerate_site_connected_at' ) ) {
		update_option( 'accelerate_site_connected_at', time() );
	}

	// Ensure PostHog is initialized.
	if ( ! initialize() ) {
		return;
	}

	// Identify the site with full traits and connected_at timestamp.
	$site_details = get_site_details();
	if ( $site_details['opt_in'] ) {
		PostHog::identify( [
			'distinctId' => $site_details['id'],
			'$set' => array_merge( $site_details['traits'], [
				'connected_at' => gmdate( 'c' ),
			] ),
		] );
	}

	// Track connection event.
	track( [
		'event' => 'site_connected',
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
 * Fire the feature_activated event with computed properties.
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
		$site_details = get_site_details();
		if ( $site_details['opt_in'] ) {
			PostHog::identify( [
				'distinctId' => $site_details['id'],
				'$set' => array_merge( $site_details['traits'], [
					'activated' => true,
					'activated_at' => gmdate( 'c' ),
					'days_to_activate' => $days_since_signup,
					'activation_type' => $activation_type,
				] ),
			] );
		}
	}

	// Track activation event.
	track( [
		'event' => 'feature_activated',
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
		'event' => 'activation',
		'properties' => array_merge( [
			'action' => $action,
		], $properties ),
	] );
}
