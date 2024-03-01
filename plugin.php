<?php
/**
 * Plugin Name: Altis Accelerate
 * Description: Go beyond content with Altis Accelerate, the best way to personalize content in WordPress.
 * Author: Altis DXP
 * Author URI: https://www.altis-dxp.com/
 * Version: 3.2.0
 * Text Domain: altis-accelerate
 * Update URI: https://wordpress.org/plugins/altis-accelerate/
 */

namespace Altis\Accelerate;

const PLUGIN_FILE = __FILE__;
const PLUGIN_DIR = __DIR__;
const VERSION = '3.2.0';

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

if ( is_readable( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
}

bootstrap();
