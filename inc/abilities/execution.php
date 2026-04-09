<?php
/**
 * Accelerate Abilities API - Execution Domain.
 *
 * Domain B: Execution & Configuration (Hands)
 * Write capabilities with strict validation to prevent site breakage.
 *
 * @package Altis\Accelerate\Abilities\Execution
 */

namespace Altis\Accelerate\Abilities\Execution;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\Abilities\Variants;
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Broadcast;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\Utils;
use WP_Error;

/**
 * Register all execution abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_get_variants();
	register_add_variant();
	register_update_variant();
	register_remove_variant();
	register_create_ab_test();
	register_create_personalization_rule();
	register_broadcast_content();
	register_create_audience();
	register_update_audience();
	register_set_block_goal();
	register_set_traffic_percentage();
	register_get_experiment_results();
	register_stop_experiment();
}

/**
 * Register accelerate/get-variants ability.
 *
 * Inspects all variants in a synced pattern, returning their structure,
 * content preview, and experiment state.
 *
 * @return void
 */
function register_get_variants() : void {
	wp_register_ability( 'accelerate/get-variants', [
		'label'       => __( 'Get Variants', 'altis' ),
		'description' => __( 'Inspect all variants in a synced pattern, including content preview, block types, and experiment state.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern (wp_block) post ID.', 'altis' ),
				],
			],
			'required' => [ 'block_id' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id'   => [ 'type' => 'integer' ],
				'block_type' => [ 'type' => 'string' ],
				'variants'   => [ 'type' => 'array' ],
				'experiment' => [ 'type' => [ 'object', 'null' ] ],
				'edit_url'   => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_variants',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Inspecting variants...', 'altis' ),
		],
	] );
}

/**
 * Execute get-variants ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Variant details or error.
 */
function execute_get_variants( array $input ) {
	$block_id = $input['block_id'] ?? 0;

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	$variant_blocks = Variants\get_variant_blocks( $block_id );

	if ( empty( $variant_blocks ) ) {
		return [
			'block_id'   => $block_id,
			'block_type' => 'standard',
			'variants'   => [],
			'experiment' => null,
			'edit_url'   => get_edit_post_link( $block_id, 'raw' ),
		];
	}

	// Build variant details.
	$variants = [];
	foreach ( $variant_blocks as $index => $block ) {
		$inner_block_types = array_values( array_filter(
			array_map( function ( $inner ) {
				return $inner['blockName'] ?? null;
			}, $block['innerBlocks'] ?? [] )
		) );

		// Generate a plain-text content preview.
		$rendered = serialize_blocks( $block['innerBlocks'] ?? [] );
		$content_preview = wp_strip_all_tags( $rendered );
		$content_preview = preg_replace( '/\s+/', ' ', trim( $content_preview ) );
		if ( strlen( $content_preview ) > 200 ) {
			$content_preview = substr( $content_preview, 0, 200 ) . '…';
		}

		// Raw block markup for the variant's inner content — agents can use
		// this as a template when creating structurally similar variants.
		$raw_markup = serialize_blocks( $block['innerBlocks'] ?? [] );

		$variants[] = [
			'index'             => $index,
			'title'             => $block['attrs']['title'] ?? sprintf( 'Variant %d', $index + 1 ),
			'content_preview'   => $content_preview,
			'raw_markup'        => $raw_markup,
			'inner_block_types' => $inner_block_types,
			'percentage'        => $block['attrs']['percentage'] ?? null,
			'audience_id'       => $block['attrs']['audience'] ?? null,
			'fallback'          => ! empty( $block['attrs']['fallback'] ),
		];
	}

	// Get experiment state from the Experiment model.
	$experiment_data = null;
	$experiment = Experiments\Experiment::get_active_for_post( $block_id, 'block' );

	// If no active experiment, check for a completed one.
	if ( ! $experiment ) {
		$completed = Experiments\Experiment::query(
			[
				'subject_post_id' => $block_id,
				'test_id'         => 'block',
			],
			[
				'per_page' => 1,
				'order_by' => [ 'updated_at' => 'DESC' ],
			]
		)->get_results();
		$experiment = ! empty( $completed ) ? $completed[0] : null;
	}

	if ( $experiment ) {
		$results = $experiment->get_results();
		$experiment_data = [
			'type'   => $experiment->get_type(),
			'status' => $experiment->get_status(),
			'goal'   => $experiment->get_goal(),
			'winner' => $results['winner'] ?? null,
		];
	}

	// Determine block type from meta.
	$xb_type = get_post_meta( $block_id, '_xb_type', true ) ?: 'standard';

	return [
		'block_id'   => $block_id,
		'block_type' => $xb_type,
		'variants'   => $variants,
		'experiment' => $experiment_data,
		'edit_url'   => get_edit_post_link( $block_id, 'raw' ),
	];
}

/**
 * Register accelerate/add-variant ability.
 *
 * Appends a new variant to an existing synced pattern.
 *
 * @return void
 */
function register_add_variant() : void {
	wp_register_ability( 'accelerate/add-variant', [
		'label'       => __( 'Add Variant', 'altis' ),
		'description' => __( 'Add a new variant to a synced pattern. Works for both A/B tests and personalization.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern (wp_block) post ID.', 'altis' ),
				],
				'content' => [
					'type'        => 'string',
					'description' => __( 'Variant content as block markup or plain text/HTML.', 'altis' ),
				],
				'title' => [
					'type'        => 'string',
					'description' => __( 'Variant title (optional, auto-generated if omitted).', 'altis' ),
				],
				'percentage' => [
					'type'        => 'integer',
					'minimum'     => 1,
					'maximum'     => 100,
					'description' => __( 'Traffic weight for this variant (optional).', 'altis' ),
				],
				'audience_id' => [
					'type'        => 'integer',
					'description' => __( 'Audience ID for personalization targeting (optional).', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'content' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'       => [ 'type' => 'boolean' ],
				'block_id'      => [ 'type' => 'integer' ],
				'variant_index' => [ 'type' => 'integer' ],
				'variant_count' => [ 'type' => 'integer' ],
				'edit_url'      => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_add_variant',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Adding variant...', 'altis' ),
		],
	] );
}

