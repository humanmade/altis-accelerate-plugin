<?php
/**
 * Altis Accelerate Admin UI.
 */

namespace Altis\Accelerate\Admin;

use Altis\Accelerate;
use Altis\Accelerate\Utils;

const MENU_SLUG = 'altis-accelerate-settings';
const FEEDBACK_FORM_URL = 'https://altis-accelerate.canny.io/';
const UNLINK_ALTIS_DASHBOARD_ACTION = 'unlink-altis-dashboard-oauth';
const CREATE_SITE_POLLING_INTERVAL = 3;

/**
 * Setup admin hooks.
 *
 * @return void
 */
function bootstrap() : void {
	add_filter( 'plugin_action_links_' . plugin_basename( Accelerate\PLUGIN_FILE ), __NAMESPACE__ . '\\add_plugin_row_links' );

	add_action( 'admin_menu', __NAMESPACE__ . '\\register_admin_menu' );
	add_action( 'admin_menu', __NAMESPACE__ . '\\register_settings_admin_page', 11 );

	register_setting( 'altis-accelerate', 'altis_config', [
		'type' => 'string',
		'show_in_rest' => false,
		'sanitize_callback' => __NAMESPACE__ . '\\sanitize_config_setting',
	] );

	add_filter( 'plugin_row_meta', __NAMESPACE__ . '\\plugin_row_meta', 10, 3 );
	add_filter( 'admin_footer_text', __NAMESPACE__ . '\\render_feedback_link' );

	add_action( 'admin_head', __NAMESPACE__ . '\\action_admin_head' );
	add_action( 'all_admin_notices', __NAMESPACE__ . '\\add_plugin_header', 0 );
	add_action( 'admin_footer', __NAMESPACE__ . '\\add_plugin_footer', 0 );
	add_action( 'admin_enqueue_scripts', __NAMESPACE__ . '\\action_admin_enqueue_scripts' );

	add_action( 'load-accelerate_page_altis-accelerate-settings', __NAMESPACE__ . '\\handle_authorize_callback' );
	add_action( 'load-accelerate_page_altis-accelerate-settings', __NAMESPACE__ . '\\unlink_altis_dashboard_action' );

	Notices\setup();

	$config = Accelerate\get_config();
	if ( ! $config ) {
		add_action( 'admin_footer', __NAMESPACE__ . '\\render_config_warning' );
	}
}

/**
 * Register scripts for all admin pages.
 */
function action_admin_enqueue_scripts() : void {
	if ( ! is_altis_screen() ) {
		return;
	}

	Utils\register_assets( 'accelerate-admin', [
		'dependencies' => [
			'wp-api-fetch',
			'wp-components',
			'wp-data',
			'wp-element',
			'wp-i18n',
			'wp-url',
			'wp-html-entities',
		]
	], true );
}

/**
 * Check if current admin screen is an Altis screen.
 *
 * @return boolean
 */
function is_altis_screen() : bool {
	$screen = get_current_screen();

	$altis_screens = [
		'toplevel_page_accelerate',
		'edit-xb',
		'edit-wp_block',
		'edit-broadcast',
		'broadcast',
		'accelerate_page_altis-analytics',
		'accelerate_page_audience',
		'accelerate_page_altis-accelerate-settings',
	];

	if ( Accelerate\get_config() ) {
		$altis_screens[] = 'dashboard';
	}

	return in_array( $screen->id, $altis_screens, true );
}

/**
 * Prints the Altis plugin page header.
 */
function add_plugin_header() : void {
	global $title;

	if ( ! is_altis_screen() ) {
		return;
	}

	printf( '
		<div class="altis-ui">
			<div class="Header">
				<h1 class="Logo">
					<img alt="Altis Accelerate" height="26" src="%s" width="64" />
					<span class="Beta">
						%s
					</span>
					<span class="Title">%s</span>
				</h1>
				<div class="CannyWrap">
					<div class="Canny">
						<img src="%s" height="50" width="50" />
						<strong>We are in beta.</strong> Vote on upcoming features or report bugs. <a href="https://altis-accelerate.canny.io/" target="_blank">Talk to us here</a>
					</div>
				</div>
			</div>',
		plugins_url( 'assets/altis-logo.svg', Accelerate\PLUGIN_FILE ),
		__( 'BETA', 'altis' ),
		$title,
		plugins_url( 'assets/canny.png', Accelerate\PLUGIN_FILE ),
		__( 'BETA', 'altis' ),
		$title
	);

	Notices\get_page_notice();
}

