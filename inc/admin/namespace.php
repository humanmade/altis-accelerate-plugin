<?php
/**
 * Altis Accelerate Admin UI.
 */

namespace Altis\Accelerate\Admin;

use Altis\Accelerate;
use Altis\Accelerate\Telemetry;
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
	add_action( 'load-accelerate_page_altis-accelerate-settings', __NAMESPACE__ . '\\handle_telemetry_settings' );
	add_action( 'load-accelerate_page_altis-accelerate-settings', __NAMESPACE__ . '\\handle_abilities_api_settings' );

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
	wp_enqueue_style( 'altis-admin-ui', plugins_url( 'build/tailwind.css', Accelerate\PLUGIN_FILE ), [] );
	if ( ! is_altis_screen() ) {
		return;
	}

	// Enqueue block editor dependencies for BlockPreview in Content Explorer.
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

	// Accelerate wordmark SVG (logo + text + BETA badge).
	$wordmark = '<svg class="Logo__wordmark" height="32" viewBox="0 0 1705 312" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">' .
		'<path d="M235.34 242.5H29.1875L184.158 79.9502L235.34 242.5Z" stroke="#9332FF" stroke-width="25"/>' .
		'<path d="M311.8 241L373.24 70.6H406.12L467.56 241H439.96L424.36 196.6H354.76L339.4 241H311.8ZM362.92 173.08H416.44L389.56 95.32L362.92 173.08ZM531.141 243.88C518.981 243.88 508.341 241.16 499.221 235.72C490.101 230.28 483.061 222.52 478.101 212.44C473.141 202.36 470.661 190.6 470.661 177.16C470.661 163.72 473.141 152.04 478.101 142.12C483.061 132.04 490.101 124.28 499.221 118.84C508.341 113.24 518.981 110.44 531.141 110.44C541.541 110.44 550.741 112.28 558.741 115.96C566.901 119.48 573.461 124.68 578.421 131.56C583.541 138.44 586.821 146.84 588.261 156.76L561.621 158.2C560.341 149.88 556.981 143.56 551.541 139.24C546.101 134.76 539.301 132.52 531.141 132.52C520.421 132.52 512.021 136.52 505.941 144.52C500.021 152.36 497.061 163.24 497.061 177.16C497.061 191.08 500.021 202.04 505.941 210.04C512.021 217.88 520.421 221.8 531.141 221.8C539.301 221.8 546.101 219.56 551.541 215.08C556.981 210.44 560.341 203.48 561.621 194.2L588.261 195.64C586.821 205.4 583.541 213.88 578.421 221.08C573.461 228.28 566.901 233.88 558.741 237.88C550.741 241.88 541.541 243.88 531.141 243.88ZM656.832 243.88C644.672 243.88 634.032 241.16 624.912 235.72C615.792 230.28 608.752 222.52 603.792 212.44C598.832 202.36 596.352 190.6 596.352 177.16C596.352 163.72 598.832 152.04 603.792 142.12C608.752 132.04 615.792 124.28 624.912 118.84C634.032 113.24 644.672 110.44 656.832 110.44C667.232 110.44 676.432 112.28 684.432 115.96C692.592 119.48 699.152 124.68 704.112 131.56C709.232 138.44 712.512 146.84 713.952 156.76L687.312 158.2C686.032 149.88 682.672 143.56 677.232 139.24C671.792 134.76 664.992 132.52 656.832 132.52C646.112 132.52 637.712 136.52 631.632 144.52C625.712 152.36 622.752 163.24 622.752 177.16C622.752 191.08 625.712 202.04 631.632 210.04C637.712 217.88 646.112 221.8 656.832 221.8C664.992 221.8 671.792 219.56 677.232 215.08C682.672 210.44 686.032 203.48 687.312 194.2L713.952 195.64C712.512 205.4 709.232 213.88 704.112 221.08C699.152 228.28 692.592 233.88 684.432 237.88C676.432 241.88 667.232 243.88 656.832 243.88ZM782.522 243.88C770.042 243.88 759.242 241.16 750.122 235.72C741.162 230.28 734.202 222.52 729.242 212.44C724.442 202.36 722.042 190.6 722.042 177.16C722.042 163.72 724.442 152.04 729.242 142.12C734.202 132.04 741.162 124.28 750.122 118.84C759.082 113.24 769.642 110.44 781.802 110.44C793.322 110.44 803.482 113.16 812.282 118.6C821.082 123.88 827.882 131.56 832.682 141.64C837.643 151.72 840.123 163.88 840.123 178.12V184.6H748.442C749.082 197.08 752.362 206.44 758.282 212.68C764.362 218.92 772.522 222.04 782.762 222.04C790.282 222.04 796.522 220.28 801.483 216.76C806.442 213.24 809.882 208.52 811.802 202.6L838.202 204.28C834.842 216.12 828.202 225.72 818.282 233.08C808.523 240.28 796.602 243.88 782.522 243.88ZM748.442 165.4H813.242C812.442 154.04 809.162 145.64 803.402 140.2C797.802 134.76 790.602 132.04 781.802 132.04C772.682 132.04 765.162 134.92 759.242 140.68C753.482 146.28 749.882 154.52 748.442 165.4ZM887.712 241C879.392 241 872.672 238.84 867.552 234.52C862.432 230.2 859.872 223.32 859.872 213.88V70.6H885.312V211.48C885.312 214.36 886.032 216.52 887.472 217.96C889.072 219.4 891.312 220.12 894.192 220.12H904.272V241H887.712ZM971.326 243.88C958.846 243.88 948.046 241.16 938.926 235.72C929.966 230.28 923.006 222.52 918.046 212.44C913.246 202.36 910.846 190.6 910.846 177.16C910.846 163.72 913.246 152.04 918.046 142.12C923.006 132.04 929.966 124.28 938.926 118.84C947.886 113.24 958.446 110.44 970.606 110.44C982.126 110.44 992.286 113.16 1001.09 118.6C1009.89 123.88 1016.69 131.56 1021.49 141.64C1026.45 151.72 1028.93 163.88 1028.93 178.12V184.6H937.246C937.886 197.08 941.166 206.44 947.086 212.68C953.166 218.92 961.326 222.04 971.566 222.04C979.086 222.04 985.326 220.28 990.286 216.76C995.246 213.24 998.686 208.52 1000.61 202.6L1027.01 204.28C1023.65 216.12 1017.01 225.72 1007.09 233.08C997.326 240.28 985.406 243.88 971.326 243.88ZM937.246 165.4H1002.05C1001.25 154.04 997.966 145.64 992.206 140.2C986.606 134.76 979.406 132.04 970.606 132.04C961.486 132.04 953.966 134.92 948.046 140.68C942.286 146.28 938.686 154.52 937.246 165.4ZM1047.5 241V113.32H1070.78L1071.74 147.16L1069.58 146.44C1071.34 134.92 1074.86 126.52 1080.14 121.24C1085.58 115.96 1092.86 113.32 1101.98 113.32H1114.22V136.12H1101.98C1095.58 136.12 1090.22 137.16 1085.9 139.24C1081.58 141.32 1078.3 144.52 1076.06 148.84C1073.98 153.16 1072.94 158.76 1072.94 165.64V241H1047.5ZM1161.38 243.88C1148.1 243.88 1137.46 240.84 1129.46 234.76C1121.62 228.68 1117.7 220.12 1117.7 209.08C1117.7 198.04 1120.98 189.48 1127.54 183.4C1134.26 177.16 1144.58 172.68 1158.5 169.96L1202.42 161.56C1202.42 151.64 1200.1 144.28 1195.46 139.48C1190.82 134.52 1183.94 132.04 1174.82 132.04C1166.66 132.04 1160.26 133.88 1155.62 137.56C1150.98 141.08 1147.78 146.36 1146.02 153.4L1119.86 151.72C1122.26 138.92 1128.18 128.84 1137.62 121.48C1147.22 114.12 1159.62 110.44 1174.82 110.44C1192.1 110.44 1205.22 115.08 1214.18 124.36C1223.3 133.48 1227.86 146.36 1227.86 163V212.68C1227.86 215.72 1228.34 217.88 1229.3 219.16C1230.42 220.28 1232.18 220.84 1234.58 220.84H1239.14V241C1238.34 241.16 1237.06 241.32 1235.3 241.48C1233.54 241.64 1231.7 241.72 1229.78 241.72C1224.34 241.72 1219.62 240.84 1215.62 239.08C1211.78 237.32 1208.9 234.44 1206.98 230.44C1205.06 226.28 1204.1 220.76 1204.1 213.88L1206.74 215.08C1205.46 220.68 1202.66 225.64 1198.34 229.96C1194.18 234.28 1188.82 237.72 1182.26 240.28C1175.86 242.68 1168.9 243.88 1161.38 243.88ZM1165.46 223.72C1173.14 223.72 1179.7 222.28 1185.14 219.4C1190.58 216.36 1194.82 212.2 1197.86 206.92C1200.9 201.64 1202.42 195.64 1202.42 188.92V180.76L1164.98 187.96C1157.3 189.4 1151.86 191.72 1148.66 194.92C1145.62 197.96 1144.1 201.88 1144.1 206.68C1144.1 212.12 1145.94 216.36 1149.62 219.4C1153.46 222.28 1158.74 223.72 1165.46 223.72ZM1295.81 241C1283.65 241 1274.69 238.2 1268.93 232.6C1263.17 227 1260.29 218.28 1260.29 206.44V83.32H1285.73V204.52C1285.73 210.44 1287.01 214.52 1289.57 216.76C1292.13 219 1296.05 220.12 1301.33 220.12H1319.57V241H1295.81ZM1240.85 134.2V113.32H1319.57V134.2H1240.85ZM1387.14 243.88C1374.66 243.88 1363.86 241.16 1354.74 235.72C1345.78 230.28 1338.82 222.52 1333.86 212.44C1329.06 202.36 1326.66 190.6 1326.66 177.16C1326.66 163.72 1329.06 152.04 1333.86 142.12C1338.82 132.04 1345.78 124.28 1354.74 118.84C1363.7 113.24 1374.26 110.44 1386.42 110.44C1397.94 110.44 1408.1 113.16 1416.9 118.6C1425.7 123.88 1432.5 131.56 1437.3 141.64C1442.26 151.72 1444.74 163.88 1444.74 178.12V184.6H1353.06C1353.7 197.08 1356.98 206.44 1362.9 212.68C1368.98 218.92 1377.14 222.04 1387.38 222.04C1394.9 222.04 1401.14 220.28 1406.1 216.76C1411.06 213.24 1414.5 208.52 1416.42 202.6L1442.82 204.28C1439.46 216.12 1432.82 225.72 1422.9 233.08C1413.14 240.28 1401.22 243.88 1387.14 243.88ZM1353.06 165.4H1417.86C1417.06 154.04 1413.78 145.64 1408.02 140.2C1402.42 134.76 1395.22 132.04 1386.42 132.04C1377.3 132.04 1369.78 134.92 1363.86 140.68C1358.1 146.28 1354.5 154.52 1353.06 165.4Z" fill="#111111"/>' .
		'<rect x="1455" y="36" width="250" height="92" rx="30" fill="#111111"/>' .
		'<path d="M1506.96 103V58.98H1523.45C1528.83 58.98 1532.9 59.9307 1535.67 61.832C1538.48 63.7333 1539.88 66.7507 1539.88 70.884C1539.88 72.744 1539.49 74.3767 1538.7 75.782C1537.96 77.146 1536.84 78.2207 1535.36 79.006C1533.91 79.7913 1532.15 80.2253 1530.09 80.308L1530.02 80.184C1533.79 80.308 1536.68 81.3413 1538.7 83.284C1540.73 85.1853 1541.74 87.7273 1541.74 90.91C1541.74 94.9607 1540.34 97.9987 1537.53 100.024C1534.76 102.008 1530.81 103 1525.68 103H1506.96ZM1515.02 96.18H1525.31C1527.83 96.18 1529.82 95.6633 1531.26 94.63C1532.75 93.5967 1533.5 92.0673 1533.5 90.042C1533.5 88.0167 1532.77 86.4667 1531.33 85.392C1529.88 84.3173 1527.87 83.78 1525.31 83.78H1515.02V96.18ZM1515.02 77.456H1523.2C1525.85 77.456 1527.92 76.96 1529.4 75.968C1530.89 74.976 1531.64 73.5293 1531.64 71.628C1531.64 69.644 1530.91 68.1767 1529.47 67.226C1528.02 66.2753 1525.93 65.8 1523.2 65.8H1515.02V77.456ZM1551.14 103V58.98H1580.78V65.986H1559.2V77.456H1580.03V84.4H1559.2V95.994H1581.27V103H1551.14ZM1600.26 103V65.986H1586.87V58.98H1621.65V65.986H1608.32V103H1600.26ZM1619.44 103L1635.31 58.98H1645.17L1661.04 103H1652.61L1648.95 92.584H1631.53L1627.87 103H1619.44ZM1633.88 85.702H1646.59L1640.27 67.102L1633.88 85.702Z" fill="white"/>' .
		'</svg>';

	printf( '
		<div class="altis-ui">
			<div class="Header">
				<h1 class="Logo">
					%s
					<span class="Title">%s</span>
				</h1>
				<div class="CannyWrap">
					<div class="Canny">
						<img src="%s" height="50" width="50" />
						<strong>We are in beta.</strong> Vote on upcoming features or report bugs. <a href="https://altis-accelerate.canny.io/" target="_blank">Talk to us here</a>
					</div>
				</div>
			</div>',
		$wordmark,
		$title,
		plugins_url( 'assets/canny.png', Accelerate\PLUGIN_FILE )
	);

	Notices\get_page_notice();
}

