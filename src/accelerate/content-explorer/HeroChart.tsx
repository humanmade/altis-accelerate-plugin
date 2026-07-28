import moment from 'moment';
import React, { useEffect, useRef, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';

import { Card } from '../../dashboard/components/Card';
import { clampIntervalForFilter, REALTIME_VISIBLE_MINUTES, resolveCurrentRealtimeWindow, resolvePriorStatsArgs, resolveSelectedDate, siteOffsetMinutesAt } from '../../data';
import { usePersistentState } from '../../data/hooks';
import { periods } from '../../data/periods';
import { Duration, Filter, IntervalSegmentsResult, OTHER_SEGMENT_KEY, StatsResult, trackEvent } from '../../utils/admin';

import { formatEngaged } from './BreakdownPanel/formatEngaged';
import { prettyLabel } from './BreakdownPanel/prettyLabel';
import { ChartStyleControl } from './ChartStyleControl';
import { CompareControl } from './CompareControl';
import { colorForSegment, PRIOR_SERIES_COLOR, SEGMENT_COLORS, TimeSeriesPlot, TimeSeriesPoint } from './TimeSeriesPlot';
import { useChartComparison, useChartPresentation } from './useChartPresentation';

import { EmptyState } from '@/components/EmptyState';
import { MetricTile, DeltaTone } from '@/components/MetricTile';
import { TileGrid } from '@/components/TileGrid';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { computeDelta, Delta } from '@/lib/utils';

type Props = {
	period: Duration;
	// Bumped by the parent on each realtime refresh; included in the
	// stats request so the resolver invalidates its cache.
	realtimeTick?: number;
	// Optional path/audience filter. When empty/absent the request is
	// byte-identical to the unfiltered Dashboard view.
	filter?: Filter;
};

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

type PriorSummary = {
	visitors: number;
	views: number;
	bounce: number;
} | null;

type PriorStatsStatus = 'loading' | 'ready' | 'unavailable' | 'unsupported';

type PriorStatsState = {
	periodValue: Duration;
	rawInterval: string;
	filterKey: string;
	stats: StatsResult | null;
	status: PriorStatsStatus;
};

const serializeFilter = ( filter: Filter ) => JSON.stringify( filter );

export function toTimeSeriesPoints( byInterval: StatsResult['by_interval'] | undefined, through?: number ): TimeSeriesPoint[] {
	return Object.entries( byInterval || {} )
		.map( ( [ time, stats ] ) => ( {
			id: time,
			time: new Date( time.replace( ' ', 'T' ) + 'Z' ),
			value: stats?.views || 0,
		} ) )
		.filter( point => through === undefined || point.time.getTime() <= through )
		.sort( ( first, second ) => first.time.getTime() - second.time.getTime() );
}

/**
 * Attach per-interval segment maps onto time series points by matching bucket
 * id (the site-local date string from by_interval). Missing buckets get zeros
 * for every key so stacks stay stable across the series.
 *
 * `options.keys` forces a key order (use current-period keys when attaching
 * prior-period segments so both stacks share the same composition axes).
 * Values under unknown keys are folded into the stable Other key; when no
 * current-period key exists, it is synthesized so prior totals still compose.
 */
export function attachSegmentSeries(
	points: TimeSeriesPoint[],
	segments: IntervalSegmentsResult | null | undefined,
	options?: { keys?: string[] }
): TimeSeriesPoint[] {
	const keys = options?.keys?.length ? options.keys : ( segments?.keys || [] );
	if ( ! keys.length ) {
		return points;
	}
	const byInterval = segments?.by_interval || {};
	const keySet = new Set( keys );
	const otherKey = keys.find( key => key === OTHER_SEGMENT_KEY );
	return points.map( point => {
		const bucket = byInterval[ point.id ] || {};
		const map: Record<string, number> = {};
		keys.forEach( key => {
			map[ key ] = 0;
		} );
		let extras = 0;
		Object.keys( bucket ).forEach( key => {
			const n = Number( bucket[ key ] ) || 0;
			if ( keySet.has( key ) ) {
				map[ key ] += n;
			} else {
				extras += n;
			}
		} );
		if ( extras > 0 ) {
			if ( otherKey ) {
				map[ otherKey ] += extras;
			} else {
				// Prior stacks share current keys. Preserve prior-only traffic
				// when the current period did not need an Other bucket.
				map[ OTHER_SEGMENT_KEY ] = extras;
			}
		}
		return {
			...point,
			segments: map,
		};
	} );
}

export function assembleSegmentKeys( keys: string[], priorPoints: TimeSeriesPoint[] ): string[] {
	if ( ! keys.length ) {
		return keys;
	}
	const needsOther = keys.includes( OTHER_SEGMENT_KEY )
		|| keys.length > SEGMENT_COLORS.length
		|| priorPoints.some( point => ( point.segments?.[ OTHER_SEGMENT_KEY ] ?? 0 ) > 0 );
	if ( ! needsOther ) {
		return keys;
	}
	return [
		...keys.filter( key => key !== OTHER_SEGMENT_KEY ).slice( 0, SEGMENT_COLORS.length - 1 ),
		OTHER_SEGMENT_KEY,
	];
}

export function alignPriorSeriesByIndex( current: TimeSeriesPoint[], prior: TimeSeriesPoint[] ): TimeSeriesPoint[] {
	return current.slice( 0, prior.length ).map( ( _, index ) => prior[ index ] );
}

// Realtime current-window summary fetcher. Fetches the current
// 30-min window on the same minute-snapped boundaries as
// `resolvePriorPeriod`, so the strip compares apples-to-apples
// against the prior 30min.
// Returns null outside of realtime — callers fall back to the chart's
// existing 30min summary.
export function useRealtimeCurrentSummary( isRealtime: boolean, rawInterval: string, filter: Filter, tick: number, filterKey: string, hasFilter: boolean ): PriorSummary {
	const [ state, setState ] = useState<{ filterKey: string, summary: PriorSummary } | null>( null );
	const lastRef = React.useRef<{ filterKey: string, summary: PriorSummary } | null>( null );
	useEffect( () => {
		if ( ! isRealtime ) {
			setState( null );
			lastRef.current = null;
			return;
		}
		if ( lastRef.current?.filterKey !== filterKey ) {
			setState( {
				filterKey,
				summary: null,
			} );
		}
		const win = resolveCurrentRealtimeWindow();
		let cancelled = false;
		apiFetch<StatsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats', {
				start: win.start.toISOString(),
				end: win.end.toISOString(),
				interval: clampIntervalForFilter( rawInterval, hasFilter ),
				...( hasFilter ? { filter } : {} ),
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
				lastRef.current = {
					filterKey,
					summary: next,
				};
				setState( {
					filterKey,
					summary: next,
				} );
			},
			() => {
				// On error keep the last good value so the strip doesn't flash to 0.
				if ( ! cancelled ) {
					setState( {
						filterKey,
						summary: lastRef.current?.filterKey === filterKey ? lastRef.current.summary : null,
					} );
				}
			}
		);
		return () => {
			cancelled = true;
		};
	// filterKey stands in for the filter object, and hasFilter is derived from it.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isRealtime, rawInterval, filterKey, tick ] );
	return state?.filterKey === filterKey ? state.summary : null;
}

function usePriorStatsState( periodValue: Duration, rawInterval: string, filter: Filter, tick: number ): PriorStatsState {
	const filterKey = serializeFilter( filter );
	// A request's identity is period + interval + filter — NOT tick. A realtime
	// tick refetches, but must keep the last delta visible while in flight.
	const identity = `${ periodValue }|${ rawInterval }|${ filterKey }`;
	const lastIdentityRef = React.useRef<string | null>( null );
	const [ state, setState ] = useState<PriorStatsState | null>( null );
	useEffect( () => {
		const requestState = {
			periodValue,
			rawInterval,
			filterKey,
		};
		const args = resolvePriorStatsArgs( periodValue, rawInterval, filter );
		// Only clear to neutral when the identity changes — never on a tick-only
		// change, so realtime deltas don't flash to em-dash on every poll.
		if ( lastIdentityRef.current !== identity ) {
			lastIdentityRef.current = identity;
			setState( {
				...requestState,
				stats: null,
				status: args ? 'loading' : 'unsupported',
			} );
		}
		if ( ! args ) {
			return;
		}
		let cancelled = false;
		apiFetch<StatsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats', args ),
		} ).then(
			value => {
				if ( cancelled ) {
					return;
				}
				setState( {
					...requestState,
					stats: value,
					status: Object.values( value?.by_interval || {} ).length > 0 ? 'ready' : 'unavailable',
				} );
			},
			() => {
				// Swallow: prior is best-effort; tile falls back to neutral.
				if ( ! cancelled ) {
					setState( {
						...requestState,
						stats: null,
						status: 'unavailable',
					} );
				}
			}
		);
		return () => {
			cancelled = true;
		};
	// filterKey stands in for the filter object.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ periodValue, rawInterval, filterKey, tick ] );
	if ( state?.periodValue === periodValue &&
		state.rawInterval === rawInterval &&
		state.filterKey === filterKey ) {
		return state;
	}
	return {
		periodValue,
		rawInterval,
		filterKey,
		stats: null,
		status: resolvePriorStatsArgs( periodValue, rawInterval, filter ) ? 'loading' : 'unsupported',
	};
}

// Prior-period stats fetcher. Returns `null` when the period has no
// meaningful prior or while loading/erroring — consumers render neutral
// em-dashes in those cases. The full result is retained for interval data.
export function usePriorStats( periodValue: Duration, rawInterval: string, filter: Filter, tick: number ): StatsResult | null {
	return usePriorStatsState( periodValue, rawInterval, filter, tick ).stats;
}

/**
 * Composition segments for stacked bars — separate /stats/segments fetch so
 * the shared getStats store key stays untouched (BreakdownPanel dedupes on it).
 * Best-effort: null on load/error keeps solid bars.
 */
export function useIntervalSegments(
	periodValue: Duration,
	rawInterval: string,
	filter: Filter,
	tick: number,
	enabled: boolean
): IntervalSegmentsResult | null {
	const filterKey = serializeFilter( filter );
	const hasFilter = Object.keys( filter ).length > 0;
	const identity = `${ periodValue }|${ rawInterval }|${ filterKey }`;
	const lastIdentityRef = useRef<string>( '' );
	const [ state, setState ] = useState<{ identity: string, segments: IntervalSegmentsResult | null } | null>( null );

	useEffect( () => {
		if ( ! enabled ) {
			setState( null );
			lastIdentityRef.current = '';
			return;
		}
		if ( lastIdentityRef.current !== identity ) {
			lastIdentityRef.current = identity;
			setState( {
				identity,
				segments: null,
			} );
		}
		let cancelled = false;
		const { start, end } = resolveSelectedDate( periodValue, null );
		const intervalClamped = clampIntervalForFilter( rawInterval, hasFilter );
		apiFetch<IntervalSegmentsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats/segments', {
				start: start.toISOString(),
				end: end.toISOString(),
				interval: intervalClamped,
				dimension: 'referer',
				...( hasFilter ? { filter } : {} ),
			} ),
		} ).then(
			value => {
				if ( cancelled ) {
					return;
				}
				setState( {
					identity,
					segments: value?.keys?.length ? value : null,
				} );
			},
			() => {
				if ( ! cancelled ) {
					setState( {
						identity,
						segments: null,
					} );
				}
			}
		);
		return () => {
			cancelled = true;
		};
	// filterKey stands in for the filter object.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ periodValue, rawInterval, filterKey, tick, enabled ] );

	return enabled && state?.identity === identity ? state.segments : null;
}

