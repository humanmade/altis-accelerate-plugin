import apiFetch from '@wordpress/api-fetch';
import { registerStore } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

import {
	defaultAudience,
	defaultPost,
} from './defaults';
import reducer from './reducer';
import { Audience, Estimate, Field, Post, State } from '../types';

type Fields = Field[];
type FetchOptions = any;

//* @param {Object} queryArgs Query args to pass to the REST API query. Possible parameters include context, per_page, page, search or status.
type QueryArgs = {
	context?: string,
	per_page?: number,
	page?: number,
	search?: string,
	status?: string,
};

const initialState: State = {
	estimates: {},
	fields: [],
	pagination: {},
	post: defaultPost,
	posts: [],
	isLoading: false,
	isUpdating: false,
	isDeleting: false,
};

type Action = {
	type: string,
	[ key: string ]: any,
};

// Add API Fetch middleware to rewrite permissions lookups.
apiFetch.use( ( options, next ) => {
	if ( options.path ) {
		options.path = options.path.replace( 'wp/v2/audiences', 'accelerate/v1/audiences' );
	}
	return next( options );
} );

const controls = {
	FETCH_FROM_API( action: Action ): Promise<any> {
		return apiFetch( action.options );
	},

	RESPONSE_TO_JSON( action: Action ): Promise<any> {
		return action.response.json();
	},
};

const actions = {
	/**
	 * Set fields action creator.
	 */
	setFields( fields: Fields ) {
		return {
			type: 'SET_FIELDS',
			fields,
		};
	},

	/**
	 * Add posts action creator.
	 */
	addPosts( posts: Partial<Post>[] ) : Action {
		return {
			type: 'ADD_POSTS',
			posts,
		};
	},

	/**
	 * Add estimate action creator.
	 */
	addEstimate( audience: Audience, estimate: Estimate ) {
		return {
			type: 'ADD_ESTIMATE',
			audience,
			estimate,
		};
	},

	/**
	 * Remove post action creator.
	 */
	removePost( id: number ) {
		return {
			type: 'REMOVE_POST',
			id,
		};
	},

	/**
	 * Set current post action creator.
	 */
	setCurrentPost( post: Post ) {
		return {
			type: 'SET_CURRENT_POST',
			post,
		};
	},

	/**
	 * Update current post action creator.
	 */
	updateCurrentPost( post: Post ) {
		return {
			type: 'UPDATE_CURRENT_POST',
			post,
		};
	},

	/**
	 * Set is loading action creator.
	 */
	setIsLoading( isLoading: boolean ) {
		return {
			type: 'SET_IS_LOADING',
			isLoading,
		};
	},

	/**
	 * Set updating action creator.
	 */
	setIsUpdating( isUpdating: boolean ) {
		return {
			type: 'SET_IS_UPDATING',
			isUpdating,
		};
	},

	/**
	 * Set deleting action creator.
	 */
	setIsDeleting( isDeleting: boolean ) {
		return {
			type: 'SET_IS_DELETING',
			isDeleting,
		};
	},

	/**
	 * Set pagination action creator.
	 */
	setPagination( total: number, pages: number ) {
		return {
			type: 'SET_PAGINATION',
			total,
			pages,
		};
	},

	/**
	 * Fetch action creator.
	 */
	fetch( options: FetchOptions ) {
		return {
			type: 'FETCH_FROM_API',
			options,
		};
	},

	/**
	 * Response to JSON action creator.
	 */
	json( response: Response ) {
		return {
			type: 'RESPONSE_TO_JSON',
			response,
		};
	},
};

const actionGenerators = {
	/**
	 * Create post generator.
	 */
	*createPost( post: Post ) :  Generator<Action, Action, any> {
		yield actions.setIsUpdating( true );
		const newPost: Post = yield actions.fetch( {
			path: 'accelerate/v1/audiences',
			method: 'POST',
			data: post,
		} );
		yield actions.addPosts( [ newPost ] );
		yield actions.updateCurrentPost( newPost );
		return actions.setIsUpdating( false );
	},

	/**
	 * Update post generator.
	 */
	*updatePost( post: Post ) : Generator<Action, Action | undefined, any> {
		if ( ! post.id ) {
			return;
		}
		yield actions.setIsUpdating( true );
		// Raw value is also required to update the title.
		if ( post.title && ! post.title.raw ) {
			post.title.raw = post.title.rendered;
		}
		const updatedPost: Post = yield actions.fetch( {
			path: `accelerate/v1/audiences/${ post.id }`,
			method: 'PATCH',
			data: post,
		} );
		yield actions.updateCurrentPost( updatedPost );
		return actions.setIsUpdating( false );
	},

	/**
	 * Delete post generator.
	 */
	*deletePost( id: number ) : Generator<Action> {
		yield actions.setIsDeleting( true );
		yield actions.fetch( {
			path: `accelerate/v1/audiences/${ id }`,
			method: 'DELETE',
		} );
		yield actions.removePost( id );
		return actions.setIsDeleting( false );
	},
};