/**
 * Execute add-variant ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_add_variant( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$content = $input['content'] ?? '';

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	if ( empty( $content ) ) {
		return new WP_Error( 'missing_content', __( 'content is required.', 'altis' ) );
	}

	// Validate audience if provided.
	if ( ! empty( $input['audience_id'] ) ) {
		$audience = get_post( $input['audience_id'] );
		if ( ! $audience || $audience->post_type !== 'audience' ) {
			return new WP_Error( 'invalid_audience', __( 'Audience not found.', 'altis' ) );
		}
	}

	$variant_blocks = Variants\get_variant_blocks( $block_id );
	$new_index = count( $variant_blocks );

	// Build attributes.
	$attrs = [
		'title' => $input['title'] ?? sprintf( 'Variant %d', $new_index + 1 ),
	];
	if ( isset( $input['percentage'] ) ) {
		$attrs['percentage'] = $input['percentage'];
	}
	if ( ! empty( $input['audience_id'] ) ) {
		$attrs['audience'] = $input['audience_id'];
	}

	$variant_blocks[] = Variants\build_variant_block( $content, $attrs );

	$result = Variants\save_variant_blocks( $block_id, $variant_blocks );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	// Sync experiment state.
	Variants\sync_post_experiment( $block_id );

	return [
		'success'       => true,
		'block_id'      => $block_id,
		'variant_index' => $new_index,
		'variant_count' => count( $variant_blocks ),
		'edit_url'      => get_edit_post_link( $block_id, 'raw' ),
	];
}

/**
 * Register accelerate/update-variant ability.
 *
 * Updates an existing variant's content and/or attributes.
 *
 * @return void
 */
function register_update_variant() : void {
	wp_register_ability( 'accelerate/update-variant', [
		'label'       => __( 'Update Variant', 'altis' ),
		'description' => __( 'Update an existing variant\'s content, title, traffic weight, or audience targeting.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern (wp_block) post ID.', 'altis' ),
				],
				'variant_index' => [
					'type'        => 'integer',
					'minimum'     => 0,
					'description' => __( 'Zero-based index of the variant to update.', 'altis' ),
				],
				'content' => [
					'type'        => 'string',
					'description' => __( 'New content as block markup or plain text/HTML (optional).', 'altis' ),
				],
				'title' => [
					'type'        => 'string',
					'description' => __( 'New variant title (optional).', 'altis' ),
				],
				'percentage' => [
					'type'        => 'integer',
					'minimum'     => 1,
					'maximum'     => 100,
					'description' => __( 'New traffic weight (optional).', 'altis' ),
				],
				'audience_id' => [
					'type'        => 'integer',
					'description' => __( 'New audience ID for personalization (optional).', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'variant_index' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'       => [ 'type' => 'boolean' ],
				'block_id'      => [ 'type' => 'integer' ],
				'variant_index' => [ 'type' => 'integer' ],
				'variant_title' => [ 'type' => 'string' ],
				'edit_url'      => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_update_variant',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Updating variant...', 'altis' ),
		],
	] );
}

/**
 * Execute update-variant ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_update_variant( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$variant_index = $input['variant_index'] ?? null;

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	if ( $variant_index === null ) {
		return new WP_Error( 'missing_variant_index', __( 'variant_index is required.', 'altis' ) );
	}

	// Must provide at least one field to update.
	$has_update = isset( $input['content'] ) || isset( $input['title'] )
		|| isset( $input['percentage'] ) || isset( $input['audience_id'] );
	if ( ! $has_update ) {
		return new WP_Error( 'no_updates', __( 'At least one of content, title, percentage, or audience_id must be provided.', 'altis' ) );
	}

	// Validate audience if provided.
	if ( isset( $input['audience_id'] ) && $input['audience_id'] ) {
		$audience = get_post( $input['audience_id'] );
		if ( ! $audience || $audience->post_type !== 'audience' ) {
			return new WP_Error( 'invalid_audience', __( 'Audience not found.', 'altis' ) );
		}
	}

	$variant_blocks = Variants\get_variant_blocks( $block_id );

	if ( $variant_index < 0 || $variant_index >= count( $variant_blocks ) ) {
		return new WP_Error(
			'invalid_variant_index',
			sprintf(
				/* translators: %d: number of variants */
				__( 'variant_index out of range. This block has %d variant(s).', 'altis' ),
				count( $variant_blocks )
			)
		);
	}

	// Update content if provided.
	if ( isset( $input['content'] ) ) {
		$inner_blocks = parse_blocks( $input['content'] );
		if ( empty( $inner_blocks ) || ( count( $inner_blocks ) === 1 && empty( $inner_blocks[0]['blockName'] ) ) ) {
			$inner_blocks = parse_blocks(
				'<!-- wp:paragraph --><p>' . esc_html( $input['content'] ) . '</p><!-- /wp:paragraph -->'
			);
		}
		$variant_blocks[ $variant_index ]['innerBlocks'] = $inner_blocks;
	}

	// Update attributes.
	if ( isset( $input['title'] ) ) {
		$variant_blocks[ $variant_index ]['attrs']['title'] = $input['title'];
	}
	if ( isset( $input['percentage'] ) ) {
		$variant_blocks[ $variant_index ]['attrs']['percentage'] = (int) $input['percentage'];
	}
	if ( isset( $input['audience_id'] ) ) {
		$variant_blocks[ $variant_index ]['attrs']['audience'] = (int) $input['audience_id'];
	}

	$result = Variants\save_variant_blocks( $block_id, $variant_blocks );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	// Sync experiment state.
	Variants\sync_post_experiment( $block_id );

	$variant_title = $variant_blocks[ $variant_index ]['attrs']['title']
		?? sprintf( 'Variant %d', $variant_index + 1 );

	return [
		'success'       => true,
		'block_id'      => $block_id,
		'variant_index' => $variant_index,
		'variant_title' => $variant_title,
		'edit_url'      => get_edit_post_link( $block_id, 'raw' ),
	];
}

