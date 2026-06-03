
import { scaleBand, scaleLog } from '@visx/scale';
import { max, min } from 'd3-array';
import moment, { DurationInputArg1 } from 'moment';
import React from 'react';

import { __, sprintf, _n } from '@wordpress/i18n';

import { Duration } from '../../utils/admin';

type Datum = {
	index: number,
	count: number,
	zeroData?: boolean,
};

type Props = {
	histogram: Datum[],
	maxViews?: number,
	width?: number,
	height?: number,
	period?: Duration,
};

const getX = ( d : Datum ) => d.index;
const getY = ( d : Datum ) => d?.count || 0;

// Bucket count per period for the empty-state silhouette. Realtime
// shows 15 minute-buckets (matches the hero chart's 15-min visible
// window). Today/Yesterday are hourly (24). Longer windows are
// daily-bucketed via moment.duration().
function getBucketCount( period: Duration ): number {
	if ( period === 'PT30M' ) {
		return 15;
	}
	if ( period === 'TODAY' || period === 'YESTERDAY' ) {
		return 24;
	}
	const days = Math.floor( moment.duration( period as DurationInputArg1 ).asDays() );
	return days > 0 ? days : 7;
}

// Pixel widths per period — drives the SVG width so the spark scales
// with the data density. The short-window periods (Realtime / Today
// / Yesterday) fall through to the prop `width` default (160) so they
// visually match the longer-period sparks in the column instead of
// rendering as a narrow stub.
const BREAKPOINT_WIDTHS: Partial<Record<string, number>> = {
	P7D: 100,
	P14D: 110,
	P30D: 120,
	P1M: 120,
	P60D: 135,
	P90D: 150,
};

function SparkChart( props: Props ) {
	// Set up default empty histogram to allow for animations.
	const days = getBucketCount( props.period || 'P7D' );
	let histogram : Datum[] = Array( days ).fill( {
		index: 0,
		count: 0,
	} );

	histogram.forEach( ( d, i ) => {
		histogram[i] = {
			index: i,
			count: 0,
		};
	} );

	if ( props.histogram && props.histogram.length > 0 ) {
		const incoming = props.histogram;
		if ( incoming.length >= days ) {
			// Server returned more buckets than we display — keep the
			// most-recent `days` (e.g. last 15 minutes of realtime when
			// the API hands back 30).
			histogram = incoming.slice( incoming.length - days );
		} else {
			// Fewer buckets than the target window — anchor the real
			// data to the right (most recent) and leave the older slots
			// as zero placeholders. For "Today" partway through the day,
			// this keeps the spark's right edge aligned with `now`.
			histogram.splice( days - incoming.length, Infinity, ...incoming );
		}
		// Re-index so x positions are 0..N regardless of how the
		// server numbered them.
		histogram = histogram.map( ( d, i ) => ( {
			...d,
			index: i,
		} ) );
	}

	const {
		width = 160,
		height = 40,
		maxViews,
		period = 'P7D',
	} = props;

	// Override width depending on number of days shown.
	const trueWidth = BREAKPOINT_WIDTHS[ period as string ] || width;

	const yMax = max( histogram, getY ) as number || 0;

	// Pad numbers until we get data, always ensure they're less than real data values.
	for ( let i = 0; i < histogram.length; i++ ) {
		if ( histogram[i].count === 0 ) {
			histogram[i].zeroData = true;
			histogram[i].count = 0.7;
		} else {
			break;
		}
	}

	const xScale = scaleBand<number>( {
		domain: histogram.map( getX ),
		padding: Math.max( 1.5 / histogram.length, 0.15 ),
		range: [ 0, trueWidth ],
	} );
	const yScale = scaleLog<number>( {
		domain: [ 1, maxViews || yMax as number || 0.7 ],
		range: [ height, 0 ],
	} );

	return (
		<svg height={ height } overflow="hidden" width={ trueWidth }>
			{ histogram.map( ( d, i ) => {
				const barWidth = xScale.bandwidth();
				const barX = xScale( getX( d ) );
				const barY = Math.max( 0, Math.min( yScale( getY( d ) as number + 0.7 ), height - 0.7 ) );
				const barHeight = height - barY;
				return (
					<rect
						key={ `bar-${ i }` }
						fill={ d.zeroData ? '#ECEEF1' : '#1f2937' }
						fillOpacity={ 0.8 }
						height={ barHeight }
						rx={ 1 }
						width={ barWidth }
						x={ barX }
						y={ barY }
					>
						<title>{
							d.zeroData
								? __( 'No data for this date', 'altis' )
								: sprintf(
									'%d %s on %s',
									d.count,
									_n( 'View', 'Views', d.count, 'altis' ),
									( new Date( d.index ) ).toDateString()
								)
						}</title>
					</rect>
				);
			} ) }
		</svg>
	);
}

export default React.memo( SparkChart, ( prev, next ) => {
	if ( prev.period !== next.period ) {
		return false;
	}
	if ( prev.maxViews !== next.maxViews ) {
		return false;
	}
	if ( prev.width !== next.width || prev.height !== next.height ) {
		return false;
	}
	if ( ( prev.histogram?.length ?? 0 ) !== ( next.histogram?.length ?? 0 ) ) {
		return false;
	}
	return ( prev.histogram ?? [] ).every( ( d, i ) => d.count === next.histogram?.[ i ]?.count );
} );
