<?php
/**
 * Blueprints.
 *
 * Reusable personalization presets ("blueprints"): an admin authors an ordered
 * set of variants + audiences once, then applies it to a block selection from
 * the editor "…" menu to create a fully wired personalized synced pattern in a
 * single action.
 *
 * Storage uses the Foundry ORM ({@see Blueprint}) — a dedicated table, like
 * experiments — rather than a custom post type. This module owns the table and
 * the CRUD REST API; applying a blueprint is done entirely client-side and
 * reuses the existing synced-pattern save path, so there is NO change to the
 * personalization save backend here.
 *
 * @package Altis\Accelerate\Blueprints
 */

namespace Altis\Accelerate\Blueprints;

use Altis\Accelerate\Audiences;
use Altis\Accelerate\Utils;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

const REST_NAMESPACE = 'accelerate/v1';
const REST_BASE = 'blueprints';

/**
 * Bootstrap the module.
 */
function setup() {
	// Ensure the blueprints table exists.
	add_action( 'init', __NAMESPACE__ . '\\ensure_blueprints_table' );

	// Register the CRUD REST API.
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_rest_routes' );

	// Register editor assets.
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\register_scripts', 1 );

	// The authoring UI is part of the Accelerate settings React app; this just
	// loads the audience-picker modal styles on that screen.
	add_action( 'admin_enqueue_scripts', __NAMESPACE__ . '\\admin_enqueue_scripts' );

	// Editor integration ("…" menu apply + matches-default badge).
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_editor_assets' );
}

/**
 * Ensure the blueprints table exists.
 *
 * Uses Foundry's ensure_table() to create or conform the schema. Runs once
 * per request.
 */
function ensure_blueprints_table() {
	static $ensured = false;
	if ( $ensured ) {
		return;
	}
	$ensured = true;
	Blueprint::ensure_table();
}

/**
 * Permission callback for blueprint endpoints.
 *
 * Authoring and applying blueprints both sit at the experiment-creation tier
 * (edit_posts), matching Audiences and Experiments.
 *
 * @return bool
 */
function can_manage_blueprints() : bool {
	return current_user_can( 'edit_posts' );
}

/**
 * Register the CRUD REST routes.
 *
 * Hand-rolled over the Foundry model (consistent with the experiments REST
 * layer) rather than using Foundry\Api\Controller, which defaults its
 * permission checks open.
 */
function register_rest_routes() {
	register_rest_route( REST_NAMESPACE, '/' . REST_BASE, [
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => __NAMESPACE__ . '\\rest_get_items',
			'permission_callback' => __NAMESPACE__ . '\\can_manage_blueprints',
			'args'                => [
				'status' => [
					'type' => 'string',
					'enum' => [ Blueprint::STATUS_DRAFT, Blueprint::STATUS_PUBLISHED ],
				],
				'type'   => [
					'type' => 'string',
					'enum' => [ Blueprint::TYPE_PERSONALIZATION ],
				],
			],
		],
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => __NAMESPACE__ . '\\rest_create_item',
			'permission_callback' => __NAMESPACE__ . '\\can_manage_blueprints',
			'args'                => get_item_args(),
		],
	] );

	register_rest_route( REST_NAMESPACE, '/' . REST_BASE . '/(?P<id>\d+)', [
		'args' => [
			'id' => [
				'type'              => 'integer',
				'required'          => true,
				'sanitize_callback' => 'absint',
			],
		],
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => __NAMESPACE__ . '\\rest_get_item',
			'permission_callback' => __NAMESPACE__ . '\\can_manage_blueprints',
		],
		[
			'methods'             => WP_REST_Server::EDITABLE,
			'callback'            => __NAMESPACE__ . '\\rest_update_item',
			'permission_callback' => __NAMESPACE__ . '\\can_manage_blueprints',
			'args'                => get_item_args(),
		],
		[
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => __NAMESPACE__ . '\\rest_delete_item',
			'permission_callback' => __NAMESPACE__ . '\\can_manage_blueprints',
		],
	] );
}

/**
 * Writable argument schema for create/update.
 *
 * @return array<string, array<string, mixed>>
 */
function get_item_args() : array {
	return [
		'title'    => [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
		],
		// Only personalization for now: the editor apply flow builds
		// audience-targeted variant blocks, which an A/B blueprint would need
		// its own handling for. TYPE_ABTEST stays reserved in the model.
		'type'     => [
			'type' => 'string',
			'enum' => [ Blueprint::TYPE_PERSONALIZATION ],
		],
		'status'   => [
			'type' => 'string',
			'enum' => [ Blueprint::STATUS_DRAFT, Blueprint::STATUS_PUBLISHED ],
		],
		'goal'     => [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
		],
		'variants' => [
			'type' => 'array',
		],
	];
}

