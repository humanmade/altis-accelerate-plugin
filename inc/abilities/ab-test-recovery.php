<?php
/**
 * A/B test creation recovery helpers.
 *
 * @package Altis\Accelerate\Abilities\Recovery
 */

namespace Altis\Accelerate\Abilities\Recovery;

use Altis\Accelerate\Experiments;
use WP_Error;

const RECEIPT_META_PREFIX = '_altis_ab_test_recovery_';
const MAX_CONTENT_BYTES = 1048576;
const LOCK_TTL = 300;

/**
 * Return the content hash used by the create and restore contracts.
 *
 * @param string $content Block markup.
 * @return string
 */
function content_hash( string $content ) : string {
	return hash( 'sha256', $content );
}

/**
 * Validate a recovery request ID.
 *
 * @param string $request_id Caller supplied request ID.
 * @return bool
 */
function is_valid_request_id( string $request_id ) : bool {
	return (bool) preg_match( '/^[A-Za-z0-9._-]{1,128}$/', $request_id );
}

/**
 * Calculate the request identity bound to the current site, block and user.
 *
 * @param int    $block_id Block ID.
 * @param string $request_id Caller supplied request ID.
 * @return string
 */
function request_hash( int $block_id, string $request_id ) : string {
	return hash( 'sha256', implode( '|', [ get_current_blog_id(), $block_id, get_current_user_id(), $request_id ] ) );
}

/**
 * Return the private post-meta key for one recovery receipt.
 *
 * @param int    $block_id Block ID.
 * @param string $request_id Caller supplied request ID.
 * @return string
 */
function receipt_meta_key( int $block_id, string $request_id ) : string {
	return RECEIPT_META_PREFIX . request_hash( $block_id, $request_id );
}

/**
 * Obtain a short-lived, database-backed per-block lock.
 *
 * add_option() is atomic on the options table's unique option_name index and
 * works on hosts without a persistent object cache.
 *
 * @param int $block_id Block ID.
 * @return bool True when acquired.
 */
function acquire_lock( int $block_id ) : bool {
	$option_name = 'altis_ab_test_recovery_lock_' . md5( get_current_blog_id() . ':' . $block_id );
	$now = time();

	if ( add_option( $option_name, $now, '', 'no' ) ) {
		return true;
	}

	$locked_at = (int) get_option( $option_name, 0 );
	if ( $locked_at > 0 && $locked_at + LOCK_TTL < $now ) {
		delete_option( $option_name );
		return add_option( $option_name, $now, '', 'no' );
	}

	return false;
}

/**
 * Release a per-block lock.
 *
 * @param int $block_id Block ID.
 * @return void
 */
function release_lock( int $block_id ) : void {
	$option_name = 'altis_ab_test_recovery_lock_' . md5( get_current_blog_id() . ':' . $block_id );
	delete_option( $option_name );
}

/**
 * The exact block meta touched by standard A/B-test creation.
 *
 * @return string[]
 */
function tracked_meta_keys() : array {
	return [
		'_xb_abtest',
		'_xb_type',
		'_xb_type_standard',
		'_xb_type_abtest',
		'_xb_type_personalization',
		'_xb_goal',
		'_xb_traffic_percentage',
		'_xb_personalization',
		'_xb_hypothesis',
		'_altis_ab_test_block_variants',
		'_altis_ab_test_block_start_time',
		'_altis_ab_test_block_end_time',
		'_altis_ab_test_block_traffic_percentage',
		'_altis_ab_test_block_variant_traffic_percentage',
		'_altis_ab_test_block_started',
		'_altis_ab_test_block_paused',
		'_altis_ab_test_block_ended',
		'_altis_ab_test_block_results',
		'_altis_ab_test_block_completed',
		'_current_experiment_id',
	];
}

/**
 * Capture a bounded snapshot before creation writes anything.
 *
 * @param \WP_Post $post Block post.
 * @param string   $request_id Caller supplied request ID.
 * @return array|WP_Error
 */
function capture_receipt( \WP_Post $post, string $request_id ) {
	if ( strlen( $post->post_content ) > MAX_CONTENT_BYTES ) {
		return new WP_Error( 'recovery_snapshot_too_large', __( 'This block is too large to create a recoverable A/B test.', 'altis' ) );
	}

	$meta = [];
	foreach ( tracked_meta_keys() as $key ) {
		$meta[ $key ] = get_post_meta( $post->ID, $key, false );
	}

	return [
		'version'               => 1,
		'site_id'               => get_current_blog_id(),
		'block_id'              => $post->ID,
		'user_id'               => get_current_user_id(),
		'request_id'            => $request_id,
		'request_hash'          => request_hash( $post->ID, $request_id ),
		'original_content'      => $post->post_content,
		'original_content_hash' => content_hash( $post->post_content ),
		'meta'                  => $meta,
		'status'                => 'pending',
	];
}

/**
 * Store a receipt once, so duplicate request IDs cannot overwrite it.
 *
 * @param int    $block_id Block ID.
 * @param string $request_id Caller supplied request ID.
 * @param array  $receipt Receipt data.
 * @return bool
 */
function store_receipt( int $block_id, string $request_id, array $receipt ) : bool {
	return (bool) add_post_meta( $block_id, receipt_meta_key( $block_id, $request_id ), $receipt, true );
}

/**
 * Retrieve the receipt owned by the current site/user/request identity.
 *
 * @param int    $block_id Block ID.
 * @param string $request_id Caller supplied request ID.
 * @return array|null
 */
