<?php

namespace Altis\Accelerate\GlobalBlocks\REST_API;

use Altis\Accelerate\API;
use Altis\Accelerate\Experiments;
use WP_Post;

/**
 * Bootstrap it up!
 */
function bootstrap() {
	// Relationships endpoint
	$relationships_rest = new Relationships\REST_Endpoint();
	$search_rest = new Search\REST_Endpoint();

	add_action( 'rest_api_init', [ $relationships_rest, 'register_routes' ] );
	add_action( 'rest_api_init', [ $search_rest, 'register_routes' ] );

	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_rest_fields' );
}

/**
 * Register the additional post meta fields for Global Blocks.
 */
function register_rest_fields() : void {

	register_rest_field( 'wp_block', 'blockType', [
		'get_callback' => function ( $post ) {
			return get_post_meta( $post['id'], '_xb_type', true ) ?: 'standard';
		},
		'update_callback' => function ( $type, WP_Post $post ) {
			delete_post_meta( $post->ID, '_xb_type_standard' );
			delete_post_meta( $post->ID, '_xb_type_abtest' );
			delete_post_meta( $post->ID, '_xb_type_personalization' );
			update_post_meta( $post->ID, '_xb_type', $type ?: 'standard' );
			update_post_meta( $post->ID, '_xb_type_' . ( $type ?: 'standard' ), true );
		},
		'schema' => [
			'type' => 'string',
			'default' => 'standard',
			'enum' => [ 'standard', 'abtest', 'personalization' ],
		],
	] );

	$goals = Experiments\get_goals();

	register_rest_field( 'wp_block', 'goal', [
		'get_callback' => function ( $post ) {
			return get_post_meta( $post['id'], '_goal', true ) ?: 'engagement';
		},
		'update_callback' => function ( $goal, WP_Post $post ) {
			update_post_meta( $post->ID, '_goal', $goal ?: 'engagement' );
		},
		'schema' => [
			'type' => 'string',
			'default' => 'engagement',
			'enum' => array_keys( $goals ),
		],
	] );

	register_rest_field( 'wp_block', 'previewThumb', [
		'get_callback' => function ( $post ) {
			return API\get_block_preview_thumbnail( $post['id'] );
		},
		'schema' => [
			'type' => 'string',
		],
	] );

}
