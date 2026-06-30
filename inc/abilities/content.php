<?php
/**
 * Accelerate Abilities API - Content Domain.
 *
 * Read post content and media library abilities.
 *
 * @package Altis\Accelerate\Abilities\Content
 */

namespace Altis\Accelerate\Abilities\Content;

use WP_Error;

/**
 * Register all content abilities.
 *
 * @return void
 */
function register_abilities() : void {
	register_get_content();
	register_get_media();
}

/**
 * Permission callback for reading post content.
 *
 * Reading raw block markup (including drafts and synced patterns) is an
 * editorial operation, so it requires post-editing access rather than the
 * read-only analytics capability. Per-post read authorization is enforced
 * separately in execute_get_content() via the read_post meta capability.
 *
 * @return bool Whether the user may read post content.
 */
function can_read_content() : bool {
	return current_user_can( 'edit_posts' );
}

/**
 * Permission callback for listing the media library.
 *
 * Mirrors the capability the WordPress media library itself requires.
 * execute_get_media() further scopes results to media the user may read:
 * users without read_private_posts only see their own uploads.
 *
 * @return bool Whether the user may list media.
 */
function can_read_media() : bool {
	return current_user_can( 'upload_files' );
}

/**
 * Register accelerate/get-content ability.
 *
 * Retrieve a single post/page by ID or URL. Provide id or url; id takes
 * precedence if both are given.
 *
 * @return void
 */
function register_get_content() : void {
	wp_register_ability( 'accelerate/get-content', [
		'label'       => __( 'Get Content', 'altis' ),
		'description' => __( 'Retrieve a single post or page by ID or URL. Provide id or url; id takes precedence if both are given.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => [
				'id' => [
					'type'        => 'integer',
					'description' => __( 'Post ID. Takes precedence over url if both are provided.', 'altis' ),
				],
				'url' => [
					'type'        => 'string',
					'description' => __( 'Post URL. Used to resolve the post when no id is given.', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'id'       => [ 'type' => 'integer' ],
				'type'     => [ 'type' => 'string' ],
				'status'   => [ 'type' => 'string' ],
				'slug'     => [ 'type' => 'string' ],
				'title'    => [ 'type' => 'string' ],
				'content'  => [ 'type' => 'string' ],
				'template' => [ 'type' => 'string' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_content',
		'permission_callback' => __NAMESPACE__ . '\\can_read_content',
		'meta' => [
			'show_in_rest'     => true,
			'mcp'              => [ 'public' => true ],
			'thinking_message' => __( 'Reading content…', 'altis' ),
		],
	] );
}

/**
 * Execute get-content ability.
 *
 * @param array $input Input parameters.
 * @return array|WP_Error Post data or error.
 */
function execute_get_content( array $input ) {
	$id  = isset( $input['id'] ) ? (int) $input['id'] : 0;
	$url = $input['url'] ?? '';

	if ( ! $id && empty( $url ) ) {
		return new WP_Error( 'missing_input', __( 'Provide either id or url.', 'altis' ) );
	}

	if ( $id ) {
		$post = get_post( $id );
	} else {
		$resolved = url_to_postid( esc_url_raw( $url ) );
		$post     = $resolved ? get_post( $resolved ) : null;
	}

	if ( ! $post ) {
		return new WP_Error( 'not_found', __( 'No post found for the given id or url.', 'altis' ) );
	}

	if ( ! current_user_can( 'read_post', $post->ID ) ) {
		return new WP_Error( 'forbidden', __( 'You do not have permission to read this content.', 'altis' ), [ 'status' => 403 ] );
	}

	return [
		'id'       => $post->ID,
		'type'     => $post->post_type,
		'status'   => $post->post_status,
		'slug'     => $post->post_name,
		'title'    => $post->post_title,
		'content'  => $post->post_content,
		'template' => get_page_template_slug( $post ),
	];
}

/**
 * Register accelerate/get-media ability.
 *
 * List media library items with optional search and mime-type filtering.
 *
 * @return void
 */
function register_get_media() : void {
	wp_register_ability( 'accelerate/get-media', [
		'label'       => __( 'Get Media', 'altis' ),
		'description' => __( 'List media library attachments with optional search and mime-type filtering.', 'altis' ),
		'category'    => 'accelerate-discovery',
		'input_schema' => [
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => [
				'limit' => [
					'type'    => 'integer',
					'default' => 20,
					'minimum' => 1,
					'maximum' => 100,
				],
				'offset' => [
					'type'    => 'integer',
					'default' => 0,
					'minimum' => 0,
				],
				'search' => [
					'type'        => 'string',
					'description' => __( 'Optional search string to filter media by title or filename.', 'altis' ),
				],
				'mime_type' => [
					'type'        => 'string',
					'description' => __( 'Optional MIME type filter (e.g. image/jpeg, application/pdf).', 'altis' ),
				],
			],
		],
		'output_schema' => [
			'type'       => 'object',
			'properties' => [
				'media'       => [ 'type' => 'array' ],
				'total_count' => [ 'type' => 'integer' ],
			],
		],
		'execute_callback'    => __NAMESPACE__ . '\\execute_get_media',
		'permission_callback' => __NAMESPACE__ . '\\can_read_media',
		'meta' => [
			'show_in_rest'     => true,
			'mcp'              => [ 'public' => true ],
			'thinking_message' => __( 'Listing media…', 'altis' ),
		],
	] );
}

/**
 * Execute get-media ability.
 *
 * @param array $input Input parameters.
 * @return array Media list and total count.
 */
function execute_get_media( array $input ) {
	$limit  = min( max( (int) ( $input['limit'] ?? 20 ), 1 ), 100 );
	$offset = max( (int) ( $input['offset'] ?? 0 ), 0 );

	$args = [
		'post_type'      => 'attachment',
		'post_status'    => 'inherit',
		'orderby'        => 'date',
		'order'          => 'DESC',
		'posts_per_page' => $limit,
		'offset'         => $offset,
	];

	// Restrict to media the user may read so total_count and pagination stay
	// consistent. Users who can read others' private posts (editors/admins,
	// including the toolkit's account) see the whole library; everyone else is
	// scoped to their own uploads, so attachments on other users' private or
	// unpublished posts are never exposed.
	if ( ! current_user_can( 'read_private_posts' ) ) {
		$args['author'] = get_current_user_id();
	}

	if ( ! empty( $input['search'] ) ) {
		$args['s'] = sanitize_text_field( $input['search'] );
	}

	if ( ! empty( $input['mime_type'] ) ) {
		$args['post_mime_type'] = sanitize_mime_type( $input['mime_type'] );
	}

	$query = new \WP_Query( $args );

	$media = [];
	foreach ( $query->posts as $att ) {
		$meta    = wp_get_attachment_metadata( $att->ID );
		$media[] = [
			'id'     => $att->ID,
			'url'    => wp_get_attachment_url( $att->ID ),
			'alt'    => get_post_meta( $att->ID, '_wp_attachment_image_alt', true ),
			'width'  => $meta['width'] ?? null,
			'height' => $meta['height'] ?? null,
			'mime'   => $att->post_mime_type,
		];
	}

	return [
		'media'       => $media,
		'total_count' => (int) $query->found_posts,
	];
}
