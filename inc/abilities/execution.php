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
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Broadcast;
use WP_Error;

/**
 * Register all execution abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_create_ab_test();
	register_create_personalization_rule();
	register_broadcast_content();
	register_create_audience();
	register_update_audience();
	register_set_block_goal();
	register_set_traffic_percentage();
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

	if ( ! $block_id ) {
		return new WP_Error( 'missing_block_id', __( 'block_id is required.', 'altis' ) );
	}

	if ( count( $variants ) < 2 ) {
		return new WP_Error( 'insufficient_variants', __( 'At least 2 variants are required for an A/B test.', 'altis' ) );
	}

	$post = get_post( $block_id );

	if ( ! $post || $post->post_type !== 'wp_block' ) {
		return new WP_Error( 'invalid_block', __( 'Block not found or not a synced pattern.', 'altis' ) );
	}

	// Build variant blocks.
	$variant_blocks = [];
	foreach ( $variants as $index => $variant ) {
		$content = $variant['content'] ?? '';
		$title = $variant['title'] ?? sprintf( 'Variant %d', $index + 1 );

		// Parse content to blocks or wrap in paragraph.
		$inner_blocks = parse_blocks( $content );
		if ( empty( $inner_blocks ) || ( count( $inner_blocks ) === 1 && empty( $inner_blocks[0]['blockName'] ) ) ) {
			// Wrap plain text in paragraph block.
			$inner_blocks = parse_blocks( '<!-- wp:paragraph --><p>' . esc_html( $content ) . '</p><!-- /wp:paragraph -->' );
		}

		$variant_blocks[] = [
			'blockName'    => 'altis/variant',
			'attrs'        => [
				'title' => $title,
			],
			'innerBlocks'  => $inner_blocks,
			'innerHTML'    => '',
			'innerContent' => [],
		];
	}

	// Wrap variants in parent block structure.
	$new_content = serialize_blocks( $variant_blocks );

	// Update post content.
	$updated = wp_update_post( [
		'ID'           => $block_id,
		'post_content' => $new_content,
	], true );

	if ( is_wp_error( $updated ) ) {
		return $updated;
	}

	// Set A/B test meta.
	update_post_meta( $block_id, '_xb_abtest', true );
	update_post_meta( $block_id, '_xb_goal', $goal );
	update_post_meta( $block_id, '_xb_traffic_percentage', $traffic_percentage );

	if ( $hypothesis ) {
		update_post_meta( $block_id, '_xb_hypothesis', sanitize_text_field( $hypothesis ) );
	}

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

	if ( ! $block_id ) {
		return new WP_Error( 'missing_block_id', __( 'block_id is required.', 'altis' ) );
	}

	if ( ! $audience_id ) {
		return new WP_Error( 'missing_audience_id', __( 'audience_id is required.', 'altis' ) );
	}

	$post = get_post( $block_id );

	if ( ! $post || $post->post_type !== 'wp_block' ) {
		return new WP_Error( 'invalid_block', __( 'Block not found or not a synced pattern.', 'altis' ) );
	}

	// Verify audience exists.
	$audience = get_post( $audience_id );
	if ( ! $audience || $audience->post_type !== 'audience' ) {
		return new WP_Error( 'invalid_audience', __( 'Audience not found.', 'altis' ) );
	}

	// Build variant blocks.
	$personalized_blocks = parse_blocks( $personalized_content );
	if ( empty( $personalized_blocks ) || ( count( $personalized_blocks ) === 1 && empty( $personalized_blocks[0]['blockName'] ) ) ) {
		$personalized_blocks = parse_blocks( '<!-- wp:paragraph --><p>' . esc_html( $personalized_content ) . '</p><!-- /wp:paragraph -->' );
	}

	$fallback_blocks = [];
	if ( $fallback_content ) {
		$fallback_blocks = parse_blocks( $fallback_content );
		if ( empty( $fallback_blocks ) || ( count( $fallback_blocks ) === 1 && empty( $fallback_blocks[0]['blockName'] ) ) ) {
			$fallback_blocks = parse_blocks( '<!-- wp:paragraph --><p>' . esc_html( $fallback_content ) . '</p><!-- /wp:paragraph -->' );
		}
	} else {
		// Use existing content as fallback.
		$fallback_blocks = parse_blocks( $post->post_content );
	}

	// Create variant blocks.
	$variant_blocks = [
		[
			'blockName'    => 'altis/variant',
			'attrs'        => [
				'title'    => __( 'Fallback', 'altis' ),
				'fallback' => true,
			],
			'innerBlocks'  => $fallback_blocks,
			'innerHTML'    => '',
			'innerContent' => [],
		],
		[
			'blockName'    => 'altis/variant',
			'attrs'        => [
				'title'    => $audience->post_title,
				'audience' => $audience_id,
			],
			'innerBlocks'  => $personalized_blocks,
			'innerHTML'    => '',
			'innerContent' => [],
		],
	];

	$new_content = serialize_blocks( $variant_blocks );

	// Update post content.
	$updated = wp_update_post( [
		'ID'           => $block_id,
		'post_content' => $new_content,
	], true );

	if ( is_wp_error( $updated ) ) {
		return $updated;
	}

	// Set personalization meta.
	update_post_meta( $block_id, '_xb_personalization', true );
	delete_post_meta( $block_id, '_xb_abtest' );

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
