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
import { motion, useReducedMotion } from 'motion/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { useSelect } from '@wordpress/data';
import { __, _n } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';

import { resolveCurrentRealtimeWindow, resolvePriorPeriod } from '../../data';
import { usePersistentState } from '../../data/hooks';
import { periods } from '../../data/periods';
import { compactMetric, Duration, padLeft, PeriodObject, StatsResult, trackEvent } from '../../utils/admin';

import { EmptyState } from '@/components/EmptyState';
import { MetricTile, DeltaTone } from '@/components/MetricTile';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { computeDelta, Delta } from '@/lib/utils';

type Props = {
	period: Duration;
	// Bumped by the parent on each realtime refresh; included in the
	// stats request so the resolver invalidates its cache.
	realtimeTick?: number;
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

// Formatters used in the metric strip. Module-level so they don't
// reallocate per render.
const numberFormat = new Intl.NumberFormat();
const formatCount = ( value: number ) => {
	if ( value < 1000 ) {
		return numberFormat.format( value );
	}
	if ( value < 1_000_000 ) {
		return `${ ( value / 1000 ).toFixed( value < 10_000 ? 1 : 0 ) }k`;
	}
	return `${ ( value / 1_000_000 ).toFixed( 1 ) }M`;
};
const formatRatio = ( v: number ) => v.toFixed( 1 );
const formatPercent = ( v: number ) => `${ Math.round( v ) }%`;

// Direction-of-good map: higher = better for visitors/views/ratio,
// higher = worse for bounce. Tone is derived from the delta direction
// crossed with this — see toneFor() below.
function toneFor( higherIsBetter: boolean, delta?: Delta ): DeltaTone {
	if ( ! delta || ! delta.hasData || delta.direction === 0 ) {
		return 'neutral';
	}
	const good = higherIsBetter ? delta.direction === 1 : delta.direction === -1;
	return good ? 'positive' : 'negative';
}

const getTooltip = ( data : Datum, interval : string, period: PeriodObject ) => {
	const date = getX( data );
	let dateString = moment( date ).format( 'MMM Do' );

	// PT1H → 1, PT6H → 6, etc.
	const isoHours = interval.match( /^PT(\d+)H$/ );
	let intervalHours = Number( isoHours ? isoHours[1] : 0 );

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
			<small>
				<time dateTime={ date.toISOString() }>{ `${ dateString }` }</time>
			</small>
		</span>
	);
};

type PriorSummary = {
	visitors: number;
	views: number;
	bounce: number;
} | null;

