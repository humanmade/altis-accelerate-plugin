import React, { useCallback, useState, useEffect } from 'react';
import { __, _n } from '@wordpress/i18n';
import moment from 'moment';

import { __experimentalRadioGroup as RadioGroup, __experimentalRadio as Radio, Tooltip } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { extent, max, bisector } from 'd3-array';
import { curveMonotoneX } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import { GridRows, GridColumns } from '@visx/grid';
import { LinePath, AreaClosed, Bar } from '@visx/shape';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { scaleLinear, scaleTime } from '@visx/scale';
import { MarkerCircle } from '@visx/marker';
import { Text } from '@visx/text';
import { TooltipWithBounds, useTooltip } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { periods } from '../../data/periods';
import { compactMetric, Duration, padLeft, StatsResult, trackEvent } from '../../utils/admin';

import Loading from '../components/Loading';
import { usePersistentState } from '../../data/hooks';

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

export default function HeroChart( props: Props ) {
	const {
		period: periodKey,
	} = props;

	const period = periods.find( p => p.value === periodKey ) || periods[0];

	// Get stats data.
	const [ outerWidth, setOuterWidth ] = useState<number>( 0 );
	const [ resolution, setResolution ] = usePersistentState<string>( 'hero-chart-resolution', period.intervals[ period.defaultInterval || 0 ].interval );
	const data = useSelect<StatsResult>( select => {
		return select( 'accelerate' ).getStats( {
			period: period.value || 'P7D',
			interval: resolution || period.intervals[ period.defaultInterval || 0 ].interval || '1 day',
		} );
	}, [ period, resolution ] );
	const isLoading = useSelect<StatsResult>( select => {
		return select( 'accelerate' ).getIsLoadingStats();
	}, [ data ] );

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
	}, [ period, resolution ] );

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
		[ showTooltip, yScale, xScale ],
	);

	return (
		<div className="HeroChart" id="hero-chart">
			<div className={ `HeroChart__loader HeroChart__loader--${ isLoading ? 'loading' : 'loaded' }` }>
				<Loading
					svgProps={ {
						width: 32,
						height: 32,
					} }
					pathProps={ {
						strokeWidth: 12,
					} }
				/>
				{ ' ' }
				<span>{ __( 'Fetching data...', 'altis' ) }</span>
			</div>
			<div className="HeroChart__controls">
				{ data?.stats?.summary?.visitors && (
					<Tooltip text={ __( 'Percentage of visitors who only viewed a single page', 'altis' ) }>
						<p>
							{ __( 'Bounce Rate', 'altis' ) }:
							{ ' ' }
							<strong>{ compactMetric( ( ( data?.stats?.summary?.bounce || 0 ) / data.stats.summary.visitors ) * 100, '%' ) }</strong>
						</p>
					</Tooltip>
				) }
				<div className="radio-group">
					<RadioGroup
						label='Period'
						checked={ resolution }
						onChange={ ( value: string ) => {
							trackEvent( 'Content Explorer', 'Resolution', { type: value } );
							setResolution( value );
						} }
					>
						{ period.intervals.map( i => (
							<Radio
								checked={ i.interval === resolution }
								key={ i.interval }
								value={ i.interval }
							>
								{ i.label }
							</Radio>
						) ) }
					</RadioGroup>
				</div>
			</div>
			<svg width="100%" height={ graphHeight + ( graphPaddingY * 2 ) }>
				<MarkerCircle id="marker-circle" fill="#333" size={ 2 } refX={ 2 } />
				<LinearGradient
					from={ isLoading ? '#ccc' : '#4667de' }
					to="rgba( 255, 255, 255, 0 )"
					id="hero-gradient"
				/>
				<Group
					className={ `HeroChart__group ${ isLoading ? 'HeroChart__group--loading' : '' }` }
					left={ offsetleft }
					top={ graphPaddingY / 2 }
					height={ graphHeight + graphPaddingY }
					onMouseLeave={ () => hideTooltip() }
				>
					<AxisBottom
						hideAxisLine={ true }
						hideTicks={ true }
						scale={ xScale }
						top={ graphHeight + 10 }
						numTicks={ 7 }
						tickLabelProps={ () => ( {
							verticalAnchor: 'middle',
							textAnchor: 'middle',
							fontSize: 11,
							style: { textTransform: 'uppercase' },
							fill: '#777',
						} ) }
						tickFormat={ value => {
							const date = new Date( value as Date );
							return `${ padLeft( date.getDate() ) }.${ padLeft( date.getMonth() + 1 ) }`;
						} }
					/>
					<AxisLeft
						hideAxisLine={ true }
						hideTicks={ true }
						hideZero={ true }
						scale={ yScale }
						left={ -graphPaddingX }
						numTicks={ 4 }
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
						tickLabelProps={ () => ( {
							verticalAnchor: 'middle',
							textAnchor: 'end',
							fontSize: 11,
							fill: '#777',
						} ) }
						tickFormat={ value => {
							return compactMetric( value as number );
						} }
					/>
					<GridRows
						scale={ yScale }
						stroke="rgba( 0, 0, 0, .2 )"
						width={ outerWidthWithOffset + ( graphPaddingX * 2 ) }
						numTicks={ 4 }
						left={ -graphPaddingX }
					/>

					{/* <AreaClosed
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
					/> */}
					<LinePath
						curve={ curveMonotoneX }
						data={ uniques }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d  => yScale( getViews( d ) ) ?? 0 }
						stroke={ isLoading ? '#ccc' : '#4667de' }
						strokeWidth={ 2 }
						strokeOpacity={ 1 }
						shapeRendering="geometricPrecision"
					/>
					<AreaClosed
						curve={ curveMonotoneX }
						data={ uniques }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d => yScale( getViews( d ) ) ?? 0 }
						yScale={ yScale }
						strokeWidth={ 0 }
						strokeOpacity={ 1 }
						shapeRendering="geometricPrecision"
						fill="url(#hero-gradient)"
						opacity={ 0.3 }
					/>

					{/* <AreaClosed
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
					/> */}
					<LinePath
						curve={ curveMonotoneX }
						data={ uniques }
						x={ d => xScale( getX( d ) ) ?? 0 }
						y={ d  => yScale( getUniques( d ) ) ?? 0 }
						stroke={ isLoading ? '#ccc' : '#4667de' }
						strokeDasharray={ 4 }
						strokeWidth={ 2 }
						strokeOpacity={ 1 }
						shapeRendering="geometricPrecision"
						opacity={ 0.6 }
					/>

					<Bar
						x={ 0 }
						y={ 0 }
						width={ outerWidthWithOffset }
						height={ graphHeight }
						fill="transparent"
						onMouseLeave={ () => hideTooltip() }
					/>
					<GridColumns
						scale={ xScale }
						x={ 0 }
						y={ 0 }
						width={ outerWidthWithOffset }
						height={ graphHeight }
						stroke="transparent"
						strokeWidth={ outerWidthWithOffset / uniques.length }
						fill="transparent"
						numTicks={ uniques.length }
						onTouchStart={ handleTooltip }
						onTouchMove={ handleTooltip }
						onMouseMove={ handleTooltip }
					/>
					{ tooltipData && (
						<>
							<g>
								<circle
									cx={ tooltipLeft }
									cy={ tooltipTop + 1 }
									r={ 4 }
									fill="black"
									fillOpacity={ 0.1 }
									stroke="black"
									strokeOpacity={ 0.1 }
									strokeWidth={ 2 }
									pointerEvents="none"
								/>
								<circle
									cx={ tooltipLeft }
									cy={ tooltipTop }
									r={ 4 }
									fill="#4667de"
									stroke="white"
									strokeWidth={ 2 }
									pointerEvents="none"
								/>
							</g>
							<g>
								<circle
									cx={ tooltipLeft }
									cy={ yScale( getUniques( tooltipData ) ) + 1 }
									r={ 4 }
									fill="black"
									fillOpacity={ 0.1 }
									stroke="black"
									strokeOpacity={ 0.1 }
									strokeWidth={ 2 }
									pointerEvents="none"
								/>
								<circle
									cx={ tooltipLeft }
									cy={ yScale( getUniques( tooltipData ) ) }
									r={ 4 }
									fill="#4667de"
									stroke="white"
									strokeWidth={ 2 }
									pointerEvents="none"
								/>
							</g>
						</>
					) }
					{ !! data?.by_interval && ( Object.values( data.by_interval ).length || 0 ) < 1 && (
						<Text
							className="HeroChart__waiting"
							verticalAnchor="middle"
							textAnchor="middle"
							width={ 400 }
							y={ graphHeight / 2 - 30 }
							x={ outerWidthWithOffset / 2 - graphPaddingX }
							fontSize={ 32 }
							fill="#7d7d7d"
						>
							{ __( '👋 We’re collecting data, check back soon!', 'altis' ) }
						</Text>
					) }
				</Group>
				{ isLoading || ( Object.values( data?.by_interval || {} ).length || 0 ) < 1 && (
					<Bar
						x={ 0 }
						y={ 0 }
						width={ outerWidth }
						height={ graphHeight + graphPaddingY }
						fill="transparent"
					/>
				) }
			</svg>
			{ tooltipData && (
				<div>
					<TooltipWithBounds
						key={ Math.random() }
						top={ tooltipTop - 12 }
						left={ tooltipLeft + 6 + offsetleft }
					>
						{ getTooltip( tooltipData as Datum, resolution ) }
					</TooltipWithBounds>
				</div>
			) }
		</div>
	)
}
