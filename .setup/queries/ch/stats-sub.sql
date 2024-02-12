SELECT attributes['search'] as `key`, count() as `value`
FROM analytics
WHERE
    blog_id = '1'
    AND event_type = 'pageView' AND (1=1)
    AND (attributes['referer'] NOT ILIKE 'http://localhost:8081%')
    AND (attributes['search'] != '')
GROUP BY attributes['search']
ORDER BY `value` DESC
LIMIT 10;
