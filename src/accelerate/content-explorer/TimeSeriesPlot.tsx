import { AxisBottom, AxisLeft } from '@visx/axis';
import { curveLinear } from '@visx/curve';
import { localPoint } from '@visx/event';
import { LinearGradient } from '@visx/gradient';
import { GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear, scaleUtc } from '@visx/scale';
import { AreaClosed, Bar, LinePath } from '@visx/shape';
import { Text } from '@visx/text';
import { TooltipWithBounds, useTooltip } from '@visx/tooltip';
import { bisector, extent, max } from 'd3-array';
import { ArrowDown, ArrowUp } from 'lucide-react';
import moment from 'moment';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import React, { useCallback, useEffect, useId, useMemo } from 'react';

import { __ } from '@wordpress/i18n';

import { REALTIME_VISIBLE_MINUTES } from '../../data';
import { compactMetric, padLeft, PeriodObject } from '../../utils/admin';

import { Caption, Overline } from '@/components/ui/typography';
import { cn, computeDelta } from '@/lib/utils';

export type TimeSeriesPoint = {
	id: string;
	time: Date;
	value: number;
};

type Props = {
	mode: 'line' | 'bar';
	series: TimeSeriesPoint[];
	comparison?: TimeSeriesPoint[];
	width: number;
	displayNow: number;
	interval: string;
	period: PeriodObject;
	isRealtime: boolean;
	isLoading?: boolean;
	showSkeleton?: boolean;
	showWaiting?: boolean;
};

export const BRAND_COLOR = 'var(--color-brand)';

/**
 * Prior-period line stroke/area — mid gray so a 2px line stays readable
 * against the grid without competing with brand purple current.
 * Bars use PRIOR_BAR_COLOR instead.
 */
export const PRIOR_SERIES_COLOR = '#9ca3af';

/**
 * Prior solid bar (non-stack ghost / grouped total fallback) — light gray so
 * same-day prior pairs sit behind the purple current without looking stark.
 */
export const PRIOR_BAR_COLOR = '#d1d5db';

const GRAPH_HEIGHT = 250;
const OFFSET_LEFT = 70;
const GRAPH_PADDING_X = 30;
const GRAPH_PADDING_Y = 35;
const RIGHT_PADDING = 20;

const getTime = ( point: TimeSeriesPoint ) => point.time;
const getValue = ( point: TimeSeriesPoint ) => point.value;
const bisectDate = bisector<TimeSeriesPoint, Date>( getTime ).left;

function assertSeries( series: TimeSeriesPoint[] ) {
	const ids = new Set<string>();
	series.forEach( point => {
		if ( ! point.id ) {
			throw new Error( 'TimeSeriesPlot requires every point to have a stable id.' );
		}
		if ( ids.has( point.id ) ) {
			throw new Error( `TimeSeriesPlot received duplicate point id "${ point.id }".` );
		}
		if ( ! Number.isFinite( point.time.getTime() ) ) {
			throw new Error( `TimeSeriesPlot received an invalid time for "${ point.id }".` );
		}
		if ( ! Number.isFinite( point.value ) || point.value < 0 ) {
			throw new Error( `TimeSeriesPlot requires a non-negative value for "${ point.id }".` );
		}
		ids.add( point.id );
	} );
}

function formatTick( time: Date, period: PeriodObject, referenceNow: number ) {
	if ( period.value === 'PT30M' ) {
		const diffSec = ( referenceNow - time.getTime() ) / 1000;
		if ( diffSec < 30 ) {
			return 'Now';
		}
		return `${ Math.max( 0, Math.round( diffSec / 60 ) ) }m ago`;
	}
	if ( period.value === 'TODAY' || period.value === 'YESTERDAY' ) {
		return `${ padLeft( time.getUTCHours() ) }:00`;
	}
	return `${ padLeft( time.getUTCDate() ) }.${ padLeft( time.getUTCMonth() + 1 ) }`;
}

export function formatTooltipDate( date: Date, interval: string, period: PeriodObject ) {
	let dateString = moment.utc( date ).format( 'MMM Do' );
	const isoHours = interval.match( /^PT(\d+)H$/ );
	const intervalHours = Number( isoHours ? isoHours[1] : 0 );

	if ( intervalHours === 1 ) {
		dateString = `${ padLeft( date.getUTCHours() ) }:00`;
	} else if ( intervalHours ) {
		const end = moment.utc( date ).add( intervalHours, 'hours' );
		dateString = `${ padLeft( date.getUTCHours() ) }:00 — ${ end.format( 'HH:mm' ) }`;
	} else if ( period.value === 'PT30M' ) {
		dateString = moment.utc( date ).format( 'h:mmA' );
	}

	return dateString;
}