function get_receipt( int $block_id, string $request_id ) : ?array {
	$receipt = get_post_meta( $block_id, receipt_meta_key( $block_id, $request_id ), true );
	if ( ! is_array( $receipt ) ) {
		return null;
	}

	if ( (int) ( $receipt['site_id'] ?? 0 ) !== get_current_blog_id()
		|| (int) ( $receipt['block_id'] ?? 0 ) !== $block_id
		|| (int) ( $receipt['user_id'] ?? 0 ) !== get_current_user_id()
		|| (string) ( $receipt['request_hash'] ?? '' ) !== request_hash( $block_id, $request_id ) ) {
		return null;
	}

	return $receipt;
}

/**
 * Mark the receipt as having completed creation.
 *
 * @param int    $block_id Block ID.
 * @param string $request_id Caller supplied request ID.
 * @param array  $receipt Receipt data.
 * @param int    $experiment_id Newly created experiment row ID.
 * @param string $current_content Hash input after creation.
 * @return array Updated receipt.
 */
function mark_created( int $block_id, string $request_id, array $receipt, int $experiment_id, string $current_content ) : array {
	$receipt['status'] = 'created';
	$receipt['created_content_hash'] = content_hash( $current_content );
	$receipt['created_experiment_id'] = $experiment_id;
	update_post_meta( $block_id, receipt_meta_key( $block_id, $request_id ), $receipt );

	return $receipt;
}

/**
 * Restore tracked meta values exactly as they were before creation.
 *
 * @param int   $block_id Block ID.
 * @param array $receipt Receipt data.
 * @return void
 */
function restore_meta( int $block_id, array $receipt ) : void {
	$meta = is_array( $receipt['meta'] ?? null ) ? $receipt['meta'] : [];
	foreach ( tracked_meta_keys() as $key ) {
		delete_post_meta( $block_id, $key );
		foreach ( (array) ( $meta[ $key ] ?? [] ) as $value ) {
			add_post_meta( $block_id, $key, $value );
		}
	}
}

/**
 * Delete only the experiment row created by this receipt.
 *
 * @param int   $block_id Block ID.
 * @param array $receipt Receipt data.
 * @return true|WP_Error
 */
function delete_created_experiment( int $block_id, array $receipt ) {
	$experiment_id = (int) ( $receipt['created_experiment_id'] ?? 0 );
	$experiments = $experiment_id
		? [ Experiments\Experiment::get( $experiment_id ) ]
		: [ Experiments\Experiment::get_active_for_post( $block_id, 'block' ) ];
	if ( empty( $experiments ) || ! $experiments[0] ) {
		return true;
	}

	$experiment = $experiments[0];
	if ( ! $experiment_id && ( $experiment->get_type() !== Experiments\Experiment::TYPE_ABTEST || $experiment->get_subject_post_id() !== $block_id ) ) {
		return new WP_Error( 'recovery_experiment_mismatch', __( 'The active experiment no longer matches the recoverable A/B-test creation. It was not deleted.', 'altis' ) );
	}

	$deleted = $experiment->delete();
	if ( is_wp_error( $deleted ) ) {
		return $deleted;
	}
	if ( $experiment_id ) {
		if ( Experiments\Experiment::get( $experiment_id ) ) {
			return new WP_Error( 'recovery_experiment_verification_failed', __( 'The created experiment could not be verified as removed.', 'altis' ) );
		}
	}

	return true;
}

/**
 * Restore a receipt after a failed creation path while holding the block lock.
 *
 * @param int    $block_id Block ID.
 * @param string $request_id Caller supplied request ID.
 * @param array  $receipt Receipt data.
 * @return true|WP_Error
 */
function restore_receipt( int $block_id, string $request_id, array $receipt ) {
	$updated = wp_update_post( [
		'ID'           => $block_id,
		'post_content' => wp_slash( (string) $receipt['original_content'] ),
	], true );
	if ( is_wp_error( $updated ) ) {
		return $updated;
	}

	restore_meta( $block_id, $receipt );
	$deleted = delete_created_experiment( $block_id, $receipt );
	if ( is_wp_error( $deleted ) ) {
		return $deleted;
	}
	Experiments\flush_experiment_resolver_cache();
	$restored_post = get_post( $block_id );
	$restored_hash = $restored_post ? content_hash( $restored_post->post_content ) : '';
	if ( ! hash_equals( (string) $receipt['original_content_hash'], $restored_hash ) ) {
		return new WP_Error( 'recovery_verification_failed', __( 'The synced pattern could not be verified after restoration. No further changes were made.', 'altis' ) );
	}
	foreach ( tracked_meta_keys() as $key ) {
		if ( get_post_meta( $block_id, $key, false ) !== (array) ( $receipt['meta'][ $key ] ?? [] ) ) {
			return new WP_Error( 'recovery_verification_failed', __( 'The synced pattern metadata could not be verified after restoration. No further changes were made.', 'altis' ) );
		}
	}

	mark_restored( $block_id, $request_id, $receipt );
	return true;
}

/**
 * Mark an already-restored receipt so repeated restores are idempotent.
 *
 * @param int    $block_id Block ID.
 * @param string $request_id Caller supplied request ID.
 * @param array  $receipt Receipt data.
 * @return void
 */
function mark_restored( int $block_id, string $request_id, array $receipt ) : void {
	$receipt['status'] = 'restored';
	update_post_meta( $block_id, receipt_meta_key( $block_id, $request_id ), $receipt );
}