/**
 * Closes off the Altis UI div.
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

	// Register account connection section on its own page slug.
	// This prevents nesting forms when telemetry has its own form.
	add_settings_section(
		'altis-accelerate-setup',
		__( 'Account', 'altis' ),
		__NAMESPACE__ . '\\render_settings_section',
		'altis-accelerate-account'
	);
}

/**
 * Accelerate settings section description placeholder.
 *
 * @return void
 */
function render_settings_section() : void {
	$connected = Accelerate\get_accelerate_dashboard_access_token();

	if ( ! $connected ) {
		return;
	}

	$user = Accelerate\accelerate_dashboard_remote_request( '/wp/v2/users/me' );
	?>
	<?php if ( is_wp_error( $user ) ) : ?>
		<p>Your connection to Accelerate failed with <code><?php echo esc_html( $user->get_error_message() ) ?></code>. <a href="<?php echo esc_url( Accelerate\get_accelerate_dashboard_authorize_url() ) ?>">Relink your account.</a></p>
	<?php else : ?>
		<p>Your site is connected to Accelerate for the user <code><?php echo esc_html( $user->name ) ?></code>. <a href="<?php echo esc_url( Accelerate\get_accelerate_dashboard_url() . '/accelerate/' ) ?>">Manage your Altis Accelerate account.</a> If you want to change the linked account, <a href="<?php echo esc_url( wp_nonce_url( add_query_arg( 'action', 'unlink-altis-dashboard-oauth' ), 'unlink-altis-dashboard-oauth' ) ) ?>">unlink here</a>.</p>
	<?php endif; ?>
	<?php
}