// Tooltip content only — sibling to MetricTile, not a new visual
// language. Reuses MetricTile's exact delta tone mapping (higher views
// is always the "good" direction here, so no toneFor()/higherIsBetter
// param is needed).
function getTooltip(
	point: TimeSeriesPoint,
	comparison: TimeSeriesPoint | undefined,
	interval: string,
	period: PeriodObject
) {
	const dateString = formatTooltipDate( point.time, interval, period );

	if ( ! comparison ) {
		return (
			<div className="tailwind pointer-events-none">
				<div className="min-w-[8rem] rounded-md border border-border bg-popover p-2.5 text-popover-foreground shadow-md">
					<div className="flex items-center justify-between gap-3">
						<Overline className="!m-0">{ __( 'Views', 'altis' ) }</Overline>
						<Caption as="time" className="!m-0" dateTime={ point.time.toISOString() }>{ dateString }</Caption>
					</div>
					<p
						className="!m-0 !mt-0.5 !text-lg !font-semibold !leading-tight !text-foreground tabular-nums"
						data-testid="tooltip-current-value"
					>
						{ compactMetric( point.value ) }
					</p>
				</div>
			</div>
		);
	}

	const delta = computeDelta( point.value, comparison.value );
	const deltaColor = ! delta.hasData || delta.direction === 0
		? 'text-gray-400'
		: delta.direction === 1
			? 'text-emerald-600'
			: 'text-rose-600';
	const Arrow = delta.direction === 1 ? ArrowUp : delta.direction === -1 ? ArrowDown : null;
	const deltaText = ! delta.hasData
		? '—'
		: delta.direction === 0
			? '0%'
			: `${ delta.direction === 1 ? '+' : '-' }${ delta.capped ? '>' : '' }${ delta.pct }%`;
	const priorDateString = formatTooltipDate( comparison.time, interval, period );

	// Comparison card: current → prior total with total delta.
	return (
		<div className="tailwind pointer-events-none">
			<div className="min-w-[10rem] rounded-md border border-border bg-popover p-2.5 text-popover-foreground shadow-md">
				<div className="flex items-center justify-between gap-3">
					<Overline className="!m-0">{ __( 'Current', 'altis' ) }</Overline>
					<Caption as="time" className="!m-0" dateTime={ point.time.toISOString() }>{ dateString }</Caption>
				</div>
				<div className="flex items-start justify-between gap-3">
					<p
						className="!m-0 !mt-0.5 !text-lg !font-semibold !leading-tight !text-foreground tabular-nums"
						data-testid="tooltip-current-value"
					>
						{ compactMetric( point.value ) }
					</p>
					<span
						className={ cn( 'inline-flex shrink-0 items-center gap-1 !text-xs !font-medium tabular-nums', deltaColor ) }
						data-testid="tooltip-change"
					>
						{ Arrow && <Arrow aria-hidden="true" className="!h-3 !w-3" /> }
						{ deltaText }
					</span>
				</div>
				<div className="mt-2 border-t border-border pt-2">
					<div className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="inline-block size-2 shrink-0 rounded-sm"
							style={ { backgroundColor: PRIOR_SERIES_COLOR } }
						/>
						<Overline className="!m-0 !text-gray-500">
							{ __( 'Prior total', 'altis' ) }
						</Overline>
					</div>
					<p
						className="!m-0 !mt-0.5 !text-sm !font-semibold !leading-tight !text-muted-foreground tabular-nums"
						data-testid="tooltip-prior-value"
					>
						{ compactMetric( comparison.value ) }
					</p>
					<Caption
						as="time"
						className="!m-0 !text-[11px] !text-gray-400"
						dateTime={ comparison.time.toISOString() }
					>
						{ priorDateString }
					</Caption>
				</div>
			</div>
		</div>
	);
}

/**
 * Pure chart rendering. In realtime, displayNow advances the line domain;
 * band geometry and labels deliberately use only the discrete series snapshot.
 */
