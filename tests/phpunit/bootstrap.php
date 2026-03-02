<?php

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../vendor/wp-phpunit/wp-phpunit/includes/bootstrap.php';
require_once __DIR__ . '/../../plugin.php';

// Need to create the uploads dir.
@mkdir( '/var/www/html/wp-content/uploads' );

// Load the plugin.
Altis\Accelerate\bootstrap();

Altis\Accelerate\Utils\query( 'DROP TABLE IF EXISTS test_analytics SYNC' );
Altis\Accelerate\Utils\query( 'CREATE TABLE test_analytics AS analytics ENGINE = MergeTree() order by (app_id, blog_id, event_type, toStartOfDay(event_timestamp), endpoint_id, event_timestamp)' );
