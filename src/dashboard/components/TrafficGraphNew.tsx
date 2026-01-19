import { AxisLeft, AxisBottom } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { LinearGradient } from '@visx/gradient';
import { GridRows, GridColumns } from '@visx/grid';
import { Group } from '@visx/group';
import { MarkerCircle } from '@visx/marker';
import { scaleLinear, scaleTime } from '@visx/scale';
import { LinePath, AreaClosed, Bar } from '@visx/shape';
import { Text } from '@visx/text';
import { TooltipWithBounds, useTooltip } from '@visx/tooltip';
import { extent, max, bisector } from 'd3-array';
import moment from 'moment';
import React, { useCallback, useState, useEffect } from 'react';

import { useSelect } from '@wordpress/data';
import { __, _n } from '@wordpress/i18n';

import { usePersistentState } from '../../data/hooks';
import { periods } from '../../data/periods';
import { compactMetric, Duration, Period, padLeft, StatsResult } from '../../utils/admin';

const Loading = () => <p>Loading…</p>;

type Props = {
	period: Duration,
};

type Datum = {
	time: Date,
	uniques: number,
	views: number,
};

const getX = ( d : Datum ) => d.time;
const getViews = ( d : Datum ) => d?.views || 0;
const getUniques = ( d : Datum ) => d?.uniques || 0;
const bisectDate = bisector<Datum, Date>( ( d: Datum ) => d.time ).left;

const getTooltip = ( data : Datum, interval : string ) => {
	const date = getX( data );
	let dateString = moment( date ).format( 'MMM Do' );

	let isIntervalHours = interval.match( /(\d) hour/ );
	let intervalHours = Number( isIntervalHours ? isIntervalHours[1] : 0 );

	if ( intervalHours === 1 ) {
		dateString = `${ padLeft( date.getHours() ) }:00`;
	} else if ( intervalHours ) {
		const offset = date.getHours() + intervalHours;
		const wrappedOffset = offset < 24 ? offset : 0;
		dateString = `${ padLeft( date.getHours() ) }:00 — ${ padLeft( wrappedOffset ) }:00`;
	}

	return (
		<span>
			<strong>{ compactMetric( data.views ) }</strong> { _n( 'view', 'views', data.views, 'altis' ) }<br />
			<strong>{ compactMetric( data.uniques ) }</strong> { _n( 'unique', 'uniques', data.uniques, 'altis' ) }< br />
			<small><time dateTime={ date.toISOString() }>{ `${ dateString }` }</time></small>
		</span>
	);
};

interface NewProps {
	data?: StatsResult,
	period: Period,
}

