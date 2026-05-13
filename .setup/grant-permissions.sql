-- Grant permissions on analytics tables to default user
-- Run after creating tables and materialized views

GRANT SELECT, INSERT ON default.analytics TO default;
GRANT SELECT ON default.analytics_daily TO default;
GRANT SELECT ON default.analytics_daily_items TO default;
GRANT SELECT ON default.analytics_daily_referrers TO default;
GRANT SELECT ON default.analytics_daily_urls TO default;
