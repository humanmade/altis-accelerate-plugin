/**
 * Altis Analytics data store.
 */

import { resolveQueryArgs } from "../../data";

const { apiFetch } = wp;
const { registerStore } = wp.data;
const { addQueryArgs } = wp.url;

const initialState = {
	posts: [],
	views: {},
	isLoading: false,
};

// Add API Fetch middleware to rewrite permissions lookups.
apiFetch.use( ( options, next ) => {
	if ( options.path ) {
		options.path = options.path.replace( 'wp/v2/xbs', 'accelerate/v1/xbs' );
	}
	return next( options );
} );

/**
 * Experience block redux store reducer.
 *
 * @param {Object} state Store state.
 * @param {Object} action Action object.
 * @returns {Object} Updated state.
 */
const reducer = function reducer( state, action ) {
	switch ( action.type ) {
		case 'ADD_VIEWS': {
			const key = `${ action.id }:${ btoa( JSON.stringify( action.args ) ) }`;
			return {
				...state,
				views: {
					...state.views,
					[ key ]: action.views,
				},
			};
		}

		case 'REMOVE_VIEWS': {
			const key = `${ action.id }:${ btoa( JSON.stringify( action.args ) ) }`;
			const { [ key ]: deletedItem, ...newState } = state;
			return newState;
		}

		case 'SET_IS_LOADING': {
			return {
				...state,
				isLoading: action.isLoading,
			};
		}

		case 'ADD_POST': {
			return {
				...state,
				posts: [ ...state.posts, action.post ],
			};
		}

		default: {
			return state;
		}
	}
};

const controls = {
	/**
	 * Fetch data from the API.
	 *
	 * @param {Object} action Action object.
	 * @returns {Promise} API request promise.
	 */
	FETCH_FROM_API( action ) {
		return apiFetch( action.options );
	},
	/**
	 * Convert API response to JSON object.
	 *
	 * @param {Object} action The action object.
	 * @param {Response} action.response Response object.
	 * @returns {Object} JSON data from request.
	 */
	RESPONSE_TO_JSON( action ) {
		return action.response.json();
	},
};

const actions = {
	/**
	 * Action creator for adding block analytics data.
	 *
	 * @param {integer} id Block client ID.
	 * @param {Object} args Optional filters for the query.
	 * @param {Object} views Analytics data.
	 * @returns {Object} Redux action object.
	 */
	addViews( id, args, views ) {
		return {
			type: 'ADD_VIEWS',
			id,
			args,
			views,
		};
	},
	/**
	 * Action creator to remove block analytics data.
	 *
	 * @param {integer} id The block client ID.
	 * @param {Object} args Optional filters for the query.
	 * @returns {Object} Redux action object.
	 */
	removeViews( id, args ) {
		return {
			type: 'REMOVE_VIEWS',
			id,
			args,
		};
	},
	/**
	 * Action creator for setting loading property.
	 *
	 * @param {boolean} isLoading True if currently loading data.
	 * @returns {Object} Redux action object.
	 */
	setIsLoading( isLoading ) {
		return {
			type: 'SET_IS_LOADING',
			isLoading,
		};
	},
	/**
	 * Action creator for adding a post to the store.
	 *
	 * @param {Object} post A post object.
	 * @returns {Object} Action creator object.
	 */
	addPost( post ) {
		return {
			type: 'ADD_POST',
			post,
		};
	},
	/**
	 * Action creator for fetching API data.
	 *
	 * @param {Object} options API fetch function options object.
	 * @returns {Object} Redux action object.
	 */
	fetch( options ) {
		return {
			type: 'FETCH_FROM_API',
			options,
		};
	},
	/**
	 * Action creator for converting Response object to JSON.
	 *
	 * @param {Reponse} response Response object.
	 * @returns {Object} Redux action object.
	 */
	json( response ) {
		return {
			type: 'RESPONSE_TO_JSON',
			response,
		};
	},
};

const selectors = {
	/**
	 * Get analytics data for a block.
	 *
	 * @param {Object} state Redux store state.
	 * @param {integer} id Block client ID.
	 * @param {Object} args Optional args to scope views data to.
	 * @returns {Object | boolean} Object of analytics data or false on failure.
	 */
	getViews( state, id, args = null ) {
		return state.views[ `${ id }:${ btoa( JSON.stringify( args ) ) }` ] || false;
	},
	/**
	 * Get loading state for analytics data.
	 *
	 * @param {Object} state Redux store state.
	 * @returns {boolean} True if data is currently loading.
	 */
	getIsLoading( state ) {
		return state.isLoading;
	},
	/**
	 * Get an XB post from the store.
	 *
	 * @param {Object} state The current store state.
	 * @param {integer} id The block's client ID.
	 * @returns {?Object} Post object or null.
	 */
	getPost( state, id ) {
		return state.posts.find( post => post.id === id ) || null;
	},
};

const resolvers = {
	/**
	 * Fetch block analytics data from API.
	 *
	 * @param {integer} id The block ID.
	 * @param {?Object} args Optional args for filtering the data.
	 * @returns {Object} Redux action object(s).
	 */
	*getViews( id, args = null ) {
		yield actions.setIsLoading( true );
		let path = `accelerate/v1/xbs/${ id }/views`;
		if ( args ) {
			path = addQueryArgs( path, resolveQueryArgs( args ) );
		}
		const response = yield actions.fetch( {
			path,
		} );
		yield actions.addViews( id, args, response );
		return actions.setIsLoading( false );
	},
	/**
	 * Get an experience block post.
	 *
	 * @param {integer} id The block client ID.
	 * @returns {Object} Redux action objects.
	 */
	*getPost( id ) {
		yield actions.setIsLoading( true );
		try {
			const response = yield actions.fetch( {
				path: `accelerate/v1/xbs/${ id }`,
			} );
			yield actions.addPost( response );
		} catch ( error ) {
			yield actions.addPost( {
				id,
				error,
			} );
		}
		return actions.setIsLoading( false );
	},
};

export const store = registerStore( 'accelerate/xbs', {
	actions,
	controls,
	initialState,
	reducer,
	resolvers,
	selectors,
} );