/**
 * Handle telemetry settings form submission.
 *
 * @return void
 */
function handle_telemetry_settings() : void {
	if ( ! isset( $_POST['altis_telemetry_submit'] ) ) {
		return;
	}

	// Verify nonce and capability.
	$nonce = isset( $_POST['_wpnonce'] ) ? sanitize_text_field( $_POST['_wpnonce'] ) : '';
	if ( ! wp_verify_nonce( $nonce, 'altis_telemetry_settings' ) || ! current_user_can( 'manage_options' ) ) {
		wp_die( __( 'Security check failed. Please try again.', 'altis' ) );
	}

	$new_status = isset( $_POST['altis_telemetry_enabled'] );
	Telemetry\opt_in( $new_status, null, 'settings' );

	// Redirect to avoid form resubmission.
	wp_safe_redirect( add_query_arg( 'telemetry_updated', '1' ) );
	exit;
}

/**
 * Render the telemetry settings section.
 *
 * @return void
 */
function render_telemetry_section() : void {
	$is_opted_in = Telemetry\is_site_opted_in();

	// Show success notice if just updated.
	if ( isset( $_GET['telemetry_updated'] ) ) {
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Setting saved.', 'altis' ) . '</p></div>';
	}
	?>
	<p>
		<?php esc_html_e( 'When enabled, we collect anonymous data about how your site uses Accelerate — things like which features you use and how often. This helps us prioritize improvements and provide better support.', 'altis' ); ?>
	</p>
	<p style="color: #666;">
		<?php esc_html_e( 'This only shares plugin usage data (features used, versions) with Human Made. Your site\'s visitor analytics stays in your Accelerate account.', 'altis' ); ?>
	</p>
	<form method="post">
		<?php wp_nonce_field( 'altis_telemetry_settings' ); ?>
		<label style="display: flex; align-items: center; gap: 8px;">
			<input type="checkbox" name="altis_telemetry_enabled" value="1" <?php checked( $is_opted_in ); ?> />
			<span><?php esc_html_e( 'Help improve Accelerate by sharing usage data', 'altis' ); ?></span>
		</label>
		<p class="submit">
			<input type="submit" name="altis_telemetry_submit" class="button button-primary" value="<?php esc_attr_e( 'Save', 'altis' ); ?>" />
		</p>
	</form>
	<?php
}

