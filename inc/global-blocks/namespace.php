<?php

namespace Altis\Accelerate\GlobalBlocks;

use Altis\Accelerate\Blocks;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\Utils;
use Altis\Accelerate\GlobalBlocks\Connections;
use WP_Post_Type;
use WP_Block;
use WP_Post;

const BLOCK_POST_TYPE = 'wp_block';
const RELATIONSHIPS_PER_PAGE = 10;

/**
 * Altis\ReusableBlocks Bootstrap.
 */
function bootstrap() {

	Categories\bootstrap();
	Connections\bootstrap();
	REST_API\bootstrap();
	Variant\bootstrap();

	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_block_editor_assets', 9 );
	add_action( 'admin_bar_menu', __NAMESPACE__ . '\\add_block_admin_bar_menu_items', 100 );
	add_action( 'admin_menu', __NAMESPACE__ . '\\admin_menu', 100 );

	add_filter( 'manage_wp_block_posts_columns', __NAMESPACE__ . '\\manage_wp_block_posts_columns' );
	add_action( 'manage_wp_block_posts_custom_column', __NAMESPACE__ . '\\type_column_output', 10, 2 );

	add_filter( 'wp_insert_post_data', __NAMESPACE__ . '\\insert_reusable_block_post_data', 10, 2 );

	// Add to allowed blocks. Running a late to ensure that any block whitelist is defined.
	add_filter( 'allowed_block_types_all', __NAMESPACE__ . '\\filter_allowed_block_types', 20 );
	add_filter( 'register_post_type_args', __NAMESPACE__ . '\\show_wp_block_in_menu', 50, 2 );

	//add_action( 'registered_post_type_wp_block', __NAMESPACE__ . '\\update_reusable_block_registration', 10, 2 );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\override_block_type_metadata' );

	// Track reusable blocks.
	add_filter( 'render_block_core/block', __NAMESPACE__ . '\\render_block', 10, 3 );
	add_filter( 'render_block_altis/static-global', __NAMESPACE__ . '\\render_block', 10, 3 );

	// Process block variants on post save.
	add_action( 'save_post_wp_block', __NAMESPACE__ . '\\save_variants', 10, 2 );

	// Register A/B tests with experiments framework.
	add_action( 'init', __NAMESPACE__ . '\\register_test' );

	add_action( 'init', __NAMESPACE__ . '\\register_static_global_block' );
}

/**
 * Enqueue the JS and CSS for blocks in the editor.
 *
 * @return void
 */
function enqueue_block_editor_assets() {
	global $wp_styles;

	$assets = Utils\register_assets(
		'global-blocks',
		[
			'in-footer' => false,
			'dependencies' => [
				'wp-api-fetch',
				'wp-blocks',
				'wp-components',
				'wp-compose',
				'wp-data',
				'wp-edit-post',
				'wp-editor',
				'wp-element',
				'wp-html-entities',
				'wp-i18n',
				'wp-plugins',
				'wp-url',
				'altis-accelerate-blocks/data',
				'altis-accelerate-blocks/ui',
				'altis-accelerate-audiences/ui',
			],
		],
		true
	);

	$settings = [
		'editPostUrl' => admin_url( 'post.php?post=%d&action=edit' ),
		'context' => [
			'postId'   => get_the_ID(),
			'postType' => get_post_type(),
		],
		'relationshipsPerPage' => RELATIONSHIPS_PER_PAGE,
	];

	wp_localize_script( 'altis-accelerate-global-blocks', 'altisReusableBlocksSettings', $settings );

	// Register assets for core block.
	if ( ! empty( $assets['style'] ) ) {
		$wp_styles->registered['wp-reusable-blocks']->deps[] = $assets['style'];
	}
}

/**
 * Filter the allowed block types. If an array is provided, add `altis/global-block` to it, otherwise return the bool value that was passed in.
 *
 * @param bool|array $allowed_block_types Array of allowed block types or bool if it has not been filtered yet.
 * @return bool|array
 */
function filter_allowed_block_types( $allowed_block_types ) {
	if ( is_array( $allowed_block_types ) ) {
		$allowed_block_types[] = 'altis/block-picker';
	}

	return $allowed_block_types;
}

/**
 * Filter callback for `wp_insert_post_data`. Sets the post_name with the post_title for `wp_block` posts before inserting post data.
 *
 * @param array $data An array of slashed post data.
 * @param array $postarr An array of sanitized, but otherwise unmodified post data.
 *
 * @return array Filtered array of post data.
 */
