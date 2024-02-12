-- {"param_start":"1666051200","param_blog_id":"1","param_prev_start":"1665446401","param_end":"1666655999","param_page_ids":"[2,1,16,23,25]","param_block_ids":"[13]","param_experience_ids":"['e4e48768-6620-409f-92e1-d607c12220d3','2a7d3480-e525-4fc0-b27d-66d677dd3008','f7s8fgs9-e525-4fc0-b27d-66d677dd3008']"}

SELECT
    multiIf(
        event_type = 'blockView', attributes['blockId'],
        event_type = 'experienceView', attributes['clientId'],
        attributes['postId']
    ) as id,
    uniqCombined64(endpoint_id) as uniques,
    uniqCombined64If(endpoint_id, event_timestamp < toDateTime64(1661990400,3)) as uniques_previous,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1661990400,3)) as uniques_current,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1666051200,3) AND event_timestamp < toDateTime64(1666137600,3)) as `1666051200`,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1666137600,3) AND event_timestamp < toDateTime64(1666224000,3)) as `1666137600`,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1666224000,3) AND event_timestamp < toDateTime64(1666310400,3)) as `1666224000`,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1666310400,3) AND event_timestamp < toDateTime64(1666396800,3)) as `1666310400`,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1666396800,3) AND event_timestamp < toDateTime64(1666483200,3)) as `1666396800`,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1666483200,3) AND event_timestamp < toDateTime64(1666569600,3)) as `1666483200`,
    uniqCombined64If(endpoint_id, event_timestamp >= toDateTime64(1666569600,3) AND event_timestamp < toDateTime64(1666656000,3)) as `1666569600`
FROM analytics
WHERE
    blog_id = '1'
    AND event_timestamp >= toDateTime64({prev_start:UInt64},3)
    AND event_timestamp <= toDateTime64(1662508800,3)
    AND event_type IN ('pageView', 'blockView', 'experienceView')
    AND (
        (event_type = 'pageView' AND attributes['postId'] IN {page_ids:Array(UInt32)})
        OR attributes['blockId'] IN {block_ids:Array(UInt32)}
        OR attributes['clientId'] IN {experience_ids:Array(String)}
    )
GROUP BY id
ORDER BY id