/**
 * Sanitize a variants array from a request into the stored shape.
 *
 * Normalizes each entry to { title, audience, fallback, percentage } and
 * guarantees the first entry — and only the first entry — is the fallback
 * (control) with no audience. Fallback flags on later entries are dropped
 * rather than kept, since the apply flow only ever renders one fallback.
 *
 * @param mixed $raw Raw variants value from the request.
 * @return array<int, array{ title: string, audience: int, fallback: bool, percentage: int|null }>
 */
function sanitize_variants( $raw ) : array {
	if ( ! is_array( $raw ) ) {
		return [];
	}

	$variants = [];
	foreach ( array_values( $raw ) as $index => $variant ) {
		if ( ! is_array( $variant ) ) {
			continue;
		}

		$is_fallback = $index === 0;
		$audience = isset( $variant['audience'] ) ? absint( $variant['audience'] ) : 0;

		$variants[] = [
			'title'      => isset( $variant['title'] ) ? sanitize_text_field( (string) $variant['title'] ) : '',
			// The fallback never targets an audience.
			'audience'   => $is_fallback ? 0 : $audience,
			'fallback'   => $is_fallback,
			'percentage' => isset( $variant['percentage'] ) && $variant['percentage'] !== null
				? max( 0, min( 100, (int) $variant['percentage'] ) )
				: null,
		];
	}

	return $variants;
}

/**
 * Validate a blueprint before it is saved.
 *
 * The editor apply flow trusts published blueprints, so the invariants the
 * authoring UI enforces client-side are enforced here too. Audience references
 * are checked whenever present (a draft pointing at a deleted audience is
 * still broken data); completeness — title, a default plus at least one
 * audience variant — is only required to publish, so partial drafts save fine.
 *
 * @param Blueprint $blueprint Blueprint with pending changes applied.
 * @return true|WP_Error
 */
function validate_blueprint( Blueprint $blueprint ) {
	$variants = $blueprint->get_variants();

	foreach ( $variants as $variant ) {
		if ( empty( $variant['audience'] ) ) {
			continue;
		}
		$audience = get_post( $variant['audience'] );
		if ( ! $audience || $audience->post_type !== Audiences\POST_TYPE ) {
			return new WP_Error(
				'accelerate.blueprints.invalid_audience',
				__( 'A blueprint variant references an audience that does not exist.', 'altis' ),
				[ 'status' => 400 ]
			);
		}
		if ( ! current_user_can( 'read_post', $audience->ID ) ) {
			return new WP_Error(
				'accelerate.blueprints.invalid_audience',
				__( 'A blueprint variant references an audience you do not have access to.', 'altis' ),
				[ 'status' => 403 ]
			);
		}
	}

	if ( $blueprint->get_status() !== Blueprint::STATUS_PUBLISHED ) {
		return true;
	}

	if ( trim( $blueprint->get_title() ) === '' ) {
		return new WP_Error(
			'accelerate.blueprints.missing_title',
			__( 'A published blueprint needs a title.', 'altis' ),
			[ 'status' => 400 ]
		);
	}

	if ( count( $variants ) < 2 ) {
		return new WP_Error(
			'accelerate.blueprints.missing_variants',
			__( 'A published blueprint needs a default and at least one audience variant.', 'altis' ),
			[ 'status' => 400 ]
		);
	}

	foreach ( array_slice( $variants, 1 ) as $variant ) {
		if ( empty( $variant['audience'] ) ) {
			return new WP_Error(
				'accelerate.blueprints.missing_audience',
				__( 'Every variant in a published blueprint needs an audience.', 'altis' ),
				[ 'status' => 400 ]
			);
		}
	}

	return true;
}

/**
 * GET /blueprints — list blueprints.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response
 */
function rest_get_items( WP_REST_Request $request ) : WP_REST_Response {
	$where = [];
	if ( $request['status'] ) {
		$where['status'] = $request['status'];
	}
	if ( $request['type'] ) {
		$where['type'] = $request['type'];
	}

	$results = Blueprint::query(
		$where,
		[
			'per_page' => 100,
			'order_by' => [ 'updated_at' => 'DESC' ],
		]
	)->get_results();

	$data = [];
	if ( ! is_wp_error( $results ) ) {
		foreach ( $results as $blueprint ) {
			$data[] = $blueprint->to_array();
		}
	}

	return rest_ensure_response( $data );
}

