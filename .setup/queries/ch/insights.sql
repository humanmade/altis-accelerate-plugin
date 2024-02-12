-- {"param_blog_id":"1","param_start":"1666015981"}

SELECT
    item_id,
    uniqCombined64If(endpoint_id, event_type = 'experienceView') as unique_views,
    uniqCombined64If(endpoint_id, event_type = 'conversion') as unique_conversions,
    (unique_conversions / unique_views) as conversion_rate,
    groupUniqArray(post_id) as post_ids
FROM analytics
WHERE
    blog_id = '1'
    AND event_type IN ('experienceView', 'conversion')
    AND event_timestamp >= toDateTime64(1661990400,3)
    AND event_timestamp <= toDateTime64(1662508800,3)
GROUP BY item_id
ORDER BY unique_views DESC
