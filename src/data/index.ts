import { map } from 'd3-array';
import moment, { DurationInputArg1, Moment } from 'moment';

import apiFetch, { APIFetchOptions } from '@wordpress/api-fetch';
import { createReduxStore } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

import {
	Post,
	RemovePostAction,
	SelectableDate,
	SetPostsAction,
	SetPostAction,
	SetPaginationAction,
	SetStatsAction,
	SetIsLoadingAction,
	SetIsLoadingStatsAction,
	SetIsUpdatingAction,
	SetStatsErrorAction,
	SetPostsErrorAction,
	State,
	StandardAction,
	StatsResult,
	RefreshPostsAction,
	RefreshStatsAction,
	QueryArgs,
	Filter,
	DiffsResult,
	SetDiffsAction,
	SetIsLoadingDiffsAction,
	PostUpdateObject,
	UpdatablePost,
} from '../utils/admin';

import reducer from './reducer';

const API_NAMESPACE = 'accelerate/v1';
const STATS_ENDPOINT = `${ API_NAMESPACE }/stats`;
const AGGREGATIONS_ENDPOINT = `${ API_NAMESPACE }/stats/aggregations`;
const TOP_ENDPOINT = `${ API_NAMESPACE }/top`;
const DIFF_ENDPOINT = `${ API_NAMESPACE }/diff`;

const POST_TYPE_ENDPOINTS = {
	broadcast: `${ API_NAMESPACE }/broadcast`,
};

const ONE_DAY = moment.duration( 1, 'day' );

type ResolvedDate = {
	start: Moment,
	end: Moment,
	interval: QueryArgs['interval'],
}

// Read the site's timezone, localized from PHP (see inc/dashboard/namespace.php).
// `string` is the IANA name when configured; otherwise empty, and `offset`
// (hours) carries a manual UTC offset. Defaults to UTC when the global is
// absent (tests / non-dashboard mounts) rather than throwing.
const getSiteTimezone = () : { name: string, offsetMinutes: number } => {
	const tz = ( typeof window !== 'undefined' && window.AltisAccelerateDashboardData?.timezone ) || null;
	return {
		name: tz?.string || '',
		offsetMinutes: Math.round( ( tz?.offset ?? 0 ) * 60 ),
	};
};

// The site's UTC offset (minutes) at a specific instant. Uses the IANA name via
// the built-in Intl API when available (DST-correct, per-date), falling back to
// the fixed manual offset. The day the dashboard buckets must match the site's
// calendar day, not the viewer's browser day (#681).
export const siteOffsetMinutesAt = ( instant: Moment ) : number => {
	const { name, offsetMinutes } = getSiteTimezone();
	if ( ! name ) {
		return offsetMinutes;
	}
	try {
		const parts = new Intl.DateTimeFormat( 'en-US', {
			timeZone: name,
			timeZoneName: 'longOffset',
		} ).formatToParts( instant.toDate() );
		const tzName = parts.find( p => p.type === 'timeZoneName' )?.value || '';
		const match = tzName.match( /GMT([+-])(\d{1,2})(?::?(\d{2}))?/ );
		if ( match ) {
			const sign = match[1] === '-' ? -1 : 1;
			return sign * ( parseInt( match[2], 10 ) * 60 + parseInt( match[3] || '0', 10 ) );
		}
		// Bare "GMT" means UTC.
		if ( /GMT$/.test( tzName ) ) {
			return 0;
		}
	} catch ( e ) {
		// Intl timezone data unavailable — fall back to the fixed offset.
	}
	return offsetMinutes;
};

// Clone a moment and pin its display offset to the site timezone *at that
// instant*, so `startOf('day')` / `endOf('day')` land on the site's calendar
// day. The underlying instant is unchanged — only the wall-clock the day
// boundaries are computed against.
const inSiteTimezone = ( instant: Moment ) : Moment => {
	const clone = instant.clone();
	return clone.utcOffset( siteOffsetMinutesAt( clone ) );
};

