<?php

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../vendor/wp-phpunit/wp-phpunit/includes/bootstrap.php';
require_once __DIR__ . '/../../plugin.php';

// Need to create the uploads dir.
@mkdir( '/var/www/html/wp-content/uploads' );

// Load the plugin.
Altis\Accelerate\bootstrap();

// Ensure the experiments table exists for all tests (other test suites may
// trigger code paths that query it via get_active_for_post, etc.).
Altis\Accelerate\Experiments\Experiment::ensure_table();

Altis\Accelerate\Utils\query( 'DROP VIEW IF EXISTS test_analytics_hourly_engaged_mv SYNC' );
Altis\Accelerate\Utils\query( 'DROP TABLE IF EXISTS test_analytics_hourly SYNC' );
Altis\Accelerate\Utils\query( 'DROP TABLE IF EXISTS test_analytics SYNC' );
Altis\Accelerate\Utils\query( 'CREATE TABLE test_analytics AS analytics ENGINE = MergeTree() order by (app_id, blog_id, event_type, toStartOfDay(event_timestamp), endpoint_id, event_timestamp)' );

// CI's ClickHouse only provisions the base analytics table, but
// API\get_graph_data() reads the analytics_hourly rollup for unfiltered
// hourly/daily windows and hard-errors when it is absent. Create the (empty)
// table so that path returns no rows instead of UNKNOWN_TABLE — mirrors the
// definition in .setup/create-analytics-materialized-views.sql.
Altis\Accelerate\Utils\query(
	'CREATE TABLE test_analytics_hourly (
		app_id String,
		blog_id String,
		hour DateTime,
		views SimpleAggregateFunction(sum, UInt64),
		unique_visitors AggregateFunction(uniqCombined64, UUID),
		returning_visitors AggregateFunction(uniqCombined64, UUID),
		bounce_visitors AggregateFunction(uniqCombined64, UUID),
		engaged_ms SimpleAggregateFunction(sum, Float64),
		engaged_reads AggregateFunction(uniqCombined64, UUID),
		engaged_sessions AggregateFunction(uniqCombined64, UUID)
	) ENGINE = AggregatingMergeTree()
	PARTITION BY toYYYYMM(hour)
	ORDER BY (app_id, blog_id, hour)
	TTL hour + INTERVAL 90 DAY'
);

// Mirror analytics_hourly_engaged_mv over the isolated test events table so the
// unfiltered get_graph_data() path (which reads the rollup) is exercised by
// tests that insert into test_analytics.
Altis\Accelerate\Utils\query(
	"CREATE MATERIALIZED VIEW test_analytics_hourly_engaged_mv TO test_analytics_hourly AS
	SELECT
		app_id,
		blog_id,
		toStartOfHour(event_timestamp) as hour,
		sum(metrics['engaged']) as engaged_ms,
		uniqCombined64State(page_session_id) as engaged_reads,
		uniqCombined64State(session_id) as engaged_sessions
	FROM test_analytics
	WHERE event_type = '_session.stop' AND metrics['engaged'] > 0
	GROUP BY app_id, blog_id, hour"
);
