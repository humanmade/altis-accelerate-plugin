import { useCallback, useEffect, useRef, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

import { resolveSelectedDate } from '../../../data';
import { Duration, Filter } from '../../../utils/admin';

import { ContentItem, TopPost, toContentItems } from './toContentItems';

type SliceState = 'loading' | 'loaded' | 'empty' | 'error';

const TOP_ENDPOINT = '/accelerate/v1/top';

// Block-backed types whose rows rank by blockView impressions rather than
// page views, so they don't belong in a "Top content" list of full pages.
const NON_PAGE_TYPES = [ 'wp_block', 'broadcast' ];

/**
 * Comma-separated post type list for the /top `type` filter: every trackable
 * post type the admin app knows about (including custom post types) minus the
 * block-backed ones, so the tile only ranks full pages by pageView events.
 */
export function getPageContentTypes(): string {
	const postTypes = window.AltisAccelerateDashboardData?.post_types || [];
	return postTypes
		.map( type => type.name )
		.filter( name => ! NON_PAGE_TYPES.includes( name ) )
		.join( ',' ) || 'post,page';
}

export type TopContent = {
	state: SliceState;
	items: ContentItem[];
	refresh: () => void;
};

/**
 * Top posts by pageviews for the active period, shaped for a BreakdownPanel
 * tile. Mirrors useBreakdownStats: a local apiFetch with SWR — last-known-good
 * rows stay on screen while the same period reloads on each realtime tick, so
 * counts update without a skeleton flash. The /top endpoint already returns
 * view-ranked posts for start/end/interval, so there is no new backend.
 */
export function useTopContent( period: Duration, realtimeTick: number = 0, filter: Filter = {} ): TopContent {
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

		const { start, end, interval } = resolveSelectedDate( period as any, null );

		apiFetch<TopPost[]>( {
			path: addQueryArgs( TOP_ENDPOINT, {
				start: start.toISOString(),
				end: end.toISOString(),
				interval,
				page: 1,
				type: getPageContentTypes(),
				...( hasFilter ? { filter } : {} ),
			} ),
		} ).then(
			result => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
				const next = toContentItems( Array.isArray( result ) ? result : [] );
				setItems( next );
				setLoadedPeriod( period );
				setState( next.length > 0 ? 'loaded' : 'empty' );
			},
			() => {
				if ( ! isMounted.current || currentId !== requestId.current ) {
					return;
				}
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
		refresh,
	};
}