// Realtime current-window summary fetcher. The shared chart fetch
// returns a 30-min summary (PT30M), but the chart visually shows the
// last 15min. For the strip to compare apples-to-apples against the
// prior 15min, this hook fetches the last-15min summary separately.
// Returns null outside of realtime — callers fall back to the chart's
// existing 30min summary.
function useRealtimeCurrentSummary( isRealtime: boolean, tick: number ): PriorSummary {
	const [ summary, setSummary ] = useState<PriorSummary>( null );
	const lastRef = React.useRef<PriorSummary>( null );
	useEffect( () => {
		if ( ! isRealtime ) {
			setSummary( null );
			lastRef.current = null;
			return;
		}
		const win = resolveCurrentRealtimeWindow();
		let cancelled = false;
		apiFetch<StatsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats', {
				start: win.start.toISOString(),
				end: win.end.toISOString(),
				interval: win.interval,
			} ),
		} ).then(
			value => {
				if ( cancelled ) {
					return;
				}
				const s = value?.stats?.summary;
				const next = {
					visitors: s?.visitors ?? 0,
					views: s?.views ?? 0,
					bounce: s?.bounce ?? 0,
				};
				lastRef.current = next;
				setSummary( next );
			},
			() => {
				// On error keep the last good value so the strip doesn't flash to 0.
				if ( ! cancelled ) {
					setSummary( lastRef.current );
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [ isRealtime, tick ] );
	return summary;
}

// Prior-period summary fetcher. Returns `null` when the period has no
// meaningful prior (PT30M) or while loading/erroring — consumers render
// neutral em-dashes in those cases. Keyed on period.value so a period
// change discards the in-flight response. Refetches when `tick`
// increments (the parent's realtime-tick prop).
function usePriorSummary( periodValue: Duration, tick: number ): PriorSummary {
	const [ summary, setSummary ] = useState<PriorSummary>( null );
	const lastPeriodRef = React.useRef<Duration | null>( null );
	useEffect( () => {
		const prior = resolvePriorPeriod( periodValue );
		if ( ! prior ) {
			setSummary( null );
			lastPeriodRef.current = null;
			return;
		}
		let cancelled = false;
		// Only reset to null on period change, not on realtime tick — keeps
		// delta arrows visible while the new summary is fetching.
		if ( lastPeriodRef.current !== periodValue ) {
			setSummary( null );
			lastPeriodRef.current = periodValue;
		}
		apiFetch<StatsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats', {
				start: prior.start.toISOString(),
				end: prior.end.toISOString(),
				interval: prior.interval,
			} ),
		} ).then(
			value => {
				if ( cancelled ) {
					return;
				}
				const s = value?.stats?.summary;
				setSummary( {
					visitors: s?.visitors ?? 0,
					views: s?.views ?? 0,
					bounce: s?.bounce ?? 0,
				} );
			},
			() => {
				// Swallow: prior is best-effort; tile falls back to neutral.
				if ( ! cancelled ) {
					setSummary( null );
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [ periodValue, tick ] );
	return summary;
}

export default function HeroChart( props: Props ) {
	const { period: periodKey, realtimeTick = 0 } = props;

	const period = periods.find( p => p.value === periodKey ) || periods[0];

	// Get stats data.
	const [ outerWidth, setOuterWidth ] = useState<number>( 0 );
	const [ resolution, setResolution ] = usePersistentState<string>( 'hero-chart-resolution', period.intervals[ period.defaultInterval || 0 ].interval );

	const isRealTime = period.value === 'PT30M';

	// In realtime mode the chart's right edge tracks wall-clock "now" via
	// a rAF loop. This is what makes the line continuously drift left:
	// each frame, the scale's max time advances by ~16ms, so every data
	// point (whose time is fixed) appears slightly further left than the
	// previous frame. ~10fps (every 100ms) is plenty smooth visually and
	// keeps the cost down. Non-realtime modes don't tick — they stay at
	// initial-mount time and only update on data ticks.
	const [ displayNow, setDisplayNow ] = useState( () => Date.now() );
	useEffect( () => {
		if ( ! isRealTime ) {
			return;
		}
		let rafId = 0;
		let last = 0;
		const loop = ( ts: number ) => {
			// Throttle to ~10fps — enough for smooth perception, far less
			// CPU than running the visx render at 60fps for 30 minutes.
			if ( ts - last >= 100 ) {
				last = ts;
				setDisplayNow( Date.now() );
			}
			rafId = requestAnimationFrame( loop );
		};
		rafId = requestAnimationFrame( loop );
		return () => cancelAnimationFrame( rafId );
	}, [ isRealTime ] );

	const data = useSelect<StatsResult>( select => {
		let chosen_resolution = resolution;
		// The `resolution` may be persistend state that is not a valid resolution for the current period.
		if ( resolution && period.intervals.map( i => i.interval ).indexOf( resolution ) === -1 ) {
			chosen_resolution = period.intervals[ period.defaultInterval || 0 ].interval;
		}
		return select( 'accelerate' ).getStats( {
			period: period.value || 'P7D',
			interval: chosen_resolution || period.intervals[ period.defaultInterval || 0 ].interval || 'P1D',
			// Only include `time` when non-zero so non-realtime periods share
			// the same cache key as List.tsx and deduplicate the request.
			// When realtime-ticking, realtimeTick > 0 forces a fresh fetch.
			...( realtimeTick > 0 ? { time: realtimeTick } : {} ),
		} );
	}, [ period, resolution, realtimeTick ] );
	const isLoading = useSelect<StatsResult>( select => {
		return select( 'accelerate' ).getIsLoadingStats();
	}, [ data ] );
	const statsError = useSelect<string | null>( select => {
		return select( 'accelerate' ).getStatsError();
	}, [ isLoading ] );

	// Stale-while-revalidate: hold the last good payload across realtime
	// refetches so the chart can interpolate between snapshots instead of
	// blanking to the empty fallback whenever the cache key bumps. Keyed
	// by period+resolution so a switch to a different window doesn't
	// show the previous window's data while fetching.
	const swrKey = `${ period.value || '' }:${ resolution }`;
	const lastDataRef = useRef<StatsResult | undefined>( undefined );
	const lastDataKeyRef = useRef<string>( '' );
	if ( data && Object.values( data?.by_interval || {} ).length > 0 ) {
		lastDataRef.current = data;
		lastDataKeyRef.current = swrKey;
	}
	const effectiveData = data && Object.values( data?.by_interval || {} ).length > 0
		? data
		: ( lastDataKeyRef.current === swrKey ? lastDataRef.current : undefined );

	// eslint-disable-next-line react-hooks/exhaustive-deps
	let uniques: Datum[] = [];
	const hasData = Object.values( effectiveData?.by_interval || {} ).length > 0;
	// Don't show loading state visuals during realtime refresh when we already have data.
	const showLoadingState = isLoading && ! ( isRealTime && hasData );
	// True only on the first load before any data arrives — used to suppress chart
	// axes/grid while the skeleton overlay is visible. showLoadingState is too broad
	// here (it's also true during background refreshes with existing data).
	const showChartSkeleton = ! hasData && isLoading;
	// Only show placeholder when there's no data yet. During realtime refresh, keep showing existing data.
	if ( ! hasData ) {
		if ( isRealTime ) {
			// Empty-state placeholder for the realtime view: 15 zero
			// buckets so the chart silhouette matches the visible
			// window above (15 min). Once real data lands, the older
			// 15 minutes of data are still fetched but clip off-screen.
			uniques = Array( 15 )
				.fill( {} )
				.map( ( _, i ) => {
					return {
						time: moment()
							.subtract( 15 - i, 'minutes' )
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
		const dateNow = new Date( displayNow );
		uniques = Object.entries( effectiveData?.by_interval || {} ).map( ( [ time, stats ] ) => {
			const date: Date = new Date( time.replace( ' ', 'T' ) + 'Z' );
			return {
				time: date < dateNow ? date : dateNow,
				uniques: stats?.visitors || 0,
				views: stats?.views || 0,
			};
		} );
		// Realtime drops everything older than the visible window. We
		// fetch 30 minutes but only show the last 5; without this
		// trim, visx draws the off-screen-left buckets and the line
		// + gradient bleed past the y-axis gutter. One extra bucket
		// of margin keeps the leftmost segment landing cleanly on
		// the chart edge as it scrolls off.
		if ( isRealTime ) {
			const visibleStart = displayNow - ( 15 * 60 * 1000 ) - ( 60 * 1000 );
			uniques = uniques.filter( d => d.time.getTime() >= visibleStart );
			// Anchor the newest bucket to displayNow so it always sits
			// at the right edge — its value pulses up as the current
			// minute fills, instead of the whole point drifting left
			// until a new bucket pops in further right. On bucket
			// rollover the previously-anchored point reverts to its
			// real time and snaps into its true position; the snap
			// reads as "new point arrived, prior one slid into place".
			uniques.sort( ( a, b ) => a.time.getTime() - b.time.getTime() );
			const last = uniques[ uniques.length - 1 ];
			if ( last ) {
				last.time = new Date( displayNow );
			}
		}
	}

	useEffect( () => {
		const el = document.getElementById( 'hero-chart' );
		if ( ! el ) {
			return;
		}
		// Initial measurement.
		setOuterWidth( el.offsetWidth );
		// Recalc on any container resize — fullscreen toggle, sidebar
		// collapse, window resize.
		const obs = new ResizeObserver( entries => {
			const w = entries[ 0 ]?.contentRect.width;
			if ( w ) {
				setOuterWidth( Math.round( w ) );
			}
		} );
		obs.observe( el );
		return () => obs.disconnect();
	}, [ setOuterWidth ] );

	// Reset interval on period change if not available.
	useEffect( () => {
		if ( period.intervals.map( i => i.interval ).indexOf( resolution ) === -1 ) {
			setResolution( period.intervals[period.defaultInterval || 0].interval );
		}
	}, [ period, resolution, setResolution ] );

	const dateDomain = extent( uniques, getX ) as [Date, Date];
	if ( resolution.match( /PT\d+H/ ) || resolution.match( /\d+ hour/ ) ) {
		dateDomain[1] = moment( dateDomain[1] ).add( 1, 'hours' ).toDate(); // Ensure last data point is not left out by visx.
	}
	// Realtime: pin the scale's right edge to wall-clock now and the
	// left edge to now-15min so the line continuously drifts left as
	// displayNow advances. We fetch 30 minutes of data and show the
	// last 15 — at ~1200px wide that's ~1.3 px/sec of drift, visible
	// without feeling frantic, and the window covers enough recent
	// activity for wall-display context. Older buckets fall off-screen
	// left and are clipped by the SVG viewport.
	if ( isRealTime ) {
		const visibleWindowMs = 15 * 60 * 1000;
		dateDomain[ 0 ] = new Date( displayNow - visibleWindowMs );
		dateDomain[ 1 ] = new Date( displayNow );
	}
	const xScale = scaleTime<number>( {
		domain: dateDomain,
	} );
	const yScaleMax = Math.max( 4, ( max( uniques, getViews ) as number ) + Math.floor( ( max( uniques, getViews ) as number ) / 6 ) );
	// yScale only depends on data magnitude, not on displayNow — safe to memoize
	// so the RAF ticker doesn't recompute it every 100 ms.
	const yScale = useMemo( () => scaleLinear<number>( {
		domain: [ 0, yScaleMax ],
		nice: true,
	} ), [ yScaleMax ] );

	const graphHeight = 250;
	// Left gutter holds the rotated "VIEW COUNT" label (flush with the
	// content-area left edge), the tick numbers, and a little breathing
	// room. Tightened from 150 so the chart fills the content width and
	// aligns with the tile/list containers.
	const offsetleft = 70;
	const graphPaddingX = 30;
	const graphPaddingY = 35;
	// Right padding is small — just enough that the last data point isn't
	// flush against the SVG edge.
	const outerWidthWithOffset = Math.max( 0, outerWidth - offsetleft - 20 );

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

	// Fade-in dot key: bumped only when a brand new bucket joins the
	// server data (minute boundary in realtime). Stable within a minute
	// so the dot doesn't re-flash on every rAF tick. Falls back to the
	// last point's index if the data shape isn't ready.
	const lastBucketKey = effectiveData
		? Object.keys( effectiveData.by_interval || {} ).slice( -1 )[ 0 ] ?? ''
		: '';
	const reduced = useReducedMotion();
	const lastPoint = uniques.length > 0 ? uniques[ uniques.length - 1 ] : null;
	const lastDotX = lastPoint ? xScale( getX( lastPoint ) ) : null;
	const lastDotY = lastPoint ? yScale( getViews( lastPoint ) ) : null;
	const showDot =
		isRealTime &&
		hasData &&
		lastPoint != null &&
		Number.isFinite( lastDotX as number ) &&
		Number.isFinite( lastDotY as number );

	// For realtime, the chart's main fetch covers the last 30 min, but
	// the visible window + the strip's "vs. prior" comparison are both
	// scoped to the last 15 min. Override the strip values with a
	// dedicated 15-min fetch in that case. Non-realtime keeps using
	// the chart's summary directly.
	const realtimeCurrent = useRealtimeCurrentSummary( isRealTime, realtimeTick );
	const baseSummary = effectiveData?.stats?.summary;
	const stripVisitors = isRealTime ? realtimeCurrent?.visitors ?? 0 : baseSummary?.visitors ?? 0;
	const stripViews = isRealTime ? realtimeCurrent?.views ?? 0 : baseSummary?.views ?? 0;
	const stripBounce = isRealTime ? realtimeCurrent?.bounce ?? 0 : baseSummary?.bounce ?? 0;
	const visitors = stripVisitors;
	const views = stripViews;
	const pagesPerVisit = visitors > 0 ? views / visitors : 0;
	const bouncePct = visitors > 0 ? ( stripBounce / visitors ) * 100 : 0;
	// Show KPI skeletons only on the genuine first-load (no data yet
	// AND a fetch is in flight). A loaded payload with all-zero counts
	// is still data — render `0` for each KPI, don't loop on skeletons.
	const headerHasData = Boolean( effectiveData );
	const showHeaderSkeleton = ! headerHasData && isLoading;
	const showLoadingPill = isLoading;

	// Prior-period fetch for the metric strip deltas. Skipped for PT30M
	// (realtime) — usePriorSummary returns null in that case so each
	// tile renders the neutral em-dash.
	const prior = usePriorSummary( period.value || 'P7D', realtimeTick );
	const priorVisitors = prior?.visitors ?? 0;
	const priorViews = prior?.views ?? 0;
	const priorPagesPerVisit = priorVisitors > 0 ? priorViews / priorVisitors : 0;
	const priorBouncePct = priorVisitors > 0 ? ( ( prior?.bounce ?? 0 ) / priorVisitors ) * 100 : 0;
	const visitorsDelta = prior ? computeDelta( visitors, priorVisitors ) : undefined;
	const viewsDelta = prior ? computeDelta( views, priorViews ) : undefined;
	const pagesPerVisitDelta = prior ? computeDelta(
		Math.round( pagesPerVisit * 10 ),
		Math.round( priorPagesPerVisit * 10 )
	) : undefined;
	const bounceDelta = prior ? computeDelta(
		Math.round( bouncePct ),
		Math.round( priorBouncePct )
	) : undefined;

	return (
		<div className="HeroChart" id="hero-chart">
			<div className="tailwind mb-4">
				{ showHeaderSkeleton ? (
					<div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
						{ [ 0, 1, 2, 3 ].map( i => (
							<div key={ i } className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
								<Skeleton className="h-3 w-20" />
								<Skeleton className="!mt-2 h-9 w-24" />
								<Skeleton className="!mt-2 h-3 w-16" />
							</div>
						) ) }
					</div>
				) : (
					<div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
						<MetricTile
							delta={ visitorsDelta }
							deltaTone={ toneFor( true, visitorsDelta ) }
							label={ __( 'Unique visitors', 'altis' ) }
							value={ formatCount( visitors ) }
						/>
						<MetricTile
							delta={ viewsDelta }
							deltaTone={ toneFor( true, viewsDelta ) }
							label={ __( 'Page views', 'altis' ) }
							value={ formatCount( views ) }
						/>
						<MetricTile
							delta={ pagesPerVisitDelta }
							deltaTone={ toneFor( true, pagesPerVisitDelta ) }
							label={ __( 'Pages per visit', 'altis' ) }
							value={ formatRatio( pagesPerVisit ) }
						/>
						<MetricTile
							delta={ bounceDelta }
							deltaTone={ toneFor( false, bounceDelta ) }
							label={ __( 'Bounce rate', 'altis' ) }
							value={ formatPercent( bouncePct ) }
						/>
					</div>
				) }
			</div>
			{ period.intervals.length > 1 && (
				<div className="tailwind mb-2 flex flex-wrap items-end justify-between gap-3">
					<h3 className="!m-0 !text-sm !font-semibold !tracking-tight !text-foreground">
						{ isRealTime ? __( 'Live activity', 'altis' ) : __( 'Traffic', 'altis' ) }
					</h3>
					<AnimatedTabs
						options={ period.intervals.map( i => ( {
							value: i.interval,
							label: i.label,
						} ) ) }
						value={ resolution }
						onValueChange={ ( value: string ) => {
							trackEvent( 'content_explorer_resolution_changed', { resolution: value } );
							setResolution( value );
						} }
					/>
				</div>
			) }
			<div className="HeroChart__plot tailwind">
				{ showLoadingPill && (
					<div className="HeroChart__loader-pill">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-xs">
							<Spinner className="size-3" />
							{ __( 'Loading data', 'altis' ) }
						</span>
					</div>
				) }
				{ ! hasData && ! isLoading && statsError && (
					<div className="absolute inset-0 flex items-center justify-center">
						<EmptyState
							description={ statsError }
							title={ __( 'Failed to load data', 'altis' ) }
						/>
					</div>
				) }
				{ ! hasData && isLoading && (
					// Chart silhouette skeleton — y-tick stubs on the left,
					// three staggered horizontal bars hinting at a rising
					// line, and an axis line at the bottom. Reads as
					// "a chart is loading" rather than a flat placeholder.
					<div aria-hidden="true" className="pointer-events-none absolute inset-0">
						<div className="absolute left-3 top-6 flex flex-col gap-12">
							<Skeleton className="h-3 w-6" />
							<Skeleton className="h-3 w-6" />
							<Skeleton className="h-3 w-6" />
							<Skeleton className="h-3 w-6" />
						</div>
						<Skeleton className="absolute left-20 right-32 top-1/3 h-1" />
						<Skeleton className="absolute left-32 right-20 top-1/2 h-1" />
						<Skeleton className="absolute right-8 top-2/3 h-1" style={ { left: '11rem' } } />
						<div className="absolute bottom-6 left-20 right-2 h-px bg-muted opacity-60" />
					</div>
				) }
				<svg height={ graphHeight + graphPaddingY * 2 } width="100%">
					<MarkerCircle fill="#333" id="marker-circle" refX={ 2 } size={ 2 } />
					<LinearGradient
						from={ showLoadingState ? '#ccc' : '#9332FF' }
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
						{ ! showChartSkeleton && (
							<AxisBottom
								hideAxisLine
								hideTicks
								numTicks={ isRealTime ? 5 : 7 }
								scale={ xScale }
								tickFormat={ ( value: Date | { valueOf(): number } ) => {
									if ( period.value === 'PT30M' ) {
									// Render minute-precise labels: "Now" for the
									// right-edge tick, then "1m ago", "2m ago".
									// Math.round on diffMs lands on the same minute
									// as the bucket time, so dupes are avoided.
										const diffSec = ( displayNow - ( value as Date ).getTime() ) / 1000;
										if ( diffSec < 30 ) {
											return 'Now';
										}
										const diffMin = Math.round( diffSec / 60 );
										return `${ diffMin }m ago`;
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
						) }
						{ ! showChartSkeleton && (
							<AxisLeft
								hideAxisLine
								hideTicks
								hideZero
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
						) }
						{ ! showChartSkeleton && (
							<GridRows
								left={ -graphPaddingX }
								numTicks={ 4 }
								scale={ yScale }
								stroke="rgba( 0, 0, 0, .2 )"
								width={ outerWidthWithOffset + graphPaddingX * 2 }
							/>
						) }

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
						{ /* Clip the line/area to the chart rect so realtime drift
					      doesn't bleed into the y-axis gutter on the left or
					      past the right edge as data scrolls. */ }
						<defs>
							<clipPath id="hero-plot-clip">
								<rect
									height={ graphHeight + graphPaddingY }
									width={ outerWidthWithOffset }
									x={ 0 }
									y={ 0 }
								/>
							</clipPath>
						</defs>
						<g clipPath="url(#hero-plot-clip)">
							<LinePath
								curve={ curveMonotoneX }
								data={ uniques }
								shapeRendering="geometricPrecision"
								stroke={ showLoadingState ? '#ccc' : '#9332FF' }
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
							{ showDot && (
								<motion.circle
									key={ lastBucketKey }
									animate={ {
										opacity: 1,
										scale: 1,
									} }
									cx={ lastDotX as number }
									cy={ lastDotY as number }
									fill="#9332FF"
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
						</g>

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
									fill="#9332FF"
									pointerEvents="none"
									r={ 4 }
									stroke="white"
									strokeWidth={ 2 }
								/>
							</g>
						) }
						{ !! effectiveData?.by_interval && ( Object.values( effectiveData.by_interval ).length || 0 ) < 1 && (
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
					( ( Object.values( effectiveData?.by_interval || {} ).length || 0 ) < 1 && (
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
		</div>
	);
}