/**
 * Render telemetry section with its own heading.
 *
 * This is called directly from render_settings_page() to avoid
 * nesting forms (telemetry has its own form, can't be inside options.php form).
 *
 * @return void
 */
function render_telemetry_section_with_heading() : void {
	?>
	<div style="padding-left: 5%;">
		<h2><?php esc_html_e( 'Product Analytics', 'altis' ); ?></h2>
		<div style="max-width: 600px;">
			<?php render_telemetry_section(); ?>
		</div>
	</div>
	<?php
}

/**
 * Handle Abilities API settings form submission.
 *
 * @return void
 */
function handle_abilities_api_settings() : void {
	if ( ! isset( $_POST['accelerate_abilities_submit'] ) ) {
		return;
	}

	// Verify nonce and capability.
	$nonce = isset( $_POST['_wpnonce'] ) ? sanitize_text_field( $_POST['_wpnonce'] ) : '';
	if ( ! wp_verify_nonce( $nonce, 'accelerate_abilities_api_settings' ) || ! current_user_can( 'manage_options' ) ) {
		wp_die( __( 'Security check failed. Please try again.', 'altis' ) );
	}

	$enabled = isset( $_POST['accelerate_abilities_api_enabled'] );
	update_option( 'accelerate_abilities_api_enabled', $enabled );

	// Redirect to avoid form resubmission.
	wp_safe_redirect( add_query_arg( 'abilities_updated', '1' ) );
	exit;
}