export const resolveSelectedDate = ( period: SelectableDate, diff: SelectableDate | null ) : ResolvedDate => {
	// Calendar-day windows. Hourly resolution. Boundaries are the *site's*
	// calendar day, independent of the viewer's browser timezone.
	if ( period === 'TODAY' ) {
		return {
			start: inSiteTimezone( moment() ).startOf( 'day' ),
			end: moment(),
			interval: 'PT1H',
		};
	}
	if ( period === 'YESTERDAY' ) {
		const yesterday = inSiteTimezone( moment().subtract( 1, 'day' ) );
		return {
			start: yesterday.clone().startOf( 'day' ),
			end: yesterday.clone().endOf( 'day' ),
			interval: 'PT1H',
		};
	}

	const dur = moment.duration( period as DurationInputArg1 );

	// Is this realtime (less than 1 day)? Absolute window — timezone-agnostic.
	if ( dur.asDays() < 1 ) {
		const end = moment().endOf( 'minute' );
		const start = moment( end ).subtract( dur ).startOf( 'minute' );
		return {
			start,
			end,
			interval: 'PT1M',
		};
	}

	const diffDur = moment.duration( diff as DurationInputArg1 );
	const end = inSiteTimezone( moment().subtract( diffDur ) ).endOf( 'day' );
	const start = inSiteTimezone( moment( end ).subtract( dur ).add( 1, 'day' ) ).startOf( 'day' );
	return {
		start,
		end,
		interval: 'P1D',
	};
};

// When any path/post/audience/dimension filter is active the query runs
// against the raw events table. The day-bucket prune (see get_graph_data() in
// inc/api/namespace.php) keeps minute/hour/day scans cheap, so PT1M / PT1H /
// P1D are all allowed under a filter. Only the 7-day rollup (P7D, up to a
// 90-day single scan) still 400s with analytics.invalid_resolution, so clamp
// it down to P1D — the fallback the backend recommends. No-op otherwise.
export const clampIntervalForFilter = ( interval: string, hasFilter: boolean ) : string => {
	if ( hasFilter && interval !== 'PT1M' && interval !== 'PT1H' && interval !== 'P1D' ) {
		return 'P1D';
	}
	return interval;
};

// Calendar-aware prior-window resolver. Returns `null` for periods
// where a prior comparison doesn't make sense (sub-day windows where
// the noise would dominate any signal). For everything else, delegates
// to `resolveSelectedDate` with semantics that match what a user
// reading "vs. previous" would expect — yesterday for TODAY, the prior
// N-day calendar window for P7D/P14D/etc. Subtracting raw ms across
// DST is the foot-gun this avoids.
// Realtime view shows the full 30-minute fetch window (PT30M). Pair
// this with `resolveCurrentRealtimeWindow()` so the metric strip
// compares last-30 vs prior-30 on the same boundaries as the chart.
export const REALTIME_VISIBLE_MINUTES = 30;

export const resolveCurrentRealtimeWindow = () : ResolvedDate => {
	const end = moment().endOf( 'minute' );
	const start = end.clone().subtract( REALTIME_VISIBLE_MINUTES, 'minutes' ).startOf( 'minute' );
	return {
		start,
		end,
		interval: 'PT1M',
	};
};

export const resolvePriorPeriod = ( period: SelectableDate ) : ResolvedDate | null => {
	if ( period === 'PT30M' ) {
		// Previous 30-minute window, aligned to the current realtime
		// visible window (the full PT30M fetch).
		const currentEnd = moment().endOf( 'minute' );
		const priorEnd = currentEnd.clone().subtract( REALTIME_VISIBLE_MINUTES, 'minutes' );
		const priorStart = priorEnd.clone().subtract( REALTIME_VISIBLE_MINUTES, 'minutes' ).startOf( 'minute' );
		return {
			start: priorStart,
			end: priorEnd,
			interval: 'PT1M',
		};
	}
	if ( period === 'TODAY' ) {
		// "Today so far" → yesterday clipped to the same elapsed time.
		// Comparing partial-today against full-yesterday would always
		// look catastrophic at 9am (current = 3hrs, prior = 24hrs);
		// clipping makes the two windows the same shape. Elapsed time and
		// day boundaries are measured in the site timezone.
		const siteNow = inSiteTimezone( moment() );
		const elapsedMs = siteNow.diff( siteNow.clone().startOf( 'day' ) );
		const yesterdayStart = inSiteTimezone( moment().subtract( 1, 'day' ) ).startOf( 'day' );
		return {
			start: yesterdayStart,
			end: yesterdayStart.clone().add( elapsedMs, 'ms' ),
			interval: 'PT1H',
		};
	}
	if ( period === 'YESTERDAY' ) {
		// Yesterday is a settled calendar day — prior is the previous
		// settled calendar day in full. No partial-window correction
		// needed.
		const dayBefore = inSiteTimezone( moment().subtract( 2, 'day' ) );
		return {
			start: dayBefore.clone().startOf( 'day' ),
			end: dayBefore.clone().endOf( 'day' ),
			interval: 'PT1H',
		};
	}
	const dur = moment.duration( period as DurationInputArg1 );
	if ( dur.asDays() < 1 ) {
		return null;
	}
	// No data beyond 90 days — suppress the prior-period comparison.
	if ( dur.asDays() >= 90 ) {
		return null;
	}
	// P7D/P14D/P30D — diff arg shifts the window back by one full
	// period length, using the same day-boundary semantics as the main
	// fetch.
	return resolveSelectedDate( period, period );
};