/**
 * Register accelerate/remove-variant ability.
 *
 * Removes a variant from a synced pattern.
 *
 * @return void
 */
function register_remove_variant() : void {
	wp_register_ability( 'accelerate/remove-variant', [
		'label'       => __( 'Remove Variant', 'altis' ),
		'description' => __( 'Remove a variant from a synced pattern. Cannot remove the last variant.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern (wp_block) post ID.', 'altis' ),
				],
				'variant_index' => [
					'type'        => 'integer',
					'minimum'     => 0,
					'description' => __( 'Zero-based index of the variant to remove.', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'variant_index' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'            => [ 'type' => 'boolean' ],
				'block_id'           => [ 'type' => 'integer' ],
				'remaining_variants' => [ 'type' => 'integer' ],
				'edit_url'           => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_remove_variant',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'          => true,
			'mcp' => [ 'public' => true ],
			'destructive'           => true,
			'requires_confirmation' => true,
			'thinking_message'      => __( 'Removing variant...', 'altis' ),
		],
	] );
}

/**
 * Execute remove-variant ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_remove_variant( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$variant_index = $input['variant_index'] ?? null;

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	if ( $variant_index === null ) {
		return new WP_Error( 'missing_variant_index', __( 'variant_index is required.', 'altis' ) );
	}

	$variant_blocks = Variants\get_variant_blocks( $block_id );

	if ( $variant_index < 0 || $variant_index >= count( $variant_blocks ) ) {
		return new WP_Error(
			'invalid_variant_index',
			sprintf(
				/* translators: %d: number of variants */
				__( 'variant_index out of range. This block has %d variant(s).', 'altis' ),
				count( $variant_blocks )
			)
		);
	}

	if ( count( $variant_blocks ) < 2 ) {
		return new WP_Error(
			'cannot_remove_last',
			__( 'Cannot remove the last variant. Downgrade the block to standard instead.', 'altis' )
		);
	}

	// Remove the variant.
	array_splice( $variant_blocks, $variant_index, 1 );

	$result = Variants\save_variant_blocks( $block_id, $variant_blocks );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	// Sync experiment state.
	Variants\sync_post_experiment( $block_id );

	return [
		'success'            => true,
		'block_id'           => $block_id,
		'remaining_variants' => count( $variant_blocks ),
		'edit_url'           => get_edit_post_link( $block_id, 'raw' ),
	];
}

/**
 * Register accelerate/create-ab-test ability.
 *
 * The core engine. Converts a standard block into an Experiment Block with variants.
 *
 * @return void
 */
function register_create_ab_test() : void {
	wp_register_ability( 'accelerate/create-ab-test', [
		'label'       => __( 'Create A/B Test', 'altis' ),
		'description' => __( 'Add variants to a synced pattern to create an A/B test.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern (wp_block) post ID.', 'altis' ),
				],
				'hypothesis' => [
					'type'        => 'string',
					'description' => __( 'Natural language description of what is being tested.', 'altis' ),
				],
				'goal' => [
					'type'        => 'string',
					'enum'        => [ 'engagement', 'click_any_link', 'submit_form' ],
					'default'     => 'engagement',
					'description' => __( 'Conversion goal metric.', 'altis' ),
				],
				'variants' => [
					'type'     => 'array',
					'minItems' => 2,
					'items'    => [
						'type'       => 'object',
						'properties' => [
							'title'   => [ 'type' => 'string' ],
							'content' => [
								'type'        => 'string',
								'description' => __( 'Block content (HTML or block markup).', 'altis' ),
							],
						],
					],
					'description' => __( 'Array of variant objects with title and content.', 'altis' ),
				],
				'traffic_percentage' => [
					'type'    => 'integer',
					'minimum' => 1,
					'maximum' => 100,
					'default' => 100,
					'description' => __( 'Percentage of traffic to include in test.', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'variants' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'        => [ 'type' => 'boolean' ],
				'block_id'       => [ 'type' => 'integer' ],
				'variants_count' => [ 'type' => 'integer' ],
				'edit_url'       => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_create_ab_test',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Creating A/B test variants...', 'altis' ),
		],
	] );
}