/**
 * GET /blueprints/{id} — single blueprint.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function rest_get_item( WP_REST_Request $request ) {
	$blueprint = Blueprint::get( (int) $request['id'] );
	if ( ! $blueprint ) {
		return new WP_Error( 'accelerate.blueprints.not_found', __( 'Blueprint not found.', 'altis' ), [ 'status' => 404 ] );
	}
	return rest_ensure_response( $blueprint->to_array() );
}

/**
 * POST /blueprints — create a blueprint.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function rest_create_item( WP_REST_Request $request ) {
	$blueprint = new Blueprint();
	apply_changes( $blueprint, $request );

	$valid = validate_blueprint( $blueprint );
	if ( is_wp_error( $valid ) ) {
		return $valid;
	}

	$result = $blueprint->save();
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$response = rest_ensure_response( $blueprint->to_array() );
	$response->set_status( 201 );
	return $response;
}

/**
 * PUT/PATCH /blueprints/{id} — update a blueprint.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function rest_update_item( WP_REST_Request $request ) {
	$blueprint = Blueprint::get( (int) $request['id'] );
	if ( ! $blueprint ) {
		return new WP_Error( 'accelerate.blueprints.not_found', __( 'Blueprint not found.', 'altis' ), [ 'status' => 404 ] );
	}

	apply_changes( $blueprint, $request );

	$valid = validate_blueprint( $blueprint );
	if ( is_wp_error( $valid ) ) {
		return $valid;
	}

	if ( $blueprint->is_modified() ) {
		$result = $blueprint->save();
		if ( is_wp_error( $result ) ) {
			return $result;
		}
	}

	return rest_ensure_response( $blueprint->to_array() );
}

/**
 * DELETE /blueprints/{id} — delete a blueprint.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function rest_delete_item( WP_REST_Request $request ) {
	$blueprint = Blueprint::get( (int) $request['id'] );
	if ( ! $blueprint ) {
		return new WP_Error( 'accelerate.blueprints.not_found', __( 'Blueprint not found.', 'altis' ), [ 'status' => 404 ] );
	}

	$previous = $blueprint->to_array();

	$result = $blueprint->delete();
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return rest_ensure_response( [
		'deleted'  => true,
		'previous' => $previous,
	] );
}

/**
 * Apply request fields to a blueprint model (shared by create + update).
 *
 * @param Blueprint       $blueprint Blueprint model.
 * @param WP_REST_Request $request   Request.
 */
function apply_changes( Blueprint $blueprint, WP_REST_Request $request ) : void {
	$params = $request->get_params();

	if ( array_key_exists( 'title', $params ) ) {
		$blueprint->set_title( (string) $params['title'] );
	}
	if ( array_key_exists( 'type', $params ) ) {
		$blueprint->set_type( (string) $params['type'] );
	}
	if ( array_key_exists( 'status', $params ) ) {
		$blueprint->set_status( (string) $params['status'] );
	}
	if ( array_key_exists( 'goal', $params ) ) {
		$blueprint->set_goal( (string) $params['goal'] );
	}
	if ( array_key_exists( 'variants', $params ) ) {
		$blueprint->set_variants( sanitize_variants( $params['variants'] ) );
	}
}

/**
 * Register the editor integration bundle.
 *
 * The authoring UI ships inside the Accelerate settings React app
 * (`accelerate-settings`), so only the block-editor bundle is registered here.
 */
function register_scripts() {
	static $registered = false;
	if ( $registered ) {
		return;
	}
	$registered = true;

	Utils\register_assets(
		'blueprints/editor',
		[
			'dependencies' => [
				'react',
				'wp-blocks',
				'wp-block-editor',
				'wp-components',
				'wp-compose',
				'wp-core-data',
				'wp-data',
				'wp-element',
				'wp-i18n',
				'wp-plugins',
			],
		]
	);
}

/**
 * Load the audience-picker modal styles on the Audiences page.
 *
 * The Blueprints authoring UI renders as a section of the Audiences admin page
 * and reuses the audience picker, which opens the audience manager as a
 * `.media-modal` popup — so the WordPress media modal styles must be present.
 * (The audiences UI script/style is already enqueued on this screen by the
 * Audiences module.)
 */
function admin_enqueue_scripts() {
	$screen = get_current_screen();
	if ( ! $screen || $screen->id !== 'accelerate_page_' . Audiences\POST_TYPE ) {
		return;
	}

	wp_enqueue_media();
}

/**
 * Enqueue the editor integration (block "…" menu apply + badge).
 */
function enqueue_editor_assets() {
	wp_enqueue_script( 'altis-accelerate-blueprints/editor' );
	wp_enqueue_style( 'altis-accelerate-blueprints/editor' );
}