/**
 * Render the Abilities API settings section.
 *
 * @return void
 */
function render_abilities_api_section() : void {
	$is_enabled = get_option( 'accelerate_abilities_api_enabled', false );
	$has_abilities_api = function_exists( 'wp_register_ability' );

	// Show success notice if just updated.
	if ( isset( $_GET['abilities_updated'] ) ) {
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Abilities API setting saved.', 'altis' ) . '</p></div>';
	}
	?>
	<p>
		<?php esc_html_e( 'Enable AI agents to interact with Accelerate via the WordPress Abilities API. This allows AI tools to query analytics, create experiments, and manage personalization on your behalf.', 'altis' ); ?>
	</p>
	<p style="color: #666;">
		<?php esc_html_e( 'Requires WordPress 6.9 or later. When enabled, abilities are exposed through the WordPress REST API for authenticated users.', 'altis' ); ?>
	</p>
	<?php if ( ! $has_abilities_api ) : ?>
		<div class="notice notice-warning inline" style="margin: 10px 0;">
			<p><?php esc_html_e( 'The Abilities API requires WordPress 6.9 or later. Please upgrade WordPress to enable this feature.', 'altis' ); ?></p>
		</div>
	<?php else : ?>
	<form method="post">
		<?php wp_nonce_field( 'accelerate_abilities_api_settings' ); ?>
		<label style="display: flex; align-items: center; gap: 8px;">
			<input type="checkbox" name="accelerate_abilities_api_enabled" value="1" <?php checked( $is_enabled ); ?> />
			<span><?php esc_html_e( 'Enable Abilities API for AI agents', 'altis' ); ?></span>
		</label>
		<p class="submit">
			<input type="submit" name="accelerate_abilities_submit" class="button button-primary" value="<?php esc_attr_e( 'Save', 'altis' ); ?>" />
		</p>
	</form>
	<?php endif;
}