/**
 * Closes off the Altis UI div.
 *
 * @param string $data The data to print.
 */
function add_plugin_footer() : void {
	if ( ! is_altis_screen() ) {
		return;
	}

	echo '</div>';
}

/**
 * Fires as an admin screen or script is being initialized.
 */
function action_admin_head() : void {
	if ( ! is_altis_screen() ) {
		return;
	}

	add_notices_wrapper();
}

/**
 * Render the config warning if not configured.
 *
 * @return void
 */
function render_config_warning() : void {
	if ( is_altis_screen() ) {
		return;
	}

	get_activation_message();
}

/**
 * Output the activation message.
 *
 * @return void
 */
function get_activation_message() : void {
	$message = sprintf(
		__( '<strong>Altis Accelerate is not active.</strong> <a href="%s">Add your API key</a> to get started.', 'altis' ),
		admin_url( 'admin.php?page=' . MENU_SLUG )
	);
	printf(
		'<div id="message" class="error"><p>%s</p></div>',
		wp_kses_post( $message )
	);
}

/**
 * Filters the list of action links displayed for a specific plugin in the Plugins list table.
 *
 * @param string[] $links List of plugin action links.
 * @return string[]
 */
function add_plugin_row_links( array $links ) : array {
	$links['settings'] = sprintf(
		'<a href="%s">%s</a>',
		admin_url( 'admin.php?page=' . MENU_SLUG ),
		__( 'Settings', 'altis' )
	);
	return $links;
}

/**
 * Add Accelerate config page.
 *
 * @return void
 */
function register_settings_admin_page() : void {
	add_submenu_page(
		'accelerate',
		_x( 'Settings', 'settings page title', 'altis' ),
		_x( 'Settings', 'settings menu title', 'altis' ),
		'manage_options',
		MENU_SLUG,
		__NAMESPACE__ . '\\render_settings_page',
		1000
	);

	// Register a new section in the "wporg" page.
	add_settings_section(
		'altis-accelerate-setup',
		'',
		__NAMESPACE__ . '\\render_settings_section',
		'altis-accelerate'
	);
}

/**
 * Accelerate settings section description placeholder.
 *
 * @return void
 */
function render_settings_section() : void {
	$connected = Accelerate\get_altis_dashboard_access_token();

	if ( ! $connected ) {
		return;
	}

	$user = Accelerate\altis_dashboard_remote_request( '/wp/v2/users/me' );
	?>
	<?php if ( is_wp_error( $user ) ) : ?>
		<p>Your connection to Altis Accelerate failed with <code><?php echo esc_html( $user->get_error_message() ) ?></code>. <a href="<?php echo esc_url( Accelerate\get_altis_dashboard_authorize_url() ) ?>">Relink your account.</a></p>
	<?php else : ?>
		<p>Your site is connected to Altis Accelerate for the user <code><?php echo esc_html( $user->name ) ?></code>. <a href="<?php echo esc_url( Accelerate\get_altis_dashboard_url() . '/accelerate/' ) ?>">Manage your Altis Accelerate account.</a> If you want to change the linked account, <a href="<?php echo esc_url( wp_nonce_url( add_query_arg( 'action', 'unlink-altis-dashboard-oauth' ), 'unlink-altis-dashboard-oauth' ) ) ?>">unlink here</a>.</p>
	<?php endif; ?>
	<?php
}

/**
 * Config settings field callback.
 *
 * @param array $args Field settings data.
 * @return void
 */
function render_config_settings_field( array $args ) : void {
	?>
	<input name="altis_config" class="widefat code" readonly value="<?php echo esc_attr( get_option( 'altis_config' ) ) ?>" />
	<p class="description">
		<?php esc_html_e( 'Connect your Altis Accelerate account to update.', 'altis' ); ?>
	</p>
	<?php
}