export function TimeSeriesPlot( {
	mode,
	series,
	comparison,
	width,
	displayNow,
	interval,
	period,
	isRealtime,
	isLoading = false,
	showSkeleton = false,
	showWaiting = false,
}: Props ) {
	assertSeries( series );
	const comparisonSeries = useMemo( () => comparison?.slice( 0, series.length ) || [], [ comparison, series.length ] );
	assertSeries( comparisonSeries );
	const reduced = useReducedMotion();
	const instanceId = useId().replace( /:/g, '' );
	const gradientId = `hero-gradient-${ instanceId }`;
	const clipId = `hero-plot-clip-${ instanceId }`;
	const plotWidth = Math.max( 0, width - OFFSET_LEFT - RIGHT_PADDING );
	const sortedSeries = useMemo(
		() => [ ...series ].sort( ( a, b ) => a.time.getTime() - b.time.getTime() ),
		[ series ]
	);
	const comparisonPairs = useMemo(
		() => comparisonSeries.map( ( point, index ) => ( {
			current: series[ index ],
			prior: point,
		} ) ),
		[ comparisonSeries, series ]
	);
	const sortedComparisonPairs = useMemo(
		() => [ ...comparisonPairs ].sort( ( a, b ) => a.current.time.getTime() - b.current.time.getTime() ),
		[ comparisonPairs ]
	);
	const hasComparison = comparisonPairs.length > 0;

	const lineDateDomain = useMemo( () => {
		const fallbackEnd = new Date( displayNow );
		const fallbackStart = new Date( displayNow - 60 * 60 * 1000 );
		const domain = extent( sortedSeries, getTime ) as [ Date | undefined, Date | undefined ];
		let start = domain[ 0 ] ?? fallbackStart;
		let end = domain[ 1 ] ?? fallbackEnd;
		if ( interval.match( /PT\d+H/ ) || interval.match( /\d+ hour/ ) ) {
			end = moment( end ).add( 1, 'hours' ).toDate();
		}
		if ( start.getTime() === end.getTime() ) {
			end = new Date( end.getTime() + 60 * 60 * 1000 );
		}
		if ( isRealtime ) {
			const visibleWindowMs = REALTIME_VISIBLE_MINUTES * 60 * 1000;
			start = new Date( displayNow - visibleWindowMs );
			end = new Date( displayNow );
		}
		return [ start, end ] as [ Date, Date ];
	}, [ displayNow, interval, isRealtime, sortedSeries ] );

	const xTimeScale = useMemo( () => scaleUtc<number>( {
		domain: lineDateDomain,
		range: [ 0, plotWidth ],
	} ), [ lineDateDomain, plotWidth ] );
	const xBandScale = useMemo( () => scaleBand<string>( {
		domain: series.map( point => point.id ),
		padding: series.length > 1 ? 0.2 : 0.35,
		range: [ 0, plotWidth ],
	} ), [ plotWidth, series ] );

	const maxValue = max( series, getValue ) ?? 0;
	const comparisonMaxValue = max( comparisonSeries, getValue ) ?? 0;
	const yDomainMax = Math.max( maxValue, comparisonMaxValue );
	const yMax = Math.max( 4, yDomainMax + Math.floor( yDomainMax / 6 ) );
	const yScale = useMemo( () => scaleLinear<number>( {
		domain: [ 0, yMax ],
		nice: true,
		range: [ GRAPH_HEIGHT, 0 ],
	} ), [ yMax ] );

	const barReferenceNow = displayNow;
	// Shared x-axis ticks for line and bar: even sample of real data buckets so
	// switching presentation doesn't jump labels (line used to use d3 "nice"
	// time ticks on scaleUtc, which picked different dates than the band axis).
	const xAxisTickPoints = useMemo( () => {
		const tickCount = Math.min( isRealtime ? 5 : 7, sortedSeries.length );
		if ( tickCount === 0 ) {
			return [] as TimeSeriesPoint[];
		}
		if ( tickCount === 1 ) {
			return [ sortedSeries[ 0 ] ];
		}
		return Array.from( { length: tickCount }, ( _, index ) => {
			const seriesIndex = Math.round( index * ( sortedSeries.length - 1 ) / ( tickCount - 1 ) );
			return sortedSeries[ seriesIndex ];
		} );
	}, [ isRealtime, sortedSeries ] );
	const barTickIds = useMemo(
		() => xAxisTickPoints.map( point => point.id ),
		[ xAxisTickPoints ]
	);
	const lineTickTimes = useMemo(
		() => xAxisTickPoints.map( point => point.time ),
		[ xAxisTickPoints ]
	);
	const pointsById = useMemo(
		() => new Map( series.map( point => [ point.id, point ] ) ),
		[ series ]
	);
	const comparisonByCurrentId = useMemo(
		() => new Map( comparisonPairs.map( pair => [ pair.current.id, pair.prior ] ) ),
		[ comparisonPairs ]
	);
	const {
		showTooltip,
		hideTooltip,
		tooltipData: tooltipPointId,
	} = useTooltip<string>();
	const tooltipPoint = tooltipPointId ? pointsById.get( tooltipPointId ) : undefined;
	const tooltipComparison = tooltipPoint ? comparisonByCurrentId.get( tooltipPoint.id ) : undefined;

	useEffect( () => {
		if ( tooltipPointId && ! tooltipPoint ) {
			hideTooltip();
		}
	}, [ hideTooltip, tooltipPoint, tooltipPointId ] );

	const handleTooltip = useCallback( (
		event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>
	) => {
		const point = localPoint( event );
		if ( ! point || series.length === 0 ) {
			hideTooltip();
			return;
		}
		const plotX = point.x - OFFSET_LEFT;
		if ( plotX < 0 || plotX > plotWidth ) {
			hideTooltip();
			return;
		}

		let selected: TimeSeriesPoint | undefined;
		if ( mode === 'bar' ) {
			const bandwidth = xBandScale.bandwidth();
			selected = series.find( candidate => {
				const x = xBandScale( candidate.id );
				return x !== undefined && plotX >= x && plotX <= x + bandwidth;
			} );
		} else {
			const time = xTimeScale.invert( plotX );
			const index = bisectDate( sortedSeries, time, 1 );
			const before = sortedSeries[ index - 1 ];
			const after = sortedSeries[ index ];
			selected = ! before
				? after
				: ! after
					? before
					: time.valueOf() - before.time.valueOf() > after.time.valueOf() - time.valueOf()
						? after
						: before;
		}

		if ( ! selected ) {
			hideTooltip();
			return;
		}
		showTooltip( { tooltipData: selected.id } );
	}, [ hideTooltip, mode, plotWidth, series, showTooltip, sortedSeries, xBandScale, xTimeScale ] );

	const tooltipLeft = tooltipPoint
		? mode === 'bar'
			? ( xBandScale( tooltipPoint.id ) ?? 0 ) + xBandScale.bandwidth() / 2
			: xTimeScale( tooltipPoint.time )
		: 0;
	const tooltipTop = tooltipPoint ? yScale( tooltipPoint.value ) : 0;
	const lastPoint = sortedSeries[ sortedSeries.length - 1 ] ?? null;
	const lastDotX = lastPoint ? xTimeScale( lastPoint.time ) : null;
	const lastDotY = lastPoint ? yScale( lastPoint.value ) : null;
	const showDot = mode === 'line' &&
		isRealtime &&
		lastPoint !== null &&
		Number.isFinite( lastDotX ) &&
		Number.isFinite( lastDotY );
	const barTransition = reduced
		? { duration: 0 }
		: {
			duration: 0.2,
			ease: [ 0.2, 0, 0, 1 ] as [ number, number, number, number ],
		};

	return (
		<>
			<svg data-chart-mode={ mode } height={ GRAPH_HEIGHT + GRAPH_PADDING_Y * 2 } width="100%">
				<LinearGradient
					from={ isLoading ? '#ccc' : BRAND_COLOR }
					id={ gradientId }
					to="rgba( 255, 255, 255, 0 )"
				/>
				<Group
					className={ `HeroChart__group ${ isLoading ? 'HeroChart__group--loading' : '' }` }
					height={ GRAPH_HEIGHT + GRAPH_PADDING_Y }
					left={ OFFSET_LEFT }
					top={ GRAPH_PADDING_Y / 2 }
					onMouseLeave={ hideTooltip }
				>
					{ ! showSkeleton && mode === 'line' && (
						<AxisBottom
							hideAxisLine
							hideTicks
							scale={ xTimeScale }
							tickFormat={ value => formatTick( new Date( value.valueOf() ), period, displayNow ) }
							tickLabelProps={ () => ( {
								verticalAnchor: 'middle',
								textAnchor: 'middle',
								fontSize: 11,
								style: { textTransform: 'uppercase' },
								fill: '#777',
							} ) }
							tickValues={ lineTickTimes }
							top={ GRAPH_HEIGHT + 10 }
						/>
					) }
					{ ! showSkeleton && mode === 'bar' && (
						<AxisBottom
							hideAxisLine
							hideTicks
							scale={ xBandScale }
							tickFormat={ id => {
								const point = pointsById.get( String( id ) );
								return point ? formatTick( point.time, period, barReferenceNow ) : '';
							} }
							tickLabelProps={ () => ( {
								verticalAnchor: 'middle',
								textAnchor: 'middle',
								fontSize: 11,
								style: { textTransform: 'uppercase' },
								fill: '#777',
							} ) }
							tickValues={ barTickIds }
							top={ GRAPH_HEIGHT + 10 }
						/>
					) }
					{ ! showSkeleton && (
						<>
							<AxisLeft
								hideAxisLine
								hideTicks
								hideZero
								left={ -GRAPH_PADDING_X }
								numTicks={ 4 }
								scale={ yScale }
								tickFormat={ value => compactMetric( value as number ) }
								tickLabelProps={ () => ( {
									verticalAnchor: 'middle',
									textAnchor: 'end',
									fontSize: 11,
									fill: '#777',
								} ) }
							/>
							<GridRows
								left={ -GRAPH_PADDING_X }
								numTicks={ 4 }
								scale={ yScale }
								stroke="rgba( 0, 0, 0, .2 )"
								width={ plotWidth + GRAPH_PADDING_X * 2 }
							/>
						</>
					) }
					<defs>
						<clipPath id={ clipId }>
							<rect height={ GRAPH_HEIGHT + GRAPH_PADDING_Y } width={ plotWidth } x={ 0 } y={ 0 } />
						</clipPath>
					</defs>
					<g clipPath={ `url(#${ clipId })` }>
						{ mode === 'line' ? (
							<>
								{ hasComparison && (
									<>
										<AreaClosed
											curve={ curveLinear }
											data={ sortedComparisonPairs }
											fill={ isLoading ? '#ccc' : PRIOR_SERIES_COLOR }
											opacity={ 0.12 }
											shapeRendering="geometricPrecision"
											strokeWidth={ 0 }
											x={ pair => xTimeScale( pair.current.time ) ?? 0 }
											y={ pair => yScale( pair.prior.value ) ?? 0 }
											yScale={ yScale }
										/>
										<LinePath
											curve={ curveLinear }
											data={ sortedComparisonPairs }
											data-comparison-line="true"
											shapeRendering="geometricPrecision"
											stroke={ isLoading ? '#ccc' : PRIOR_SERIES_COLOR }
											strokeOpacity={ 0.85 }
											strokeWidth={ 2 }
											x={ pair => xTimeScale( pair.current.time ) ?? 0 }
											y={ pair => yScale( pair.prior.value ) ?? 0 }
										/>
									</>
								) }
								<LinePath
									curve={ curveLinear }
									data={ sortedSeries }
									shapeRendering="geometricPrecision"
									stroke={ isLoading ? '#ccc' : BRAND_COLOR }
									strokeOpacity={ 1 }
									strokeWidth={ 2 }
									x={ point => xTimeScale( point.time ) ?? 0 }
									y={ point => yScale( point.value ) ?? 0 }
								/>
								<AreaClosed
									curve={ curveLinear }
									data={ sortedSeries }
									fill={ `url(#${ gradientId })` }
									opacity={ 0.3 }
									shapeRendering="geometricPrecision"
									strokeOpacity={ 1 }
									strokeWidth={ 0 }
									x={ point => xTimeScale( point.time ) ?? 0 }
									y={ point => yScale( point.value ) ?? 0 }
									yScale={ yScale }
								/>
								{ showDot && (
									<motion.circle
										key={ lastPoint.id }
										animate={ {
											opacity: 1,
											scale: 1,
										} }
										cx={ lastDotX as number }
										cy={ lastDotY as number }
										fill={ BRAND_COLOR }
										initial={ reduced ? false : {
											opacity: 0,
											scale: 0.4,
										} }
										r={ 3 }
										style={ { transformOrigin: `${ lastDotX as number }px ${ lastDotY as number }px` } }
										transition={ {
											duration: 0.5,
											ease: [ 0.2, 0, 0, 1 ],
										} }
									/>
								) }
							</>
						) : (
							<>
								{ /* Prior period bars render as a gray ghost behind the
								    current solid bar. */ }
								{ comparisonPairs.map( pair => {
									const bandX = xBandScale( pair.current.id ) ?? 0;
									const bandWidth = xBandScale.bandwidth();
									const y = comparisonMaxValue === 0 ? GRAPH_HEIGHT : yScale( pair.prior.value );
									const height = Math.max( 0, GRAPH_HEIGHT - y );
									return (
										<rect
											key={ pair.current.id }
											data-comparison-bucket-id={ pair.current.id }
											data-comparison-layout="ghost"
											data-prior-time={ pair.prior.time.toISOString() }
											fill={ isLoading ? '#ccc' : PRIOR_BAR_COLOR }
											fillOpacity={ 0.85 }
											height={ height }
											rx={ 1 }
											width={ bandWidth }
											x={ bandX }
											y={ y }
										/>
									);
								} ) }
								<AnimatePresence initial={ false }>
									{ series.map( point => {
										const bandX = xBandScale( point.id ) ?? 0;
										const bandWidth = xBandScale.bandwidth();
										const barWidth = hasComparison ? bandWidth * 0.7 : bandWidth;
										const x = bandX + ( hasComparison ? bandWidth * 0.15 : 0 );
										const transformOrigin = `${ x + barWidth / 2 }px ${ GRAPH_HEIGHT }px`;

										const y = maxValue === 0 ? GRAPH_HEIGHT : yScale( point.value );
										const height = Math.max( 0, GRAPH_HEIGHT - y );
										return (
											<motion.rect
												key={ point.id }
												animate={ {
													x,
													y,
													width: barWidth,
													height,
													opacity: 1,
													scaleY: 1,
												} }
												data-bucket-id={ point.id }
												exit={ reduced ? { opacity: 0 } : {
													opacity: 0,
													scaleY: 0.8,
												} }
												fill={ isLoading ? '#ccc' : BRAND_COLOR }
												initial={ reduced ? false : {
													opacity: 0,
													scaleY: 0.8,
												} }
												rx={ 1 }
												style={ { transformOrigin } }
												transition={ barTransition }
											/>
										);
									} ) }
								</AnimatePresence>
							</>
						) }
						{ tooltipPoint && (
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
									fill={ BRAND_COLOR }
									pointerEvents="none"
									r={ 4 }
									stroke="white"
									strokeWidth={ 2 }
								/>
							</g>
						) }
					</g>
					<Bar
						data-tooltip-hit-area="true"
						fill="transparent"
						height={ GRAPH_HEIGHT }
						width={ plotWidth }
						x={ 0 }
						y={ 0 }
						onMouseLeave={ hideTooltip }
						onMouseMove={ handleTooltip }
						onTouchEnd={ hideTooltip }
						onTouchMove={ handleTooltip }
						onTouchStart={ handleTooltip }
					/>
					{ showWaiting && (
						<Text
							className="HeroChart__waiting"
							fill="#7d7d7d"
							fontSize={ 32 }
							textAnchor="middle"
							verticalAnchor="middle"
							width={ 400 }
							x={ plotWidth / 2 - GRAPH_PADDING_X }
							y={ GRAPH_HEIGHT / 2 - 30 }
						>
							{ __( '👋 We’re collecting data, check back soon!', 'altis' ) }
						</Text>
					) }
				</Group>
			</svg>
			{ /* `unstyled` drops visx's inline defaults (white background, its own */ }
			{ /* radius and shadow) which otherwise paint a square card behind our */ }
			{ /* rounded one. `applyPositionStyle` restores the absolute */ }
			{ /* positioning those defaults were also providing. */ }
			{ tooltipPoint && (
				<TooltipWithBounds
					applyPositionStyle
					className="HeroChart__tooltip"
					left={ tooltipLeft + 6 + OFFSET_LEFT }
					top={ tooltipTop - 12 }
					unstyled
				>
					{ getTooltip( tooltipPoint, tooltipComparison, interval, period ) }
				</TooltipWithBounds>
			) }
		</>
	);
}
