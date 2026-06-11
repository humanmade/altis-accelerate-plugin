<?php
/**
 * A/B Tests.
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Experiments;

use Altis\Accelerate;
use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\Utils;
use MathPHP\Probability\Distribution\Discrete;
use WP_Post;
use WP_Query;

// Special fallback value - if no goal is set the test will never convert.
const NULL_GOAL = '__none__';

/**
 * Bootstrap the plugin.
 */
function setup() {

	// Ensure the experiments table exists.
	add_action( 'init', __NAMESPACE__ . '\\ensure_experiments_table' );

	// Register experiments REST API.
	add_action( 'rest_api_init', __NAMESPACE__ . '\\REST_API\\register_routes' );

	// Load analytics scripts early.
	add_action( 'altis.analytics.enqueue_scripts', __NAMESPACE__ . '\\enqueue_scripts' );

	// Register REST Fields.
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_post_ab_tests_rest_fields' );

	// Register REST fields for test variants.
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_post_ab_tests_variants_rest_fields' );

	// Hook cron task.
	add_action( 'altis_post_ab_test_cron', __NAMESPACE__ . '\\handle_post_ab_test_cron', 10, 2 );

	// Hook backfill cron for large-site deferred migration.
	add_action( 'accelerate_experiments_backfill_cron', __NAMESPACE__ . '\\handle_backfill_cron' );

	// Register notifications.
	add_action( 'altis.experiments.test.ended', __NAMESPACE__ . '\\send_post_ab_test_notification', 10, 2 );

	/**
	 * Enable Title AB Tests.
	 *
	 * @param bool $enabled Whether to enable this feature or not.
	 */
	$titles_feature = apply_filters( 'altis.experiments.features.titles', true );
	if ( $titles_feature ) {
		Titles\setup();
	}

	/**
	 * Enable Featured images AB Tests.
	 *
	 * @param bool $enabled Whether to enable this feature or not.
	 */
	$featured_images_feature = apply_filters( 'altis.experiments.features.featured_images', true );
	if ( $featured_images_feature ) {
		FeaturedImages\setup();
	}

	// Register default conversion goals.
	register_goal( 'engagement', [
		'label' => __( 'Engagement (Default)', 'altis' ),
		'event' => 'click',
		'selector' => 'a,input[type="button"],input[type="submit"],input[type="image"],button,area',
		'validation_message' => __( 'You need to add at least one clickable element or a form to track conversions.', 'altis' ),
	] );
	register_goal( 'click_any_link', [
		'label' => __( 'Click on any link', 'altis' ),
		'event' => 'click',
		'selector' => 'a',
		'validation_message' => __( 'You need to add at least one link to this content to track conversions.', 'altis' ),
	] );
	register_goal( 'submit_form', [
		'label' => __( 'Submit a form', 'altis' ),
		'event' => 'submit',
		'selector' => 'form',
		'validation_message' => __( 'You need to add a form to this content to track conversions.', 'altis' ),
	] );

	// Register the admin list table page.
	add_action( 'admin_menu', __NAMESPACE__ . '\\register_admin_page' );
	add_action( 'admin_menu', __NAMESPACE__ . '\\reorder_admin_submenu', 999 );

	// Register WP-CLI command.
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		Experiments_Command::register();
	}
}

/**
 * Ensure the experiments table exists.
 *
 * Called on init. Uses Foundry's ensure_table to create or update the schema.
 */
function ensure_experiments_table() {
	static $ensured = false;
	if ( $ensured ) {
		return;
	}
	$ensured = true;
	Experiment::ensure_table();

	// Auto-migrate legacy post meta experiments to the table (runs once).
	maybe_run_backfill();
}

/**
 * Auto-migrate legacy experiments from post meta to the experiments table.
 *
 * Runs once after the table is created. Uses a version option to track
 * completion and an atomic lock to prevent concurrent runs.
 *
 * Small sites (<= 50 candidate posts) migrate synchronously.
 * Larger sites defer to a one-time cron event.
 */
function maybe_run_backfill() {
	// Already migrated — fast exit on every subsequent request.
	if ( (int) get_option( 'accelerate_experiments_backfill_version', 0 ) >= 1 ) {
		return;
	}

	// Clean up stale locks from crashed processes (> 10 minutes old).
	$lock_time = get_option( 'accelerate_experiments_backfill_lock' );
	if ( $lock_time && ( time() - (int) $lock_time ) > 600 ) {
		delete_option( 'accelerate_experiments_backfill_lock' );
	}

	// Acquire an atomic lock. add_option returns false if the row already exists.
	if ( ! add_option( 'accelerate_experiments_backfill_lock', time(), '', 'no' ) ) {
		return; // Another process is running the migration.
	}

	// Count candidate posts with experiment meta.
	global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$count = (int) $wpdb->get_var(
		"SELECT COUNT( DISTINCT post_id ) FROM {$wpdb->postmeta} WHERE meta_key LIKE '_altis_ab_test_%_variants'"
	);

	if ( $count === 0 ) {
		// Nothing to migrate.
		update_option( 'accelerate_experiments_backfill_version', 1 );
		delete_option( 'accelerate_experiments_backfill_lock' );
		return;
	}

	if ( $count <= 50 ) {
		// Small site — migrate synchronously.
		Migration\backfill( 50 );
		update_option( 'accelerate_experiments_backfill_version', 1 );
		delete_option( 'accelerate_experiments_backfill_lock' );
		return;
	}

	// Large site — defer to a one-time cron event.
	if ( ! wp_next_scheduled( 'accelerate_experiments_backfill_cron' ) ) {
		wp_schedule_single_event( time(), 'accelerate_experiments_backfill_cron' );
	}
	delete_option( 'accelerate_experiments_backfill_lock' );
}

/**
 * Cron handler for deferred experiment backfill on large sites.
 */
function handle_backfill_cron() {
	if ( (int) get_option( 'accelerate_experiments_backfill_version', 0 ) >= 1 ) {
		return;
	}

	if ( ! add_option( 'accelerate_experiments_backfill_lock', time(), '', 'no' ) ) {
		return;
	}

	Migration\backfill( 100 );

	update_option( 'accelerate_experiments_backfill_version', 1 );
	delete_option( 'accelerate_experiments_backfill_lock' );
}

/**
 * Sync experiment state to the experiments table (dual-write).
 *
 * Creates or updates an experiment row to mirror the current post meta state.
 * Called from lifecycle transition points (start, pause, end, results update).
 *
 * @param string $test_id Test ID (block, titles, featured_images, etc.).
 * @param int    $post_id Subject post ID.
 * @param string $type    Experiment type override. Auto-detected if empty.
 * @return Experiment|null The synced experiment, or null on failure.
 */
