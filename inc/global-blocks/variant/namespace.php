<?php
/**
 * Global Block Variant Block Server Side.
 *
 * @phpcs:disable HM.Files.NamespaceDirectoryName.NameMismatch
 * @phpcs:disable HM.Files.FunctionFileName.WrongFile
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\GlobalBlocks\Variant;

const BLOCK = 'altis/variant';

/**
 * Registers the block type assets and server side rendering.
 */
function bootstrap() {
	// Register the block.
	register_block_type( __DIR__, [
		'render_callback' => __NAMESPACE__ . '\\render_block',
	] );
}

/**
 * Render callback for the A/B test variant block.
 *
 * Because this block only saves <InnerBlocks.Content> on the JS side,
 * the content string represents only the wrapped inner block markup.
 *
 * @param array $attributes The block's attributes object.
 * @param string $inner_content The block's saved content.
 * @return string The final rendered block markup, as an HTML string.
 */
function render_block( array $attributes, ?string $inner_content = '' ) : string {
	$fallback = $attributes['fallback'] ?? false;
	$goal = $attributes['goal'] ?? '';
	$audience = $attributes['audience'] ?? 0;
	$percentage = $attributes['percentage'] ?? '';
	$title = $attributes['title'] ?? '';

	// If this is the fallback variant output the template with different attributes
	// for easier and more specific targeting by document.querySelector().
	if ( $fallback ) {
		return sprintf(
			'<template data-fallback data-parent-id="__PARENT_BLOCK_ID__" data-title="%4$s" data-goal="%1$s" data-weight="%2$s">%3$s</template><noscript>%3$s</noscript>',
			esc_attr( $goal ),
			$percentage,
			$inner_content,
			esc_attr( $title )
		);
	}

	return sprintf(
		'<template data-parent-id="__PARENT_BLOCK_ID__" data-title="%s" data-goal="%s" data-weight="%s" data-audience="%d">%s</template>',
		esc_attr( $title ),
		esc_attr( $goal ),
		$percentage,
		absint( $audience ),
		$inner_content,
	);
}
