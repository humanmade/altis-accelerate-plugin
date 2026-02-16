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

import { Tooltip } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __, _n } from '@wordpress/i18n';

import { usePersistentState } from '../../data/hooks';
import { periods } from '../../data/periods';
import { useInterval } from '../../lib/hooks';
import { compactMetric, Duration, padLeft, PeriodObject, StatsResult, trackEvent } from '../../utils/admin';

import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Spinner } from '@/components/ui/spinner';

type Props = {
	period: Duration;
};

type Datum = {
	time: Date;
	uniques: number;
	views: number;
};

const getX = ( d: Datum ) => d.time;
const getViews = ( d: Datum ) => d?.views || 0;
const getUniques = ( d: Datum ) => d?.uniques || 0;
const bisectDate = bisector<Datum, Date>( ( d: Datum ) => d.time ).left;

const getTooltip = ( data : Datum, interval : string, period: PeriodObject ) => {
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
	} else if ( period.value === 'PT30M' ) {
		dateString = `${ padLeft( date.getHours() ) }:${ padLeft( date.getMinutes() ) }${ date.getHours() >= 12 ? 'PM' : 'AM' }`;
	}

	return (
		<span>
			<strong>{ compactMetric( data.views ) }</strong> { _n( 'view', 'views', data.views, 'altis' ) }
			<br />
			<strong>{ compactMetric( data.uniques ) }</strong> { _n( 'unique', 'uniques', data.uniques, 'altis' ) }
			<br />
			<small>
				<time dateTime={ date.toISOString() }>{ `${ dateString }` }</time>
			</small>
		</span>
	);
};