/**
 * Execute create-ab-test ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_create_ab_test( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$hypothesis = $input['hypothesis'] ?? '';
	$goal = $input['goal'] ?? 'engagement';
	$variants = $input['variants'] ?? [];
	$traffic_percentage = $input['traffic_percentage'] ?? 100;

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	if ( count( $variants ) < 2 ) {
		return new WP_Error( 'insufficient_variants', __( 'At least 2 variants are required for an A/B test.', 'altis' ) );
	}

	// Build variant blocks using shared helpers.
	$variant_blocks = [];
	foreach ( $variants as $index => $variant ) {
		$variant_blocks[] = Variants\build_variant_block(
			$variant['content'] ?? '',
			[ 'title' => $variant['title'] ?? sprintf( 'Variant %d', $index + 1 ) ]
		);
	}

	// Save variant blocks and trigger metadata sync.
	$result = Variants\save_variant_blocks( $block_id, $variant_blocks );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	// Set A/B test meta.
	update_post_meta( $block_id, '_xb_abtest', true );
	update_post_meta( $block_id, '_xb_type', 'abtest' );
	update_post_meta( $block_id, '_xb_goal', $goal );
	update_post_meta( $block_id, '_xb_traffic_percentage', $traffic_percentage );
	delete_post_meta( $block_id, '_xb_personalization' );

	if ( $hypothesis ) {
		update_post_meta( $block_id, '_xb_hypothesis', sanitize_text_field( $hypothesis ) );
	}

	// Sync to experiments table.
	Variants\sync_post_experiment( $block_id, Experiments\Experiment::TYPE_ABTEST );

	return [
		'success'        => true,
		'block_id'       => $block_id,
		'variants_count' => count( $variants ),
		'edit_url'       => get_edit_post_link( $block_id, 'raw' ),
	];
}

/**
 * Register accelerate/create-personalization-rule ability.
 *
 * Sets up conditional display rules for targeted content.
 *
 * @return void
 */
function register_create_personalization_rule() : void {
	wp_register_ability( 'accelerate/create-personalization-rule', [
		'label'       => __( 'Create Personalization Rule', 'altis' ),
		'description' => __( 'Set up conditional display rules for targeted content based on audience segments.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern post ID.', 'altis' ),
				],
				'audience_id' => [
					'type'        => 'integer',
					'description' => __( 'Target audience post ID.', 'altis' ),
				],
				'personalized_content' => [
					'type'        => 'string',
					'description' => __( 'Content to show to matching audience.', 'altis' ),
				],
				'fallback_content' => [
					'type'        => 'string',
					'description' => __( 'Default content for non-matching visitors.', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'audience_id', 'personalized_content' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'  => [ 'type' => 'boolean' ],
				'block_id' => [ 'type' => 'integer' ],
				'edit_url' => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_create_personalization_rule',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Setting up personalization rule...', 'altis' ),
		],
	] );
}

/**
 * Execute create-personalization-rule ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_create_personalization_rule( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$audience_id = $input['audience_id'] ?? 0;
	$personalized_content = $input['personalized_content'] ?? '';
	$fallback_content = $input['fallback_content'] ?? '';

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	if ( ! $audience_id ) {
		return new WP_Error( 'missing_audience_id', __( 'audience_id is required.', 'altis' ) );
	}

	// Verify audience exists.
	$audience = get_post( $audience_id );
	if ( ! $audience || $audience->post_type !== 'audience' ) {
		return new WP_Error( 'invalid_audience', __( 'Audience not found.', 'altis' ) );
	}

	// Use existing content as fallback if none provided.
	if ( ! $fallback_content ) {
		$fallback_content = $post->post_content;
	}

	// Build variant blocks using shared helpers.
	$variant_blocks = [
		Variants\build_variant_block( $fallback_content, [
			'title'    => __( 'Fallback', 'altis' ),
			'fallback' => true,
		] ),
		Variants\build_variant_block( $personalized_content, [
			'title'    => $audience->post_title,
			'audience' => $audience_id,
		] ),
	];

	// Save variant blocks and trigger metadata sync.
	$result = Variants\save_variant_blocks( $block_id, $variant_blocks );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	// Set personalization meta.
	update_post_meta( $block_id, '_xb_personalization', true );
	update_post_meta( $block_id, '_xb_type', 'personalization' );
	delete_post_meta( $block_id, '_xb_abtest' );

	// Sync to experiments table.
	Variants\sync_post_experiment( $block_id, Experiments\Experiment::TYPE_PERSONALIZATION );

	return [
		'success'  => true,
		'block_id' => $block_id,
		'edit_url' => get_edit_post_link( $block_id, 'raw' ),
	];
}

/**
 * Register accelerate/broadcast-content ability.
 *
 * Pushes content to multiple locations site-wide.
 *
 * @return void
 */
function register_broadcast_content() : void {
	wp_register_ability( 'accelerate/broadcast-content', [
		'label'       => __( 'Broadcast Content', 'altis' ),
		'description' => __( 'Create a broadcast campaign to push content to multiple locations site-wide.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_ids' => [
					'type'  => 'array',
					'items' => [ 'type' => 'integer' ],
					'description' => __( 'Synced Pattern IDs to include in broadcast.', 'altis' ),
				],
				'title' => [
					'type'        => 'string',
					'description' => __( 'Broadcast campaign title.', 'altis' ),
				],
			],
			'required' => [ 'block_ids', 'title' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'      => [ 'type' => 'boolean' ],
				'broadcast_id' => [ 'type' => 'integer' ],
				'edit_url'     => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_broadcast_content',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_manage_experiments',
		'meta' => [
			'show_in_rest'          => true,
			'destructive'           => true,
			'requires_confirmation' => true,
			'thinking_message'      => __( 'Creating broadcast campaign...', 'altis' ),
		],
	] );
}

/**
 * Execute broadcast-content ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_broadcast_content( array $input ) {
	$block_ids = $input['block_ids'] ?? [];
	$title = $input['title'] ?? '';

	if ( empty( $block_ids ) ) {
		return new WP_Error( 'missing_block_ids', __( 'block_ids is required.', 'altis' ) );
	}

	if ( empty( $title ) ) {
		return new WP_Error( 'missing_title', __( 'title is required.', 'altis' ) );
	}

	// Validate all blocks exist.
	foreach ( $block_ids as $block_id ) {
		$post = get_post( $block_id );
		if ( ! $post || $post->post_type !== 'wp_block' ) {
			return new WP_Error(
				'invalid_block',
				sprintf(
					/* translators: %d: block ID */
					__( 'Block ID %d not found or not a synced pattern.', 'altis' ),
					$block_id
				)
			);
		}
	}

	// Create broadcast post.
	$broadcast_id = wp_insert_post( [
		'post_type'   => 'broadcast',
		'post_title'  => sanitize_text_field( $title ),
		'post_status' => 'publish',
	], true );

	if ( is_wp_error( $broadcast_id ) ) {
		return $broadcast_id;
	}

	// Associate blocks with broadcast.
	update_post_meta( $broadcast_id, '_broadcast_blocks', $block_ids );

	return [
		'success'      => true,
		'broadcast_id' => $broadcast_id,
		'block_count'  => count( $block_ids ),
		'edit_url'     => get_edit_post_link( $broadcast_id, 'raw' ),
	];
}

