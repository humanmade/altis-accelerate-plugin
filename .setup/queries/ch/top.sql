-- {"param_blog_id":"1","param_start":"1666051200","param_end":"1666655999"}

SELECT
    -- Section: group ID
    item_id,
    -- Section: event counts
    countIf(event_type != 'conversion') as views,
    uniqCombined64If(endpoint_id, event_type != 'conversion') as unique_views,
    ( uniqCombined64If(endpoint_id, event_type = 'experienceView' AND audience = '0') + uniqCombined64If(endpoint_id, event_type = 'experienceView' AND test_variant_id = '0') ) as unique_fallback_views,
    uniqCombined64If(endpoint_id, event_type = 'conversion') as unique_conversions,
    ( uniqCombined64If(endpoint_id, event_type = 'conversion' AND audience = '0') + uniqCombined64If(endpoint_id, event_type = 'conversion' AND test_variant_id = '0') ) as unique_fallback_conversions
FROM analytics
WHERE
    blog_id = '1'
    AND item_id != ''
    AND event_timestamp >= toDateTime64(1661990400,3)
    AND event_timestamp <= toDateTime64(1662508800,3)
    AND event_type IN ('pageView', 'blockView', 'experienceView', 'conversion')
    AND (1=1)
GROUP BY item_id
ORDER BY views DESC
LIMIT 300