const selectors = {
	/**
	 * Get audiences fields.
	 */
	getFields( state: State ) {
		return state.fields;
	},

	/**
	 * Get estimate data.
	 */
	getEstimate( state: State, audience: Audience ) {
		const key = JSON.stringify( audience );
		return state.estimates[ key ] || {
			count: 0,
			isLoading: false,
			total: 0,
			histogram: new Array( 28 ).fill( { count: 1 } ), // Build empty histogram data.
		};
	},

	/**
	 * Get a post by ID.
	 */
	getPost( state: State, id : number ) {
		return state.posts.find( post => post.id === id );
	},

	/**
	 * Gets the currently selected post.
	 */
	getCurrentPost( state: State ) {
		return state.post;
	},

	/**
	 * Get all posts.
	 */
	getPosts( state: State ) {
		return state.posts;
	},

	/**
	 * Get pagination data.
	 */
	getPagination( state: State ) {
		return state.pagination;
	},

	/**
	 * Get loading status.
	 */
	getIsLoading( state: State ) {
		return state.isLoading;
	},

	/**
	 * Get updating status.
	 */
	getIsUpdating( state: State ) {
		return state.isUpdating;
	},

	/**
	 * Get deleting status.
	 */
	getIsDeleting( state: State ) {
		return state.isDeleting;
	},
};

const resolvers = {
	/**
	 * Resovle field request.
	 *
	 * @returns {Object} Action objects.
	 */
	*getFields() : Generator<Action, Action, any> {
		const fields: Fields = yield actions.fetch( {
			path: 'accelerate/v1/audiences/fields',
		} );
		return actions.setFields( fields );
	},

	/**
	 * Resolve estimate request.
	 */
	*getEstimate( audience: Audience ) : Generator<Action, Action, any> {
		yield actions.addEstimate( audience, {
			count: 0,
			isLoading: true,
			total: 0,
			histogram: new Array( 28 ).fill( { count: 1 } ), // Build empty histogram data.
		} );
		const audienceQuery = encodeURIComponent( JSON.stringify( audience ) );
		const estimate: Estimate = yield actions.fetch( {
			path: `accelerate/v1/audiences/estimate?audience=${ audienceQuery }`,
		} );
		estimate.histogram = estimate.histogram || new Array( 28 ).fill( { count: 1 } );
		estimate.isLoading = false;
		return actions.addEstimate( audience, estimate );
	},

	/**
	 * Resolve request for post.
	 */
	*getPost( id: number, queryArgs: QueryArgs = {} ) : Generator<Action, Action | undefined, any> {
		if ( ! id ) {
			return;
		}
		yield actions.setIsLoading( true );

		// Default context to view only.
		queryArgs = Object.assign( {
			context: 'view',
		}, queryArgs );

		try {
			const post: Post = yield actions.fetch( {
				path: addQueryArgs( `accelerate/v1/audiences/${ id }`, queryArgs ),
			} );
			if ( post.status === 'auto-draft' ) {
				post.title.rendered = '';
			}
			if ( ! post.audience ) {
				post.audience = defaultAudience;
			}
			yield actions.addPosts( [ post ] );
		} catch ( error ) {
			// Add the post ID to the error response.
			yield actions.addPosts( [
				{
					id,
					error,
				},
			] );
		}
		return actions.setIsLoading( false );
	},

	/**
	 * Resolve request for current post.
	 */
	*getCurrentPost( id: number, queryArgs: QueryArgs = {} ) : Generator<Action, Action | undefined, any> {
		if ( ! id ) {
			return;
		}
		yield actions.setIsLoading( true );

		queryArgs = Object.assign( {
			context: 'view',
		}, queryArgs );

		const post: Post = yield actions.fetch( {
			path: addQueryArgs( `accelerate/v1/audiences/${ id }`, queryArgs ),
		} );
		if ( post.status === 'auto-draft' ) {
			post.title.rendered = '';
		}
		if ( ! post.audience ) {
			post.audience = defaultAudience;
		}
		yield actions.addPosts( [ post ] );
		yield actions.setCurrentPost( post );
		return actions.setIsLoading( false );
	},

	/**
	 * Resolve request for multiple posts.
	 */
	*getPosts( queryArgs: QueryArgs = {} ) : Generator<Action, Action, any> {
		yield actions.setIsLoading( true );

		queryArgs = Object.assign( {
			context: 'edit',
			per_page: 20,
			page: 1,
			search: '',
			status: 'publish,draft',
		}, queryArgs );

		const response: Response = yield actions.fetch( {
			path: addQueryArgs( 'accelerate/v1/audiences', queryArgs ),
			headers: {
				'Access-Control-Expose-Headers': 'X-WP-Total, X-WP-TotalPages',
			},
			parse: false,
		} );
		const posts: Post[] = yield actions.json( response );
		yield actions.addPosts( posts );
		yield actions.setPagination(
			parseInt( response.headers.get( 'x-wp-total' ) || '0', 10 ),
			parseInt( response.headers.get( 'x-wp-totalpages' ) || '1', 10 )
		);
		return actions.setIsLoading( false );
	},
};

export const store = registerStore( 'audience', {
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