export const resolvePriorStatsArgs = ( period: SelectableDate, rawInterval: string, filter: Filter = {} ) : QueryArgs | null => {
	const prior = resolvePriorPeriod( period );
	if ( ! prior ) {
		return null;
	}
	const hasFilter = Object.keys( filter ).length > 0;
	return {
		start: prior.start.toISOString(),
		end: prior.end.toISOString(),
		interval: clampIntervalForFilter( rawInterval, hasFilter ) as QueryArgs['interval'],
		...( hasFilter ? { filter } : {} ),
	};
};

const mapToKey = ( obj: QueryArgs ) : string => {
	// Include period in the cache key since resolveQueryArgs discards it.
	// Without this, different periods (P7D, P30D, P90D) with the same interval
	// would share the same cache key and return stale data.
	const resolved = resolveQueryArgs( obj );
	const withPeriod = obj.period ? {
		...resolved,
		period: obj.period,
	} : resolved;

	return Object.entries( withPeriod )
		.filter( ( [ k ] ) => [ 'start', 'end' ].indexOf( k ) === -1 )
		.map( ( [ k, v ] ) => `${ k }:${ JSON.stringify( v ) }` )
		.sort()
		.join( ';' );
};

export const resolveQueryArgs = ( queryArgs: QueryArgs = {} ) : QueryArgs => {
	const { start, end, interval } = resolveSelectedDate(
		queryArgs.period || 'P7D',
		queryArgs.diff || null
	);

	// Discard unused parameters.
	const {
		period: _1,
		diff: _2,
		refresh: _3,
		aggregations: _4,
		interval: explicitInterval,
		...minimalQueryArgs
	} = queryArgs;

	return {
		end: end.toISOString(),
		start: start.toISOString(),
		interval: explicitInterval || interval || 'P1D',
		...minimalQueryArgs,
	};
};

const initialState: State = {
	isLoading: true,
	isLoadingStats: true,
	isLoadingDiffs: true,
	isUpdating: false,
	statsError: null,
	postsError: null,
	pagination: {
		total: 0,
		pages: 0,
	},
	posts: {},
	queries: {},
	stats: {},
	diffs: {},
};

interface FetchAction extends StandardAction {
	type: 'FETCH_FROM_API',
	options: APIFetchOptions,
}

interface ResponseAction extends StandardAction {
	type: 'RESPONSE_TO_JSON',
	response: Response,
}

type Responses = Post[] | StatsResult | DiffsResult;

const controls = {
	/**
	 * @param {object} action Action object.
	 * @returns {Promise} API fetch promise.
	 */
	FETCH_FROM_API( action: FetchAction ) : Promise<Response | Responses> {
		return apiFetch( {
			credentials: 'same-origin',
			...action.options,
		} );
	},
	/**
	 * @param {object} action Fetch Promise result.
	 * @returns {Promise} Fetch response to JSON Promise.
	 */
	RESPONSE_TO_JSON( action: ResponseAction ) : Promise<Responses> {
		return action.response.json();
	},
};