export default function HeroChart( props: Props ) {
	const { period: periodKey } = props;

	const period = periods.find( p => p.value === periodKey ) || periods[0];

	// Get stats data.
	const [ outerWidth, setOuterWidth ] = useState<number>( 0 );
	const [ resolution, setResolution ] = usePersistentState<string>( 'hero-chart-resolution', period.intervals[ period.defaultInterval || 0 ].interval );

	// Realtime refresh - update every 30 seconds when in realtime mode (PT30M).
	const REALTIME_INTERVAL_SECONDS = 30;
	const isRealTime = period.value === 'PT30M';
	const [ refreshKey, setRefreshKey ] = useState<number>( Date.now() );

	// Refresh data every 30 seconds in realtime mode.
	useInterval( () => {
		if ( isRealTime ) {
			setRefreshKey( Date.now() );
		}
	}, isRealTime ? REALTIME_INTERVAL_SECONDS * 1000 : null );

	const data = useSelect<StatsResult>( select => {
		let chosen_resolution = resolution;
		// The `resolution` may be persistend state that is not a valid resolution for the current period.
		if ( resolution && period.intervals.map( i => i.interval ).indexOf( resolution ) === -1 ) {
			chosen_resolution = period.intervals[ period.defaultInterval || 0 ].interval;
		}
		return select( 'accelerate' ).getStats( {
			period: period.value || 'P7D',
			interval: chosen_resolution || period.intervals[ period.defaultInterval || 0 ].interval || '1 day',
		} );
	}, [ period, resolution ] );
	const isLoading = useSelect<StatsResult>( select => {
		return select( 'accelerate' ).getIsLoadingStats();
	}, [ data ] );

	// eslint-disable-next-line react-hooks/exhaustive-deps
	let uniques: Datum[] = [];
	const hasData = Object.values( data?.by_interval || {} ).length > 0;
	// Don't show loading state visuals during realtime refresh when we already have data.
	const showLoadingState = isLoading && ! ( isRealTime && hasData );
	// Only show placeholder when there's no data yet. During realtime refresh, keep showing existing data.
	if ( ! hasData ) {
		if ( isRealTime ) {
			// Generate 30 data points for the last 30 minutes in realtime mode.
			uniques = Array( 30 )
				.fill( {} )
				.map( ( _, i ) => {
					return {
						time: moment()
							.subtract( 30 - i, 'minutes' )
							.toDate(),
						uniques: 0,
						views: 0,
					};
				} );
		} else {
			uniques = Array( 7 )
				.fill( {} )
				.map( ( d, i ) => {
					return {
						time: moment().endOf( 'day' ).subtract( 7, 'days' ).add( i, 'days' ).toDate(),
						uniques: 0,
						views: 0,
					};
				} );
		}
	} else {
		uniques = Object.entries( data?.by_interval || {} ).map( ( [ time, stats ] ) => {
			const date: Date = new Date( time );
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
			setResolution( period.intervals[period.defaultInterval || 0].interval );
		}
	}, [ period, resolution, setResolution ] );

	const dateDomain = extent( uniques, getX ) as [Date, Date];
	if ( resolution.match( 'hour' ) ) {
		dateDomain[1] = moment( dateDomain[1] ).add( 1, 'hours' ).toDate(); // Ensure last data point is not left out by visx.
	}
	const xScale = scaleTime<number>( {
		domain: dateDomain,
	} );
	const yScale = scaleLinear<number>( {
		domain: [
			0,
			Math.max( 4, ( max( uniques, getViews ) as number ) + Math.floor( ( max( uniques, getViews ) as number ) / 6 ) ),
		],
		nice: true,
	} );

	const graphHeight = 250;
	const offsetleft = 150;
	const graphPaddingX = 30;
	const graphPaddingY = 50;
	const outerWidthWithOffset = Math.max( 0, outerWidth - graphHeight );

	xScale.range( [ 0, outerWidthWithOffset ] );
	yScale.range( [ graphHeight, 0 ] );

	const { showTooltip, hideTooltip, tooltipData, tooltipTop = 0, tooltipLeft = 0 } = useTooltip();

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

	// Circle dimensions for the countdown indicator.
	const circleRadius = 8;
	const circleCircumference = 2 * Math.PI * circleRadius;

	return (
		<div className="HeroChart" id="hero-chart">
			{ isRealTime ? (
				<div className="HeroChart__realtime-indicator">
					<svg
						className={ `HeroChart__pulse ${ isLoading ? 'HeroChart__pulse--loading' : '' }` }
						height="24"
						viewBox="0 0 24 24"
						width="24"
					>
						{ /* Background circle */ }
						<circle
							cx="12"
							cy="12"
							fill="none"
							r={ circleRadius }
							stroke="#e5e7eb"
							strokeWidth="2"
						/>
						{ /* Progress circle - animates from full to empty over 30s */ }
						<circle
							key={ refreshKey }
							className="HeroChart__progress-ring"
							cx="12"
							cy="12"
							fill="none"
							r={ circleRadius }
							stroke="#7a00df"
							strokeDasharray={ circleCircumference }
							strokeLinecap="round"
							strokeWidth="2"
							style={ {
								'--circumference': circleCircumference,
							} as React.CSSProperties }
							transform="rotate(-90 12 12)"
						/>
						{ /* Center pulse dot */ }
						<circle
							className="HeroChart__pulse-dot"
							cx="12"
							cy="12"
							fill="#7a00df"
							r="3"
						/>
					</svg>
					<span>{ isLoading ? __( 'Updating...', 'altis' ) : __( 'Realtime', 'altis' ) }</span>
				</div>
			) : (
				<div className={ `HeroChart__loader HeroChart__loader--${ isLoading ? 'loading' : 'loaded' }` }>
					<span className="tailwind">
						<span className="inline-flex items-center gap-1.5">
							<Spinner className="size-3" />
							{ __( 'Fetching data...', 'altis' ) }
						</span>
					</span>
				</div>
			) }
			<div className="HeroChart__controls">
				{ Boolean( data?.stats?.summary?.views ) && (
					<>
						<p>
							{ __( 'Total Views', 'altis' ) }:
							{ ' ' }
							<strong>{ compactMetric( data.stats.summary.views ) }</strong>
							{ ' ' }
							{ __( 'Total Visitors', 'altis' ) }:
							{ ' ' }
							<strong>{ compactMetric( data.stats.summary.visitors ) }</strong>
						</p>
					</>
				) }
				{ Boolean( data?.stats?.summary?.visitors ) && (
					<Tooltip text={ __( 'Percentage of visitors who only viewed a single page', 'altis' ) }>
						<p>
							{ __( 'Bounce Rate', 'altis' ) }:{ ' ' }
							<strong>
								{ compactMetric(
									( ( data?.stats?.summary?.bounce || 0 ) / data.stats.summary.visitors ) * 100,
									'%'
								) }
							</strong>
						</p>
					</Tooltip>
				) }
				{ period.intervals.length > 1 && (
					<div className="tailwind">
						<AnimatedTabs
							options={ period.intervals.map( i => ( {
								value: i.interval,
								label: i.label,
							} ) ) }
							value={ resolution }
							onValueChange={ ( value: string ) => {
								trackEvent( 'Content Explorer', 'Resolution', { type: value } );
								setResolution( value );
							} }
						/>
					</div>
				) }
			</div>
			<svg height={ graphHeight + graphPaddingY * 2 } width="100%">
				<MarkerCircle fill="#333" id="marker-circle" refX={ 2 } size={ 2 } />
				<LinearGradient
					from={ showLoadingState ? '#ccc' : '#7a00df' }
					id="hero-gradient"
					to="rgba( 255, 255, 255, 0 )"
				/>
				<Group
					className={ `HeroChart__group ${ showLoadingState ? 'HeroChart__group--loading' : '' }` }
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
						tickFormat={ ( value: Date | { valueOf(): number } ) => {
							if ( period.value === 'PT30M' ) {
								return moment( value as Date ).fromNow();
							}
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
						width={ outerWidthWithOffset + graphPaddingX * 2 }
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
						curve={ curveMonotoneX }
						data={ uniques }
						shapeRendering="geometricPrecision"
						stroke={ showLoadingState ? '#ccc' : '#7a00df' }
						strokeOpacity={ 1 }
						strokeWidth={ 2 }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d => yScale( getViews( d ) ) ?? 0 }
					/>
					<AreaClosed
						curve={ curveMonotoneX }
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
						curve={ curveMonotoneX }
						data={ uniques }
						opacity={ 0.6 }
						shapeRendering="geometricPrecision"
						stroke={ showLoadingState ? '#ccc' : '#7a00df' }
						strokeDasharray={ 4 }
						strokeOpacity={ 1 }
						strokeWidth={ 2 }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d => yScale( getUniques( d ) ) ?? 0 }
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
									fill="#7a00df"
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
									fill="#7a00df"
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
				{ isLoading ||
					( ( Object.values( data?.by_interval || {} ).length || 0 ) < 1 && (
						<Bar fill="transparent" height={ graphHeight + graphPaddingY } width={ outerWidth } x={ 0 } y={ 0 } />
					) ) }
			</svg>
			{ tooltipData && (
				<div>
					<TooltipWithBounds
						key={ Math.random() }
						className="HeroChart__tooltip"
						left={ tooltipLeft + 6 + offsetleft }
						top={ tooltipTop - 12 }
					>
						{ getTooltip( tooltipData as Datum, resolution, period ) }
					</TooltipWithBounds>
				</div>
			) }
		</div>
	);
}
