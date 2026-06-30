<?php
/**
 * Dashboard Analytics / Content Explorer.
 *
 * @package aws-analytics
 */

namespace Altis\Accelerate\Dashboard;

use Altis\Accelerate;
use Altis\Accelerate\Admin;
use Altis\Accelerate\API;
use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\Utils;
use WP_Post_Type;

const SCRIPT_ID = 'altis-analytics-ui';
const STYLE_ID = 'altis-analytics-ui';

/**
 * Set up the Dashboard Analytics page.
 */
function setup() {
	add_action( 'admin_menu', __NAMESPACE__ . '\\add_widgets_submenu' );
	add_action( 'pre_get_posts', __NAMESPACE__ . '\\block_preview_check' );

	// Queue up Altis Accelerate Dashboard replacement for standard dashboard.
	if ( is_dashboard_takeover_enabled() ) {
		add_action( 'load-index.php', __NAMESPACE__ . '\\load_dashboard' );
	}
}

/**
 * Whether the Accelerate dashboard replaces the standard WP dashboard.
 *
 * Gates only the takeover itself (the load-index.php replacement and its
 * Widgets escape hatch) — the Analytics submenu and block previews are
 * always available.
 *
 * @return bool
 */
function is_dashboard_takeover_enabled() : bool {
	if ( defined( 'ALTIS_ACCELERATE_DASHBOARD' ) && ! ALTIS_ACCELERATE_DASHBOARD ) {
		return false;
	}

	return (bool) get_option( 'accelerate_dashboard_takeover_enabled', 1 );
}

/**
 * Adds the regular Dashboard Widgets view as a subpage of the Dashboard menu.
 *
 * @return void
 */
function add_widgets_submenu() : void {
	// The Widgets escape hatch only makes sense while the takeover is
	// hiding the standard dashboard.
	if ( is_dashboard_takeover_enabled() ) {
		add_submenu_page(
			'index.php',
			__( 'Dashboard Widgets' ),
			__( 'Widgets' ),
			'read',
			'index.php?widgets=1',
			'',
			1
		);
	}

	$hook = add_submenu_page(
		'accelerate',
		_x( 'Analytics', 'page title', 'altis' ),
		_x( 'Analytics', 'menu title', 'altis' ),
		'read',
		'altis-analytics',
		__NAMESPACE__ . '\\render_analytics_page',
		1000
	);

	add_action( 'load-' . $hook, function () {
		wp_enqueue_style(
			'altis-accelerate-tailwind',
			plugins_url( 'build/tailwind.css', Accelerate\PLUGIN_FILE ),
			[],
			filemtime( dirname( Accelerate\PLUGIN_FILE ) . '/build/tailwind.css' )
		);
		Utils\register_assets( 'dashboard', [
			'dependencies' => [
				'lodash',
				'altis-accelerate-accelerate-admin',
				'altis-accelerate-audiences/data',
				'wp-api-fetch',
				'wp-components',
				'wp-core-data',
				'wp-data',
				'wp-element',
				'wp-i18n',
				'wp-url',
				'wp-html-entities',
			],
		], true );
	} );

	// Internal styleguide page — design reference for primitives in
	// `src/components/ui/` and compounds in `src/components/`. Hidden
	// from the menu (removed via remove_submenu_page below) but
	// routable via direct URL:
	// /wp-admin/admin.php?page=accelerate-styleguide.
	// Registered under `accelerate` so the parent menu stays
	// highlighted/expanded — null-parent would collapse the sidebar.
	// manage_options is intentional — nothing here is data-bearing.
	$styleguide_hook = add_submenu_page(
		'accelerate',
		_x( 'Accelerate Styleguide', 'page title', 'altis' ),
		_x( 'Styleguide', 'menu title', 'altis' ),
		'manage_options',
		'accelerate-styleguide',
		__NAMESPACE__ . '\\render_styleguide_page'
	);

	// Hide the styleguide menu item from the rendered sidebar without
	// unregistering it. remove_submenu_page() / unset() both break the
	// capability check WP runs against $submenu, blocking direct-URL
	// access. CSS-only hiding keeps the page routable + keeps the
	// Accelerate parent menu expanded when on it.
	add_action( 'admin_head', function () {
		echo '<style>#adminmenu a[href$="page=accelerate-styleguide"]{display:none!important;}</style>';
	} );

	add_action( 'load-' . $styleguide_hook, function () {
		wp_enqueue_style(
			'altis-accelerate-tailwind',
			plugins_url( 'build/tailwind.css', Accelerate\PLUGIN_FILE ),
			[],
			filemtime( dirname( Accelerate\PLUGIN_FILE ) . '/build/tailwind.css' )
		);
		Utils\register_assets( 'styleguide', [
			'dependencies' => [
				'wp-element',
				'wp-i18n',
			],
		], true );
	} );

}