const actions = {
	/**
	 * Refresh posts action creator.
	 *
	 * @returns {object} Refresh posts action object.
	 */
	refreshPosts() : RefreshPostsAction {
		return {
			type: 'REFRESH_POSTS',
		};
	},
	/**
	 * Add posts action creator.
	 *
	 * @param {Array} posts Posts to add to store.
	 * @param {string} key A query cache key for the results.
	 * @returns {object} Add posts action object.
	 */
	setPosts( posts: Post[], key: string ) : SetPostsAction {
		return {
			type: 'SET_POSTS',
			posts,
			key,
		};
	},
	/**
	 * Update a post entry.
	 *
	 * @param {UpdatablePost} post Updated post entry.
	 * @returns {object} Update post action object.
	 */
	setPost( post: UpdatablePost ) : SetPostAction {
		return {
			type: 'SET_POST',
			post,
		};
	},
	/**
	 * Remove a post entry.
	 *
	 * @param {number} id Updated post entry.
	 * @returns {object} Update post action object.
	 */
	removePost( id: number ) : RemovePostAction {
		return {
			type: 'REMOVE_POST',
			id,
		};
	},
	/**
	 * Add stats action creator.
	 *
	 * @param {Array} stats Posts to add to store.
	 * @param {string} key A query cache key for the results.
	 * @returns {object} Add stats action object.
	 */
	setStats( stats: StatsResult, key: string ) : SetStatsAction {
		return {
			type: 'SET_STATS',
			stats,
			key,
		};
	},
	/**
	 * Refresh stats action creator.
	 *
	 * @returns {object} Refresh stats action.
	 */
	refreshStats() : RefreshStatsAction {
		return {
			type: 'REFRESH_STATS',
		};
	},
	/**
	 * Add stats action creator.
	 *
	 * @param {Array} diffs Post diffs to add to store.
	 * @param {string} key A query cache key for the results.
	 * @returns {object} Add stats action object.
	 */
	setDiffs( diffs: DiffsResult, key: string ) : SetDiffsAction {
		return {
			type: 'SET_DIFFS',
			diffs,
			key,
		};
	},
	/**
	 * Set is loading action creator.
	 *
	 * @param {boolean} isLoading True if UI is loading.
	 * @returns {object} Set loading action object.
	 */
	setIsLoading( isLoading: boolean ) : SetIsLoadingAction {
		return {
			type: 'SET_IS_LOADING',
			isLoading,
		};
	},
	/**
	 * Set is loading action creator.
	 *
	 * @param {boolean} isLoading True if UI is loading.
	 * @returns {object} Set loading action object.
	 */
	setIsLoadingStats( isLoading: boolean ) : SetIsLoadingStatsAction {
		return {
			type: 'SET_IS_LOADING_STATS',
			isLoading,
		};
	},
	setPostsError( error: string | null ) : SetPostsErrorAction {
		return {
			type: 'SET_POSTS_ERROR',
			error,
		};
	},
	setStatsError( error: string | null ) : SetStatsErrorAction {
		return {
			type: 'SET_STATS_ERROR',
			error,
		};
	},
	/**
	 * Set is loading action creator.
	 *
	 * @param {boolean} isLoading True if UI is loading.
	 * @returns {object} Set loading action object.
	 */
	setIsLoadingDiffs( isLoading: boolean ) : SetIsLoadingDiffsAction {
		return {
			type: 'SET_IS_LOADING_DIFFS',
			isLoading,
		};
	},
	/**
	 * Set is updating action creator.
	 *
	 * @param {boolean} isUpdating True if UI is updating data.
	 * @returns {object} Set updating action object.
	 */
	setIsUpdating( isUpdating: boolean ) : SetIsUpdatingAction {
		return {
			type: 'SET_IS_UPDATING',
			isUpdating,
		};
	},
	/**
	 * Set pagination action creator.
	 *
	 * @param {number} total Total found posts.
	 * @param {number} pages Total number of pages.
	 * @returns {object} Set pagination action object.
	 */
	setPagination( total: number, pages: number ) : SetPaginationAction {
		return {
			type: 'SET_PAGINATION',
			total,
			pages,
		};
	},
	/**
	 * Fetch action creator.
	 *
	 * @param {object} options Fetch function options.
	 * @returns {object} Fetch action object.
	 */
	fetch( options: APIFetchOptions ) : FetchAction {
		return {
			type: 'FETCH_FROM_API',
			options,
		};
	},
	/**
	 * Response to JSON action creator.
	 *
	 * @param {Response} response Fetch response object.
	 * @returns {object} JSON response action object.
	 */
	json( response: Response ) : ResponseAction {
		return {
			type: 'RESPONSE_TO_JSON',
			response,
		};
	},
};