function insert_reusable_block_post_data( array $data, array $postarr ) : array {
	if ( ! isset( $data['post_type'] ) || ! isset( $data['post_title'] ) ) {
		return $data;
	}

	if ( $data['post_type'] === BLOCK_POST_TYPE ) {
		$post_id = (int) $postarr['ID'] ?? 0;

		$data['post_name'] = wp_unique_post_slug(
			sanitize_title( $data['post_title'], $post_id ),
			$post_id,
			$data['post_status'],
			BLOCK_POST_TYPE,
			$data['post_parent'] ?? 0
		);
	}

	return $data;
}

/**
 * Update the wp_block post type to display in the admin menu.
 *
 * @param array $args The post type creation args.
 * @param string $post_type The post type name.
 * @return array
 */
function show_wp_block_in_menu( array $args, string $post_type ) : array {
	if ( $post_type !== 'wp_block' ) {
		return $args;
	}

	if ( function_exists( 'wp_get_current_user' ) && ! current_user_can( 'edit_posts' ) ) {
		return $args;
	}

	$args['show_in_menu'] = 'accelerate';
	$args['menu_position'] = 24;
	$args['menu_icon'] = plugins_url( '../assets/gb_icon.svg', __DIR__ );
	$args['labels']['all_items'] = _x( 'Synced Patterns', 'post type menu label for all_items', 'altis' );
	$args['labels']['name'] = _x( 'Synced Patterns', 'post type menu label for name', 'altis' );

	return $args;
}

/**
 * Add wp_block to main menu global var.
 *
 * Replicates wp-admin/menu.php line 103-163 without built in post type special cases.
 */
function admin_menu() {
	global $menu, $submenu, $_wp_last_object_menu;

	$ptype = 'wp_block';

	$ptype_obj = get_post_type_object( $ptype );

	// Remove any existing instances of reusable blocks menu item added by other plugins.
	foreach ( $menu as $position => $item ) {
		if ( $item[2] === 'edit.php?post_type=wp_block' ) {
			unset( $menu[ $position ] );
		}
	}
	foreach ( $submenu as $file => $children ) {
		if ( $file === 'accelerate' ) {
			continue;
		}
		$submenu[ $file ] = array_filter( $children, function ( $item ) {
			return $item[2] !== 'edit.php?post_type=wp_block';
		} );
	}

	// Check if it should be a submenu.
	if ( $ptype_obj->show_in_menu !== true ) {
		return false;
	}

	$ptype_menu_position = is_int( $ptype_obj->menu_position ) ? $ptype_obj->menu_position : ++$_wp_last_object_menu; // If we're to use $_wp_last_object_menu, increment it first.
	$ptype_for_id = sanitize_html_class( $ptype );

	$menu_icon = 'dashicons-admin-post';
	if ( is_string( $ptype_obj->menu_icon ) ) {
		// Special handling for data:image/svg+xml and Dashicons.
		if ( 0 === strpos( $ptype_obj->menu_icon, 'data:image/svg+xml;base64,' ) || 0 === strpos( $ptype_obj->menu_icon, 'dashicons-' ) ) {
			$menu_icon = $ptype_obj->menu_icon;
		} else {
			$menu_icon = esc_url( $ptype_obj->menu_icon );
		}
	}

	$menu_class = 'menu-top menu-icon-' . $ptype_for_id;

	$ptype_file = "edit.php?post_type=$ptype";
	$post_new_file = "post-new.php?post_type=$ptype";
	$edit_tags_file = "edit-tags.php?taxonomy=%s&amp;post_type=$ptype";

	$ptype_menu_id = 'menu-posts-' . $ptype_for_id;

	/*
	 * If $ptype_menu_position is already populated or will be populated
	 * by a hard-coded value below, increment the position.
	 */
	$core_menu_positions = [ 59, 60, 65, 70, 75, 80, 85, 99 ];
	while ( isset( $menu[ $ptype_menu_position ] ) || in_array( $ptype_menu_position, $core_menu_positions ) ) {
		$ptype_menu_position++;
	}

	// Disable globals sniff as it is safe to add to the menu and submenu globals.
	// phpcs:disable WordPress.WP.GlobalVariablesOverride.Prohibited
	$menu[ $ptype_menu_position ] = [ esc_attr( $ptype_obj->labels->menu_name ), $ptype_obj->cap->edit_posts, $ptype_file, '', $menu_class, $ptype_menu_id, $menu_icon ];
	$submenu[ $ptype_file ][5] = [ $ptype_obj->labels->all_items, $ptype_obj->cap->edit_posts, $ptype_file ];
	$submenu[ $ptype_file ][10] = [ $ptype_obj->labels->add_new, $ptype_obj->cap->create_posts, $post_new_file ];

	$i = 15;
	foreach ( get_taxonomies( [], 'objects' ) as $tax ) {
		if ( ! $tax->show_ui || ! $tax->show_in_menu || ! in_array( $ptype, (array) $tax->object_type, true ) ) {
			continue;
		}

		$submenu[ $ptype_file ][ $i++ ] = [ esc_attr( $tax->labels->menu_name ), $tax->cap->manage_terms, sprintf( $edit_tags_file, $tax->name ) ];
	}
	// phpcs:enable WordPress.WP.GlobalVariablesOverride.Prohibited
}