/**
 * Register accelerate/create-audience ability.
 *
 * Creates a new audience segment from natural language or structured rules.
 *
 * @return void
 */
function register_create_audience() : void {
	wp_register_ability( 'accelerate/create-audience', [
		'label'       => __( 'Create Audience', 'altis' ),
		'description' => __( 'Create a new audience segment with targeting rules.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'title' => [
					'type'        => 'string',
					'description' => __( 'Audience name.', 'altis' ),
				],
				'description' => [
					'type'        => 'string',
					'description' => __( 'Audience description.', 'altis' ),
				],
				'rules' => [
					'type'        => 'object',
					'description' => __( 'Audience targeting configuration.', 'altis' ),
					'properties'  => [
						'include' => [
							'type' => 'string',
							'enum' => [ 'any', 'all', 'none' ],
						],
						'groups' => [
							'type'  => 'array',
							'items' => [
								'type'       => 'object',
								'properties' => [
									'include' => [ 'type' => 'string', 'enum' => [ 'any', 'all', 'none' ] ],
									'rules'   => [
										'type'  => 'array',
										'items' => [
											'type'       => 'object',
											'properties' => [
												'field'    => [ 'type' => 'string' ],
												'operator' => [ 'type' => 'string' ],
												'value'    => [ 'type' => [ 'string', 'number' ] ],
											],
										],
									],
								],
							],
						],
					],
				],
			],
			'required' => [ 'title', 'rules' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'     => [ 'type' => 'boolean' ],
				'audience_id' => [ 'type' => 'integer' ],
				'edit_url'    => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_create_audience',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Creating audience segment...', 'altis' ),
		],
	] );
}

/**
 * Execute create-audience ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_create_audience( array $input ) {
	$title = $input['title'] ?? '';
	$description = $input['description'] ?? '';
	$rules = $input['rules'] ?? [];

	if ( empty( $title ) ) {
		return new WP_Error( 'missing_title', __( 'title is required.', 'altis' ) );
	}

	if ( empty( $rules ) ) {
		return new WP_Error( 'missing_rules', __( 'rules is required.', 'altis' ) );
	}

	// Create audience post.
	$audience_id = wp_insert_post( [
		'post_type'    => 'audience',
		'post_title'   => sanitize_text_field( $title ),
		'post_excerpt' => sanitize_text_field( $description ),
		'post_status'  => 'publish',
	], true );

	if ( is_wp_error( $audience_id ) ) {
		return $audience_id;
	}

	// Save audience configuration.
	update_post_meta( $audience_id, 'audience', $rules );

	return [
		'success'     => true,
		'audience_id' => $audience_id,
		'edit_url'    => admin_url( 'admin.php?page=audience&id=' . $audience_id ),
	];
}

/**
 * Register accelerate/update-audience ability.
 *
 * Modifies existing audience targeting rules.
 *
 * @return void
 */
function register_update_audience() : void {
	wp_register_ability( 'accelerate/update-audience', [
		'label'       => __( 'Update Audience', 'altis' ),
		'description' => __( 'Modify existing audience segment targeting rules.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'audience_id' => [
					'type'        => 'integer',
					'description' => __( 'Audience post ID to update.', 'altis' ),
				],
				'title' => [
					'type'        => 'string',
					'description' => __( 'New title (optional).', 'altis' ),
				],
				'description' => [
					'type'        => 'string',
					'description' => __( 'New description (optional).', 'altis' ),
				],
				'rules' => [
					'type'        => 'object',
					'description' => __( 'New targeting rules (optional).', 'altis' ),
				],
			],
			'required' => [ 'audience_id' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'     => [ 'type' => 'boolean' ],
				'audience_id' => [ 'type' => 'integer' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_update_audience',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Updating audience segment...', 'altis' ),
		],
	] );
}