/**
 * Replace the site dashboard with the Accelerate dashboard.
 *
 * @return void
 */
function load_dashboard() {
	// Don't replace network admin.
	if ( is_network_admin() ) {
		return;
	}

	// Support default dashboard on subpage of dashboard menu.
	if ( isset( $_GET['widgets'] ) ) {
		return;
	}

	if ( ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	render_accelerate_app( 'accelerate', __( 'Dashboard', 'altis' ) );
}

/**
 * Render the dedicated Content Explorer page (the content data table).
 *
 * @return void
 */
function load_content_explorer() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	render_accelerate_app( 'content-explorer', __( 'Content Explorer', 'altis' ) );
}

/**
 * Enqueue assets, localize config and render the Accelerate admin React app.
 *
 * Shared by the Dashboard (including the index.php takeover) and the dedicated
 * Content Explorer page so both surfaces load identical assets and state — the
 * `$screen` value selects which surface the React app renders.
 *
 * @param string $screen     React screen id ('accelerate' | 'content-explorer').
 * @param string $page_title Admin page title shown in the Accelerate header.
 * @return void
 */
function render_accelerate_app( string $screen, string $page_title ) {
	global $title;

	// Enqueue block editor dependencies for BlockPreview thumbnails.
	wp_enqueue_script( 'wp-block-editor' );
	wp_enqueue_script( 'wp-block-library' );
	wp_enqueue_style( 'wp-block-editor' );
	wp_enqueue_style( 'wp-block-library' );

	Utils\register_assets( 'accelerate-admin', [
		'dependencies' => [
			'wp-api-fetch',
			'wp-blocks',
			'wp-block-editor',
			'wp-block-library',
			'wp-components',
			'wp-data',
			'wp-element',
			'wp-i18n',
			'wp-url',
			'wp-html-entities',
		],
	], true );

	add_filter( 'screen_options_show_screen', '__return_false' );

	// Set admin page title.
	$title = $page_title;
	$user = wp_get_current_user();

	$post_types = get_post_types( [
		'show_in_menu' => true,
		'public' => true,
	], 'objects' );

	// Trackable post types that do not have their own front end URL.
	if ( post_type_exists( 'wp_block' ) ) {
		$post_types = array_merge( [ get_post_type_object( 'wp_block' ) ], $post_types );
	}

	$post_types = array_map( function ( WP_Post_Type $post_type ) {
		return [
			'name' => $post_type->name,
			'label' => $post_type->labels->name,
			'singular_label' => $post_type->labels->singular_name,
		];
	}, $post_types );

	// Don't show links if feature unavailable.
	$insights_enabled = Utils\is_feature_enabled( 'insights' );

	// Backfill onboarding timestamps for sites that pre-date the checklist.
	$connected_at = get_option( 'accelerate_site_connected_at', false );
	if ( ! $connected_at && ! empty( Accelerate\get_accelerate_dashboard_access_token() ) ) {
		$connected_at = time();
		update_option( 'accelerate_site_connected_at', $connected_at );
	}

	$first_test = get_option( 'accelerate_first_abtest_created', false );
	if ( ! $first_test ) {
		$query = Experiment::query( [], [ 'per_page' => 1 ] );
		$results = $query->get_results();
		if ( ! is_wp_error( $results ) && $results->get_total_available() > 0 ) {
			$first_test = time();
			update_option( 'accelerate_first_abtest_created', $first_test );
		}
	}

	wp_localize_script( 'altis-accelerate-accelerate-admin', 'AltisAccelerateDashboardData', [
		'api_namespace' => API\API_NAMESPACE,
		'version' => Utils\get_plugin_version(),
		'home_url' => home_url(),
		'user' => [
			'id' => get_current_user_id(),
			'name' => $user->get( 'display_name' ),
			'canViewAnalytics' => $insights_enabled && current_user_can( 'manage_options' ),
			'canViewInsights' => $insights_enabled && current_user_can( 'edit_audiences' ),
		],
		'post_types' => array_values( $post_types ),
		'screen' => $screen,
		'title' => $page_title,
		'location' => isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : 'dashboard',
		'onboarding' => [
			'connected_at' => $connected_at,
			'first_test_created' => $first_test,
			'authorize_url' => Accelerate\get_accelerate_dashboard_authorize_url(),
		],
		'outbound_tracking_enabled' => Utils\is_feature_enabled( 'outbound_tracking' ),
		// Site timezone for rendering analytics in site-local time (not the
		// viewer's browser tz). `string` is the IANA name when set; otherwise
		// empty and `offset` (hours) carries a manual UTC offset. See #681.
		'timezone' => [
			'string' => get_option( 'timezone_string' ),
			'offset' => (float) get_option( 'gmt_offset' ),
		],
	] );

	Admin\render_page();
	exit;
}