/**
 * Add Blocks to "Add New" menu.
 *
 * @param WP_Admin_Bar $wp_admin_bar
 */
function add_block_admin_bar_menu_items( \WP_Admin_Bar $wp_admin_bar ) {
	$wp_admin_bar->add_menu(
		[
			'parent' => 'new-content',
			'id'     => 'new-wp_block',
			'title'  => __( 'Synced Pattern', 'altis' ),
			'href'   => admin_url( 'post-new.php?post_type=wp_block' ),
		]
	);
}

/**
 * Update registration definition of the Reusable block.
 *
 * @param string $post_type
 * @param WP_Post_Type $post_type_object
 *
 * @return void
 */
function update_reusable_block_registration( string $post_type, WP_Post_Type $post_type_object ) : void {
	global $wp_post_types;

	$post_type_object->labels = (object) array_merge( (array) $post_type_object->labels, [
		'name'                     => _x( 'Synced Patterns', 'post type general name', 'altis' ),
		'singular_name'            => _x( 'Synced Pattern', 'post type singular name', 'altis' ),
		'add_new'                  => _x( 'Add New', 'Synced Pattern', 'altis' ),
		'add_new_item'             => __( 'Add new Synced Pattern', 'altis' ),
		'new_item'                 => __( 'New Synced Pattern', 'altis' ),
		'edit_item'                => __( 'Edit Synced Pattern', 'altis' ),
		'view_item'                => __( 'View Synced Pattern', 'altis' ),
		'view_items'               => __( 'View Synced Patterns', 'altis' ),
		'all_items'                => __( 'Synced Patterns', 'altis' ),
		'search_items'             => __( 'Search Synced Patterns', 'altis' ),
		'not_found'                => __( 'No Synced Patterns found.', 'altis' ),
		'not_found_in_trash'       => __( 'No Synced Patterns found in Trash.', 'altis' ),
		'filter_items_list'        => __( 'Filter Synced Patterns list', 'altis' ),
		'items_list_navigation'    => __( 'Synced Patterns list navigation', 'altis' ),
		'items_list'               => __( 'Synced Patterns list', 'altis' ),
		'item_published'           => __( 'Synced Pattern published.', 'altis' ),
		'item_published_privately' => __( 'Synced Pattern published privately.', 'altis' ),
		'item_reverted_to_draft'   => __( 'Synced Pattern reverted to draft.', 'altis' ),
		'item_scheduled'           => __( 'Synced Pattern scheduled.', 'altis' ),
		'item_updated'             => __( 'Synced Pattern updated.', 'altis' ),
		'menu_name'                => __( 'Synced Patterns', 'altis' ),
		'name_admin_bar'           => __( 'Synced Pattern', 'altis' ),
	] );

	// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
	$wp_post_types[ $post_type ] = $post_type_object;
}

/**
 * Rename reusable block name in block metadata.
 *
 * @param array $metadata
 *
 * @return array
 */
