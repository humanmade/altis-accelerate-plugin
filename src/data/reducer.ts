import { Action, Post, State, PostMap } from '../utils/admin';

/**
 * Sort posts ascending order.
 *
 * @param {Object} a The first post object to sort.
 * @param {Object} b The second post object to sort.
 * @returns {number} Sort result value.
 */
const sortPosts = ( a: Post, b: Post ) : number => {
	// Check for errored posts.
	if ( a.error || b.error ) {
		return 0;
	}
	if ( a.views > b.views ) {
		return -1;
	}
	if ( a.views < b.views ) {
		return 1;
	}
	return 0;
};

/**
 * Convert posts array to a map.
 *
 * @param {Post[]} posts Posts array.
 * @returns {PostsMap}   Posts map keyed by ID.
 */
const arrayToMap = ( posts: Post[] ) : PostMap => {
	return posts.reduce( ( all: PostMap, post: Post ) => ( {
		...all,
		[ post.id ]: post
	} ), {} );
}

/**
 * Reducer for the dashboard data store.
 *
 * @param {Object} state The current state object.
 * @param {Object} action The action used to update the store.
 * @returns {Object} The updated state.
 */
export default function reducer( state: State, action: Action ) : State {
	switch ( action.type ) {

		case 'REFRESH_POSTS': {
			return {
				...state,
				queries: {},
			};
		}

		case 'SET_POSTS': {
			return {
				...state,
				posts: {
					...state.posts,
					...arrayToMap( action.posts ),
				},
				queries: {
					...state.queries,
					[ action.key ]: action.posts.sort( sortPosts ).map( post => post.id ),
				},
			};
		}

		case 'SET_POST': {
			return {
				...state,
				posts: {
					...state.posts,
					[ action.post.id ]: {
						...( state.posts[ action.post.id ] || {} ),
						...action.post,
					},
				},
			};
		}

		case 'REMOVE_POST': {
			const newState = {
				...state,
			}
			delete newState.posts[ action.id ];
			for ( const key in newState.queries ) {
				newState.queries[ key ] = newState.queries[ key ].filter( id => id !== action.id );
			}
			newState.pagination.total--;
			return newState;
		}

		case 'SET_STATS': {
			return {
				...state,
				stats: {
					...state.stats,
					[ action.key ]: action.stats,
				},
			};
		}

		case 'REFRESH_STATS': {
			return {
				...state,
				stats: {},
			};
		}

		case 'SET_DIFFS': {
			return {
				...state,
				diffs: {
					...( state?.diffs || {} ),
					[ action.key ]: action.diffs,
				},
			};
		}

		case 'SET_IS_LOADING': {
			return {
				...state,
				isLoading: action.isLoading,
			};
		}

		case 'SET_IS_LOADING_STATS': {
			return {
				...state,
				isLoadingStats: action.isLoading,
			};
		}

		case 'SET_IS_LOADING_DIFFS': {
			return {
				...state,
				isLoadingDiffs: action.isLoading,
			};
		}

		case 'SET_IS_UPDATING': {
			return {
				...state,
				isUpdating: action.isUpdating,
			};
		}

		case 'SET_PAGINATION': {
			return {
				...state,
				pagination: {
					total: action.total,
					pages: action.pages,
				},
			};
		}

		default: {
			return state;
		}
	}
}