export default function HeroChart( props: NewProps ) {
	const {
		period: periodKey,
		data,
	} = props;

	const period = periods.find( p => p.value === periodKey ) || periods[0];
	const isLoading = false;

	// Get stats data.
	const [ outerWidth, setOuterWidth ] = useState<number>( 0 );
	const [ resolution, setResolution ] = usePersistentState<string>( 'hero-chart-resolution', period.intervals[ period.defaultInterval || 0 ].interval );

	// eslint-disable-next-line react-hooks/exhaustive-deps
	let uniques : Datum[] = [];
	if ( isLoading || Object.values( data?.by_interval || {} ).length < 1 ) {
		uniques = Array( 7 ).fill( {} ).map( ( d, i ) => {
			return {
				time: moment().endOf( 'day' ).subtract( 7, 'days' ).add( i, 'days' ).toDate(),
				uniques: 0,
				views: 0,
			};
		} );
	} else {
		uniques = Object.entries( data?.by_interval || {} ).map( ( [ time, stats ] ) => {
			const date : Date = new Date( time );
			const dateNow = new Date();
			return {
				time: date < dateNow ? date : dateNow,
				uniques: stats?.visitors || 0,
				views: stats?.views || 0,
			};
		} );
	}

	useEffect( () => {
		setOuterWidth( document.getElementById( 'hero-chart' )?.offsetWidth || 600 );
	}, [ setOuterWidth, data ] );

	// Reset interval on period change if not available.
	useEffect( () => {
		if ( period.intervals.map( i => i.interval ).indexOf( resolution ) === -1 ) {
			setResolution( period.intervals[ period.defaultInterval || 0 ].interval );
		}
	}, [ period, resolution, setResolution ] );

	const dateDomain = extent( uniques, getX ) as [ Date, Date ];
	if ( ! resolution.match( 'day' ) ) {
		dateDomain[1] = moment( dateDomain[1] ).add( 1, 'hours' ).toDate(); // Ensure last data point is not left out by visx.
	}
	const xScale = scaleTime<number>( {
		domain: dateDomain,
	} );
	const yScale = scaleLinear<number>( {
		domain: [ 0, Math.max( 4, max( uniques, getViews ) as number + Math.floor( max( uniques, getViews ) as number / 6 ) ) ],
		nice: true,
	} );

	const graphHeight = 250;
	const offsetleft = 150;
	const graphPaddingX = 30;
	const graphPaddingY = 50;
	const outerWidthWithOffset = Math.max( 0, outerWidth - graphHeight );

	xScale.range( [ 0, outerWidthWithOffset ] );
	yScale.range( [ graphHeight, 0 ] );

	const {
		showTooltip,
		hideTooltip,
		tooltipData,
		tooltipTop = 0,
		tooltipLeft = 0,
	} = useTooltip();

	const handleTooltip = useCallback(
		( event: React.TouchEvent<SVGGElement> | React.MouseEvent<SVGGElement> ) => {
		  const { x } = localPoint( event ) || { x: 0 };
		  const x0 = xScale.invert( x - offsetleft );
		  const index = bisectDate( uniques, x0, 1 );
		  const d0 = uniques[ index - 1 ];
		  const d1 = uniques[ index ];
		  let d = d0;
		  if ( d1 && getX( d1 ) ) {
				d = x0.valueOf() - getX( d0 ).valueOf() > getX( d1 ).valueOf() - x0.valueOf() ? d1 : d0;
		  }
		  showTooltip( {
				tooltipData: d,
				tooltipLeft: xScale( getX( d ) ),
				tooltipTop: yScale( getViews( d ) ),
		  } );
		},
		[ showTooltip, yScale, xScale, uniques ]
	);

	return (
		<div className="HeroChart my-0" id="hero-chart">
			<svg height={ graphHeight + ( graphPaddingY * 2 ) } width="100%">
				<MarkerCircle fill="#333" id="marker-circle" refX={ 2 } size={ 2 } />
				<LinearGradient
					from={ isLoading ? '#ccc' : '#9333ea' }
					id="hero-gradient"
					to="rgba( 255, 255, 255, 0 )"
				/>
				<Group
					className={ `HeroChart__group ${ isLoading ? 'HeroChart__group--loading' : '' }` }
					height={ graphHeight + graphPaddingY }
					left={ offsetleft }
					top={ graphPaddingY / 2 }
					onMouseLeave={ () => hideTooltip() }
				>
					<AxisBottom
						hideAxisLine
						hideTicks
						numTicks={ 7 }
						scale={ xScale }
						tickFormat={ value => {
							const date = new Date( value as Date );
							return `${ padLeft( date.getDate() ) }.${ padLeft( date.getMonth() + 1 ) }`;
						} }
						tickLabelProps={ () => ( {
							verticalAnchor: 'middle',
							textAnchor: 'middle',
							fontSize: 11,
							style: { textTransform: 'uppercase' },
							fill: '#777',
						} ) }
						top={ graphHeight + 10 }
					/>
					<AxisLeft
						hideAxisLine
						hideTicks
						hideZero
						label={ __( 'View Count', 'altis' ) }
						labelOffset={ 50 }
						labelProps={ {
							verticalAnchor: 'middle',
							textAnchor: 'middle',
							fontSize: 13,
							fontWeight: 'normal',
							letterSpacing: '0.1em',
							style: { textTransform: 'uppercase' },
							fill: '#777',
						} }
						left={ -graphPaddingX }
						numTicks={ 4 }
						scale={ yScale }
						tickFormat={ value => {
							return compactMetric( value as number );
						} }
						tickLabelProps={ () => ( {
							verticalAnchor: 'middle',
							textAnchor: 'end',
							fontSize: 11,
							fill: '#777',
						} ) }
					/>
					<GridRows
						left={ -graphPaddingX }
						numTicks={ 4 }
						scale={ yScale }
						stroke="rgba( 0, 0, 0, .2 )"
						width={ outerWidthWithOffset + ( graphPaddingX * 2 ) }
					/>

					{ /* <AreaClosed
						curve={ curveMonotoneX }
						data={ uniques }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d  => yScale( getViews( d ) ) ?? 0 }
						yScale={ yScale }
						strokeWidth={ 0 }
						strokeOpacity={ 1 }
						shapeRendering="geometricPrecision"
						// fill="#fff"
						// opacity={ 0.9 }
					/> */ }
					<LinePath
						// curve={ curveMonotoneX }
						data={ uniques }
						shapeRendering="geometricPrecision"
						stroke={ isLoading ? '#ccc' : '#9333ea' }
						strokeOpacity={ 1 }
						strokeWidth={ 2 }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d  => yScale( getViews( d ) ) ?? 0 }
					/>
					<AreaClosed
						// curve={ curveMonotoneX }
						data={ uniques }
						fill="url(#hero-gradient)"
						opacity={ 0.3 }
						shapeRendering="geometricPrecision"
						strokeOpacity={ 1 }
						strokeWidth={ 0 }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d => yScale( getViews( d ) ) ?? 0 }
						yScale={ yScale }
					/>

					{ /* <AreaClosed
						curve={ curveMonotoneX }
						data={ uniques }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d  => yScale( getUniques( d ) ) ?? 0 }
						yScale={ yScale }
						strokeWidth={ 0 }
						strokeOpacity={ 1 }
						shapeRendering="geometricPrecision"
						fill="#fff"
						opacity={ 0.9 }
					/> */ }
					<LinePath
						// curve={ curveMonotoneX }
						data={ uniques }
						opacity={ 0.6 }
						shapeRendering="geometricPrecision"
						stroke={ isLoading ? '#ccc' : '#9333ea' }
						strokeDasharray={ 4 }
						strokeOpacity={ 1 }
						strokeWidth={ 2 }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d  => yScale( getUniques( d ) ) ?? 0 }
					/>

					<Bar
						fill="transparent"
						height={ graphHeight }
						width={ outerWidthWithOffset }
						x={ 0 }
						y={ 0 }
						onMouseLeave={ () => hideTooltip() }
					/>
					<GridColumns
						fill="transparent"
						height={ graphHeight }
						numTicks={ uniques.length }
						scale={ xScale }
						stroke="transparent"
						strokeWidth={ outerWidthWithOffset / uniques.length }
						width={ outerWidthWithOffset }
						x={ 0 }
						y={ 0 }
						onMouseMove={ handleTooltip }
						onTouchMove={ handleTooltip }
						onTouchStart={ handleTooltip }
					/>
					{ tooltipData && (
						<>
							<g>
								<circle
									cx={ tooltipLeft }
									cy={ tooltipTop + 1 }
									fill="black"
									fillOpacity={ 0.1 }
									pointerEvents="none"
									r={ 4 }
									stroke="black"
									strokeOpacity={ 0.1 }
									strokeWidth={ 2 }
								/>
								<circle
									cx={ tooltipLeft }
									cy={ tooltipTop }
									fill="#9333ea"
									pointerEvents="none"
									r={ 4 }
									stroke="white"
									strokeWidth={ 2 }
								/>
							</g>
							<g>
								<circle
									cx={ tooltipLeft }
									cy={ yScale( getUniques( tooltipData ) ) + 1 }
									fill="black"
									fillOpacity={ 0.1 }
									pointerEvents="none"
									r={ 4 }
									stroke="black"
									strokeOpacity={ 0.1 }
									strokeWidth={ 2 }
								/>
								<circle
									cx={ tooltipLeft }
									cy={ yScale( getUniques( tooltipData ) ) }
									fill="#9333ea"
									pointerEvents="none"
									r={ 4 }
									stroke="white"
									strokeWidth={ 2 }
								/>
							</g>
						</>
					) }
					{ !! data?.by_interval && ( Object.values( data.by_interval ).length || 0 ) < 1 && (
						<Text
							className="HeroChart__waiting"
							fill="#7d7d7d"
							fontSize={ 32 }
							textAnchor="middle"
							verticalAnchor="middle"
							width={ 400 }
							x={ outerWidthWithOffset / 2 - graphPaddingX }
							y={ graphHeight / 2 - 30 }
						>
							{ __( '👋 We’re collecting data, check back soon!', 'altis' ) }
						</Text>
					) }
				</Group>
				{ isLoading || ( Object.values( data?.by_interval || {} ).length || 0 ) < 1 && (
					<Bar
						fill="transparent"
						height={ graphHeight + graphPaddingY }
						width={ outerWidth }
						x={ 0 }
						y={ 0 }
					/>
				) }
			</svg>
			{ tooltipData && (
				<div>
					<TooltipWithBounds
						key={ Math.random() }
						left={ tooltipLeft + 6 + offsetleft }
						top={ tooltipTop - 12 }
					>
						{ getTooltip( tooltipData as Datum, resolution ) }
					</TooltipWithBounds>
				</div>
			) }
		</div>
	);
}