function override_block_type_metadata( array $metadata ) : array {
	if ( $metadata['name'] !== 'core/block' ) {
		return $metadata;
	}

	$metadata['vary_on'] = 'test_variant_id';

	// Block support.
	$metadata['supports'] = $metadata['supports'] ?? [];
	$metadata['supports'] = [
		'align' => true,
	];

	// Add custom attributes.
	$metadata['attributes']['goal'] = [
		'type' => 'string',
		'default' => 'engagement',
	];
	$metadata['attributes']['blockType'] = [
		'type' => 'string',
		'default' => 'standard',
	];

	// Block CSS for FSE.
	$metadata['editorStyle'] = 'altis-accelerate-global-blocks';

	return $metadata;
}


/**
 * Adds the block type column to the `wp_block` post list table.
 *
 * @param array $columns Columns to be filtered.
 *
 * @return array Filtered columns.
 */
function manage_wp_block_posts_columns( array $columns ) : array {
	return array_slice( $columns, 0, 2, true ) +
		[ 'block-type' => __( 'Type', 'altis' ) ] +
		array_slice( $columns, 2, null, true );
}

/**
 * Renders the type for the post list table custom column.
 *
 * @param string $column Custom column slug name.
 * @param int $post_id Post to display data for.
 */
function type_column_output( $column, $post_id ) {
	if ( $column !== 'block-type' ) {
		return;
	}

	$block_type = get_post_meta( $post_id, '_xb_type', true ) ?: 'standard';

	if ( $block_type !== 'standard' ) {
		echo Blocks\get_block_type_label( $block_type );
	}
}


/**
 * Track reusable block views.
 *
 * @param string $block_content The rendered block content.
 * @param array $parsed_block The parsed block data.
 * @param WP_Block $block The block object.
 * @return string
 */
function render_block( $block_content, $parsed_block, WP_Block $block ) : string {
	global $altis_block_preview, $altis_block_preview_variant;

	if ( ! is_string( $block_content ) ) {
		return $block_content;
	}

	$block_post = get_post( $block->attributes['ref'] );
	if ( empty( $block_post ) || $block_post->post_type !== 'wp_block' ) {
		return $block_content;
	}

	// Get block type.
	$block_type = get_post_meta( $block_post->ID, '_xb_type', true ) ?: 'standard';
	$block_tags = [
		'abtest' => 'ab-test-block',
		'personalization' => 'personalization-block',
		'standard' => 'global-block',
	];
	$block_tag = $block_tags[ $block_type ];

	// Handle block previews.
	if ( (int) $altis_block_preview === (int) $block_post->ID ) {
		if ( $block_type === 'standard' ) {
			return $block_content;
		}
		if ( ! is_null( $altis_block_preview_variant ) ) {
			$variants = parse_blocks( $block_post->post_content );
			$variants = array_filter( $variants, function ( $variant ) {
				return $variant['blockName'] === 'altis/variant';
			} );
			$variants = array_values( $variants );
			return implode(
				"\n",
				array_map( 'render_block', $variants[ $altis_block_preview_variant ]['innerBlocks'] ?? [] )
			);
		}
	}

	// Handle block types with variants.
	$variants = '';
	if ( $block_type !== 'standard' ) {
	 	$variants = str_replace( '__PARENT_BLOCK_ID__', $block_post->ID, $block_content );

		// Clear the block content.
		$block_content = '';
	} else {
		// Ensure no JS fallback content is shown.
		$variants = sprintf( '<noscript>%s</noscript>', $block_content );
	}

	// Add any extra attributes needed for the block.
	$extra_attributes = [
		'class' => 'wp-core-block altis-global-block',
	];

	// A/B test block attributes.
	if ( $block_type === 'abtest' ) {
		if ( Experiments\is_ab_test_paused_for_post( 'block', $block_post->ID ) ) {
			$extra_attributes['paused'] = '';
		}
		$results = Experiments\get_ab_test_results_for_post( 'block', $block_post->ID );
		if ( $results['winner'] ?? false ) {
			$extra_attributes['winner'] = '';
		}
		$percentage = Experiments\get_ab_test_traffic_percentage_for_post( 'block', $block_post->ID );
		$extra_attributes['traffic-percentage'] = $percentage;
	}

	// Block alignment support.
	if ( isset( $block->attributes['align'] ) ) {
		$extra_attributes['class'] .= sprintf( ' align%s', $block->attributes['align'] );
	}

	/**
	 * Filter the attributes recorded when tracking a reusable block view.
	 *
	 * @param array $properties Key value pair attributes to record along with `block*` events.
	 * @param WP_Post $block_post The reusable block post object.
	 */
	$block_event_attributes = apply_filters( 'altis.analytics.block_event_attributes', [
		'blockAuthorID' => (string) $block_post->post_author,
		'blockAuthor' => get_user_by( 'id', $block_post->post_author )->user_nicename,
	], $block_post );

	/**
	 * Filter the metrics recorded when tracking a reusable block event.
	 *
	 * @param array $properties Key value pair attributes to record along with `block*` events.
	 * @param WP_Post $block_post The reusable block post object.
	 */
	$block_event_metrics = apply_filters( 'altis.analytics.block_event_metrics', [], $block_post );

	return sprintf(
		'%1$s<%2$s block-id="%3$d" goal="%4$s" attributes="%5$s" metrics="%6$s"%7$s>%8$s</%2$s>',
		$variants,
		$block_tag,
		absint( $block_post->ID ),
		esc_attr( $block->attributes['goal'] ?? 'engagement' ),
		esc_attr( wp_json_encode( (object) $block_event_attributes ) ),
		esc_attr( wp_json_encode( (object) $block_event_metrics ) ),
		array_reduce( array_keys( $extra_attributes ), function ( $carry, $attr ) use ( $extra_attributes ) {
			return $carry . sprintf(
				' %s%s',
				sanitize_key( $attr ),
				! empty( $extra_attributes[ $attr ] ) ? '="' . esc_attr( $extra_attributes[ $attr ] ) . '"' : ''
			);
		}, '' ),
		$block_content
	);
}

