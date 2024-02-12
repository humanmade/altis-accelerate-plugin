# Let's output to a jpeg file
set terminal png size 1280,540
# This sets the aspect ratio of the graph
set size 1, 1
# The file we'll write to
set output "results/plots/png/".query."-boxplot.png"
# The graph title
set title "Benchmark testing: ".query
set style boxplot nooutliers
set style boxplot fraction 0.99
set style data boxplot
set style fill solid 0.50 border lt -1
# Where to place the legend/key
set key outside left top
# Draw gridlines oriented on the y axis
set grid y
# Specify that the x-series data is time data
set xrange [0:9]
set yrange [0:*]
# Specify the *input* format of the time data
set timefmt "%s"
# Specify the *output* format for the x-axis tick labels
set format x ""
# Label the x-axis
set xlabel 'table settings'
# Label the y-axis
set ylabel "response time (ms)"
# Tell gnuplot to use tabs as the delimiter instead of spaces (default)
set datafile separator '\t'
# Plot the data
plot "results/plots/".query."-cardinal.tsv" every ::2 using (1):5 title 'Cardinal' pointsize .5, \
     "results/plots/".query."-cardinal_pk.tsv" every ::2 using (2):5 title 'Cardinal PK' pointsize .5, \
     "results/plots/".query."-cardinal_date.tsv" every ::2 using (3):5 title 'Cardinal Date' pointsize .5, \
     "results/plots/".query."-cardinal_date_pk.tsv" every ::2 using (4):5 title 'Cardinal Date PK' pointsize .5, \
     "results/plots/".query."-hierarchical.tsv" every ::2 using (5):5 title 'Hierarchical' pointsize .5, \
     "results/plots/".query."-hierarchical_pk.tsv" every ::2 using (6):5 title 'Hierarchical PK' pointsize .5, \
     "results/plots/".query."-hierarchical_date.tsv" every ::2 using (7):5 title 'Hierarchical Date' pointsize .5, \
     "results/plots/".query."-hierarchical_date_pk.tsv" every ::2 using (8):5 title 'Hierarchical Date PK' pointsize .5
exit