/**
 * Settings page UI.
 *
 * @return void
 */
function render_settings_page() : void {
	settings_errors( 'altis-accelerate' );
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'altis-accelerate' );
			do_settings_sections( 'altis-accelerate' );
			// Output save settings button.
			// submit_button( __( 'Save Changes', 'altis' ) );
			?>
		</form>
	</div>
	<?php
}

/**
 * Settings page validation callback.
 *
 * @param string $config The Altis Accelerate config.
 * @return string
 */
function sanitize_config_setting( string $config ) : string {
	if ( strpos( $config, '{' ) === 0 ) {
		$config = json_decode( $config, ARRAY_A );
		$config = implode( ':', [
			$config['pinpoint']['region'],
			$config['pinpoint']['app_id'],
			hash( 'sha256',
				$config['elasticsearch']['access_key'] .
				$config['elasticsearch']['access_secret'] .
				$config['elasticsearch']['index_path']
			),
		] );
	}
	$parsed_config = explode( ':', $config, 3 );
	if ( count( $parsed_config ) !== 3 ) {
		// phpcs:ignore
		add_settings_error( 'altis_config', 'invalid-api-key', __( 'Unable parse API key. Ensure you copied it correctly from the Accelerate Dashboard.', 'altis' ) );
		return '';
	}

	return $config;
}

/**
 * Filters the array of row meta for each plugin in the Plugins list table.
 *
 * @param string[] $plugin_meta An array of the plugin's metadata, including the version, author, author URI, and plugin URI.
 * @param string $plugin_file Path to the plugin file relative to the plugins directory.
 * @param array $plugin_data An array of plugin data.
 * @return string[] An array of the plugin's metadata, including the version, author, author URI, and plugin URI.
 */
function plugin_row_meta( array $plugin_meta, string $plugin_file, array $plugin_data ) : array {
	if ( $plugin_data['UpdateURI'] !== 'https://wordpress.org/plugins/altis-accelerate/' ) {
		return $plugin_meta;
	}

	$plugin_meta[] = sprintf(
		'<a href="%s">%s</a>',
		FEEDBACK_FORM_URL,
		__( 'Send Feedback', 'altis' )
	);

	return $plugin_meta;
}

/**
 * Show feedback form URL in footer.
 *
 * @param string $text The admin footer text to display.
 * @return string
 */
function render_feedback_link( string $text ) : string {
	if ( ! is_altis_screen() ) {
		return $text;
	}

	$message = __( 'Altis Accelerate Feature Requests & Bugs', 'altis' );
	$message = sprintf(
		'<a href="%s" target="altis-accelerate-feedback">%s<span style="font-size:inherit;text-decoration:none;" class="dashicons dashicons-external"></span></a>',
		esc_url( FEEDBACK_FORM_URL ),
		wp_kses_post( $message )
	);

	if ( ! empty ( $text ) ) {
		$message = ' | ' . $message;
	}

	return $text . $message;
}


/**
 * Add a wrapper for admin notices on custom admin pages.
 *
 * @return void
 */
function add_notices_wrapper() : void {
	// High priority so the opening div is before any notices.
	add_action( 'admin_notices', __NAMESPACE__ . '\\add_notices_wrapper_open', 0 );
	add_action( 'all_admin_notices', __NAMESPACE__ . '\\add_all_notices_wrapper_open', 1 );
	// Low priority so the closing div is after any notices.
	add_action( 'admin_notices', __NAMESPACE__ . '\\add_notices_wrapper_close', 999999 );
	add_action( 'all_admin_notices', __NAMESPACE__ . '\\add_notices_wrapper_close', 999999 );
}

/**
 * Adds an opening div to wrap around notices in the Accelerate Dashboard.
 *
 * @return void
 */
function add_notices_wrapper_open() : void {
	echo '<div id="Altis_Dashboard__notices">';

	$screen = get_current_screen();
	if ( ! Accelerate\get_config() && ! $screen->id === 'accelerate_page_altis-accelerate-settings' ) {
		get_activation_message();
	}
}

