-- Analytics Materialized Views for Query Optimization
-- These pre-aggregate daily stats for faster queries on /stats/, /top/, and related endpoints.
--
-- Run after create-analytics-table.sql
-- For existing data, run the backfill queries at the end.

-- ============================================
-- 1. Daily Blog Stats (for /stats/ endpoint)
-- ============================================
-- Aggregates: views, unique visitors, returning visitors, bounce rate
-- Use for: Dashboard stats, time-series graphs with daily granularity

CREATE TABLE IF NOT EXISTS analytics_daily (
    app_id String,
    blog_id String,
    day Date,
    views SimpleAggregateFunction(sum, UInt64),
    unique_visitors AggregateFunction(uniqCombined64, UUID),
    returning_visitors AggregateFunction(uniqCombined64, UUID),
    bounce_visitors AggregateFunction(uniqCombined64, UUID)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (app_id, blog_id, day)
TTL day + INTERVAL 180 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_daily_mv TO analytics_daily AS
SELECT
    app_id,
    blog_id,
    toDate(event_timestamp) as day,
    count() as views,
    uniqCombined64State(endpoint_id) as unique_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_sessions > 1) as returning_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_views < 2) as bounce_visitors
FROM analytics
WHERE event_type = 'pageView'
GROUP BY app_id, blog_id, day;


-- ============================================
-- BACKFILL EXISTING DATA
-- ============================================
-- Run these after creating tables to populate from existing analytics data.
-- Note: This can take time on large tables.

INSERT INTO analytics_daily
SELECT
    app_id,
    blog_id,
    toDate(event_timestamp) as day,
    count() as views,
    uniqCombined64State(endpoint_id) as unique_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_sessions > 1) as returning_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_views < 2) as bounce_visitors
FROM analytics
WHERE event_type = 'pageView'
GROUP BY app_id, blog_id, day;

-- ============================================
-- 2. Hourly Stats (primary table for all time-series graphs up to 90 days)
-- ============================================
-- Aggregates: views, unique visitors, returning visitors, bounce rate
-- Use for: All interval resolutions (PT1H, P1D, P7D) up to 90 days.
--          Day/week grouping happens at query time via toStartOfInterval(hour, ..., tz),
--          which correctly handles timezone-aware day boundaries (unlike analytics_daily
--          which stored UTC days and caused boundary errors for non-UTC users).
-- TTL: 90 days

CREATE TABLE IF NOT EXISTS analytics_hourly (
    app_id String,
    blog_id String,
    hour DateTime,
    views SimpleAggregateFunction(sum, UInt64),
    unique_visitors AggregateFunction(uniqCombined64, UUID),
    returning_visitors AggregateFunction(uniqCombined64, UUID),
    bounce_visitors AggregateFunction(uniqCombined64, UUID),
    -- Engaged time (fed by analytics_hourly_engaged_mv; defaults on pageView rows)
    engaged_ms SimpleAggregateFunction(sum, Float64),
    engaged_reads AggregateFunction(uniqCombined64, UUID),
    engaged_sessions AggregateFunction(uniqCombined64, UUID)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (app_id, blog_id, hour)
TTL hour + INTERVAL 90 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_hourly_mv TO analytics_hourly AS
SELECT
    app_id,
    blog_id,
    toStartOfHour(event_timestamp) as hour,
    count() as views,
    uniqCombined64State(endpoint_id) as unique_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_sessions > 1) as returning_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_views < 2) as bounce_visitors
FROM analytics
WHERE event_type = 'pageView'
GROUP BY app_id, blog_id, hour;

-- Backfill last 90 days of hourly data
INSERT INTO analytics_hourly (app_id, blog_id, hour, views, unique_visitors, returning_visitors, bounce_visitors)
SELECT
    app_id,
    blog_id,
    toStartOfHour(event_timestamp) as hour,
    count() as views,
    uniqCombined64State(endpoint_id) as unique_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_sessions > 1) as returning_visitors,
    uniqCombined64StateIf(endpoint_id, endpoint_views < 2) as bounce_visitors
FROM analytics
WHERE event_type = 'pageView' AND event_timestamp >= now() - INTERVAL 90 DAY
GROUP BY app_id, blog_id, hour;

-- ============================================
-- 3. Engaged time (columns on analytics_hourly)
-- ============================================
-- The client flushes engaged time as an additive delta (metrics['engaged'],
-- milliseconds) on each _session.stop event, so pre-aggregation is plain
-- sum/uniq at the hourly grain — no dedicated table needed. A second
-- materialized view feeds the same analytics_hourly rows the pageView MV
-- writes to; AggregatingMergeTree merges them by (app_id, blog_id, hour).
-- get_graph_data() reads these for the unfiltered dashboard summary; filtered
-- drilldowns compute from the raw table's materialized `engaged` column.
--
-- For EXISTING installations run (instant, metadata-only):
--   ALTER TABLE analytics ADD COLUMN IF NOT EXISTS engaged Float64 MATERIALIZED metrics['engaged'];
--   ALTER TABLE analytics_hourly
--     ADD COLUMN IF NOT EXISTS engaged_ms SimpleAggregateFunction(sum, Float64),
--     ADD COLUMN IF NOT EXISTS engaged_reads AggregateFunction(uniqCombined64, UUID),
--     ADD COLUMN IF NOT EXISTS engaged_sessions AggregateFunction(uniqCombined64, UUID);
-- then create analytics_hourly_engaged_mv below.
--
-- Environments that previously provisioned the dedicated engaged-time objects
-- can drop them (they no longer receive rows):
--   DROP VIEW IF EXISTS analytics_engaged_daily_mv;
--   DROP TABLE IF EXISTS analytics_engaged_daily;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_hourly_engaged_mv TO analytics_hourly AS
SELECT
    app_id,
    blog_id,
    toStartOfHour(event_timestamp) as hour,
    sum(metrics['engaged']) as engaged_ms,
    uniqCombined64State(page_session_id) as engaged_reads,
    uniqCombined64State(session_id) as engaged_sessions
FROM analytics
WHERE event_type = '_session.stop' AND metrics['engaged'] > 0
GROUP BY app_id, blog_id, hour;

-- Backfill engaged rollups from any existing delta rows (no-op on
-- installations that predate engaged tracking).
INSERT INTO analytics_hourly (app_id, blog_id, hour, engaged_ms, engaged_reads, engaged_sessions)
SELECT
    app_id,
    blog_id,
    toStartOfHour(event_timestamp) as hour,
    sum(metrics['engaged']) as engaged_ms,
    uniqCombined64State(page_session_id) as engaged_reads,
    uniqCombined64State(session_id) as engaged_sessions
FROM analytics
WHERE event_type = '_session.stop' AND metrics['engaged'] > 0 AND event_timestamp >= now() - INTERVAL 90 DAY
GROUP BY app_id, blog_id, hour;
