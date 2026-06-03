import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { useDispatch, useSelect } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

import { resolveSelectedDate } from '../../../data';
import { Duration, StatsResult } from '../../../utils/admin';

type SliceState = 'loading' | 'loaded' | 'empty' | 'error';

type Slice<T> = {
	state: SliceState;
	data: T | null;
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

export function useBreakdownStats( period: Duration, realtimeTick: number = 0, outboundEnabled: boolean = false ): BreakdownStats {
	const isMounted = useRef( true );
	const requestId = useRef( 0 );
	// Incremented by refresh() to re-trigger both the aggregations fetch and the store resolver.
	const [ refreshTrigger, setRefreshTrigger ] = useState( 0 );

	// Stats come from the shared data store — same response as HeroChart avoids a duplicate request.
	const { interval } = resolveSelectedDate( period as any, null );
	const storeStats = useSelect( select => {
		return select( 'accelerate' ).getStats( {
			period,
			interval,
			...( refreshTrigger > 0 ? { refresh: refreshTrigger } : {} ),
		} );
	}, [ period, interval, refreshTrigger ] );
	const isLoadingStats = useSelect( select => select( 'accelerate' ).getIsLoadingStats(), [] );
	const { refreshStats } = useDispatch( 'accelerate' );

	// Aggregations (by_referer etc.) are not in the shared store, so fetch them locally.
	const [ aggs, setAggs ] = useState<Record<string, Record<string, number>> | null>( null );
	const [ aggsState, setAggsState ] = useState<SliceState>( 'loading' );
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
				fields: [ 'by_referer', 'by_source_campaign', 'by_source_medium', 'by_campaign', ...( outboundEnabled ? [ 'by_outbound_host' ] : [] ) ].join( ',' ),
			} ),
		} ).then(
			result => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				setAggs( result );
				setAggsPeriod( period );
				setAggsState( 'loaded' );
			},
			() => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				setAggsState( 'error' );
			}
		);
	// realtimeTick and refreshTrigger are intentional deps so each tick/retry refetches.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ period, realtimeTick, refreshTrigger ] );

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

	// SWR: if we already have content, keep showing it while isLoadingStats
	// cycles true/false on each realtime tick — avoids flashing skeleton bars.
	const state: SliceState =
		aggsState === 'error' ? 'error'
			: statsHasContent( mergedData ) ? 'loaded'
				: isLoadingStats || aggsState === 'loading' ? 'loading'
					: 'empty';

	return {
		stats: {
			state,
			data: mergedData,
		},
		refresh,
	};
}