/**
 * Prior-period composition segments for stacked compare. Same endpoint as
 * useIntervalSegments, windowed via resolvePriorStatsArgs. Only runs when
 * `enabled` (compare toggle on + period supports prior).
 */
export function usePriorIntervalSegments(
	periodValue: Duration,
	rawInterval: string,
	filter: Filter,
	tick: number,
	enabled: boolean
): IntervalSegmentsResult | null {
	const filterKey = serializeFilter( filter );
	const identity = `${ periodValue }|${ rawInterval }|${ filterKey }|prior`;
	const lastIdentityRef = useRef<string>( '' );
	const [ state, setState ] = useState<{ identity: string, segments: IntervalSegmentsResult | null } | null>( null );

	useEffect( () => {
		if ( ! enabled ) {
			setState( null );
			lastIdentityRef.current = '';
			return;
		}
		const args = resolvePriorStatsArgs( periodValue, rawInterval, filter );
		if ( ! args?.start || ! args?.end ) {
			setState( {
				identity,
				segments: null,
			} );
			return;
		}
		if ( lastIdentityRef.current !== identity ) {
			lastIdentityRef.current = identity;
			setState( {
				identity,
				segments: null,
			} );
		}
		let cancelled = false;
		apiFetch<IntervalSegmentsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats/segments', {
				start: args.start,
				end: args.end,
				interval: args.interval,
				dimension: 'referer',
				...( args.filter ? { filter: args.filter } : {} ),
			} ),
		} ).then(
			value => {
				if ( cancelled ) {
					return;
				}
				setState( {
					identity,
					segments: value?.keys?.length ? value : null,
				} );
			},
			() => {
				if ( ! cancelled ) {
					setState( {
						identity,
						segments: null,
					} );
				}
			}
		);
		return () => {
			cancelled = true;
		};
	// filterKey stands in for the filter object.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ periodValue, rawInterval, filterKey, tick, enabled ] );

	return enabled && state?.identity === identity ? state.segments : null;
}