const actionGenerators = {
	/**
	 * Create post generator.
	 *
	 * @param {object} post Post object.
	 * @returns {object} Action objects.
	 */
	*createPost( post: PostUpdateObject ) {
		yield actions.setIsUpdating( true );

		const response: { [ k: string ] : any } = yield actions.fetch( {
			path: 'accelerate/v1/broadcast',
			method: 'POST',
			data: post,
		} );

		if ( ! response ) {
			return;
		}

		const createdPost = {
			id: response.id,
			title: response?.title?.rendered,
			type: {
				name: response.type,
			},
			blocks: [],
			date: response.date,
		};

		yield actions.setPost( createdPost );
		yield actions.setIsUpdating( false );

		return createdPost;
	},

	/**
	 * Update post action generator.
	 *
	 * @param {UpdatablePost} post Post object.
	 * @returns {object} Action objects.
	 */
	*updatePost( post: UpdatablePost ) {
		if ( ! post.id ) {
			return;
		}

		// Optimistic update: immediately update the store
		yield actions.setPost( post );
		yield actions.setIsUpdating( true );

		const response: { [ k: string ] : any } = yield actions.fetch( {
			path: `accelerate/v1/broadcast/${ post.id }`,
			method: 'PATCH',
			data: post,
		} );

		yield actions.setIsUpdating( false );

		if ( ! response ) {
			return;
		}

		// Sync server response as authoritative (convert blocks to numbers for type consistency)
		yield actions.setPost( {
			id: response.id,
			title: response?.title?.rendered ?? '',
			blocks: ( response?.blocks ?? [] ).map( Number ),
		} );

		return post;
	},
	*deletePost( id: number ) {
		if ( ! id ) {
			return;
		}
		yield actions.setIsUpdating( true );

		const response: object = yield actions.fetch( {
			path: `accelerate/v1/broadcast/${ id }?force=true`,
			method: 'DELETE',
		} );

		if ( ! response ) {
			return;
		}
		yield actions.removePost( id );
		yield actions.setIsUpdating( false );

		return;
	},
};

const selectors = {
	/**
	 * Get stats.
	 *
	 * @param {object} state The redux store state.
	 * @param {object} queryArgs The query args object.
	 * @returns {Array} List of all available posts.
	 */
	getStats( state: State, queryArgs: QueryArgs = {} ) {
		return state.stats[ mapToKey( queryArgs ) ];
	},
	/**
	 * Get all posts.
	 *
	 * @param {object} state The redux store state.
	 * @param {object} queryArgs The query args object.
	 * @returns {Array} List of all available posts.
	 */
	getPosts( state: State, queryArgs: QueryArgs = {} ) {
		const postIds = state.queries[ mapToKey( queryArgs ) ] || [];
		return postIds.map( id => state.posts[ id ] || null );
	},
	/**
	 * Get a post.
	 *
	 * @param {object} state  The redux store state.
	 * @param {number} id     The post ID.
	 * @returns {Post | null} The requested post object.
	 */
	getPost( state: State, id: number ) {
		return state.posts[ id ] || null;
	},
	/**
	 * Get all post diffs.
	 *
	 * @param {object} state The redux store state.
	 * @param {object} queryArgs The query args object.
	 * @returns {object} List of all available post diffs.
	 */
	getDiffs( state: State, queryArgs: QueryArgs = {} ) {
		return state.diffs[ mapToKey( queryArgs ) ] || {};
	},
	/**
	 * Get pagination data.
	 *
	 * @param {object} state The redux store state.
	 * @returns {object} Current pagination data.
	 */
	getPagination( state: State ) {
		return state.pagination;
	},
	getPostsError( state: State ) {
		return state.postsError || null;
	},
	/**
	 * Get loading status.
	 *
	 * @param {object} state The redux store state.
	 * @returns {boolean} True if currently loading.
	 */
	getIsLoading( state: State ) {
		return state.isLoading;
	},
	/**
	 * Get loading status.
	 *
	 * @param {object} state The redux store state.
	 * @returns {boolean} True if currently loading.
	 */
	getIsLoadingStats( state: State ) {
		return state.isLoadingStats;
	},
	/**
	 * Get loading status.
	 *
	 * @param {object} state The redux store state.
	 * @returns {boolean} True if currently loading.
	 */
	getIsLoadingDiffs( state: State ) {
		return state.isLoadingDiffs;
	},
	getStatsError( state: State ) {
		return state.statsError;
	},
	/**
	 * Get loading status.
	 *
	 * @param {object} state The redux store state.
	 * @returns {boolean} True if currently loading.
	 */
	getIsUpdating( state: State ) {
		return state.isUpdating;
	},
};