/**
 * Adds an opening div to wrap around notices in the Accelerate Dashboard.
 *
 * @return void
 */
function add_all_notices_wrapper_open() : void {
	echo '<div id="Altis_Dashboard__all_notices">';
}

/**
 * Adds a closing div to wrap around notices in the Accelerate Dashboard.
 *
 * @return void
 */
function add_notices_wrapper_close() {
	echo '</div>';
}

/**
 * Display Accelerate React apps.
 *
 * @return void
 */
function render_page() : void {
	require_once ABSPATH . 'wp-admin/admin-header.php';

	echo '<div id="altis-analytics-root">';

	if ( wp_get_environment_type() === 'local' ) {
		echo "<p>Ensure you're running the Webpack server. You may also need to open the script URL directly to accept the SSL certificate.</p>";
	}

	echo '</div>';
	require_once ABSPATH . 'wp-admin/admin-footer.php';
}

/**
 * Register Accelerate menu pages.
 *
 * @return void
 */
function register_admin_menu() : void {
	// Get icon.
	$icon = '<svg viewBox="0 0 310 289" fill="none" xmlns="http://www.w3.org/2000/svg">' .
		'<path d="M90.566 121.617C68.4471 119.413 30.7493 115.15 19.2857 108.022C8.26297 101.188 0.694027 87.8141 0.914482 75.6156C1.13494 63.3437 10.7615 52.9823 22.0782 52.9823C23.8418 52.9823 25.6789 53.2762 27.4425 53.7906C33.9092 55.6278 39.641 60.3308 44.7114 64.4459C51.0311 69.6634 56.322 74.5868 60.9516 79.5103C67.4917 86.5649 73.591 94.4278 79.6167 103.466C83.3645 109.125 87.1122 115.224 90.6395 121.617" fill="#9FA1A6"/>' .
		'<path d="M232.024 209.285C231.583 210.387 231.216 211.563 230.775 212.665C229.746 215.384 228.717 218.177 227.762 220.822L227.542 221.483V221.704C223.5 232.359 219.458 243.382 215.49 254.258C209.685 270.204 200.793 288.502 183.451 288.502C182.349 288.502 181.173 288.428 180.07 288.281H179.923H179.777H179.483C178.013 288.208 165.08 287.032 157.364 274.833C155.306 271.6 153.91 267.852 153.175 263.664C150.309 247.424 139.139 191.281 114.816 138.225C116.653 138.372 118.417 138.519 120.254 138.739L121.577 138.886C142.446 140.871 164.051 142.855 184.186 145.427C185.067 149.101 185.949 152.702 186.684 155.788C190.138 170.264 192.783 181.655 196.531 189.371C205.276 207.301 218.43 209.946 225.484 209.946H226.072C228.056 209.946 230.04 209.652 231.951 209.211" fill="#9FA1A6"/>' .
		'<path d="M241.43 183.785L241.21 184.3C239.005 190.325 233.935 194.661 227.983 195.616C227.248 195.763 226.513 195.837 225.852 195.837C225.705 195.837 225.631 195.837 225.484 195.837H225.337C218.871 195.837 213.359 191.501 209.318 183.197C206.231 176.951 203.586 165.635 200.499 152.628C200.132 151.011 199.765 149.394 199.397 147.778C222.545 152.407 233.347 160.27 238.418 166.222C242.459 170.999 243.635 177.76 241.43 183.712" fill="#9FA1A6"/>' .
		'<path d="M180.364 130.583C161.92 128.378 142.446 126.541 123.561 124.778H122.899C117.755 124.263 112.611 123.749 107.541 123.308C93.138 95.4573 76.8978 73.4853 59.041 57.98C58.9675 57.98 52.5743 52.3216 44.197 46.7368L119.299 33.5095C155.38 56.1429 170.958 96.7065 180.291 130.73" fill="#9FA1A6"/>' .
		'<path d="M309.11 0L250.689 158.58C240.769 145.573 222.251 136.902 195.649 132.64C186.757 98.5432 172.281 57.0977 138.992 29.9818L309.11 0Z" fill="#9FA1A6"/>' .
		'</svg>';

	add_menu_page(
		__( 'Altis Accelerate', 'altis' ),
		__( 'Accelerate', 'altis' ),
		'edit_posts',
		'accelerate',
		Accelerate\get_config()
			? 'Altis\\Accelerate\\Dashboard\\load_dashboard'
			: __NAMESPACE__ . '\\render_settings_page',
		'data:image/svg+xml;base64,' . base64_encode( $icon ),
		3
	);

	if ( ! Accelerate\get_config() ) {
		return;
	}

	add_submenu_page(
		'accelerate',
		__( 'Content Explorer', 'altis' ),
		__( 'Content Explorer', 'altis' ),
		'edit_posts',
		'accelerate',
		'Altis\\Accelerate\\Dashboard\\load_dashboard',
		0
	);
}

