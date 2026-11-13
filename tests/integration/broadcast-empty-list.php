<?php
/**
 * Broadcast empty-list checks in disposable local WordPress.
 * Run with wp eval-file. Test records are trashed; HTTP interception is request-local.
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI || wp_get_environment_type() !== 'local' ) {
	throw new RuntimeException( 'Run only with WP-CLI in a disposable local environment.' );
}

$assert = function ( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
	WP_CLI::log( 'PASS: ' . $message );
};
$filter = new Altis\Accelerate\API\Filter();
$filter->type = 'broadcast';
$filter->search = 'broadcast-proof-' . wp_generate_uuid4();
$requests = 0;
$http_mode = 'error';
$mock = function () use ( &$requests, &$http_mode ) {
	$requests++;
	return $http_mode === 'error'
		? new WP_Error( 'test_analytics_unavailable', 'Test analytics unavailable.' )
		: [ 'response' => [ 'code' => 200 ], 'body' => '', 'headers' => [] ];
};
add_filter( 'pre_http_request', $mock, 0 );
$post_id = 0;
try {
	$read = function () use ( $filter ) {
		return Altis\Accelerate\API\get_top_data( time() - DAY_IN_SECONDS, time(), $filter );
	};
	$data = $read();
	$assert( $data === [ 'posts' => [], 'total' => 0, 'max_pages' => 0 ] && $requests === 0, 'Empty broadcasts return without contacting analytics' );
	$post_id = wp_insert_post( [ 'post_type' => 'broadcast', 'post_title' => $filter->search, 'post_status' => 'draft' ], true );
	$assert( ! is_wp_error( $post_id ) && $post_id > 0, 'Disposable broadcast created' );
	$requests = 0;
	$data = $read();
	$assert( $data['total'] === 0 && $requests === 0, 'Draft-only broadcasts remain empty without analytics' );
	wp_update_post( [ 'ID' => $post_id, 'post_status' => 'publish' ] );
	$requests = 0;
	$data = $read();
	$assert( is_wp_error( $data ) && $requests > 0, 'Existing broadcasts preserve analytics errors instead of claiming empty' );
	$filter->include = [ $post_id + 1000000 ];
	$requests = 0;
	$data = $read();
	$assert( $data['total'] === 0 && $requests === 0, 'An unmatched include filter returns empty without analytics' );
	$filter->include = [];
	$http_mode = 'success';
	$data = $read();
	$assert( ! is_wp_error( $data ) && $data['total'] === 1 && $data['posts'][0]['id'] === $post_id && $data['posts'][0]['views'] === 0, 'Published broadcasts with zero views remain visible' );
} finally {
	if ( is_int( $post_id ) && $post_id > 0 ) {
		wp_trash_post( $post_id );
	}
	remove_filter( 'pre_http_request', $mock, 0 );
}