/**
 * Process the XB attrs further when the XB is created.
 *
 * @param integer $post_id ID of XB post that has just been updated or created.
 * @param WP_Post $xb The block data array.
 * @return void
 */
function save_variants( int $post_id, WP_Post $post ) {
	$variants = parse_blocks( $post->post_content );
	$variants = array_filter( $variants, function ( $variant ) {
		return $variant['blockName'] === 'altis/variant';
	} );
	$variants = array_values( $variants );

	// Set variants.
	$changed = Experiments\update_ab_test_variants_for_post( 'block', $post_id, $variants ) !== false;

	// Set start and end time (reset if variants have changed).
	if ( $changed ) {
		$start_time = Utils\milliseconds();
		$end_time = $start_time + ( 90 * DAY_IN_SECONDS * 1000 ); // 90 days in the future.
	} else {
		$start_time = Experiments\get_ab_test_start_time_for_post( 'block', $post_id );
		$end_time = Experiments\get_ab_test_end_time_for_post( 'block', $post_id );
	}
	Experiments\update_ab_test_start_time_for_post( 'block', $post_id, $start_time );
	Experiments\update_ab_test_end_time_for_post( 'block', $post_id, $end_time );

	// Set traffic percentage.
	Experiments\update_ab_test_traffic_percentage_for_post( 'block', $post_id, $xb['attrs']['percentage'] ?? 100 );

	// Set variant traffic percentages.
	$percents = array_map( function ( $variant ) use ( $variants ) {
		return $variant['attrs']['percentage'] ?? ( 100 / count( $variants ) );
	}, $variants );
	Experiments\update_ab_test_variant_traffic_percentage_for_post( 'block', $post_id, $percents );

	// Start the test!
	Experiments\update_is_ab_test_paused_for_post( 'block', $post_id, false );
	Experiments\update_is_ab_test_started_for_post( 'block', $post_id, true );
}

/**
 * Register experiment for AB test blocks.
 *
 * @return void
 */
function register_test() {
	Experiments\register_post_ab_test( 'block', [
		'label' => __( 'A/B Test Block', 'altis-analytics' ),
		'goal' => 'conversion',
		'view' => 'blockView',
		'query_filter' => "block_id = {block_id:String}",
		'query_filter_params' => function ( $post_id ) : array {
			return [
				'block_id' => $post_id,
			];
		},
		'post_types' => [ 'wp_block' ],
	] );
}

/**
 * Register the static core block. The Static Core Block is used as a Global
 * Block is not available. For example, as of WP 6.3 Global Blocks / Reusable Blocks
 * are not supported in the Widgets editor. In those cases we insert a "static placeholder"
 * block and proxy the render on the front-end to render_block_core_block().
 *
 * @return void
 */
function register_static_global_block() {
	register_block_type(
		'altis/static-global',
		[
			'render_callback' => 'render_block_core_block',
		]
	);
}
