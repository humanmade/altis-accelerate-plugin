<?php

namespace Altis\Accelerate\GlobalBlocks\Categories;

/**
 * Bootstrap it up!
 */
function bootstrap() {
	add_action( 'init', __NAMESPACE__ . '\\register_block_categories' );
}

/**
 * Create the block categories taxonomy.
 */
function register_block_categories() {
	register_taxonomy( 'wp_block_category', 'wp_block', [
		'label' => __( 'Block Categories', 'altis' ),
		'labels' => [
			'name'                       => _x( 'Block Categories', 'taxonomy general name', 'altis' ),
			'singular_name'              => _x( 'Block Category', 'taxonomy singular name', 'altis' ),
			'search_items'               => __( 'Search Block Categories', 'altis' ),
			'popular_items'              => __( 'Popular Block Categories', 'altis' ),
			'all_items'                  => __( 'All Block Categories', 'altis' ),
			'parent_item'                => __( 'Parent Category', 'altis' ),
			'parent_item_colon'          => __( 'Parent Category:', 'altis' ),
			'edit_item'                  => __( 'Edit Block Category', 'altis' ),
			'update_item'                => __( 'Update Block Category', 'altis' ),
			'add_new_item'               => __( 'Add New Block Category', 'altis' ),
			'new_item_name'              => __( 'New Block Category Name', 'altis' ),
			'separate_items_with_commas' => __( 'Separate block categories with commas', 'altis' ),
			'add_or_remove_items'        => __( 'Add or remove block categories', 'altis' ),
			'choose_from_most_used'      => __( 'Choose from the most used block categories', 'altis' ),
			'not_found'                  => __( 'No block categories found.', 'altis' ),
			'menu_name'                  => __( 'Categories', 'altis' ),
		],
		'public' => false,
		'publicly_queryable' => false,
		'show_ui' => true,
		'show_in_nav_menus' => false,
		'show_in_rest' => true,
		'hierarchical' => true,
		'show_admin_column' => true,
		'rewrite' => false,
	] );
}
