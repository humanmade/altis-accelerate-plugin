import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { useDispatch, useSelect } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

import { clampIntervalForFilter, resolveSelectedDate } from '../../../data';
import { Duration, Filter, StatsResult } from '../../../utils/admin';

type SliceState = 'loading' | 'loaded' | 'empty' | 'error';

type Slice<T> = {
	state: SliceState;
	data: T | null;
	// Backend error message (e.g. invalid interval for a filtered query), surfaced
	// in the tile's error state instead of the generic "Something went wrong".
	error?: string;
};

const AGGREGATIONS_ENDPOINT = '/accelerate/v1/stats/aggregations';

function statsHasContent( s: StatsResult | null ): boolean {
	if ( ! s ) {
		return false;
	}
	const summary = s.stats?.summary?.views ?? 0;
	const referrers = Object.keys( s.stats?.by_referer || {} ).length;
	const campaigns = Object.keys( s.stats?.by_campaign || {} ).length;
	const sourceCampaigns = Object.keys( s.stats?.by_source_campaign || {} ).length;
	const sourceMediums = Object.keys( s.stats?.by_source_medium || {} ).length;
	const outbound = Object.keys( s.stats?.by_outbound_host || {} ).length;
	return summary > 0 ||
		referrers > 0 ||
		campaigns > 0 ||
		sourceCampaigns > 0 ||
		sourceMediums > 0 ||
		outbound > 0;
}

export type BreakdownStats = {
	stats: Slice<StatsResult>;
	refresh: () => void;
};

export function useBreakdownStats( period: Duration, realtimeTick: number = 0, outboundEnabled: boolean = false, filter: Filter = {} ): BreakdownStats {
	const isMounted = useRef( true );
	const requestId = useRef( 0 );
	// Incremented by refresh() to re-trigger both the aggregations fetch and the store resolver.
	const [ refreshTrigger, setRefreshTrigger ] = useState( 0 );

	// Stable dependency key for the filter object so effects/selectors don't
	// refetch on every render when the parent passes a fresh-but-equal object.
	const hasFilter = Object.keys( filter ).length > 0;
	const filterKey = JSON.stringify( filter );

	// Stats come from the shared data store — same response as HeroChart avoids a duplicate request.
	// Filtered queries run against the raw table; only the 7-day rollup is
	// disallowed there, so this clamps P7D down to P1D (PT1M/PT1H/P1D pass
	// through) — both the store stats request and the /aggregations fetch use it.
	const { interval: rawInterval } = resolveSelectedDate( period as any, null );
	const interval = clampIntervalForFilter( rawInterval, hasFilter );
	const storeStats = useSelect( select => {
		return select( 'accelerate' ).getStats( {
			period,
			interval,
			...( refreshTrigger > 0 ? { refresh: refreshTrigger } : {} ),
			...( hasFilter ? { filter } : {} ),
		} );
	// filterKey stands in for the filter object in deps.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ period, interval, refreshTrigger, filterKey ] );
	const isLoadingStats = useSelect( select => select( 'accelerate' ).getIsLoadingStats(), [] );
	const { refreshStats } = useDispatch( 'accelerate' );

	// Aggregations (by_referer etc.) are not in the shared store, so fetch them locally.
	const [ aggs, setAggs ] = useState<Record<string, Record<string, number>> | null>( null );
	const [ aggsState, setAggsState ] = useState<SliceState>( 'loading' );
	const [ aggsError, setAggsError ] = useState<string | undefined>( undefined );
	const [ aggsPeriod, setAggsPeriod ] = useState<Duration | null>( null );

	useEffect( () => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, [] );

	useEffect( () => {
		if ( ! isMounted.current ) {
			return;
		}
		const currentId = ++requestId.current;
		const samePeriod = aggsPeriod === period;
		// SWR: keep last-known-good data while reloading the same period (realtime ticks).
		// Show skeleton only on period change or first load.
		setAggsState( prev => ( prev === 'loaded' && samePeriod ? 'loaded' : 'loading' ) );

		const { start, end } = resolveSelectedDate( period as any, null );
		const dateArgs = {
			start: start.toISOString(),
			end: end.toISOString(),
			interval,
		};

		apiFetch<Record<string, Record<string, number>>>( {
			path: addQueryArgs( AGGREGATIONS_ENDPOINT, {
				...dateArgs,
				fields: [ 'by_referer', 'by_source_campaign', 'by_source_medium', 'by_campaign', 'by_country', 'by_search_term', 'by_os', 'by_browser', ...( outboundEnabled ? [ 'by_outbound_host' ] : [] ) ].join( ',' ),
				...( hasFilter ? { filter } : {} ),
			} ),
		} ).then(
			result => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				setAggs( result );
				setAggsPeriod( period );
				setAggsError( undefined );
				setAggsState( 'loaded' );
			},
			( err: any ) => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				setAggsError( err?.message || undefined );
				setAggsState( 'error' );
			}
		);
	// realtimeTick, refreshTrigger and filterKey are intentional deps so each
	// tick/retry/filter-change refetches.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ period, realtimeTick, refreshTrigger, filterKey ] );

	const refresh = useCallback( () => {
		setRefreshTrigger( t => t + 1 );
		refreshStats();
	}, [ refreshStats ] );

	const mergedData = useMemo( (): StatsResult | null => {
		if ( ! storeStats ) {
			return null;
		}
		return {
			...storeStats,
			stats: {
				...storeStats.stats,
				...( aggs || {} ),
			},
		};
	}, [ storeStats, aggs ] );

	// The aggregation-backed tiles (referrers, country, UTM, search, tech,
	// outbound) get their rows from the separate /aggregations request, so they
	// must stay in skeleton until that request resolves — NOT flip to loaded the
	// moment the shared /stats summary arrives. `statsHasContent` is true as soon
	// as summary.views > 0, so gating on it alone would surface premature empty
	// states while /aggregations is still in flight. Checking aggs first fixes
	// that; aggsState stays 'loaded' across realtime ticks/refreshes (see the SWR
	// keep above), so this still avoids flashing skeleton bars on background
	// refresh — it only holds the skeleton on first load and period change.
	const state: SliceState =
		aggsState === 'error' ? 'error'
			: aggsState === 'loading' ? 'loading'
				: statsHasContent( mergedData ) ? 'loaded'
					: isLoadingStats ? 'loading'
						: 'empty';

	return {
		stats: {
			state,
			data: mergedData,
			error: aggsError,
		},
		refresh,
	};
}
