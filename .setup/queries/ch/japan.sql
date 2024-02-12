-- {"param_audience_0_0":"JP","param_blog_id":"1","param_since":"1665964800000"}

SELECT
    uniqCombined64(endpoint_id) as uniques,
    histogram(42)(toUnixTimestamp64Milli(event_timestamp)) as `histogram`
FROM analytics
WHERE
    blog_id = '1'
    AND event_type = 'pageView'
    AND event_timestamp >= toDateTime64(1661990400,3)
    AND event_timestamp <= toDateTime64(1662508800,3)
    AND ( (country = 'JP') )