/**
 * Execute update-audience ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_update_audience( array $input ) {
	$audience_id = $input['audience_id'] ?? 0;

	if ( ! $audience_id ) {
		return new WP_Error( 'missing_audience_id', __( 'audience_id is required.', 'altis' ) );
	}

	$post = get_post( $audience_id );

	if ( ! $post || $post->post_type !== 'audience' ) {
		return new WP_Error( 'invalid_audience', __( 'Audience not found.', 'altis' ) );
	}

	// Build update array.
	$update_args = [ 'ID' => $audience_id ];

	if ( isset( $input['title'] ) ) {
		$update_args['post_title'] = sanitize_text_field( $input['title'] );
	}

	if ( isset( $input['description'] ) ) {
		$update_args['post_excerpt'] = sanitize_text_field( $input['description'] );
	}

	// Update post if there are changes.
	if ( count( $update_args ) > 1 ) {
		$updated = wp_update_post( $update_args, true );
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}
	}

	// Update rules if provided.
	if ( isset( $input['rules'] ) ) {
		update_post_meta( $audience_id, 'audience', $input['rules'] );
	}

	return [
		'success'     => true,
		'audience_id' => $audience_id,
	];
}

/**
 * Register accelerate/set-block-goal ability.
 *
 * Defines the conversion goal for a block.
 *
 * @return void
 */
function register_set_block_goal() : void {
	wp_register_ability( 'accelerate/set-block-goal', [
		'label'       => __( 'Set Block Goal', 'altis' ),
		'description' => __( 'Define the conversion goal metric for tracking block performance.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern post ID.', 'altis' ),
				],
				'goal' => [
					'type'        => 'string',
					'enum'        => [ 'engagement', 'click_any_link', 'submit_form' ],
					'description' => __( 'Conversion goal type.', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'goal' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'  => [ 'type' => 'boolean' ],
				'block_id' => [ 'type' => 'integer' ],
				'goal'     => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_set_block_goal',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Setting block conversion goal...', 'altis' ),
		],
	] );
}

/**
 * Execute set-block-goal ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_set_block_goal( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$goal = $input['goal'] ?? '';

	if ( ! $block_id ) {
		return new WP_Error( 'missing_block_id', __( 'block_id is required.', 'altis' ) );
	}

	if ( ! $goal ) {
		return new WP_Error( 'missing_goal', __( 'goal is required.', 'altis' ) );
	}

	$post = get_post( $block_id );

	if ( ! $post || $post->post_type !== 'wp_block' ) {
		return new WP_Error( 'invalid_block', __( 'Block not found or not a synced pattern.', 'altis' ) );
	}

	// Set goal meta.
	update_post_meta( $block_id, '_xb_goal', sanitize_text_field( $goal ) );

	return [
		'success'  => true,
		'block_id' => $block_id,
		'goal'     => $goal,
	];
}

/**
 * Register accelerate/set-traffic-percentage ability.
 *
 * Adjusts traffic allocation for an experiment.
 *
 * @return void
 */
