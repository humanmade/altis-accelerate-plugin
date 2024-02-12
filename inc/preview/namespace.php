<?php
/**
 * Audience preview selector.
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Preview;

use Altis\Accelerate;
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Utils;

/**
 * Bootstrap Title AB Tests Feature.
 *
 * @return void
 */
function setup() : void {
	add_action( 'wp_enqueue_scripts', __NAMESPACE__ . '\\enqueue_assets' );
	add_action( 'admin_bar_menu', __NAMESPACE__ . '\\add_menu_item', 100 );
}

/**
 * Should we show the Audience preview selector?
 *
 * @return bool True to show the preview selector, false otherwise.
 */
function should_show_selector() : bool {
	return is_admin_bar_showing() && ! is_admin() && current_user_can( 'edit_posts' );
}

/**
 * Enqueue the preview selector assets.
 *
 * @return void
 */
function enqueue_assets() : void {
	if ( ! should_show_selector() ) {
		return;
	}

	wp_enqueue_style(
		'altis-analytics-preview',
		plugins_url( 'src/audiences/preview/index.css', Accelerate\PLUGIN_DIR . '/plugin.php' ),
		[],
		Accelerate\VERSION
	);

	// Enqueue the script and pass through data.
	$preview = Utils\register_assets(
		'audiences/preview',
		[
			'dependencies' => [
				'altis-accelerate-accelerate',
				'wp-element',
			],
		],
		true
	);
	wp_localize_script( $preview['script'], 'AltisExperimentsPreview', get_script_data() );
}

/**
 * Get data to pass to the frontend.
 *
 * @return array
 */
function get_script_data() : array {
	$audiences = Audiences\query_audiences();
	$data = [
		'audiences' => [],
		'editLabel' => __( 'Create your first audience', 'altis' ),
		'editUrl' => admin_url( 'admin.php?page=audience' ),
		'label' => __( 'Audience Preview', 'altis' ),
	];
	foreach ( $audiences as $post ) {
		$data['audiences'][] = [
			'id' => $post->ID,
			'title' => html_entity_decode( get_the_title( $post->ID ) ),
		];
	}

	return $data;
}

/**
 * Register the menu item.
 *
 * @param \WP_Admin_Bar $wp_admin_bar The admin bar manager object.
 * @return void
 */
function add_menu_item( $wp_admin_bar ) : void {
	if ( ! should_show_selector() ) {
		return;
	}

	$wp_admin_bar->add_node( [
		'id' => 'altis-analytics-preview',
		'title' => '',
		'meta' => [
			// Trigger the hover handler, even with no child items.
			'class' => 'menupop',
		],
	] );
}
