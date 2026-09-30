import { useCallback, useEffect, useRef, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { decodeEntities } from '@wordpress/html-entities';
import { addQueryArgs } from '@wordpress/url';

import { clampIntervalForFilter, resolveSelectedDate } from '../../../data';
import { Duration, Filter } from '../../../utils/admin';

import { ContentItem } from './toContentItems';
import { getPageContentTypes } from './useTopContent';

type SliceState = 'loading' | 'loaded' | 'empty' | 'error';

const TOP_ENGAGED_ENDPOINT = '/accelerate/v1/top-engaged';

// Shape returned by /accelerate/v1/top-engaged: one row per post, ranked by
// AVERAGE engaged seconds per visit (engaged_seconds is the per-visit average,
// not a summed total).
type TopEngagedPost = {
	id: number;
	title: string;
	engaged_seconds: number;
};

export type TopEngaged = {
	state: SliceState;
	items: ContentItem[];
	// Backend error message, surfaced in the tile's error state.
	error?: string;
	refresh: () => void;
};

/**
 * Top posts by engaged time for the active period, shaped for a BreakdownPanel
 * tile. Mirrors useTopContent: a local apiFetch with SWR — last-known-good rows
 * stay on screen while the same period reloads on each realtime tick, so the
 * list updates without a skeleton flash. The /top-engaged endpoint already
 * returns engagement-ranked posts for start/end/interval.
 */
export function useTopEngaged( period: Duration, realtimeTick: number = 0, filter: Filter = {} ): TopEngaged {
	const isMounted = useRef( true );
	const requestId = useRef( 0 );
	// Bumped by refresh() so the error-state retry can refetch on demand,
	// independent of the realtime tick.
	const [ refreshTrigger, setRefreshTrigger ] = useState( 0 );

	// Stable dependency key so a fresh-but-equal filter object doesn't refetch.
	const hasFilter = Object.keys( filter ).length > 0;
	const filterKey = JSON.stringify( filter );

	const [ items, setItems ] = useState<ContentItem[]>( [] );
	const [ state, setState ] = useState<SliceState>( 'loading' );
	const [ error, setError ] = useState<string | undefined>( undefined );
	const [ loadedPeriod, setLoadedPeriod ] = useState<Duration | null>( null );

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
		const samePeriod = loadedPeriod === period;
		// SWR: keep last-known-good rows while reloading the same period
		// (realtime ticks). Show skeleton only on period change or first load.
		setState( prev => ( prev === 'loaded' && samePeriod ? 'loaded' : 'loading' ) );

		const { start, end, interval: rawInterval } = resolveSelectedDate( period as any, null );
		// Filtered queries run against the raw table; only P7D is disallowed there — clamp it to P1D.
		const interval = clampIntervalForFilter( rawInterval, hasFilter );

		apiFetch<TopEngagedPost[]>( {
			path: addQueryArgs( TOP_ENGAGED_ENDPOINT, {
				start: start.toISOString(),
				end: end.toISOString(),
				interval,
				type: getPageContentTypes(),
				...( hasFilter ? { filter } : {} ),
			} ),
		} ).then(
			result => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				const next: ContentItem[] = ( Array.isArray( result ) ? result : [] ).map( post => ( {
					key: String( post.id ),
					value: post.engaged_seconds,
					label: decodeEntities( post.title || '' ) || '',
				} ) );
				setItems( next );
				setLoadedPeriod( period );
				setError( undefined );
				setState( next.length > 0 ? 'loaded' : 'empty' );
			},
			( err: any ) => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				setError( err?.message || undefined );
				setState( 'error' );
			}
		);
	// realtimeTick, refreshTrigger and filterKey are intentional deps so each
	// tick/retry/filter-change refetches.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ period, realtimeTick, refreshTrigger, filterKey ] );

	const refresh = useCallback( () => {
		setRefreshTrigger( t => t + 1 );
	}, [] );

	return {
		state,
		items,
		error,
		refresh,
	};
}