function register_set_traffic_percentage() : void {
	wp_register_ability( 'accelerate/set-traffic-percentage', [
		'label'       => __( 'Set Traffic Percentage', 'altis' ),
		'description' => __( 'Adjust the percentage of traffic included in an experiment.', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern post ID.', 'altis' ),
				],
				'percentage' => [
					'type'        => 'integer',
					'minimum'     => 1,
					'maximum'     => 100,
					'description' => __( 'Traffic percentage (1-100).', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'percentage' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'    => [ 'type' => 'boolean' ],
				'block_id'   => [ 'type' => 'integer' ],
				'percentage' => [ 'type' => 'integer' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_set_traffic_percentage',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_create_experiments',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Adjusting traffic allocation...', 'altis' ),
		],
	] );
}

/**
 * Execute set-traffic-percentage ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_set_traffic_percentage( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$percentage = $input['percentage'] ?? 100;

	if ( ! $block_id ) {
		return new WP_Error( 'missing_block_id', __( 'block_id is required.', 'altis' ) );
	}

	$post = get_post( $block_id );

	if ( ! $post || $post->post_type !== 'wp_block' ) {
		return new WP_Error( 'invalid_block', __( 'Block not found or not a synced pattern.', 'altis' ) );
	}

	// Validate percentage.
	$percentage = max( 1, min( 100, (int) $percentage ) );

	// Set traffic percentage meta.
	update_post_meta( $block_id, '_xb_traffic_percentage', $percentage );

	return [
		'success'    => true,
		'block_id'   => $block_id,
		'percentage' => $percentage,
	];
}

/**
 * Register accelerate/get-experiment-results ability.
 *
 * Retrieves detailed statistical results for running or completed experiments.
 *
 * @return void
 */
function register_get_experiment_results() : void {
	wp_register_ability( 'accelerate/get-experiment-results', [
		'label'       => __( 'Get Experiment Results', 'altis' ),
		'description' => __( 'Get detailed statistical results for a running or completed experiment (A/B test or personalization).', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern (wp_block) post ID.', 'altis' ),
				],
				'refresh' => [
					'type'        => 'boolean',
					'default'     => false,
					'description' => __( 'Force refresh of cached results.', 'altis' ),
				],
			],
			'required' => [ 'block_id' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id'             => [ 'type' => 'integer' ],
				'experiment_type'      => [ 'type' => 'string' ],
				'status'               => [ 'type' => 'string' ],
				'started_at'           => [ 'type' => 'string' ],
				'ended_at'             => [ 'type' => [ 'string', 'null' ] ],
				'traffic_percentage'   => [ 'type' => 'integer' ],
				'confidence_threshold' => [ 'type' => 'number' ],
				'has_winner'           => [ 'type' => 'boolean' ],
				'winner_variant_index' => [ 'type' => [ 'integer', 'null' ] ],
				'variants'             => [ 'type' => 'array' ],
				'recommendation'       => [ 'type' => 'object' ],
				'edit_url'             => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_experiment_results',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_view_analytics',
		'meta' => [
			'show_in_rest'     => true,
			'mcp' => [ 'public' => true ],
			'thinking_message' => __( 'Fetching experiment results...', 'altis' ),
		],
	] );
}

/**
 * Execute get-experiment-results ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Experiment results or error.
 */
function execute_get_experiment_results( array $input ) {
	$block_id = $input['block_id'] ?? 0;

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	// Find the experiment via the Experiment model.
	// First try active (running/paused/draft), then fall back to most recent completed.
	$experiment = Experiments\Experiment::get_active_for_post( $block_id, 'block' );
	if ( ! $experiment ) {
		$completed = Experiments\Experiment::query(
			[
				'subject_post_id' => $block_id,
				'test_id'         => 'block',
				'status'          => Experiments\Experiment::STATUS_COMPLETED,
			],
			[
				'per_page' => 1,
				'order_by' => [ 'updated_at' => 'DESC' ],
			]
		)->get_results();
		$experiment = ! empty( $completed ) ? $completed[0] : null;
	}

	if ( ! $experiment ) {
		return new WP_Error( 'not_experiment', __( 'No experiment found for this block.', 'altis' ) );
	}

	$experiment_type = $experiment->get_type();
	$status = $experiment->get_status();
	$goal = $experiment->get_goal();
	$traffic_percentage = $experiment->get_traffic_percentage();
	$start_time = $experiment->get_start_time();
	$end_time = $experiment->get_end_time();
	$results = $experiment->get_results();

	// Parse block content to get current variants.
	$variant_blocks = Variants\get_variant_blocks( $block_id );
	$variants = [];

	foreach ( $variant_blocks as $idx => $block ) {
		$variants[] = [
			'index'       => $idx,
			'title'       => $block['attrs']['title'] ?? sprintf( 'Variant %d', $idx + 1 ),
			'is_control'  => $idx === 0,
			'is_fallback' => ! empty( $block['attrs']['fallback'] ),
			'audience'    => $block['attrs']['audience'] ?? null,
		];
	}

	// Process results for each variant.
	$has_winner = isset( $results['winner'] ) && $results['winner'] !== null;
	$winner_index = $has_winner ? (int) $results['winner'] : null;
	$result_variants = $results['variants'] ?? [];

	foreach ( $variants as $idx => &$variant ) {
		$result = $result_variants[ $idx ] ?? [];

		$variant['impressions'] = $result['size'] ?? 0;
		$variant['conversions'] = $result['hits'] ?? 0;
		$variant['conversion_rate'] = isset( $result['rate'] ) ? round( $result['rate'] * 100, 2 ) : 0;
		$variant['p_value'] = $result['p'] ?? 1;
		$variant['probability_to_beat_control'] = $idx === 0 ? 0 : ( isset( $result['p'] ) ? round( ( 1 - $result['p'] ) * 100, 2 ) : 0 );
		$variant['is_winner'] = $winner_index === $idx;
	}
	unset( $variant );

	// Generate recommendation.
	$recommendation = generate_experiment_recommendation( $status, $has_winner, $winner_index, $variants );

	return [
		'block_id'             => $block_id,
		'experiment_type'      => $experiment_type,
		'goal'                 => $goal,
		'status'               => $status,
		'started_at'           => $start_time ? gmdate( 'c', intval( $start_time / 1000 ) ) : null,
		'ended_at'             => $end_time ? gmdate( 'c', intval( $end_time / 1000 ) ) : null,
		'traffic_percentage'   => $traffic_percentage,
		'confidence_threshold' => 0.95,
		'has_winner'           => $has_winner,
		'winner_variant_index' => $winner_index,
		'variants'             => $variants,
		'recommendation'       => $recommendation,
		'edit_url'             => get_edit_post_link( $block_id, 'raw' ),
	];
}

/**
 * Generate recommendation based on experiment state.
 *
 * @param string    $status       Current status.
 * @param bool      $has_winner   Whether there's a winner.
 * @param int|null  $winner_index Winner variant index.
 * @param array     $variants     Variant data.
 * @return array Recommendation with action, message, confidence.
 */
function generate_experiment_recommendation( string $status, bool $has_winner, ?int $winner_index, array $variants ) : array {
	if ( $has_winner && $winner_index !== null ) {
		$winner = $variants[ $winner_index ] ?? null;
		$winner_title = $winner['title'] ?? 'Variant ' . ( $winner_index + 1 );

		return [
			'action'     => 'declare_winner',
			'message'    => sprintf(
				/* translators: %s: winner variant title */
				__( 'Variant "%s" is the winner with statistical significance. Consider declaring it the winner.', 'altis' ),
				$winner_title
			),
			'confidence' => 'high',
		];
	}

	if ( $status === 'running' ) {
		// Check if we have enough data.
		$total_impressions = array_sum( array_column( $variants, 'impressions' ) );

		if ( $total_impressions < 100 ) {
			return [
				'action'     => 'continue',
				'message'    => __( 'Not enough data yet. Continue running the experiment to gather more impressions.', 'altis' ),
				'confidence' => 'low',
			];
		}

		// Check if any variant is clearly losing.
		$winning_variant = null;
		$winning_prob = 0;

		foreach ( $variants as $idx => $v ) {
			if ( $idx === 0 ) {
				continue;
			}
			if ( $v['probability_to_beat_control'] > $winning_prob ) {
				$winning_prob = $v['probability_to_beat_control'];
				$winning_variant = $v;
			}
		}

		if ( $winning_prob >= 90 ) {
			return [
				'action'     => 'continue',
				'message'    => sprintf(
					/* translators: %s: variant title, %d: probability percentage */
					__( 'Variant "%s" is performing well (%d%% probability to beat control). Continue to reach statistical significance.', 'altis' ),
					$winning_variant['title'],
					(int) $winning_prob
				),
				'confidence' => 'medium',
			];
		}

		return [
			'action'     => 'continue',
			'message'    => __( 'Experiment is running. No clear winner yet. Continue to gather more data.', 'altis' ),
			'confidence' => 'low',
		];
	}

	if ( $status === 'paused' ) {
		return [
			'action'     => 'resume',
			'message'    => __( 'Experiment is paused. Consider resuming to continue gathering data.', 'altis' ),
			'confidence' => 'medium',
		];
	}

	if ( $status === 'completed' && ! $has_winner ) {
		return [
			'action'     => 'no_winner',
			'message'    => __( 'Experiment completed without a statistically significant winner. Consider running a new test with different variants.', 'altis' ),
			'confidence' => 'high',
		];
	}

	return [
		'action'     => 'setup',
		'message'    => __( 'Experiment is not started. Configure variants and start the test.', 'altis' ),
		'confidence' => 'low',
	];
}

/**
 * Register accelerate/stop-experiment ability.
 *
 * Ends experiments with various actions: pause, resume, stop, declare_winner.
 *
 * @return void
 */
function register_stop_experiment() : void {
	wp_register_ability( 'accelerate/stop-experiment', [
		'label'       => __( 'Stop Experiment', 'altis' ),
		'description' => __( 'End, pause, resume, or declare a winner for an experiment (A/B test or personalization).', 'altis' ),
		'category'    => 'accelerate-execution',
		'input_schema' => [
			'type'       => 'object',
			'properties' => [
				'block_id' => [
					'type'        => 'integer',
					'description' => __( 'Synced Pattern (wp_block) post ID.', 'altis' ),
				],
				'action' => [
					'type'        => 'string',
					'enum'        => [ 'pause', 'resume', 'stop', 'declare_winner' ],
					'description' => __( 'Action to take on the experiment.', 'altis' ),
				],
				'winner_variant_index' => [
					'type'        => 'integer',
					'description' => __( 'Required for declare_winner action. Zero-based index of the winning variant.', 'altis' ),
				],
			],
			'required' => [ 'block_id', 'action' ],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'success'    => [ 'type' => 'boolean' ],
				'block_id'   => [ 'type' => 'integer' ],
				'action'     => [ 'type' => 'string' ],
				'new_status' => [ 'type' => 'string' ],
				'message'    => [ 'type' => 'string' ],
				'edit_url'   => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_stop_experiment',
		'permission_callback' => 'Altis\\Accelerate\\Abilities\\can_manage_experiments',
		'meta' => [
			'show_in_rest'          => true,
			'mcp' => [ 'public' => true ],
			'destructive'           => true,
			'requires_confirmation' => true,
			'thinking_message'      => __( 'Processing experiment action...', 'altis' ),
		],
	] );
}

/**
 * Execute stop-experiment ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Result or error.
 */
function execute_stop_experiment( array $input ) {
	$block_id = $input['block_id'] ?? 0;
	$action = $input['action'] ?? '';
	$winner_index = $input['winner_variant_index'] ?? null;

	$post = Variants\validate_block_post( $block_id );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	if ( ! $action ) {
		return new WP_Error( 'missing_action', __( 'action is required.', 'altis' ) );
	}

	// Find the experiment via the Experiment model.
	$experiment = Experiments\Experiment::get_active_for_post( $block_id, 'block' );
	if ( ! $experiment ) {
		return new WP_Error( 'not_experiment', __( 'No active experiment found for this block.', 'altis' ) );
	}

	$message = '';
	$new_status = '';

	// The test ID is always 'block' for block-level experiments.
	$test_id = 'block';

	switch ( $action ) {
		case 'pause':
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_paused', 'true' );
			$new_status = Experiments\Experiment::STATUS_PAUSED;
			$message = __( 'Experiment paused successfully.', 'altis' );
			break;

		case 'resume':
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_paused', 'false' );
			$new_status = Experiments\Experiment::STATUS_RUNNING;
			$message = __( 'Experiment resumed successfully.', 'altis' );
			break;

		case 'stop':
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_paused', 'true' );
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_ended', 'true' );
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_end_time', Utils\milliseconds() );
			$new_status = Experiments\Experiment::STATUS_COMPLETED;
			$message = __( 'Experiment stopped successfully.', 'altis' );
			break;

		case 'declare_winner':
			if ( $winner_index === null ) {
				return new WP_Error( 'missing_winner', __( 'winner_variant_index is required for declare_winner action.', 'altis' ) );
			}

			// Update results with winner via post meta (dual-write source of truth).
			$results = get_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_results', true ) ?: [];
			$results['winner'] = (int) $winner_index;
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_results', $results );

			// End the test.
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_paused', 'true' );
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_ended', 'true' );
			update_post_meta( $block_id, '_altis_ab_test_' . $test_id . '_end_time', Utils\milliseconds() );

			$new_status = Experiments\Experiment::STATUS_COMPLETED;
			$message = sprintf(
				/* translators: %d: winner variant index */
				__( 'Variant %d declared as winner. Experiment completed.', 'altis' ),
				$winner_index + 1
			);
			break;

		default:
			return new WP_Error( 'invalid_action', __( 'Invalid action specified.', 'altis' ) );
	}

	// Sync the updated state to the experiments table.
	Variants\sync_post_experiment( $block_id, $experiment->get_type() );

	return [
		'success'    => true,
		'block_id'   => $block_id,
		'action'     => $action,
		'new_status' => $new_status,
		'message'    => $message,
		'edit_url'   => get_edit_post_link( $block_id, 'raw' ),
	];
}
