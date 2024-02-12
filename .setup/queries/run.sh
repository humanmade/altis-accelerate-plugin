#!/bin/bash

CONCURRENTS=1
REQUESTS=1000
ORIGSTART=1661990400
ORIGEND=1662508800
START=1663628400
END=1664406000

# echo "
# Running bencharks for ElasticSearch...
# "
# for q in top stats insights japan uniques
# do
#     echo "
# ----------------------------------------------
# Query $q:"
#     ab -l -c $CONCURRENTS -n $REQUESTS -p es/$q.json -T application/json http://localhost:9220/analytics-\*/_search
# done

echo "
Running bencharks for ClickHouse...
"
for q in top stats insights japan uniques
do
    echo "
----------------------------------------------
Query $q:"
    mkdir -p results/plots/png
    mkdir -p modified/ch
    cp ch/$q.sql modified/ch/$q.sql
    sed -i '' "s/$ORIGSTART/$START/" modified/ch/$q.sql
    sed -i '' "s/$ORIGEND/$END/" modified/ch/$q.sql
    ab -l -c $CONCURRENTS -n $REQUESTS -g results/plots/$q.tsv -p modified/ch/$q.sql http://localhost:8123/\?enable_http_compression\=1 > results/$q.txt
    gnuplot -e "query='$q'" plot.gp
done
