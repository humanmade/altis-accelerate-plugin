<?php

namespace Altis\Accelerate\Traffic_Generator;

use WP_CLI;

function bootstrap() {
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		require_once __DIR__ . '/class-cli-command.php';
		WP_CLI::add_command( 'accelerate traffic-generator', CLI_Command::class );
	}
}