const resolvers = {
	/**
	 * Resolve request for multiple posts.
	 *
	 * @param {object} queryArgs Query args to pass to the REST API query. Possible parameters include context, per_page, page, search or status.
	 * @returns {object} Action objects.
	 */
	*getPosts( queryArgs: QueryArgs = {}, isMainQuery = true ) {
		if ( isMainQuery ) {
			yield actions.setPostsError( null );
			yield actions.setIsLoading( true );
		}

		try {
			const resolvedArgs = resolveQueryArgs( queryArgs );
			const response: Response = yield actions.fetch( {
				path: addQueryArgs( TOP_ENDPOINT, resolvedArgs ),
				headers: {
					'Access-Control-Expose-Headers': 'X-WP-Total, X-WP-TotalPages',
				},
				parse: false,
			} );
			if ( ! response ) {
				throw new Error( 'No content response' );
			}
			const posts: Post[] = yield actions.json( response );
			yield actions.setPosts( posts, mapToKey( queryArgs ) );

			if ( isMainQuery ) {
				yield actions.setPagination(
					parseInt( response.headers.get( 'x-wp-total' ) || '0', 10 ),
					parseInt( response.headers.get( 'x-wp-totalpages' ) || '0', 10 )
				);
			}
			return posts;
		} catch ( error ) {
			if ( isMainQuery ) {
				yield actions.setPostsError( 'content_request_failed' );
			} else {
				throw error;
			}
		} finally {
			if ( isMainQuery ) {
				yield actions.setIsLoading( false );
			}
		}
	},
	/**
	 * Resolve request for a single post.
	 *
	 * @param {number} id Post ID to query.
	 * @returns {object} Action objects.
	 */
	*getPost( id: number, type: string ) {
		const queryArgs = resolveQueryArgs( {
			include: [ id ],
			type: type,
		} );

		const result: Response = yield actions.fetch( {
			path: addQueryArgs( TOP_ENDPOINT, queryArgs ),
			headers: {
				'Access-Control-Expose-Headers': 'X-WP-Total, X-WP-TotalPages',
			},
			parse: false,
		} );

		if ( ! result ) {
			return;
		}

		const posts: Post[] = yield actions.json( result );
		return posts[0];
	},
	/**
	 * Resolve request for stats.
	 *
	 * @param {object} queryArgs Arguments for the stats request.
	 * @returns {object} Action objects.
	 */
	*getStats( queryArgs: QueryArgs = {} ) {
		yield actions.setIsLoadingStats( true );

		const resolved = resolveQueryArgs( queryArgs );
		let stats: StatsResult;
		try {
			stats = yield actions.fetch( {
				path: addQueryArgs( STATS_ENDPOINT, resolved ),
			} );
		} catch ( err: any ) {
			yield actions.setStatsError( err?.message || 'Failed to load analytics data.' );
			return actions.setIsLoadingStats( false );
		}
		if ( ! stats ) {
			return actions.setIsLoadingStats( false );
		}
		yield actions.setStats( stats, mapToKey( queryArgs ) );
		yield actions.setIsLoadingStats( false );

		// Only fetch aggregations when the caller explicitly requests them.
		if ( ! queryArgs.aggregations?.length ) {
			return;
		}

		// Fetch aggregations separately so the graph is not blocked.
		// Strip `time` so realtime ticks don't re-fetch aggregations on every poll.
		const { time: _time, ...resolvedForAggs } = resolved as typeof resolved & { time?: unknown };
		const aggsParams = {
			...resolvedForAggs,
			fields: queryArgs.aggregations.join( ',' ),
		};
		let aggs;
		try {
			aggs = yield actions.fetch( {
				path: addQueryArgs( AGGREGATIONS_ENDPOINT, aggsParams ),
			} );
		} catch ( _err ) {
			// Aggregations failure is non-fatal — base stats are already in the store.
			return;
		}
		if ( aggs ) {
			yield actions.setStats(
				{
					...stats,
					stats: {
						...stats.stats,
						...aggs,
					},
				},
				mapToKey( queryArgs )
			);
		}
	},
	/**
	 * Resolve request for diffs.
	 *
	 * @param {object} queryArgs Arguments for the diffs request.
	 * @returns {object} Action objects.
	 */
	*getDiffs( queryArgs: QueryArgs = {} ) {
		yield actions.setIsLoadingDiffs( true );

		const diffs: DiffsResult = yield actions.fetch( {
			path: addQueryArgs( DIFF_ENDPOINT, resolveQueryArgs( queryArgs ) ),
		} );

		yield actions.setDiffs( diffs || {}, mapToKey( queryArgs ) );
		return actions.setIsLoadingDiffs( false );
	},
};

export const store = createReduxStore( 'accelerate', {
	actions: {
		...actions,
		...actionGenerators,
	},
	controls,
	initialState,
	reducer,
	resolvers,
	selectors,
} );

declare module '@wordpress/data' {
    function dispatch( key: 'accelerate' ): typeof actions;
    function select( key: 'accelerate' ): typeof selectors;
}
