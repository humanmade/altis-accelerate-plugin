<?php
/**
 * Accelerate Abilities API - Main Bootstrap.
 *
 * Exposes Accelerate capabilities to AI agents via the WordPress Abilities API.
 *
 * @package Altis\Accelerate\Abilities
 */

namespace Altis\Accelerate\Abilities;

/**
 * Set up the Abilities API if enabled and WordPress 6.9+.
 *
 * @return void
 */
function setup() : void {
	// Check WordPress version supports Abilities API.
	if ( ! function_exists( 'wp_register_ability' ) ) {
		return;
	}

	// Check feature flag.
	if ( ! get_option( 'accelerate_abilities_api_enabled', false ) ) {
		return;
	}

	// Register categories first.
	add_action( 'wp_abilities_api_categories_init', __NAMESPACE__ . '\\register_categories' );

	// Register all abilities.
	add_action( 'wp_abilities_api_init', __NAMESPACE__ . '\\register_all_abilities' );
}

/**
 * Register ability categories.
 *
 * Categories organize abilities into logical groups:
 * - Discovery: Read-only analytics queries
 * - Execution: Create/manage experiments
 * - Integration: Export data
 *
 * @return void
 */
function register_categories() : void {
	wp_register_ability_category( 'accelerate-discovery', [
		'label'       => __( 'Discovery & Analytics', 'altis' ),
		'description' => __( 'Query site analytics, traffic data, and content performance.', 'altis' ),
	] );

	wp_register_ability_category( 'accelerate-execution', [
		'label'       => __( 'Experimentation & Personalization', 'altis' ),
		'description' => __( 'Create and manage A/B tests, audiences, and broadcasts.', 'altis' ),
	] );

	wp_register_ability_category( 'accelerate-integration', [
		'label'       => __( 'Data Integration', 'altis' ),
		'description' => __( 'Export analytics data for external tools.', 'altis' ),
	] );
}

/**
 * Register all abilities from domain files.
 *
 * @return void
 */
function register_all_abilities() : void {
	Discovery\register_abilities();
	Execution\register_abilities();
	Integration\register_abilities();
	Author\register_abilities();
	Realtime\register_abilities();
	Engagement\register_abilities();
	Attribution\register_abilities();
	Query\register_abilities();
}

/**
 * Permission callback for Tier 1 (read analytics).
 *
 * Safe for monitoring agents. Allows read-only access to analytics data.
 * Accepts either 'edit_posts' (backward compatible) or the dedicated
 * 'view_accelerate_analytics' capability for read-only agent accounts.
 *
 * @return bool Whether user can view analytics.
 */
function can_view_analytics() : bool {
	return current_user_can( 'edit_posts' ) || current_user_can( 'view_accelerate_analytics' );
}

/**
 * Permission callback for Tier 2 (create/edit experiments).
 *
 * Allows agents to create experiments and audiences, but not publish or destroy.
 *
 * @return bool Whether user can create experiments.
 */
function can_create_experiments() : bool {
	return current_user_can( 'edit_posts' );
}

/**
 * Permission callback for Tier 3 (destructive/publish actions).
 *
 * Full automation tier. Allows stopping experiments, declaring winners,
 * and broadcasting content. Requires admin-level access.
 *
 * @return bool Whether user can manage experiments.
 */
function can_manage_experiments() : bool {
	return current_user_can( 'manage_options' );
}

/**
 * Get the date range schema definition for reuse.
 *
 * @return array Date range JSON schema.
 */
function get_date_range_schema() : array {
	return [
		'type'       => 'object',
		'properties' => [
			'start' => [
				'type'        => 'string',
				'format'      => 'date-time',
				'description' => __( 'Start date/time in ISO 8601 format', 'altis' ),
			],
			'end'   => [
				'type'        => 'string',
				'format'      => 'date-time',
				'description' => __( 'End date/time in ISO 8601 format', 'altis' ),
			],
		],
	];
}

/**
 * Parse date range from input, with defaults.
 *
 * @param array $input Input containing optional date_range.
 * @param int   $default_days Default number of days if not specified.
 * @return array Array with 'start' and 'end' timestamps.
 */
function parse_date_range( array $input, int $default_days = 7 ) : array {
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
