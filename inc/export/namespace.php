<?php
/**
 * Altis Analytics Data Export feature.
 */

namespace Altis\Accelerate\Export;

/**
 * Set up the data export REST API endpoint.
 *
 * @return void
 */
function setup() {
	$endpoint = new Endpoint();
	$endpoint->bootstrap();

	Cron\bootstrap();
}