/**
 * Render Abilities API section with its own heading.
 *
 * This is called directly from render_settings_page() to avoid
 * nesting forms (abilities API has its own form, can't be inside options.php form).
 *
 * @return void
 */
function render_abilities_api_section_with_heading() : void {
	?>
	<div style="padding-left: 5%;">
		<h2><?php esc_html_e( 'AI Abilities', 'altis' ); ?></h2>
		<div style="max-width: 600px;">
			<?php render_abilities_api_section(); ?>
		</div>
	</div>
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
			// Render only the account section inside the WordPress settings form.
			do_settings_sections( 'altis-accelerate-account' );
			?>
		</form>

		<?php
		// Render telemetry section separately (it has its own form).
		render_telemetry_section_with_heading();

		// Render abilities API section (it has its own form).
		render_abilities_api_section_with_heading();
		?>
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
	// Accelerate triangle icon - outlined triangle converted to filled path for WordPress menu coloring.
	// Based on the thick stroke version (stroke-width="80") from brand guidelines.
	// Uses fill="black" per WordPress best practices (see add_menu_page docs comment #5845).
	// Mathematically calculated: original center line offset by 40 units (half stroke-width) perpendicular to each edge.
	// Original vertices: (507.286, 76.6426), (93.4014, 510.767), (643.977, 510.767)
	// Outer (offset outward): (525, 0), (0, 551), (698, 551) - counterclockwise
	// Inner (offset inward): (490, 153), (187, 471), (589, 471) - clockwise for evenodd cutout
	$icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 699 551">' .
		'<path fill="black" fill-rule="evenodd" d="M698 551 H0 L525 0 Z M490 153 L589 471 H187 Z"/>' .
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
	$request = wp_remote_post( Accelerate\get_accelerate_dashboard_url() . '/wp-json/oauth2/access_token', [
		'headers' => [
			'Content-Type' => 'application/json',
		],
		'body' => wp_json_encode( [
			'client_id' => Accelerate\get_accelerate_dashboard_oauth2_client_id(),
			'code' => $code,
			'grant_type' => 'authorization_code',
		] ),
	] );

	if ( is_wp_error( $request ) ) {
		wp_die( esc_html( $request->get_error_message() ) );
	}

	$body = json_decode( wp_remote_retrieve_body( $request ) );
	if ( wp_remote_retrieve_response_code( $request ) > 299 ) {
		if ( json_last_error() ) {
			$headers = wp_remote_retrieve_headers( $request );
			$headers_output = '';
			foreach ( $headers as $name => $value ) {
				$headers_output .= esc_html( $name ) . ': ' . esc_html( $value ) . '<br>';
			}
			wp_die( esc_html( wp_remote_retrieve_body( $request ) ) . '<br><br><strong>Response Headers:</strong><br>' . $headers_output );
		} else {
			wp_die( esc_html( $body->message ) );
		}
	}

	// Save the access token.
	Accelerate\set_accelerate_dashboard_access_token( $body->access_token );

	$sites = Accelerate\accelerate_dashboard_remote_request( '/accelerate/sites', 'GET' );
	if ( is_wp_error( $sites ) ) {
		wp_die( esc_html( $sites->get_error_message() ) );
	}

	// Try to find a site that matching the current site's url.
	$site = array_values( array_filter( $sites, function ( $site ) : bool {
		return $site->url === home_url() && $site->status !== 'failed';
	} ) );

	if ( empty( $site ) ) {
		// Create a site for the current site's URL.
		$site = Accelerate\accelerate_dashboard_remote_request( '/accelerate/sites', 'POST', [
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
		$sites = Accelerate\accelerate_dashboard_remote_request( '/accelerate/sites', 'GET' );
		if ( is_wp_error( $sites ) ) {
			wp_die( esc_html( $sites->get_error_message() ) );
		}
		$site = array_filter( $sites, function ( $a ) use ( $site ) : bool {
			return $a->id === $site->id;
		} )[0];
	}

	update_option( 'altis_config', $site->plugin_config );

	// Track site connection event for PLG analytics.
	Telemetry\track_site_connected();

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

	Accelerate\delete_accelerate_dashboard_access_token();
	delete_option( 'altis_config');

	wp_safe_redirect( remove_query_arg( 'action' ) );
	exit;
}
