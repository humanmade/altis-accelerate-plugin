<?php
/**
 * Plugin Name: Accelerate
 * Description: Go beyond content with Accelerate, the best way to personalize content in WordPress.
 * Author: Human Made
 * Author URI: https://www.accelerateplugin.com/
 * Version: pull-request-abilities-api
 * Text Domain: altis-accelerate
 * Update URI: https://wordpress.org/plugins/altis-accelerate/
 */

namespace Altis\Accelerate;

const PLUGIN_FILE = __FILE__;
const PLUGIN_DIR = __DIR__;
const VERSION = 'pull-request-abilities-api';

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

if ( is_readable( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
}

bootstrap();