export default function HeroChart( props: Props ) {
	const { period: periodKey, realtimeTick = 0, filter = {} } = props;
	// Stable dependency key for the filter object so useSelect doesn't refetch
	// on every render when the parent passes a fresh-but-equal object.
	const filterKey = serializeFilter( filter );
	const hasFilter = Object.keys( filter ).length > 0;

	const period = periods.find( p => p.value === periodKey ) || periods[0];

	// Get stats data.
	const [ outerWidth, setOuterWidth ] = useState<number>( 0 );
	const [ resolution, setResolution ] = usePersistentState<string>( 'hero-chart-resolution', period.intervals[ period.defaultInterval || 0 ].interval );
	const [ presentation, setPresentation ] = useChartPresentation( 'hero' );
	const [ compareToPrior, setCompareToPrior ] = useChartComparison( 'hero' );
	const rawInterval = resolution && period.intervals.map( i => i.interval ).includes( resolution )
		? resolution
		: period.intervals[ period.defaultInterval || 0 ].interval || 'P1D';
	// Composition segments for stacked bars — separate endpoint, best-effort.
	const intervalSegments = useIntervalSegments(
		period.value || 'P7D',
		rawInterval,
		filter,
		realtimeTick,
		presentation === 'bar'
	);
	// Prior segments only for a bar comparison (same window as usePriorStats).
	const priorIntervalSegments = usePriorIntervalSegments(
		period.value || 'P7D',
		rawInterval,
		filter,
		realtimeTick,
		presentation === 'bar' && compareToPrior
	);
	const interval = clampIntervalForFilter( rawInterval, hasFilter );

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
		// Filtered queries run against the raw table; only the 7-day rollup is
		// disallowed there, so this clamps P7D down to P1D (PT1M/PT1H/P1D pass through).
		return select( 'accelerate' ).getStats( {
			period: period.value || 'P7D',
			interval,
			// Only include `time` when non-zero so non-realtime periods share
			// the same cache key as List.tsx and deduplicate the request.
			// When realtime-ticking, realtimeTick > 0 forces a fresh fetch.
			...( realtimeTick > 0 ? { time: realtimeTick } : {} ),
			// Only include `filter` when non-empty so the unfiltered Dashboard
			// view shares the same cache key as List.tsx and deduplicates.
			...( hasFilter ? { filter } : {} ),
		} );
	// filterKey stands in for the filter object in deps — see filterKey above.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ period, resolution, realtimeTick, filterKey ] );
	const isLoading = useSelect<StatsResult>( select => {
		return select( 'accelerate' ).getIsLoadingStats();
	}, [ data ] );
	const statsError = useSelect<string | null>( select => {
		return select( 'accelerate' ).getStatsError();
	}, [ isLoading ] );

	// Stale-while-revalidate: hold the last good payload across realtime
	// refetches so the chart can interpolate between snapshots instead of
	// blanking to the empty fallback whenever the cache key bumps. Keyed
	// by period+resolution+filter so a switch to a different window — or a
	// different filter — doesn't show the previous view's data while
	// fetching. Including the filter also means a filtered request that
	// errors (e.g. an invalid interval) falls through to the error state
	// instead of silently keeping the prior unfiltered chart on screen.
	const swrKey = `${ period.value || '' }:${ resolution }:${ filterKey }`;
	const lastDataRef = useRef<StatsResult | undefined>( undefined );
	const lastDataKeyRef = useRef<string>( '' );
	if ( data && Object.values( data?.by_interval || {} ).length > 0 ) {
		lastDataRef.current = data;
		lastDataKeyRef.current = swrKey;
	}
	const effectiveData = data && Object.values( data?.by_interval || {} ).length > 0
		? data
		: ( lastDataKeyRef.current === swrKey ? lastDataRef.current : undefined );

	let points: TimeSeriesPoint[] = [];
	const hasData = Object.values( effectiveData?.by_interval || {} ).length > 0;
	// Don't show loading state visuals during realtime refresh when we already have data.
	const showLoadingState = isLoading && ! ( isRealTime && hasData );
	// True only on the first load before any data arrives — used to suppress chart
	// axes/grid while the skeleton overlay is visible. showLoadingState is too broad
	// here (it's also true during background refreshes with existing data).
	const showChartSkeleton = ! hasData && isLoading;
	// Backend bucket labels (`date`) are the *site-local* wall-clock expressed as
	// UTC (see get_graph_data / #681), so every chart `time` lives in a wall-clock
	// frame shifted from real time by the site's offset. `wallNow` puts "now" in
	// that same frame so the TODAY/realtime positioning (clamp, visible window,
	// right-edge anchor) lines up with the data; labels read it back with the
	// UTC getters below. The instant itself is unchanged — only the frame.
	const now = isRealTime ? displayNow : Date.now();
	const siteOffsetMs = siteOffsetMinutesAt( moment( now ) ) * 60 * 1000;
	const wallNow = now + siteOffsetMs;
	// Only show placeholder when there's no data yet. During realtime refresh, keep showing existing data.
	if ( ! hasData ) {
		if ( isRealTime ) {
			// Empty-state placeholder for the realtime view: one zero-value
			// bucket per minute so the chart silhouette matches the visible
			// 30-minute window.
			points = Array( REALTIME_VISIBLE_MINUTES )
				.fill( {} )
				.map( ( _, i ) => {
					return {
						id: `placeholder-${ i }`,
						time: new Date( wallNow - ( REALTIME_VISIBLE_MINUTES - i ) * 60 * 1000 ),
						value: 0,
					};
				} );
		} else {
			points = Array( 7 )
				.fill( {} )
				.map( ( d, i ) => {
					return {
						id: `placeholder-${ i }`,
						time: moment.utc( wallNow ).endOf( 'day' ).subtract( 7, 'days' ).add( i, 'days' ).toDate(),
						value: 0,
					};
				} );
		}
	} else {
		points = toTimeSeriesPoints( effectiveData?.by_interval, wallNow );
	}
	if ( hasData && isRealTime && presentation === 'line' && points.length > 0 ) {
		// Keep the newest line point at the right edge as its value pulses up
		// during the current minute. On rollover it returns to its real bucket
		// time, making the new point's arrival read as a natural snap.
		points = points.map( ( point, index ) => index === points.length - 1 ? {
			...point,
			time: new Date( wallNow ),
		} : point );
	}

	// Composition segments (referer host top-N + Other). Bar mode stacks them;
	// line mode ignores (total only). Prior compare attaches the same keys so
	// stacks share a composition axis (unknown prior hosts fold into Other).
	const segmentKeys = presentation === 'bar' ? ( intervalSegments?.keys || [] ) : [];

	useEffect( () => {
		// Measure the plot region (inside Card padding), not the outer
		// #hero-chart root — otherwise scales are ~48px too wide.
		const root = document.getElementById( 'hero-chart' );
		const el = root?.querySelector( '.HeroChart__plot' ) as HTMLElement | null;
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

	// For realtime, override the strip values with a dedicated current-window
	// fetch so its "vs. prior" comparison uses matching 30-minute windows.
	// Non-realtime keeps using the chart's summary directly.
	const realtimeCurrent = useRealtimeCurrentSummary( isRealTime, rawInterval, filter, realtimeTick, filterKey, hasFilter );
	const baseSummary = effectiveData?.stats?.summary;
	const stripSummary = isRealTime ? realtimeCurrent ?? baseSummary : baseSummary;
	const stripVisitors = stripSummary?.visitors ?? 0;
	const stripViews = stripSummary?.views ?? 0;
	const stripBounce = stripSummary?.bounce ?? 0;
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

	// Prior-period fetch for the metric strip deltas.
	const priorState = usePriorStatsState( period.value || 'P7D', rawInterval, filter, realtimeTick );
	const priorStats = priorState.stats;
	const comparisonSupported = priorState.status !== 'unsupported';
	const comparisonEnabled = comparisonSupported && compareToPrior;
	let priorPoints = toTimeSeriesPoints( priorStats?.by_interval );
	if ( segmentKeys.length > 0 && priorIntervalSegments ) {
		priorPoints = attachSegmentSeries( priorPoints, priorIntervalSegments, { keys: segmentKeys } );
	}
	const plotSegmentKeys = assembleSegmentKeys( segmentKeys, priorPoints );
	if ( plotSegmentKeys.length > 0 ) {
		points = attachSegmentSeries( points, intervalSegments, { keys: plotSegmentKeys } );
		if ( priorIntervalSegments ) {
			priorPoints = attachSegmentSeries( priorPoints, priorIntervalSegments, { keys: plotSegmentKeys } );
		}
	}
	const comparison = comparisonEnabled && hasData && priorPoints.length > 0
		? alignPriorSeriesByIndex( points, priorPoints )
		: undefined;
	const priorUnavailable = comparisonEnabled && priorState.status === 'unavailable';
	const prior = priorStats?.stats?.summary;
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

	const engagedSecondsAvg = baseSummary?.engaged?.avg_seconds ?? 0;

	return (
		<div className="HeroChart" id="hero-chart">
			<div className="tailwind mb-4">
				{ showHeaderSkeleton ? (
					<TileGrid variant="metric">
						{ [ 0, 1, 2, 3, 4 ].map( i => (
							<div key={ i } className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
								<Skeleton className="h-3 w-20" />
								<Skeleton className="!mt-2 h-9 w-24" />
								<Skeleton className="!mt-2 h-3 w-16" />
							</div>
						) ) }
					</TileGrid>
				) : (
					<TileGrid variant="metric">
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
							label={ __( 'Avg. engaged time', 'altis' ) }
							labelTitle={ __( 'Average time visitors spent actively reading or interacting per page visit. Time only counts while scrolling, clicking, typing or touching — idle time and background tabs are excluded.', 'altis' ) }
							value={ formatEngaged( engagedSecondsAvg ) }
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
					</TileGrid>
				) }
			</div>
			{ /* Chart tile: same Card chrome as BreakdownPanel StatTiles.
			    KPI strip stays outside — each MetricTile is already a Card. */ }
			<Card className="tailwind">
				<div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
					<h3 className="!m-0 !text-sm !font-medium !text-muted-foreground">
						{ isRealTime ? __( 'Live activity', 'altis' ) : __( 'Traffic', 'altis' ) }
					</h3>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<ChartStyleControl value={ presentation } onValueChange={ setPresentation } />
						{ period.intervals.length > 1 && (
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
						) }
						{ /* Periods with no comparable prior window (P90D — retention */ }
						{ /* is 90 days) drop the control entirely rather than showing */ }
						{ /* a disabled one; a dimmed toggle reads as "off" and just */ }
						{ /* invites the question of why it won't turn on. */ }
						{ comparisonSupported && (
							<CompareControl
								enabled={ comparisonEnabled }
								onEnabledChange={ setCompareToPrior }
							/>
						) }
						{ priorUnavailable && (
							<span className="!text-xs !text-muted-foreground">
								{ __( 'Prior data unavailable', 'altis' ) }
							</span>
						) }
					</div>
				</div>
				<div className="HeroChart__plot">
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
					<TimeSeriesPlot
						{ ...( comparison ? { comparison } : {} ) }
						displayNow={ wallNow }
						interval={ resolution }
						isLoading={ showLoadingState }
						isRealtime={ isRealTime }
						mode={ presentation === 'bar' ? 'bar' : 'line' }
						period={ period }
						segmentKeys={ plotSegmentKeys }
						series={ points }
						showSkeleton={ showChartSkeleton }
						showWaiting={ !! effectiveData?.by_interval && Object.values( effectiveData.by_interval ).length < 1 }
						width={ outerWidth }
					/>
					{ plotSegmentKeys.length > 0 && presentation === 'bar' && (
						// Inline gap: !gap-x-* is not always in the built Tailwind
						// sheet (only !gap-2/3 are), so WP-admin list styles + missing
						// utilities were collapsing items into an illegible run-on.
						<ul
							aria-label={ __( 'Traffic sources', 'altis' ) }
							className="!m-0 !mt-2 !flex !list-none !flex-wrap !items-center !justify-end !p-0"
							style={ { gap: '6px 18px' } }
						>
							{ comparisonEnabled && (
								<li
									className="!m-0 !inline-flex !items-center !p-0"
									style={ { gap: 6 } }
								>
									<span
										aria-hidden="true"
										className="inline-block size-2 shrink-0 rounded-sm"
										style={ { backgroundColor: PRIOR_SERIES_COLOR } }
									/>
									<span className="!text-[11px] !leading-none !text-muted-foreground">
										{ __( 'Prior period', 'altis' ) }
									</span>
								</li>
							) }
							{ plotSegmentKeys.map( ( key, index ) => (
								<li
									key={ key }
									className="!m-0 !inline-flex !items-center !p-0"
									style={ { gap: 6 } }
								>
									<span
										aria-hidden="true"
										className="inline-block size-2 shrink-0 rounded-sm"
										style={ { backgroundColor: colorForSegment( index ) } }
									/>
									<span className="!text-[11px] !leading-none !text-muted-foreground">
										{ prettyLabel( key ) }
									</span>
								</li>
							) ) }
						</ul>
					) }
				</div>
			</Card>
		</div>
	);
}
