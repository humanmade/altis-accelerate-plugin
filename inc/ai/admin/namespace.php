<?php

namespace Altis\Accelerate\AI\Admin;

use Altis\Accelerate\Utils;

function bootstrap() : void {
	add_action( 'init', __NAMESPACE__ . '\\register_blocks' );
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_assets' );
}

function register_blocks() : void {
	register_block_type( __DIR__ );

}

function enqueue_assets() : void {
	$script = Utils\register_assets(
		'blocks/ai',
		[
			'dependencies' => [],
		],
		true
	);

	wp_localize_script(
		$script['script'],
		'AltisAIBlock',
		[
			'nonce' => wp_create_nonce( 'wp_rest' ),
		]
	);
}
