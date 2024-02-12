-- {"param_blog_id":"1","param_start":"1666051200","param_end":"1666655999"}

SELECT
    toStartOfInterval(event_timestamp, INTERVAL 1 hour) as `date`,
    -- views
    count() as views,
    -- uniques
    uniqCombined64(endpoint_id) as uniques,
    -- returning
    uniqCombined64If(endpoint_id, endpoint_sessions > 1) as returning,
    -- bounce
    uniqCombined64If(endpoint_id, endpoint_views < 2) as bounce
FROM analytics
WHERE
    blog_id = '1'
    AND event_timestamp >= toDateTime64(1661990400,3)
    AND event_timestamp <= toDateTime64(1662508800,3)
    AND event_type = 'pageView'
    AND (1=1)
GROUP BY `date` WITH ROLLUP
ORDER BY `date` ASC WITH FILL FROM toDateTime(1661990400) TO toDateTime(1662508800) STEP INTERVAL 1 hour