function sync_experiment_to_table( string $test_id, int $post_id, string $type = '' ) : ?Experiment {
	// Determine type.
	if ( empty( $type ) ) {
		$xb_type = get_post_meta( $post_id, '_xb_type', true );
		if ( $xb_type === 'personalization' || get_post_meta( $post_id, '_xb_personalization', true ) ) {
			$type = Experiment::TYPE_PERSONALIZATION;
		} else {
			$type = Experiment::TYPE_ABTEST;
		}
	}

	$experiment = Experiment::get_or_create_for_post( $post_id, $test_id, $type );

	// Read current state from meta.
	$variants    = get_ab_test_variants_for_post( $test_id, $post_id );
	$start_time  = (int) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_start_time', true );
	$end_time    = (int) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_end_time', true );
	$is_started  = (bool) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_started', true );
	$is_paused   = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_paused', true ) !== 'false';
	$has_ended   = ( get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_ended', true ) ?: 'false' ) !== 'false';
	$traffic_pct = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_traffic_percentage', true );
	$variant_pcts = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variant_traffic_percentage', true );
	$results     = get_ab_test_results_for_post( $test_id, $post_id );

	// Determine status.
	$now = Utils\milliseconds();
	if ( $has_ended ) {
		$status = Experiment::STATUS_COMPLETED;
	} elseif ( $is_paused ) {
		$status = Experiment::STATUS_PAUSED;
	} elseif ( $is_started && $start_time <= $now ) {
		$status = Experiment::STATUS_RUNNING;
	} else {
		$status = Experiment::STATUS_DRAFT;
	}

	// If the current experiment is completed and we're starting a new one,
	// create a fresh experiment instead.
	if ( $experiment->get_status() === Experiment::STATUS_COMPLETED && $status !== Experiment::STATUS_COMPLETED ) {
		$experiment = new Experiment();
		$experiment->set_subject_post_id( $post_id );
		$experiment->set_test_id( $test_id );
		$experiment->set_type( $type );
	}

	// If the type has changed (e.g. abtest → personalization), complete the old
	// experiment and start a fresh one.
	if ( $experiment->get_id() && $experiment->get_type() !== $type ) {
		$experiment->set_status( Experiment::STATUS_COMPLETED );
		$experiment->set_end_time( Utils\milliseconds() );
		$experiment->save();

		$experiment = new Experiment();
		$experiment->set_subject_post_id( $post_id );
		$experiment->set_test_id( $test_id );
		$experiment->set_type( $type );
	}

	$experiment->set_status( $status );

	$post = get_post( $post_id );
	if ( $post ) {
		$experiment->set_title( $post->post_title ?: '' );
	}

	$goal = get_post_meta( $post_id, '_xb_goal', true ) ?: get_post_meta( $post_id, '_goal', true ) ?: 'engagement';
	$experiment->set_goal( $goal );

	if ( is_numeric( $traffic_pct ) ) {
		$experiment->set_traffic_percentage( (int) $traffic_pct );
	}

	if ( is_array( $variant_pcts ) && ! empty( $variant_pcts ) ) {
		$experiment->set_variant_traffic_percentage( $variant_pcts );
	}

	if ( ! empty( $variants ) ) {
		$experiment->set_variants_snapshot( $variants );
	}

	if ( ! empty( $results ) && ! empty( $results['variants'] ) ) {
		$experiment->set_results( $results );
	}

	if ( $start_time ) {
		$experiment->set_start_time( $start_time );
	}
	if ( $end_time ) {
		$experiment->set_end_time( $end_time );
	}

	$saved = $experiment->save();
	if ( is_wp_error( $saved ) ) {
		return null;
	}

	// Store current experiment ID for fast lookup.
	if ( $status !== Experiment::STATUS_COMPLETED ) {
		update_post_meta( $post_id, '_current_experiment_id', $experiment->get_id() );
	}

	// Update resolver cache so subsequent reads within the same request are fresh.
	$cache_key = "{$post_id}:{$test_id}";
	$GLOBALS['_altis_experiment_resolver_cache'][ $cache_key ] = $experiment;

	return $experiment;
}

/**
 * Resolve the experiment row for a test/post pair, with a per-request cache.
 *
 * Falls back from active (draft/running/paused) to most-recent any-status row
 * when $active_only is false. Cache is keyed by "$post_id:$test_id".
 *
 * @param string $test_id     Test ID.
 * @param int    $post_id     Subject post ID.
 * @param bool   $active_only When true, only return a non-completed experiment.
 * @return Experiment|null
 */
function resolve_experiment_for_test( string $test_id, int $post_id, bool $active_only = false ) : ?Experiment {
	$cache_key = "{$post_id}:{$test_id}";

	if ( isset( $GLOBALS['_altis_experiment_resolver_cache'][ $cache_key ] ) ) {
		$cached = $GLOBALS['_altis_experiment_resolver_cache'][ $cache_key ];
		if ( $active_only && $cached->get_status() === Experiment::STATUS_COMPLETED ) {
			// Cache has a completed row but caller needs active — re-query.
			$fresh = Experiment::get_active_for_post( $post_id, $test_id );
			if ( $fresh ) {
				$GLOBALS['_altis_experiment_resolver_cache'][ $cache_key ] = $fresh;
			}
			return $fresh ?: null;
		}
		return $cached;
	}

	$experiment = Experiment::get_active_for_post( $post_id, $test_id );

	if ( ! $experiment && ! $active_only ) {
		// Fall back to most-recent row of any status, scoped to this test.
		$results = Experiment::query(
			[
				'subject_post_id' => $post_id,
				'test_id'         => $test_id,
			],
			[
				'per_page' => 1,
				'order_by' => [ 'created_at' => 'DESC' ],
			]
		)->get_results();

		if ( ! is_wp_error( $results ) && ! empty( $results ) ) {
			$experiment = $results[0];
		}
	}

	if ( $experiment ) {
		$GLOBALS['_altis_experiment_resolver_cache'][ $cache_key ] = $experiment;
	}

	return $experiment ?: null;
}

/**
 * Flush the per-request experiment resolver cache.
 *
 * Called from test set_up() to ensure DB rollbacks between tests start clean.
 */
function flush_experiment_resolver_cache() : void {
	$GLOBALS['_altis_experiment_resolver_cache'] = [];
}

/**
 * Queue up the tracker script and required configuration.
 */
function enqueue_scripts() {
	global $wp_scripts;

	Utils\register_assets(
		'experiments',
		[
			'dependencies' => [
				'altis-accelerate-accelerate',
			],
			'in-footer' => false,
		],
		true
	);

	wp_add_inline_script(
		'altis-accelerate-experiments',
		sprintf(
			'window.Altis = window.Altis || {};' .
			'window.Altis.Analytics = window.Altis.Analytics || {};' .
			'window.Altis.Analytics.Experiments = window.Altis.Analytics.Experiments || {};' .
			'window.Altis.Analytics.Experiments.BuildURL = %s;' .
			'window.Altis.Analytics.Experiments.Goals = %s;',
			wp_json_encode( plugins_url( 'build', Accelerate\PLUGIN_FILE ) ),
			wp_json_encode( (object) get_goals() )
		),
		'before'
	);

	// Load async.
	$wp_scripts->add_data( 'altis-accelerate-experiments', 'async', true );
}

/**
 * Registers a new conversion goal for front end tracking.
 *
 * @param string $name A reference name for the goal.
 * @param array $args An array of configuration options.
 *   - string $args['label'] A human readable label for the goal. Defaults to $name.
 *   - string $args['event'] The JS event to trigger on. Defaults to $name.
 *   - string $args['selector'] An optional CSS selector to scope the event to.
 *   - string $args['closest'] An optional CSS selector for finding the closest matching parent to bind the event to.
 *   - string $args['validation_message'] An optional message to show if the variant is missing the selector.
 * @return void
 */
function register_goal( string $name, array $args = [] ) : void {
	global $altis_analytics_goals;

	if ( ! is_array( $altis_analytics_goals ) ) {
		$altis_analytics_goals = [];
	}

	$args = wp_parse_args( $args, [
		'event' => strtolower( $name ),
		'label' => ucwords( $name ),
		'selector' => null,
		'closest' => null,
	] );

	$altis_analytics_goals[ $name ] = [
		'name' => $name,
		'event' => sanitize_key( $args['event'] ),
		'label' => $args['label'],
		'selector' => $args['selector'],
		'closest' => $args['closest'],
	];

	// Remove key properties from args before appending general args.
	unset( $args['event'] );
	unset( $args['label'] );
	unset( $args['selector'] );
	unset( $args['closest'] );

	$altis_analytics_goals[ $name ]['args'] = $args;
}

/**
 * Returns registered goals.
 *
 * @return array
 */
function get_goals() : array {
	global $altis_analytics_goals;
	return $altis_analytics_goals ?? [];
}

/**
 * Get all registered Post AB Tests.
 *
 * @return array
 */
function get_post_ab_tests() : array {
	global $post_ab_tests;
	return (array) $post_ab_tests;
}

/**
 * Get a registered test by its ID.
 *
 * @param string $test_id The ID of a registered test.
 * @return array
 */
function get_post_ab_test( string $test_id ) : array {
	global $post_ab_tests;
	return $post_ab_tests[ $test_id ];
}

/**
 * Register the rest api field for all the tests on a post.
 */
function register_post_ab_tests_rest_fields() {
	$post_types = get_post_types( [
		'show_in_rest' => true,
	] );

	register_rest_field( $post_types, 'ab_tests', [
		'get_callback' => function ( array $post ) {
			$response = [];
			foreach ( array_keys( get_post_ab_tests() ) as $test_id ) {
				if ( ! isset( $post['type'] ) ) {
					// The wp-global-styles post type is show_in_rest, but has no 'type'.
					continue;
				}
				// Skip this test for unsupported types.
				if ( ! in_array( $post['type'], get_post_types_by_support( "altis.experiments.{$test_id}" ), true ) ) {
					continue;
				}

				$response[ $test_id ] = [
					'started' => is_ab_test_started_for_post( $test_id, $post['id'] ),
					'start_time' => get_ab_test_start_time_for_post( $test_id, $post['id'] ),
					'end_time' => get_ab_test_end_time_for_post( $test_id, $post['id'] ),
					'traffic_percentage' => get_ab_test_traffic_percentage_for_post( $test_id, $post['id'] ),
					'variant_traffic_percentage' => get_ab_test_variant_traffic_percentage_for_post( $test_id, $post['id'] ),
					'paused' => is_ab_test_paused_for_post( $test_id, $post['id'] ),
					'ended' => has_ab_test_ended_for_post( $test_id, $post['id'] ),
					'results' => (object) get_ab_test_results_for_post( $test_id, $post['id'] ),
					'test_mode' => get_test_mode_for_post( $test_id, $post['id'] ),
					'test_phase' => get_test_phase_for_post( $test_id, $post['id'] ),
				];
			}
			return (object) $response;
		},
		'update_callback' => function ( $value, WP_Post $post ) {
			foreach ( $value as $test_id => $test ) {
				// Skip this test for unsupported types.
				if ( ! in_array( $post->post_type, get_post_types_by_support( "altis.experiments.{$test_id}" ), true ) ) {
					continue;
				}

				if ( isset( $test['started'] ) ) {
					update_is_ab_test_started_for_post( $test_id, $post->ID, $test['started'] );
				}
				if ( isset( $test['start_time'] ) ) {
					update_ab_test_start_time_for_post( $test_id, $post->ID, $test['start_time'] );
				}
				if ( isset( $test['end_time'] ) ) {
					update_ab_test_end_time_for_post( $test_id, $post->ID, $test['end_time'] );
				}
				if ( isset( $test['traffic_percentage'] ) ) {
					update_ab_test_traffic_percentage_for_post( $test_id, $post->ID, $test['traffic_percentage'] );
				}
				if ( isset( $test['variant_traffic_percentage'] ) ) {
					update_ab_test_variant_traffic_percentage_for_post( $test_id, $post->ID, $test['variant_traffic_percentage'] );
				}
				if ( isset( $test['paused'] ) ) {
					update_is_ab_test_paused_for_post( $test_id, $post->ID, $test['paused'] );
				}
			}
		},
		'schema' => [
			'type' => 'object',
			'patternProperties' => [
				'.*' => [
					'type' => 'object',
					'properties' => [
						'started' => [
							'type' => 'boolean',
						],
						'start_time' => [
							'type' => 'number',
						],
						'end_time' => [
							'type' => 'number',
						],
						'traffic_percentage' => [
							'type' => 'number',
							'minimum' => 0,
							'maximum' => 100,
						],
						'variant_traffic_percentage' => [
							'type' => 'array',
							'items' => [
								'type' => 'number',
								'minimum' => 0,
								'maximum' => 100,
							],
						],
						'paused' => [
							'type' => 'boolean',
						],
						'ended' => [
							'type' => 'boolean',
						],
						'test_mode' => [
							'type' => 'string',
							'enum' => [ 'equal-split', 'bandit' ],
							'readOnly' => true,
						],
						'test_phase' => [
							'type' => 'string',
							'enum' => [ '', 'burn_in', 'bandit', 'confirmatory', 'done' ],
							'readOnly' => true,
						],
						'results' => [
							'type' => 'object',
							'required' => false,
							'readOnly' => true,
							'properties' => [
								'timestamp' => [
									'type' => 'number',
								],
								'winning' => [
									'type' => [ 'number', 'null' ],
								],
								'winner' => [
									'type' => [ 'number', 'null' ],
								],
								'aggs' => [
									'type' => 'array',
									'items' => [
										'type' => 'object',
									],
								],
								'variants' => [
									'type' => 'array',
									'items' => [
										'type' => 'object',
										'properties' => [
											'value' => [
												'type' => [ 'number', 'string', 'object', 'array' ],
												'description' => __( 'Variant value', 'altis' ),
											],
											'size' => [
												'type' => 'number',
												'default' => 0,
												'description' => __( 'Variant sample size', 'altis' ),
											],
											'hits' => [
												'type' => 'number',
												'default' => 0,
												'description' => __( 'Variant conversion count', 'altis' ),
											],
											'rate' => [
												'type' => 'number',
												'default' => 0,
												'description' => __( 'Variant conversion rate', 'altis' ),
											],
											'p' => [
												'type' => 'number',
												'default' => 0,
												'description' => __( 'Variant probability to be best (P2BB)', 'altis' ),
											],
										],
									],
								],
							],
						],
					],
				],
			],
		],
	] );
}

/**
 * Register an AB test for post objects.
 *
 * @param string $test_id The test name.
 * @param array $options A/B Test configuration options.
 *     $options = [
 *       'label' => (string) A human readable name for the test.
 *       'singular_label' => (string) A human readable name for one instance of the test.
 *       'show_ui' => (boolean) Whether to show this test in the sidebar.
 *       'rest_api_variants_field' => (string) REST API field name to return variants on.
 *       'rest_api_variants_type' => (string) REST API field data type.
 *       'goal' => (string) The conversion event name.
 *       'view' => (string) The view event name.
 *       'closest' => (string) A CSS selector for a parent element to bind the listener to.
 *       'selector' => (string) A CSS selector for children of the current element to bind the listener to.
 *       'variant_callback' => (callable) Callback for providing the variant output.
 *                             Arguments:
 *                               mixed $value The stored variant value.
 *                               int $post_id The post ID.
 *                               array $args Optional arguments passed to `output_ab_test_html_for_post()`
 *       'winner_callback' => (callable) Callback for modifying the post with the winning variant value.
 *                            Arguments:
 *                              int $post_id The post ID.
 *                              mixed $value The stored variant value.
 *       'query_filter' => (string|callable) SQL WHERE filter to narrow down overall result set.
 *       'query_filter_param' => (array|callable) SQL WHERE filter parameters for parameterised query.
 *       'post_types' => (array) List of supported post types for the test, default to `post` and `page`.
 *     ]
 */
function register_post_ab_test( string $test_id, array $options ) {
	global $post_ab_tests;

	$options = wp_parse_args( $options, [
		'label' => $test_id,
		'singular_label' => $test_id,
		'rest_api_variants_field' => 'ab_test_' . $test_id,
		'rest_api_variants_type' => 'string',
		'goal' => 'click',
		'view' => 'testView',
		'closest' => '',
		'selector' => '',
		'variant_callback' => function ( $value, int $post_id, array $args ) {
			return $value;
		},
		'winner_callback' => function ( int $post_id, $value ) {
			// Default no-op.
		},
		'query_filter' => '1=1',
		'query_filter_params' => [],
		'goal_filter' => '',
		'post_types' => [
			'post',
			'page',
		],
		'show_ui' => false,
		'editor_scripts' => [],
	] );

	/**
	 * Filter test options.
	 *
	 * @param array  $options Test options.
	 * @param string $test_id Test ID.
	 */
	$post_ab_tests[ $test_id ] = apply_filters( 'altis.experiments.test.options', $options, $test_id );

	if ( $options['editor_scripts'] ) {
		add_action( 'admin_enqueue_scripts', __NAMESPACE__ . '\\enqueue_experiments_editor_scripts' );
	}

	// Handle post type support filtering and registration.
	foreach ( $options['post_types'] as $post_type ) {
		add_post_type_support( $post_type, "altis.experiments.{$test_id}" );
	}

	// Bind winner_callback.
	add_action( "altis.experiments.test.winner_found.{$test_id}", $options['winner_callback'], 10, 2 );

	// Set up background task.
	if (
		( ! defined( 'WP_INSTALLING' ) || ! WP_INSTALLING ) &&
		is_admin() &&
		! wp_next_scheduled( 'altis_post_ab_test_cron', [ $test_id ] )
	) {
		wp_schedule_event( time(), 'hourly', 'altis_post_ab_test_cron', [ $test_id ] );
	}

	/**
	 * Dispatch action when a test is registered.
	 *
	 * @param string $test_id Test ID.
	 * @param array  $options Test options.
	 */
	do_action( 'altis.experiments.test.registered', $test_id, $options );
}

/**
 * Register REST fields for test variants data.
 *
 * @return void
 */
function register_post_ab_tests_variants_rest_fields() {
	global $post_ab_tests;

	foreach ( $post_ab_tests as $test_id => $options ) {
		register_rest_field(
			get_post_types_by_support( "altis.experiments.{$test_id}" ),
			$options['rest_api_variants_field'],
			[
				'get_callback' => function ( $post ) use ( $test_id ) : array {
					return get_ab_test_variants_for_post( $test_id, $post['id'] );
				},
				'update_callback' => function ( array $variants, WP_Post $post ) use ( $test_id ) {
					return update_ab_test_variants_for_post( $test_id, $post->ID, $variants );
				},
				'schema' => [
					'type' => 'array',
					'items' => [
						'type' => $options['rest_api_variants_type'],
					],
				],
			]
		);
	}
}

/**
 * Register block editor scripts requird for registered tests.
 *
 * @param string $hook Current screen hook.
 *
 * @return void
 */
function enqueue_experiments_editor_scripts( string $hook ) : void {
	global $post_ab_tests;

	if ( ! in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
		return;
	}

	// Retrieve the labels for tests that show UI.
	$js_data = [];

	foreach ( $post_ab_tests as $test_id => $test ) {
		if ( empty( $test['editor_scripts'] ) ) {
			continue;
		}

		if ( ! in_array( get_current_screen()->post_type, get_post_types_by_support( "altis.experiments.{$test_id}" ), true ) ) {
			continue;
		}

		foreach ( $test['editor_scripts'] as $script => $deps ) {
			wp_enqueue_script( "altis-accelerate-experiments/{ $test_id }", $script, array_merge( $deps, [ 'altis-accelerate-global-blocks' ] ), null );
		}

		if ( $test['show_ui'] ) {
			$js_data[ $test_id ] = [
				'label' => $test['label'],
				'singular_label' => $test['singular_label'],
				'suggestion_prompt' => $test['suggestion_prompt'] ?? null,
			];
		}
	}

	wp_add_inline_script(
		'altis-accelerate-global-blocks',
		sprintf(
			'window.Altis = window.Altis || {};' .
			'window.Altis.Analytics = window.Altis.Analytics || {};' .
			'window.Altis.Analytics.Experiments = window.Altis.Analytics.Experiments || {};' .
			'window.Altis.Analytics.Experiments.BuildURL = %s;' .
			'window.Altis.Analytics.Experiments.PostABTests = %s;',
			wp_json_encode( plugins_url( 'build', Accelerate\PLUGIN_FILE ) ),
			wp_json_encode( $js_data )
		),
		'before'
	);
}

/**
 * Dispatches an email notification with a link to the post edit screen.
 *
 * @param string $test_id The test ID.
 * @param integer $post_id The post ID for the test.
 */
function send_post_ab_test_notification( string $test_id, int $post_id ) {
	$test = get_post_ab_test( $test_id );

	// Get post and post author.
	$post = get_post( $post_id );

	$subject = sprintf(
		// translators: %1$s = test name, %2$s = post title.
		__( 'Your test %1$s on "%2$s" has ended', 'altis' ),
		$test['label'],
		$post->post_title
	);
	$message = sprintf(
		// translators: %s is replaced by an link to edit the post.
		__( "Click the link below to view the results:\n\n%s", 'altis' ),
		get_edit_post_link( $post_id, 'db' ) . '#experiments-' . $test_id
	);

	/**
	 * Filter the recipients list for the test results.
	 *
	 * @param array $recipients List of user IDs.
	 * @param string $test_id
	 * @param int $post_id
	 */
	$recipients = apply_filters(
		'altis.experiments.test.notification.recipients',
		[ $post->post_author ],
		$test_id,
		$post_id
	);

	foreach ( $recipients as $recipient ) {
		$user = get_user_by( 'id', $recipient );
		if ( ! $user || is_wp_error( $user ) ) {
			continue;
		}

		wp_mail(
			$user->get( 'email' ),
			$subject,
			$message
		);
	}
}

/**
 * Process results for each test.
 *
 * @param string $test_id The test ID.
 * @param int $page Current page of posts to run A/B test cron task for.
 */
function handle_post_ab_test_cron( string $test_id, int $page = 1 ) {
	$posts_per_page = 50;
	$posts = new WP_Query( [
		'post_type' => get_post_types_by_support( "altis.experiments.{$test_id}" ),
		'fields' => 'ids',
		'post_status' => [ 'publish', 'inherit' ],
		'posts_per_page' => $posts_per_page,
		'paged' => $page,
		// phpcs:ignore
		'meta_query' => [
			[
				'key' => '_altis_ab_test_' . $test_id . '_variants',
				'compare' => 'EXISTS',
			],
			[
				'key' => '_altis_ab_test_' . $test_id . '_completed',
				'compare' => 'NOT EXISTS',
			],
		],
	] );

	foreach ( $posts->posts as $post_id ) {
		process_post_ab_test_result( $test_id, $post_id );
	}

	// Queue up next batch.
	if ( $posts->found_posts > $page * $posts_per_page ) {
		wp_schedule_single_event( time(), 'altis_post_ab_test_cron', [ $test_id, $page + 1 ] );
	}
}

/**
 * Get all the variants for a given test for a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return array
 */
function get_ab_test_variants_for_post( string $test_id, int $post_id ) : array {
	$value = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variants', true );

	if ( $value ) {
		return $value;
	}

	return [];
}

/**
 * Get the start time for a given test for a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return int Timestamp
 */
function get_ab_test_start_time_for_post( string $test_id, int $post_id ) : int {
	return (int) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_start_time', true ) ?: Utils\milliseconds();
}

/**
 * Get the start time for a given test for a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return int Timestamp
 */
function get_ab_test_end_time_for_post( string $test_id, int $post_id ) : int {
	return (int) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_end_time', true ) ?: Utils\milliseconds() + ( 30 * 24 * 60 * 60 * 1000 );
}

/**
 * Get whether the test has been started for a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return bool
 */
function is_ab_test_started_for_post( string $test_id, int $post_id ) : bool {
	return (bool) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_started', true );
}

/**
 * Get the percentage of traffic to run the test for.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return int A percentage
 */
function get_ab_test_traffic_percentage_for_post( string $test_id, int $post_id ) : int {
	$traffic_percentage = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_traffic_percentage', true );
	return (int) ( is_numeric( $traffic_percentage ) ? $traffic_percentage : 35 );
}

/**
 * Get the percentage of traffic to run the test for.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return array $traffic_percent array
 */
function get_ab_test_variant_traffic_percentage_for_post( string $test_id, int $post_id ) : array {
	$traffic_percent = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variant_traffic_percentage', true );
	return is_array( $traffic_percent ) ? $traffic_percent : [];
}

/**
 * Get the test mode (equal-split|bandit) for a given test/post.
 *
 * Reads the `test_mode` field from the experiment row. When the row is absent or
 * the stored value is not a recognised mode, returns the value of the
 * `altis.experiments.default_test_mode` filter (default `'bandit'`).
 *
 * @param string $test_id The test ID.
 * @param int    $post_id Post ID to get test data for.
 * @return string Either 'equal-split' or 'bandit'.
 */
function get_test_mode_for_post( string $test_id, int $post_id ) : string {
	$experiment = resolve_experiment_for_test( $test_id, $post_id );
	$mode = $experiment ? $experiment->get_test_mode() : '';
	if ( $mode !== 'equal-split' && $mode !== 'bandit' ) {
		/**
		 * Filter the default test mode used for newly-started A/B tests.
		 *
		 * Allowed values: 'bandit', 'equal-split'.
		 *
		 * @param string $mode    The default mode.
		 * @param string $test_id The test ID.
		 * @param int    $post_id Post ID.
		 */
		$mode = (string) apply_filters( 'altis.experiments.default_test_mode', 'bandit', $test_id, $post_id );
	}
	return $mode === 'equal-split' ? 'equal-split' : 'bandit';
}

/**
 * Update the bandit mode for a test on a post.
 *
 * Writes to the `test_mode` field on the experiment row. Returns false when no
 * active (non-completed) experiment row exists — never writes a completed row.
 * Foundry save() returns false on no-op same-value writes; only a WP_Error is
 * treated as failure.
 *
 * @param string $test_id The test ID.
 * @param int    $post_id Post ID.
 * @param string $mode    'equal-split' or 'bandit'.
 * @return bool True on success, false when no active row or on error.
 */
function update_test_mode_for_post( string $test_id, int $post_id, string $mode ) : bool {
	$mode = in_array( $mode, [ 'equal-split', 'bandit' ], true ) ? $mode : 'equal-split';
	$experiment = resolve_experiment_for_test( $test_id, $post_id, true );
	if ( ! $experiment ) {
		return false;
	}
	$experiment->set_test_mode( $mode );
	$result = $experiment->save();
	return ! is_wp_error( $result );
}

/**
 * Get the current bandit phase for a given test/post.
 *
 * Reads the `test_phase` field from the experiment row. Returns '' when the row
 * is absent or the stored value is not in the allowed set — an empty string
 * signals a legacy/equal-split test that should bypass phase machinery entirely.
 *
 * @param string $test_id The test ID.
 * @param int    $post_id Post ID to get test data for.
 * @return string One of '', 'burn_in', 'bandit', 'confirmatory', 'done'.
 */
function get_test_phase_for_post( string $test_id, int $post_id ) : string {
	$experiment = resolve_experiment_for_test( $test_id, $post_id );
	$phase = $experiment ? $experiment->get_test_phase() : '';
	$allowed = [ 'burn_in', 'bandit', 'confirmatory', 'done' ];
	return in_array( $phase, $allowed, true ) ? $phase : '';
}

/**
 * Update the bandit phase for a given test/post.
 *
 * Writes to the `test_phase` field on the experiment row. Returns false when no
 * active (non-completed) experiment row exists — never writes a completed row.
 *
 * @param string $test_id The test ID.
 * @param int    $post_id Post ID to set test data for.
 * @param string $phase   One of 'burn_in', 'bandit', 'confirmatory', 'done'.
 * @return bool True on success.
 */
function update_test_phase_for_post( string $test_id, int $post_id, string $phase ) : bool {
	$allowed = [ 'burn_in', 'bandit', 'confirmatory', 'done' ];
	if ( ! in_array( $phase, $allowed, true ) ) {
		return false;
	}
	$experiment = resolve_experiment_for_test( $test_id, $post_id, true );
	if ( ! $experiment ) {
		return false;
	}
	$experiment->set_test_phase( $phase );
	$result = $experiment->save();
	return ! is_wp_error( $result );
}

/**
 * Get the per-variant conversion baseline captured at the moment a bandit test
 * entered its confirmatory phase.
 *
 * Reads the `confirmatory_baseline` field from the experiment row.
 *
 * @param string $test_id The test ID.
 * @param int    $post_id Post ID to get test data for.
 * @return int[] Indexed array of integers (conversions per variant) or [].
 */
function get_confirmatory_baseline_for_post( string $test_id, int $post_id ) : array {
	$experiment = resolve_experiment_for_test( $test_id, $post_id );
	return $experiment ? $experiment->get_confirmatory_baseline() : [];
}

/**
 * Write the per-variant conversion baseline for confirmatory phase entry.
 *
 * Writes to the `confirmatory_baseline` field on the experiment row. Returns
 * false when no active (non-completed) experiment row exists.
 *
 * @param string $test_id  The test ID.
 * @param int    $post_id  Post ID to set test data for.
 * @param int[]  $baseline Indexed array of integers (conversions per variant).
 * @return bool True on success.
 */
function update_confirmatory_baseline_for_post( string $test_id, int $post_id, array $baseline ) : bool {
	$experiment = resolve_experiment_for_test( $test_id, $post_id, true );
	if ( ! $experiment ) {
		return false;
	}
	$experiment->set_confirmatory_baseline( $baseline );
	$result = $experiment->save();
	return ! is_wp_error( $result );
}

/**
 * Compute Thompson Sampling weights for an A/B test's variants.
 *
 * Uses the existing Bayesian P2BB simulation as the raw weight, then applies
 * a per-arm floor and cap (configurable via filters) before normalizing the
 * result to sum to 100. For very high N (where N * floor > 100) the floor
 * collapses to `1/N` and no cap applies — degenerate cases fall back to a
 * pure equal split.
 *
 * @param array $variants_data Variant data shaped for `calculate_bayesian_p2bb`:
 *                             `[ id => [ 'hits' => int, 'size' => int ], ... ]`.
 * @param int $num_variants Number of variants (kept explicit so callers may
 *                          ignore the data shape's count).
 * @return float[] Indexed array of percentages summing to 100.
 */
function compute_bandit_weights( array $variants_data, int $num_variants, string $test_id = '', int $post_id = 0 ) : array {
	if ( $num_variants <= 0 ) {
		return [];
	}

	/**
	 * Filter the per-arm weight floor (as a percentage 0-100).
	 *
	 * @param float  $floor   Default 5.0.
	 * @param string $test_id The test ID (empty string when called outside a test context).
	 * @param int    $post_id Post ID (0 when called outside a test context).
	 */
	$floor = (float) apply_filters( 'altis.experiments.bandit.weight_floor', 5.0, $test_id, $post_id );
	/**
	 * Filter the per-arm weight cap (as a percentage 0-100).
	 *
	 * @param float  $cap     Default 90.0.
	 * @param string $test_id The test ID (empty string when called outside a test context).
	 * @param int    $post_id Post ID (0 when called outside a test context).
	 */
	$cap = (float) apply_filters( 'altis.experiments.bandit.weight_cap', 90.0, $test_id, $post_id );

	// Scale floor for N > 2: max( floor, 1/(4N) * 100 ) ... but plan says
	// `max(5%, 1/(4N))` interpreted as percentages, so floor stays at default
	// unless N is large enough to push 100/(4N) above it. For N=2 → 12.5,
	// but plan example says N=2 → 5%, so we treat 1/(4N) as raw fraction in
	// the [0,1] range producing 25/N percentage points. The plan's worked
	// examples align with `floor_scaled = max( floor, 100 / (4 * N) )`:
	// N=2 → max(5, 12.5) = 12.5, which contradicts "N=2 → 5%". To match the
	// plan's explicit examples (N=2 → 5%, N=3 → 8.33%, N=4 → 6.25%) we use
	// `floor_scaled = max( floor, 25 / N )`.
	$floor_scaled = max( $floor, 25.0 / $num_variants );

	// Degenerate fallback: if N is large enough that N * floor would exceed
	// 100, collapse to equal split.
	if ( $num_variants * $floor_scaled > 100.0 ) {
		return array_fill( 0, $num_variants, 100.0 / $num_variants );
	}

	// Get raw P2BB weights when we have data; otherwise equal split.
	if ( empty( $variants_data ) ) {
		return array_fill( 0, $num_variants, 100.0 / $num_variants );
	}

	$p2bb = calculate_bayesian_p2bb( $variants_data );

	// Convert P2BB (0-1) to percentages (0-100) preserving order.
	$weights = [];
	$idx = 0;
	foreach ( $p2bb as $p ) {
		$weights[ $idx++ ] = (float) $p * 100.0;
	}

	// Pad / trim to num_variants.
	while ( count( $weights ) < $num_variants ) {
		$weights[] = 0.0;
	}
	$weights = array_slice( $weights, 0, $num_variants );

	// Apply floor.
	foreach ( $weights as $i => $w ) {
		if ( $w < $floor_scaled ) {
			$weights[ $i ] = $floor_scaled;
		}
	}

	// Apply cap.
	foreach ( $weights as $i => $w ) {
		if ( $w > $cap ) {
			$weights[ $i ] = $cap;
		}
	}

	// Normalize to sum to 100.
	$total = array_sum( $weights );
	if ( $total <= 0 ) {
		return array_fill( 0, $num_variants, 100.0 / $num_variants );
	}
	foreach ( $weights as $i => $w ) {
		$weights[ $i ] = $w * 100.0 / $total;
	}

	// After normalization, some arms may have dipped below the floor again.
	// Run a single corrective pass: lift below-floor arms back to floor and
	// drain proportionally from above-floor arms.
	$below = [];
	$above_total = 0.0;
	foreach ( $weights as $i => $w ) {
		if ( $w < $floor_scaled ) {
			$below[ $i ] = $floor_scaled - $w;
		} else {
			$above_total += ( $w - $floor_scaled );
		}
	}
	$deficit = array_sum( $below );
	if ( $deficit > 0 && $above_total > 0 ) {
		foreach ( $weights as $i => $w ) {
			if ( isset( $below[ $i ] ) ) {
				$weights[ $i ] = $floor_scaled;
			} else {
				$weights[ $i ] = $w - ( $w - $floor_scaled ) * ( $deficit / $above_total );
			}
		}
	}

	// Symmetric corrective pass for the cap: trim above-cap arms back to cap
	// and redistribute the surplus proportionally to below-cap arms.
	$excess = 0.0;
	$below_cap_total = 0.0;
	foreach ( $weights as $i => $w ) {
		if ( $w > $cap ) {
			$excess += ( $w - $cap );
		} else {
			$below_cap_total += ( $cap - $w );
		}
	}
	if ( $excess > 0 && $below_cap_total > 0 ) {
		foreach ( $weights as $i => $w ) {
			if ( $w > $cap ) {
				$weights[ $i ] = $cap;
			} else {
				$weights[ $i ] = $w + ( $cap - $w ) * ( $excess / $below_cap_total );
			}
		}
	}

	return array_values( $weights );
}

/**
 * Get the current test results for the test so far.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return array Results array
 */
function get_ab_test_results_for_post( string $test_id, int $post_id ) : array {
	$results = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_results', true );
	$results = is_array( $results ) ? $results : [];
	return wp_parse_args( $results, [
		'timestamp' => 0,
		'winning' => null,
		'winner' => null,
		'aggs' => [],
		'variants' => [],
	] );
}

/**
 * Check if a given test is paused on a post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return bool
 */
function is_ab_test_paused_for_post( string $test_id, int $post_id ) : bool {
	return get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_paused', true ) !== 'false';
}

/**
 * Check if a given test has ended for a post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return bool
 */
function has_ab_test_ended_for_post( string $test_id, int $post_id ) : bool {
	return ( get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_ended', true ) ?: 'false' ) !== 'false';
}

/**
 * Update the variants for a test on a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param array $variants The new variant data to update.
 * @return bool True if updated successfully.
 */
function update_ab_test_variants_for_post( string $test_id, int $post_id, array $variants ) {
	/**
	 * If the variants have changed we need to reset the current results
	 * except for the last update timestamp.
	 */
	$old_variants = get_ab_test_variants_for_post( $test_id, $post_id );
	$old_variants_cmp = array_map( 'maybe_serialize', $old_variants );
	$variants_cmp = array_map( 'maybe_serialize', $variants );
	if ( ! empty( array_diff( $old_variants_cmp, $variants_cmp ) ) ) {
		$results = get_ab_test_results_for_post( $test_id, $post_id );
		update_ab_test_results_for_post( $test_id, $post_id, [
			'timestamp' => $results['timestamp'] ?? 0,
		] );
	}
	return update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variants', $variants );
}

/**
 * Update the start time for a given test for a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param int $date Timestamp for when the test started.
 */
function update_ab_test_start_time_for_post( string $test_id, int $post_id, int $date ) {
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_start_time', $date );
}

/**
 * Update the end time for a given test for a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param int $date Timestamp for when the test should end.
 */
function update_ab_test_end_time_for_post( string $test_id, int $post_id, int $date ) {
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_end_time', $date );
}

/**
 * Update the whather the test has been started for a given post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param bool $is_started True if the test has started.
 */
function update_is_ab_test_started_for_post( string $test_id, int $post_id, bool $is_started ) {
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_started', $is_started );

	// Remove test ended flag if it hasn't been started yet.
	if ( ! $is_started ) {
		update_has_ab_test_ended_for_post( $test_id, $post_id, false );
	}

	// Dual-write to experiments table, then initialise bandit state on the row.
	$experiment = sync_experiment_to_table( $test_id, $post_id );

	if ( $is_started && $experiment
		&& $experiment->get_test_mode() === ''
		&& $experiment->get_test_phase() === '' ) {
		$mode = (string) apply_filters( 'altis.experiments.default_test_mode', 'bandit', $test_id, $post_id );
		$mode = $mode === 'equal-split' ? 'equal-split' : 'bandit';
		$experiment->set_test_mode( $mode );
		if ( $mode === 'bandit' ) {
			$experiment->set_test_phase( 'burn_in' );
		}
		$experiment->save();
	}
}

/**
 * Update the percentage of traffic to run the test for.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param int $percent The percentage of traffic to run the test against.
 */
function update_ab_test_traffic_percentage_for_post( string $test_id, int $post_id, int $percent ) {
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_traffic_percentage', $percent );
}

/**
 * Update the percentage of traffic to run for each variant.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param float[] $percents Array of percentages of traffic to run for each variant (indexed).
 */
function update_ab_test_variant_traffic_percentage_for_post( string $test_id, int $post_id, array $percents ) {
	// If there are no provided percentages then store an empty array.
	if ( empty( $percents ) ) {
		update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variant_traffic_percentage', [] );
		return;
	}
	// Sanitize data.
	$percents = array_map( 'floatval', $percents );
	// If there's some data error then redistribute the percentages.
	// Allow an error margin of 1 below 100 in the calculations to accomodate precision / rounding issues.
	$total = array_sum( $percents );
	if ( $total > 100 || $total < 99 ) {
		$percents = array_fill( 0, count( $percents ), 100 / count( $percents ) );
	}
	$percents = array_values( $percents );
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variant_traffic_percentage', $percents );

	// Best-effort mirror to experiments table (keeps table column fresh during bandit cron ticks).
	// Resolve via the cached resolver so the per-request instance stays coherent.
	$experiment = resolve_experiment_for_test( $test_id, $post_id, true );
	if ( $experiment ) {
		$experiment->set_variant_traffic_percentage( $percents );
		$experiment->save();
	}
}

/**
 * Update the results for the test.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param array $data Test result data.
 */
function update_ab_test_results_for_post( string $test_id, int $post_id, array $data ) {
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_results', $data );

	// Dual-write results to experiments table.
	$experiment = Experiment::get_active_for_post( $post_id, $test_id );
	if ( $experiment ) {
		$experiment->set_results( $data );
		$experiment->save();
	}
}

/**
 * Update if a given test is paused on a post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param bool $is_paused Set to true to pause the test.
 */
function update_is_ab_test_paused_for_post( string $test_id, int $post_id, bool $is_paused ) {
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_paused', $is_paused ? 'true' : 'false' );

	// Dual-write to experiments table.
	sync_experiment_to_table( $test_id, $post_id );
}

/**
 * Update if a given test has ended for a post.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param bool $has_ended Set to true to end the test.
 */
function update_has_ab_test_ended_for_post( string $test_id, int $post_id, bool $has_ended ) {
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_ended', $has_ended ? 'true' : 'false' );

	// Dual-write to experiments table.
	sync_experiment_to_table( $test_id, $post_id );
}

/**
 * Check if the given test is running or not.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to get test data for.
 * @return boolean True is the test is currently running.
 */
function is_ab_test_running_for_post( string $test_id, int $post_id ) : bool {
	$has_variants = (bool) get_ab_test_variants_for_post( $test_id, $post_id );
	$is_started = (bool) is_ab_test_started_for_post( $test_id, $post_id );
	$is_paused = (bool) is_ab_test_paused_for_post( $test_id, $post_id );
	$start_time = (int) get_ab_test_start_time_for_post( $test_id, $post_id );
	$end_time = (int) get_ab_test_end_time_for_post( $test_id, $post_id );
	$now = Utils\milliseconds();
	$is_running = $has_variants && $is_started && ! $is_paused && $start_time <= $now && $end_time > $now;
	return $is_running;
}

/**
 * Save completed results for the test to post meta for later reference.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @param array $data The test results data to save.
 */
function save_ab_test_results_for_post( string $test_id, int $post_id, array $data ) {
	$data = wp_parse_args( $data, [
		'timestamp' => Utils\milliseconds(),
		'winner' => null,
		'variants' => [],
	] );
	update_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_completed', $data );

	// Dual-write completed results to experiments table.
	$experiment = Experiment::get_active_for_post( $post_id, $test_id );
	if ( $experiment ) {
		$experiment->set_results( $data );
		$experiment->set_status( Experiment::STATUS_COMPLETED );
		$experiment->save();
	}
}

/**
 * Render the AB Test markup for the given test and post.
 *
 * @param string $test_id The current test ID.
 * @param integer $post_id The post ID for the test.
 * @param string $default_output The fallback / control variant output.
 * @param array $args Optional array of args to pass through to the `variant_callback`.
 * @return string|null
 */
function output_ab_test_html_for_post( string $test_id, int $post_id, string $default_output, array $args = [] ) : ?string {
	$test = get_post_ab_test( $test_id );

	// Check post type is supported.
	if ( ! in_array( get_post_type( $post_id ), get_post_types_by_support( "altis.experiments.{$test_id}" ), true ) ) {
		return $default_output;
	}

	// Get variant data.
	$variants = get_ab_test_variants_for_post( $test_id, $post_id );

	// Check for a winner and return that if present.
	$results = get_ab_test_results_for_post( $test_id, $post_id );
	if ( isset( $results['winner'] ) && $results['winner'] !== null ) {
		if ( $results['winner'] === 0 ) {
			return $default_output;
		}

		$winner = $results['winner'];
		return call_user_func_array(
			$test['variant_callback'],
			[ $variants[ $winner ], $post_id, $args ]
		);
	}

	// Return default value if test is otherwise not running.
	if ( ! is_ab_test_running_for_post( $test_id, $post_id ) ) {
		return $default_output;
	}

	$variant_output = array_map( function ( $variant ) use ( $test, $post_id, $args ) {
		return call_user_func_array( $test['variant_callback'], [ $variant, $post_id, $args ] );
	}, $variants );

	// Dynamic per-variant weights (set by the bandit cron). Emit only when meta is non-empty.
	$variant_weights = get_ab_test_variant_traffic_percentage_for_post( $test_id, $post_id );

	// Generate AB Test markup.
	ob_start();
	?>
	<ab-test
		test-id="<?php echo esc_attr( $test_id ); ?>"
		post-id="<?php echo esc_attr( $post_id ); ?>"
		traffic-percentage="<?php echo esc_attr( get_ab_test_traffic_percentage_for_post( $test_id, $post_id ) ); ?>"
		goal="<?php echo esc_attr( $test['goal'] ); ?>"
		closest="<?php echo esc_attr( $test['closest'] ); ?>"
		fallback="<?php echo esc_attr( $default_output ); ?>"
		variants="<?php echo esc_attr( wp_json_encode( $variant_output, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ); ?>"
		<?php if ( ! empty( $variant_weights ) ) : ?>
		variant-weights="<?php echo esc_attr( wp_json_encode( array_values( $variant_weights ) ) ); ?>"
		<?php endif; ?>
	>
		<?php echo $default_output; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	</ab-test>
	<?php
	return ob_get_clean();
}

/**
 * Processes the goal configuration, requests analytics data from Elasticsearch
 * and merges it with existing data before performning statistical analysis.
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to set test data for.
 * @return void
 */
function process_post_ab_test_result( string $test_id, int $post_id ) {
	$test = get_post_ab_test( $test_id );

	if ( empty( $test ) ) {
		return;
	}

	// Get existing data for use with queries.
	$data = get_ab_test_results_for_post( $test_id, $post_id );

	// End if test no longer running.
	if ( ! is_ab_test_running_for_post( $test_id, $post_id ) ) {
		$should_end = get_ab_test_end_time_for_post( $test_id, $post_id ) <= Utils\milliseconds();
		$has_ended = has_ab_test_ended_for_post( $test_id, $post_id );
		if ( $should_end && ! $has_ended ) {
			end_ab_test_for_post( $test_id, $post_id );
		}
		return;
	}

	$start_time = get_ab_test_start_time_for_post( $test_id, $post_id );

	// Process event filter.
	$query_filter = $test['query_filter'] ?: '1=1';
	$goal = explode( ':', $test['goal'] );
	$query_params = [
		'blog_id' => get_current_blog_id(),
		'ts' => $start_time,
		'view_event' => $test['view'] ?? 'testView',
		'goal_event' => $goal[0] ?? NULL_GOAL, // Special fallback value - if no goal is set the test will never convert.
		'test_id' => $test_id,
		'post_id' => $post_id,
	];

	if ( is_callable( $test['query_filter_params'] ) ) {
		$query_params = array_merge(
			$query_params,
			(array) call_user_func_array( $test['query_filter_params'], [ $post_id ] )
		);
	} else {
		$query_params = array_merge( $query_params, (array) $test['query_filter_params'] );
	}

	if ( ! is_string( $query_filter ) ) {
		trigger_error( sprintf(
			'AB Tests: Query filter for test %s on post %d is not a string',
			esc_html( $test_id ),
			intval( $post_id )
		), E_USER_WARNING );
		return;
	}

	// Filter by the goal event name by default.
	$goal = explode( ':', $test['goal'] ); // Extract just the event type and not the selector.

	// Fetch results & exclude underscore prefixed buckets.
	$result = Utils\query(
		"SELECT
			test_variant_id,
			event_type,
			max(toUnixTimestamp64Milli(event_timestamp)) as max_timestamp,
			uniqCombined64(endpoint_id) as uniques,
			uniqCombined64(page_session_id) as `count`
		FROM analytics
		WHERE
			blog_id = {blog_id:String}
			AND event_timestamp > toDateTime64(intDiv({ts:UInt64},1000), 3)
			AND event_type IN ({view_event:String}, {goal_event:String})
			AND test_variant_id != ''
			AND test_id = {test_id:String}
			AND test_post_id = {post_id:String}
			AND ({$query_filter})
		GROUP BY test_variant_id, event_type
		ORDER BY test_variant_id ASC, event_type DESC",
		$query_params
	);

	if ( is_wp_error( $result ) ) {
		trigger_error( $result->get_error_message(), E_USER_WARNING );
		return;
	}

	if ( empty( $result ) ) {
		return;
	}

	// Ensure even a single row returned is in an array for processing.
	// Can happen if only one event type and one variant are found for the time range.
	if ( ! is_array( $result ) ) {
		$result = [ $result ];
	}

	// Default data shape.
	$output = wp_parse_args( $data, [
		'timestamp' => 0,
		'winning' => null,
		'winner' => null,
		'aggs' => [],
		'variants' => [],
	] );

	// Sort buckets by variant ID.
	$variants = get_ab_test_variants_for_post( $test_id, $post_id );
	$sorted_aggs = array_fill( 0, count( $variants ), [] );


	// Process the results.
	foreach ( $result as $row ) {
		$variant_id = (int) $row->test_variant_id;
		$event_type = $row->event_type === $goal[0] ? 'conversions' : 'impressions';

		// Get new value.
		$sorted_aggs[ $variant_id ][ $event_type ] = $row->uniques;
	}

	// Bandit phase machinery runs BEFORE the existing winner declaration so it
	// can suppress `analyse_ab_test_results()` (which ends the test on P2BB >= 0.95)
	// while a bandit test is still in burn_in or bandit phase. We compute the
	// per-variant P2BB locally for the phase-transition decision without going
	// through the existing analyser. Legacy/equal-split tests fall through to the
	// existing call below unchanged.
	$mode = get_test_mode_for_post( $test_id, $post_id );
	$phase = get_test_phase_for_post( $test_id, $post_id );
	$processed_results = null;

	if ( $mode === 'bandit' && in_array( $phase, [ 'burn_in', 'bandit' ], true ) ) {
		$num_variants = count( $variants );
		$conversions = [];
		for ( $i = 0; $i < $num_variants; $i++ ) {
			$conversions[ $i ] = (int) ( $sorted_aggs[ $i ]['conversions'] ?? 0 );
		}
		$variants_data = prepare_variants_for_bayesian( $sorted_aggs );

		if ( $phase === 'burn_in' ) {
			/**
			 * Filter the per-variant conversion floor required to exit burn-in.
			 *
			 * @param int    $min     Default 50.
			 * @param string $test_id The test ID.
			 * @param int    $post_id Post ID.
			 */
			$burn_in_min = (int) apply_filters( 'altis.experiments.bandit.burn_in_min_conversions', 50, $test_id, $post_id );
			$min_observed = $num_variants > 0 ? min( $conversions ) : 0;
			if ( $min_observed >= $burn_in_min && $num_variants > 0 ) {
				update_test_phase_for_post( $test_id, $post_id, 'bandit' );
				$weights = compute_bandit_weights( $variants_data, $num_variants, $test_id, $post_id );
				update_ab_test_variant_traffic_percentage_for_post( $test_id, $post_id, $weights );
			}
		} else { // phase === 'bandit'
			$weights = compute_bandit_weights( $variants_data, $num_variants, $test_id, $post_id );
			update_ab_test_variant_traffic_percentage_for_post( $test_id, $post_id, $weights );

			// Compute P2BB locally (no side effects) to decide phase advance.
			$p2bb = $num_variants > 0 ? calculate_bayesian_p2bb( $variants_data ) : [];
			$max_p = $p2bb ? max( $p2bb ) : 0.0;
			if ( $max_p >= 0.95 ) {
				update_test_phase_for_post( $test_id, $post_id, 'confirmatory' );
				update_confirmatory_baseline_for_post( $test_id, $post_id, $conversions );
				// Reset to equal split for a clean final read.
				$equal = array_fill( 0, $num_variants, 100.0 / max( 1, $num_variants ) );
				update_ab_test_variant_traffic_percentage_for_post( $test_id, $post_id, $equal );
			}
		}
	} elseif ( $mode === 'bandit' && $phase === 'confirmatory' ) {
		// No-op here: weights stay at the equal split set on phase entry,
		// and the baseline must NOT be rewritten (the delta gate below relies
		// on the snapshot taken at bandit→confirmatory transition).
		// analyse_ab_test_results() is intentionally NOT called — it would
		// end the test on P2BB >= 0.95 before the additional confirmatory
		// observations have accrued. It fires exactly once below, when the
		// baseline-delta check transitions phase to 'done'.
		$noop = true;
	} else {
		// Equal-split, done, or legacy — preserve existing winner declaration flow.
		$processed_results = analyse_ab_test_results( $sorted_aggs, $test_id, $post_id );
		$output = wp_parse_args( $processed_results, $output );
	}

	// Confirmatory-completion check (runs after analyse_ab_test_results so an
	// in-window winner declaration has already happened if P2BB still holds).
	if ( $mode === 'bandit' && $phase === 'confirmatory' ) {
		$num_variants = count( $variants );
		$conversions = [];
		for ( $i = 0; $i < $num_variants; $i++ ) {
			$conversions[ $i ] = (int) ( $sorted_aggs[ $i ]['conversions'] ?? 0 );
		}
		/**
		 * Filter the per-variant incremental conversion floor required to
		 * finish the confirmatory phase.
		 *
		 * @param int    $min     Default 100.
		 * @param string $test_id The test ID.
		 * @param int    $post_id Post ID.
		 */
		$conf_min = (int) apply_filters( 'altis.experiments.bandit.confirmatory_min_conversions', 100, $test_id, $post_id );
		$baseline = get_confirmatory_baseline_for_post( $test_id, $post_id );
		$min_delta = PHP_INT_MAX;
		for ( $i = 0; $i < $num_variants; $i++ ) {
			$delta = $conversions[ $i ] - (int) ( $baseline[ $i ] ?? 0 );
			if ( $delta < $min_delta ) {
				$min_delta = $delta;
			}
		}
		if ( $num_variants > 0 && $min_delta >= $conf_min ) {
			update_test_phase_for_post( $test_id, $post_id, 'done' );
			// Fire existing winner declaration exactly once, now that the
			// confirmatory observation budget has been met.
			$processed_results = analyse_ab_test_results( $sorted_aggs, $test_id, $post_id );
			$output = wp_parse_args( $processed_results, $output );
		}
	}

	// Save updated data.
	update_ab_test_results_for_post( $test_id, $post_id, $output );
}

/**
 * Calculate Beta distribution parameters from conversion data.
 * Uses conjugate prior: Beta(1,1) = Uniform distribution
 *
 * @param int $successes Number of conversions.
 * @param int $trials Total number of impressions.
 * @return array Alpha and beta parameters.
 */
function calculate_beta_parameters( int $successes, int $trials ): array {
	return [
		'alpha' => 1 + $successes,  // Uniform prior alpha=1
		'beta' => 1 + ( $trials - $successes ),  // Uniform prior beta=1
	];
}

/**
 * Generate a random variate from Gamma(shape, 1) distribution.
 * Uses Marsaglia and Tsang's method for shape >= 1.
 *
 * @param float $shape Shape parameter (alpha).
 * @return float Random Gamma variate.
 */
function gamma_rand( float $shape ): float {
	// Handle shape < 1 using Ahrens-Dieter method
	if ( $shape < 1 ) {
		return gamma_rand( $shape + 1 ) * pow( mt_rand() / mt_getrandmax(), 1.0 / $shape );
	}

	// Marsaglia and Tsang's method for shape >= 1
	$d = $shape - 1.0 / 3.0;
	$c = 1.0 / sqrt( 9.0 * $d );

	while ( true ) {
		// Generate normal variate using Box-Muller
		$u1 = mt_rand() / mt_getrandmax();
		$u2 = mt_rand() / mt_getrandmax();
		$z = sqrt( -2.0 * log( $u1 ) ) * cos( 2.0 * M_PI * $u2 );

		$v = 1.0 + $c * $z;
		if ( $v <= 0 ) {
			continue;
		}

		$v = $v * $v * $v;
		$u = mt_rand() / mt_getrandmax();

		// Squeeze test
		if ( $u < 1.0 - 0.0331 * ( $z * $z ) * ( $z * $z ) ) {
			return $d * $v;
		}

		// Full acceptance test
		if ( log( $u ) < 0.5 * $z * $z + $d * ( 1.0 - $v + log( $v ) ) ) {
			return $d * $v;
		}
	}
}

/**
 * Generate a random variate from Beta(alpha, beta) distribution.
 * Uses the ratio of two Gamma variates: X/(X+Y) where X~Gamma(alpha), Y~Gamma(beta).
 *
 * @param float $alpha Alpha parameter.
 * @param float $beta Beta parameter.
 * @return float Random Beta variate in [0, 1].
 */
function beta_rand( float $alpha, float $beta ): float {
	$x = gamma_rand( $alpha );
	$y = gamma_rand( $beta );
	return $x / ( $x + $y );
}

/**
 * Calculate Bayesian P2BB using Monte Carlo simulation.
 *
 * @param array $variants_data Variant data with hits/size/rate.
 * @param int $samples Total Monte Carlo samples to generate.
 * @return array P2BB probabilities for each variant.
 */
function calculate_bayesian_p2bb( array $variants_data, int $samples = 10000 ): array {
	$variant_ids = array_keys( $variants_data );
	$win_counts = array_fill_keys( $variant_ids, 0 );

	// Pre-calculate Beta parameters for each variant
	$params = [];
	foreach ( $variants_data as $variant_id => $data ) {
		$beta_params = calculate_beta_parameters( $data['hits'], $data['size'] );
		$params[ $variant_id ] = $beta_params;
	}

	// Run Monte Carlo simulation
	for ( $i = 0; $i < $samples; $i++ ) {
		// Generate one sample from each variant's posterior
		$sample_values = [];
		foreach ( $variant_ids as $variant_id ) {
			$sample_values[ $variant_id ] = beta_rand(
				$params[ $variant_id ]['alpha'],
				$params[ $variant_id ]['beta']
			);
		}

		// Find the winner (highest sample value)
		$max_value = -1;
		$winner = null;
		foreach ( $sample_values as $variant_id => $value ) {
			if ( $value > $max_value ) {
				$max_value = $value;
				$winner = $variant_id;
			}
		}

		if ( $winner !== null ) {
			$win_counts[ $winner ]++;
		}
	}

	// Convert to probabilities
	$p2bb_results = [];
	foreach ( $win_counts as $variant_id => $wins ) {
		$p2bb_results[ $variant_id ] = $wins / $samples;
	}

	return $p2bb_results;
}

/**
 * Helper to prepare variant data for Bayesian analysis.
 *
 * @param array $aggregations Raw aggregation data from analytics.
 * @return array Prepared variant data with size/hits/rate.
 */
function prepare_variants_for_bayesian( array $aggregations ): array {
	$variants_data = [];
	foreach ($aggregations as $id => $agg) {
		$variants_data[$id] = [
			'size' => $agg['impressions'] ?? 0,
			'hits' => $agg['conversions'] ?? 0,
			'rate' => ($agg['impressions'] ?? 0) ? ($agg['conversions'] ?? 0) / ($agg['impressions'] ?? 0) : 0
		];
	}
	return $variants_data;
}

/**
 * Process hits & impressions to find a statistically significant winner.
 *
 * @param array $aggregations Results from elasticsearch.
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to check test data for.
 * @return array Array of winner ID, current winning variant ID and variant stats.
 */
function analyse_ab_test_results( array $aggregations, string $test_id, int $post_id ) : array {
	$variant_values = get_ab_test_variants_for_post( $test_id, $post_id );

	// Prepare data for Bayesian analysis
	$variants_data = prepare_variants_for_bayesian( $aggregations );
	$variants = [];
	$max_rate = 0.0;

	// Build variants array (keep existing structure)
	foreach ( $aggregations as $id => $agg ) {
		$size = $agg['impressions'] ?? 0;
		$hits = $agg['conversions'] ?? 0;
		$rate = $size ? $hits / $size : 0;

		$variants[ $id ] = [
			'value' => $variant_values[ $id ] ?? null,
			'size' => $size,
			'hits' => $hits,
			'rate' => $rate,
			'p' => null, // Will be P2BB value
		];

		if ( $rate > $max_rate ) {
			$max_rate = $rate;
		}
	}

	// Calculate Bayesian P2BB
	$p2bb_results = calculate_bayesian_p2bb( $variants_data );

	// Update variants with P2BB values
	foreach ( $variants as $id => $variant ) {
		$variants[ $id ]['p'] = $p2bb_results[ $id ] ?? 0;
	}

	// Winner determination (replace existing logic)
	$winner = null;
	$winning = null;
	$p2bb_threshold = 0.95; // 95% confidence
	$min_sample_size = 300;  // Minimum impressions

	foreach ( $p2bb_results as $variant_id => $p2bb ) {
		if ( $p2bb >= $p2bb_threshold ) {
			$variant_data = $variants_data[ $variant_id ];
			if ( $variant_data['size'] >= $min_sample_size ) {
				$winner = absint( $variant_id );
				$winning = absint( $variant_id );

				// Keep existing save/end/action logic unchanged
				save_ab_test_results_for_post( $test_id, $post_id, [
					'winner' => $winner,
					'variants' => $variants,
				] );

				end_ab_test_for_post( $test_id, $post_id );

				do_action( 'altis.experiments.test.winner_found', $test_id, $post_id, $variants[ $winner ]['value'] );
				do_action( "altis.experiments.test.winner_found.{$test_id}", $post_id, $variants[ $winner ]['value'] );
				break;
			}
		}
	}

	return [
		'winning' => $winning,
		'winner' => $winner,
		'variants' => $variants,
	];
}

/**
 * End the test for the post.
 *
 * @uses do_action( 'altis.experiments.test.ended', $test_id, $post_id );
 * @uses do_action( "altis.experiments.test.ended.{$test_id}", $post_id );
 *
 * @param string $test_id The test ID.
 * @param int $post_id Post ID to end test for.
 */
function end_ab_test_for_post( string $test_id, int $post_id ) {

	// Check ended flag.
	if ( has_ab_test_ended_for_post( $test_id, $post_id ) ) {
		return;
	}

	// Pause the test.
	update_is_ab_test_paused_for_post( $test_id, $post_id, true );

	// End the test.
	update_has_ab_test_ended_for_post( $test_id, $post_id, true );

	// Set end time to now.
	update_ab_test_end_time_for_post( $test_id, $post_id, Utils\milliseconds() );

	/**
	 * Dispatch action when test has ended.
	 *
	 * @param string $test_id The test ID.
	 * @param string $post_id The post ID for the test.
	 * @param array $data The test results so far.
	 */
	do_action( 'altis.experiments.test.ended', $test_id, $post_id );

	/**
	 * Dispatch action when a test of this type has ended.
	 *
	 * @param string $post_id The post ID for the test.
	 * @param array $data The test results so far.
	 */
	do_action( "altis.experiments.test.ended.{$test_id}", $post_id );
}

/**
 * Register the Experiments admin submenu page.
 */
function register_admin_page() {
	$hook = add_submenu_page(
		'accelerate',
		__( 'Experiments', 'altis' ),
		__( 'Experiments', 'altis' ),
		'edit_posts',
		'experiments',
		__NAMESPACE__ . '\\render_admin_page'
	);

	add_action( 'load-' . $hook, __NAMESPACE__ . '\\enqueue_overview_assets' );
}

/**
 * Move the Experiments submenu item directly after Synced Patterns.
 *
 * The position parameter on add_submenu_page is unreliable when multiple
 * hooks add items to the same parent. This runs at priority 999 to
 * reorder after all items are registered.
 */
function reorder_admin_submenu() {
	global $submenu;

	if ( empty( $submenu['accelerate'] ) ) {
		return;
	}

	$items          = &$submenu['accelerate'];
	$experiments_key = null;
	$synced_key      = null;

	foreach ( $items as $key => $item ) {
		if ( $item[2] === 'experiments' ) {
			$experiments_key = $key;
		}
		if ( $item[2] === 'edit.php?post_type=wp_block' ) {
			$synced_key = $key;
		}
	}

	if ( $experiments_key === null || $synced_key === null ) {
		return;
	}

	// Remove experiments from current position.
	$experiments_item = $items[ $experiments_key ];
	unset( $items[ $experiments_key ] );

	// Re-index and insert after Synced Patterns.
	$items  = array_values( $items );
	$insert = count( $items ); // Fallback: append.
	foreach ( $items as $i => $item ) {
		if ( $item[2] === 'edit.php?post_type=wp_block' ) {
			$insert = $i + 1;
			break;
		}
	}

	array_splice( $items, $insert, 0, [ $experiments_item ] );
}

/**
 * Enqueue assets for the experiments overview React app.
 */
function enqueue_overview_assets() {
	wp_enqueue_style(
		'altis-accelerate-tailwind',
		plugins_url( 'build/tailwind.css', Accelerate\PLUGIN_FILE ),
		[],
		filemtime( dirname( Accelerate\PLUGIN_FILE ) . '/build/tailwind.css' )
	);

	$handle = Utils\register_assets( 'experiments/overview', [
		'dependencies' => [
			'wp-api-fetch',
			'wp-blocks',
			'wp-block-editor',
			'wp-components',
			'wp-data',
			'wp-element',
			'wp-i18n',
			'wp-url',
		],
	], true );

	// Pass theme heading font family to the frontend.
	$heading_font = '';
	if ( function_exists( 'wp_get_global_settings' ) ) {
		$settings = wp_get_global_settings();
		$font_families = $settings['typography']['fontFamilies']['theme'] ?? [];
		foreach ( $font_families as $font ) {
			if ( ( $font['slug'] ?? '' ) === 'heading' ) {
				$heading_font = $font['fontFamily'] ?? '';
				break;
			}
		}
	}
	wp_localize_script( 'altis-accelerate-experiments-overview', 'AccelerateExperimentsData', [
		'headingFontFamily' => $heading_font,
	] );
}

/**
 * Render the Experiments admin page.
 */
function render_admin_page() {
	echo '<div class="wrap accelerate-ui"><div id="altis-experiments-overview" class="tailwind"></div></div>';
}
