<?php
/**
 * Experiment data migration.
 *
 * Backfills the accelerate_experiments table from existing post meta.
 * Safe to run multiple times — skips posts that already have experiment rows.
 *
 * @package Altis\Accelerate\Experiments
 */

namespace Altis\Accelerate\Experiments\Migration;

use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\Utils;

/**
 * Run the backfill migration.
 *
 * Scans all posts with experiment meta and creates corresponding
 * experiment table rows.
 *
 * @param int $batch_size Number of posts to process per batch.
 * @return array{ processed: int, created: int, skipped: int, errors: int }
 */
function backfill( int $batch_size = 100 ) : array {
	$stats = [
		'processed' => 0,
		'created'   => 0,
		'skipped'   => 0,
		'errors'    => 0,
	];

	$test_ids = get_registered_test_ids();

	foreach ( $test_ids as $test_id ) {
		$page = 1;
		do {
			$batch_stats = backfill_test_id( $test_id, $page, $batch_size );
			$stats['processed'] += $batch_stats['processed'];
			$stats['created']   += $batch_stats['created'];
			$stats['skipped']   += $batch_stats['skipped'];
			$stats['errors']    += $batch_stats['errors'];
			$page++;
		} while ( $batch_stats['processed'] === $batch_size );
	}

	return $stats;
}

/**
 * Get the test IDs to migrate.
 *
 * @return string[]
 */
function get_registered_test_ids() : array {
	return [ 'block', 'titles', 'featured_images' ];
}

/**
 * Get post types relevant to a given test ID.
 *
 * Block experiments run on wp_block (private post type).
 * Title/featured-image experiments run on public post types.
 *
 * @param string $test_id Test ID.
 * @return string[]
 */
function get_post_types_for_test_id( string $test_id ) : array {
	if ( $test_id === 'block' ) {
		return [ 'wp_block' ];
	}

	// Titles and featured images apply to any public post type.
	$types = get_post_types( [ 'public' => true ] );
	return array_values( $types );
}

/**
 * Backfill a single batch for a given test ID.
 *
 * @param string $test_id    Test ID to process.
 * @param int    $page       Page number.
 * @param int    $batch_size Posts per batch.
 * @return array{ processed: int, created: int, skipped: int, errors: int }
 */
function backfill_test_id( string $test_id, int $page, int $batch_size ) : array {
	$stats = [
		'processed' => 0,
		'created'   => 0,
		'skipped'   => 0,
		'errors'    => 0,
	];

	// Find all posts with variants for this test ID.
	// post_type => 'any' excludes private types like wp_block,
	// so we must list post types explicitly.
	$post_types = get_post_types_for_test_id( $test_id );
	$query = new \WP_Query( [
		'post_type'      => $post_types,
		'post_status'    => [ 'publish', 'inherit', 'draft' ],
		'posts_per_page' => $batch_size,
		'paged'          => $page,
		'fields'         => 'ids',
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		'meta_query'     => [
			[
				'key'     => '_altis_ab_test_' . $test_id . '_variants',
				'compare' => 'EXISTS',
			],
		],
	] );

	foreach ( $query->posts as $post_id ) {
		$stats['processed']++;

		// Check if experiment row already exists for this post + test_id.
		$existing = Experiment::query(
			[
				'subject_post_id' => $post_id,
				'test_id'         => $test_id,
			],
			[ 'per_page' => 1 ]
		)->get_results();

		if ( ! is_wp_error( $existing ) && count( $existing ) > 0 ) {
			$stats['skipped']++;
			continue;
		}

		$result = create_experiment_from_meta( $post_id, $test_id );
		if ( is_wp_error( $result ) ) {
			$stats['errors']++;
		} else {
			$stats['created']++;
		}
	}

	return $stats;
}

/**
 * Create an experiment row from existing post meta.
 *
 * @param int    $post_id Post ID.
 * @param string $test_id Test ID.
 * @return Experiment|\WP_Error The created experiment or error.
 */
function create_experiment_from_meta( int $post_id, string $test_id ) {
	$post = get_post( $post_id );
	if ( ! $post ) {
		return new \WP_Error( 'invalid_post', 'Post not found.' );
	}

	// Read existing meta.
	$variants      = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variants', true );
	$start_time    = (int) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_start_time', true );
	$end_time      = (int) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_end_time', true );
	$is_started    = (bool) get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_started', true );
	$is_paused     = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_paused', true ) !== 'false';
	$has_ended     = ( get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_ended', true ) ?: 'false' ) !== 'false';
	$traffic_pct   = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_traffic_percentage', true );
	$variant_pcts  = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_variant_traffic_percentage', true );
	$results       = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_results', true );
	$completed     = get_post_meta( $post_id, '_altis_ab_test_' . $test_id . '_completed', true );

	// Determine type from XB meta or test_id.
	$xb_type = get_post_meta( $post_id, '_xb_type', true );
	$type = Experiment::TYPE_ABTEST;
	if ( $xb_type === 'personalization' || get_post_meta( $post_id, '_xb_personalization', true ) ) {
		$type = Experiment::TYPE_PERSONALIZATION;
	}

	// For block experiments, if the block has been downgraded to standard
	// (no variant blocks in content), treat as completed.
	// Only trigger when _xb_type is explicitly 'standard', not when absent.
	if ( $test_id === 'block' && ! $has_ended && ! $completed && $xb_type === 'standard' ) {
		$has_ended = true;
	}

	// Determine status.
	$now = Utils\milliseconds();
	if ( $completed || $has_ended ) {
		$status = Experiment::STATUS_COMPLETED;
	} elseif ( $is_paused ) {
		$status = Experiment::STATUS_PAUSED;
	} elseif ( $is_started && $start_time <= $now ) {
		$status = Experiment::STATUS_RUNNING;
	} else {
		$status = Experiment::STATUS_DRAFT;
	}

	// Read additional meta.
	$goal = get_post_meta( $post_id, '_xb_goal', true ) ?: get_post_meta( $post_id, '_goal', true ) ?: 'engagement';

	$experiment = new Experiment();
	$experiment->set_subject_post_id( $post_id );
	$experiment->set_test_id( $test_id );
	$experiment->set_type( $type );
	$experiment->set_status( $status );
	$experiment->set_title( $post->post_title ?: '' );
	$experiment->set_goal( $goal );

	if ( is_numeric( $traffic_pct ) ) {
		$experiment->set_traffic_percentage( (int) $traffic_pct );
	}

	if ( is_array( $variant_pcts ) && ! empty( $variant_pcts ) ) {
		$experiment->set_variant_traffic_percentage( $variant_pcts );
	}

	if ( is_array( $variants ) && ! empty( $variants ) ) {
		$experiment->set_variants_snapshot( $variants );
	}

	// Use completed results if available, otherwise current results.
	$results_data = is_array( $completed ) ? $completed : ( is_array( $results ) ? $results : [] );
	if ( ! empty( $results_data ) ) {
		$experiment->set_results( $results_data );
	}

	if ( $start_time ) {
		$experiment->set_start_time( $start_time );
	}

	if ( $end_time ) {
		$experiment->set_end_time( $end_time );
	}

	$saved = $experiment->save();
	if ( is_wp_error( $saved ) ) {
		return $saved;
	}

	// Store the experiment ID as post meta for fast lookup.
	if ( $status !== Experiment::STATUS_COMPLETED ) {
		update_post_meta( $post_id, '_current_experiment_id', $experiment->get_id() );
	}

	return $experiment;
}