/**
 * Handle the Oauth callback
 */
function handle_authorize_callback() : void {
	if ( empty( $_GET['code'] ) ) {
		return;
	}

	$code = sanitize_text_field( wp_unslash( $_GET['code'] ) );

	// Exchange the code for an access token.
	$request = wp_remote_post( Accelerate\get_altis_dashboard_url() . '/api/oauth2/access_token', [
		'headers' => [
			'Content-Type' => 'application/json',
		],
		'body' => wp_json_encode( [
			'client_id' => Accelerate\get_altis_dashboard_oauth2_client_id(),
			'code' => $code,
			'grant_type' => 'authorization_code',
		] ),
		'sslverify' => false,
	] );

	if ( is_wp_error( $request ) ) {
		wp_die( esc_html( $request->get_error_message() ) );
	}

	$body = json_decode( wp_remote_retrieve_body( $request ) );
	if ( wp_remote_retrieve_response_code( $request ) > 299 ) {
		if ( json_last_error() ) {
			wp_die( esc_html( wp_remote_retrieve_body( $request ) ) );
		} else {
			wp_die( esc_html( $body->message ) );
		}
	}

	// Save the access token.
	Accelerate\set_altis_dashboard_access_token( $body->access_token );

	$sites = Accelerate\altis_dashboard_remote_request( '/stack/accelerate/sites', 'GET' );
	if ( is_wp_error( $sites ) ) {
		wp_die( esc_html( $sites->get_error_message() ) );
	}

	// Try to find a site that matching the current site's url.
	$site = array_values( array_filter( $sites, function ( $site ) : bool {
		return $site->url === home_url() && $site->status !== 'failed';
	} ) );

	if ( empty( $site ) ) {
		// Create a site for the current site's URL.
		$site = Accelerate\altis_dashboard_remote_request( '/stack/accelerate/sites', 'POST', [
			'url' => home_url(),
		] );
	} else {
		$site = $site[0];
	}

	if ( is_wp_error( $site ) ) {
		wp_die( esc_html( $site->get_error_message() ) );
	}

	while ( $site->status === 'creating' ) {
		sleep( CREATE_SITE_POLLING_INTERVAL );
		$sites = Accelerate\altis_dashboard_remote_request( '/stack/accelerate/sites', 'GET' );
		if ( is_wp_error( $sites ) ) {
			wp_die( esc_html( $sites->get_error_message() ) );
		}
		$site = array_filter( $sites, function ( $a ) use ( $site ) : bool {
			return $a->id === $site->id;
		} )[0];
	}

	update_option( 'altis_config', $site->plugin_config );
	wp_safe_redirect( remove_query_arg( 'code' ) );
	exit;
}

/**
 * Unlink the connected Altis Dashboard account action handler.
 *
 * @return void
 */
function unlink_altis_dashboard_action() : void {
	if ( empty( $_GET['action'] ) || $_GET['action'] !== UNLINK_ALTIS_DASHBOARD_ACTION || ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( $_GET['_wpnonce'] ), UNLINK_ALTIS_DASHBOARD_ACTION ) ) {
		return;
	}

	Accelerate\delete_altis_dashboard_access_token();
	delete_option( 'altis_config');

	wp_safe_redirect( remove_query_arg( 'action' ) );
	exit;
}
