<?php
/**
 * Broadcast Block Server Side.
 *
 * @phpcs:disable HM.Files.NamespaceDirectoryName.NameMismatch
 * @phpcs:disable HM.Files.FunctionFileName.WrongFile
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Blocks\Broadcast;

use Altis\Accelerate\Utils;
use WP_Post;
use WP_Query;

const BLOCK = 'broadcast';

/**
 * Registers the block type assets and server side rendering.
 */
function setup() {
	// Queue up JS files.
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_assets' );

	// Register the block.
	register_block_type( __DIR__, [
		'render_callback' => __NAMESPACE__ . '\\render_block',
	] );
}

/**
 * Enqueues the block assets.
 */
function enqueue_assets() {
	$block = Utils\register_assets(
		'blocks/broadcast',
		[
			'dependencies' => [
				'wp-api-fetch',
				'wp-plugins',
				'wp-blocks',
				'wp-i18n',
				'wp-editor',
				'wp-block-editor',
				'wp-components',
				'wp-edit-post',
				'wp-html-entities',
			],
		],
		true
	);

	wp_add_inline_script(
		$block['script'],
		sprintf(
			'window.Altis = window.Altis || {};' .
			'window.Altis.Analytics = window.Altis.Analytics || {};' .
			'window.Altis.Analytics.Broadcast = window.Altis.Analytics.Broadcast || {};' .
			'window.Altis.Analytics.Broadcast.ManagerURL = "%s";',
			'edit.php?post_type=broadcast'
		),
		'before'
	);
}

/**
 * Render callback for the Broadcast block.
 *
 * Because this block only saves <InnerBlocks.Content> on the JS side,
 * the content string represents only the wrapped inner block markup.
 *
 * @param array $attributes The block's attributes object.
 * @param string $inner_content The block's saved content.
 * @return string The final rendered block markup, as an HTML string.
 */
function render_block( array $attributes, ?string $inner_content = '' ) : string {
	$client_id = $attributes['clientId'] ?? null;
	$broadcast_id = $attributes['broadcast'] ?? null;
	$class_name = $attributes['className'] ?? '';
	$align = $attributes['align'] ?? 'none';

	// Add alignment class.
	if ( ! empty( $align ) ) {
		$class_name .= sprintf( 'align%s', $align );
	}

	$block_ids = get_post_meta( $broadcast_id, 'blocks' ) ?: [];

	if ( empty( $block_ids ) ) {
		return '';
	}

	$add_broadcast_id = function ( array $attributes ) use ( $broadcast_id ) : array {
		$attributes['broadcastId'] = $broadcast_id;
		return $attributes;
	};

	add_filter( 'altis.analytics.block_event_attributes', $add_broadcast_id );

	$block_ids = array_map( 'absint', array_values( array_filter( $block_ids ) ) );
	$blocks = new WP_Query( [
		'post_type' => 'wp_block',
		'post__in' => $block_ids,
		'post_status' => 'publish',
		'posts_per_page' => min( 20, count( $block_ids ) ),
		'no_found_rows' => true,
	] );
	$nested_blocks = array_map( function( WP_Post $block ) use ( $client_id ) : string {
		$content = $block->post_type === 'wp_block'
			? sprintf( '<!-- wp:block {"ref":%1$d} /-->', $block->ID )
			: $block->post_content;
		return sprintf(
			'<template data-id="%1$d" data-parent-id="%2$s">%3$s</template>',
			$block->ID,
			$client_id,
			$content
		);
	}, $blocks->posts );
	$inner_content = do_blocks( implode( '', $nested_blocks ) );

	remove_filter( 'altis.analytics.block_event_attributes', $add_broadcast_id );

	// Preview.
	if ( current_user_can( 'edit_posts' ) && ( is_preview() || is_customize_preview() ) ) {
		Utils\register_assets(
			'blocks/altis-xb-preview',
			[
				'dependencies' => [
					'wp-i18n',
				],
			],
			true
		);

		return sprintf(
			'%s
			<div class="altis-xb-preview altis-xb-preview--broadcast %s" data-client-id="%s" data-post-id="%s">
				<div class="altis-xb-preview__tabs"></div>
				<div class="altis-xb-preview__content"></div>
			</div>',
			$inner_content,
			$class_name,
			$client_id,
			$broadcast_id
		);
	}

	return sprintf(
		'%4$s<broadcast-block class="%1$s" client-id="%2$s" broadcast-id="%3$d"></broadcast-block>',
		$class_name,
		$client_id,
		$broadcast_id,
		$inner_content
	);
}