/**
 * Intercept block preview requests for block thumbnail service requests.
 *
 * @param \WP_Query $query WP Query object.
 *
 * @return void
 */
function block_preview_check( \WP_Query $query ) : void {
	global $altis_block_preview, $altis_block_preview_variant;

	$block_id = filter_input( INPUT_GET, 'preview-block-id', FILTER_SANITIZE_NUMBER_INT );
	$hmac = filter_input( INPUT_GET, 'key' );

	if (
		! $query->is_main_query()
		|| empty( $block_id )
		// || empty( $hmac )
		// || $hmac !== get_block_thumbnail_request_hmac( $block_id )
	) {
		return;
	}

	if ( ! is_block_thumbnail_allowed( $block_id ) ) {
		return;
	}

	$altis_block_preview = $block_id;
	$altis_block_preview_variant = (int) filter_input( INPUT_GET, 'variant-id', FILTER_SANITIZE_NUMBER_INT );

	// Reset any existing query vars so it doesn't conflict with our query.
	$query->query = [];
	$query->query_vars = [];

	$query->set( 'p', $block_id );
	$query->set( 'post_type', 'wp_block' );
	$query->set( 'post_status', [ 'publish', 'inherit' ] );

	add_action( 'template_redirect', __NAMESPACE__ . '\\block_thumbnail_template_override' );
}

/**
 * Return whether block thumbnail functionality is allowed.
 *
 * @param int $block_id Block ID.
 *
 * @return boolean
 */
function is_block_thumbnail_allowed( int $block_id = null ) : bool {
	/**
	 * Filters the ability of using block thumbnail API / service.
	 *
	 * @param int $block_id Block ID to preview
	 */
	return (bool) apply_filters( 'altis.accelerate.allow_block_thumbnails', true, $block_id );
}

/**
 * Generated an HMAC for a block preview thumbnail request.
 *
 * @param integer $block_post_id Post ID of the block to preview.
 *
 * @return string
 */
function get_block_thumbnail_request_hmac( int $block_post_id ) : string {
	$auth_key = defined( 'AUTH_KEY' ) ? AUTH_KEY : get_site_option( 'auth_key', '' );
	if ( empty( $auth_key ) ) {
		$auth_key = wp_generate_password( 64, true, true );
		update_site_option( 'auth_key', $auth_key );
	}
	return hash_hmac( 'md5', $block_post_id, $auth_key );
}

/**
 * Override template to output a block preview markup.
 *
 * @return void
 */
function block_thumbnail_template_override() : void {
	global $content_width;

	// Set a reasonable default content width if not defined or available.
	if ( empty( $content_width ) ) {
		$content_width = 650;
	}

	$target_width = (int) filter_input( INPUT_GET, 'width', FILTER_SANITIZE_NUMBER_INT ) ?? 210;
	$target_height = (int) filter_input( INPUT_GET, 'height', FILTER_SANITIZE_NUMBER_INT ) ?? 94;

	// Calculate a min height for container to help handle narrow content.
	$min_height = $target_height;
	if ( $target_width && $target_height ) {
		$min_height = round( $content_width / ( $target_width / $target_height ) );
	}

	$classes = 'altis-block-preview';
	if ( wp_is_block_theme() ) {
		$classes .= ' has-global-padding is-layout-constrained';
	}

	// Allow filtering preview class name to help styling.
	$classes = (string) apply_filters( 'altis.accelerate.block-image.preview-class', $classes );

	// Don't record analytics data.
	add_filter( 'altis.analytics.noop', '__return_true', 1000 );

	get_header();
	printf( '<style>.altis-block-preview { margin: 0 auto; min-height: %dpx; }</style>', (int) $min_height );
	if ( ! wp_is_block_theme() ) {
		printf( '<style>.altis-block-preview { width: %dpx; }</style>', (int) $content_width );
	}
	echo '<div class="' . $classes . '">';

	echo do_blocks( sprintf( '<!-- wp:block {"ref":%d} -->', get_the_ID() ) );

	echo '</div>';
	get_footer();
	exit;
}

function render_analytics_page() {
	echo '<div id="accelerate-analytics-root">';
	if ( wp_get_environment_type() === 'local' ) {
		echo "<p>Ensure you're running the Webpack server. You may also need to open the script URL directly to accept the SSL certificate.</p>";
	}
	echo '</div>';
}

function render_styleguide_page() {
	echo '<div id="accelerate-styleguide-root"></div>';
}
