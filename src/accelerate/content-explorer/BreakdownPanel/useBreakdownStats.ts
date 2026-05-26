import { useCallback, useEffect, useRef, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

import { resolveSelectedDate } from '../../../data';
import { Duration, StatsResult } from '../../../utils/admin';

type SliceState = 'loading' | 'loaded' | 'empty' | 'error';

type Slice<T> = {
	state: SliceState;
	data: T | null;
};

const STATS_ENDPOINT = '/accelerate/v1/stats';

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

export function useBreakdownStats( period: Duration, realtimeTick: number = 0 ): BreakdownStats {
	const isMounted = useRef( true );
	// Monotonically increasing request id. Each load bumps it; only the
	// latest id's response is allowed to call setStats. Prevents a slow
	// "P90D" response from clobbering a fresh "Today" one when the user
	// changes period rapidly.
	const requestId = useRef( 0 );
	// Period that produced the currently-mounted data. SWR is only safe
	// for the same period — a period change must show the skeleton,
	// otherwise the user sees yesterday's numbers labelled as today
	// for the duration of the fetch.
	const dataPeriod = useRef<Duration | null>( null );
	const [ stats, setStats ] = useState<Slice<StatsResult>>( {
		state: 'loading',
		data: null,
	} );

	const load = useCallback( () => {
		if ( ! isMounted.current ) {
			return;
		}
		const currentId = ++requestId.current;
		const samePeriod = dataPeriod.current === period;
		// Stale-while-revalidate: only show the skeleton on the very
		// first load OR when the period changed. On realtime-tick
		// refetches (same period) keep the previous payload mounted so
		// rows layout-animate between snapshots instead of unmounting
		// and remounting.
		setStats( prev => ( prev.data && samePeriod ? prev : {
			state: 'loading',
			data: null,
		} ) );

		const { start, end, tz, interval } = resolveSelectedDate( period, null );

		apiFetch<StatsResult>( {
			path: addQueryArgs( STATS_ENDPOINT, {
				start: start.toISOString(),
				end: end.toISOString(),
				interval,
				tz,
			} ),
		} ).then(
			value => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				dataPeriod.current = period;
				setStats( {
					state: statsHasContent( value ) ? 'loaded' : 'empty',
					data: value,
				} );
			},
			() => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				// Keep last-known-good data on error so the panel doesn't
				// blank out when ClickHouse hiccups. State signals error
				// so callers can still surface a retry affordance.
				setStats( prev => ( {
					state: 'error',
					data: prev.data,
				} ) );
			}
		);
	// realtimeTick is intentionally part of the deps so each tick refetches.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ period, realtimeTick ] );

	useEffect( () => {
		isMounted.current = true;
		load();
		return () => {
			isMounted.current = false;
		};
	}, [ load ] );

	return {
		stats,
		refresh: load,
	};
}
