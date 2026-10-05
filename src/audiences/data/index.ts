import apiFetch from '@wordpress/api-fetch';
import { register, createReduxStore, select } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

import { Audience, Estimate, Field, Post, State } from '../types';

import {
	defaultAudience,
	defaultPost,
} from './defaults';
import reducer from './reducer';

type Fields = Field[];
type FetchOptions = any;

declare global {
	interface Window {
		Altis?: {
			Analytics?: {
				Audiences?: {
					Fields?: Fields,
				},
			},
		},
	}
}

// Read basic field definitions inlined by PHP (available immediately, without ClickHouse).
const inlineFields: Fields = window?.Altis?.Analytics?.Audiences?.Fields || [];

// The server injects basic field definitions (name/label/type) as a global so
// the rule editor can render its dropdowns before the REST /audiences/fields
// call resolves. We can't rely on reading it at module-eval time (above): this
// data bundle can evaluate before the inline script that sets the global, in
// which case `inlineFields` is empty. This lazily reads — and caches — the
// global on first access, by which point (a component selecting fields) it is
// always present. Cached so the selector returns a stable reference.
let cachedInlineFields: Fields = inlineFields;
const getInlineFields = (): Fields => {
	if ( cachedInlineFields.length === 0 ) {
		cachedInlineFields = window?.Altis?.Analytics?.Audiences?.Fields || [];
	}
	return cachedInlineFields;
};

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
	fields: inlineFields,
	fieldData: {},
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
	 * Set the value data for a single field.
	 */
	setFieldData( name: string, field: Field ) {
		return {
			type: 'SET_FIELD_DATA',
			name,
			field,
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
		try {
			const newPost: Post = yield actions.fetch( {
				path: 'accelerate/v1/audiences',
				method: 'POST',
				data: post,
			} );
			yield actions.addPosts( [ newPost ] );
			yield actions.updateCurrentPost( newPost );
		} finally {
			yield actions.setIsUpdating( false );
		}
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
		try {
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
		} finally {
			yield actions.setIsUpdating( false );
		}
		return actions.setIsUpdating( false );
	},

	/**
	 * Delete post generator.
	 */
	*deletePost( id: number ) : Generator<Action> {
		yield actions.setIsDeleting( true );
		try {
			yield actions.fetch( {
				path: `accelerate/v1/audiences/${ id }`,
				method: 'DELETE',
			} );
			yield actions.removePost( id );
		} finally {
			yield actions.setIsDeleting( false );
		}
		return actions.setIsDeleting( false );
	},
};

const selectors = {
	/**
	 * Get audiences fields.
	 */
	getFields( state: State ) {
		// Fall back to the server-injected globals until the store is populated,
		// so the rule editor is enabled on first render rather than disabled
		// while the REST /audiences/fields call is in flight. See getInlineFields.
		return state.fields.length > 0 ? state.fields : getInlineFields();
	},

	/**
	 * Get the value data (top values / stats) for a single field.
	 *
	 * Resolved on demand via the getFieldData resolver, so a field's values
	 * are only queried from ClickHouse when that field is actually selected.
	 */
	getFieldData( state: State, name: string ) {
		return state.fieldData[ name ];
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
	 * Resolve the value data for a single field, on demand.
	 */
	*getFieldData( name: string ) : Generator<Action, Action, any> {
		try {
			const field: Field = yield actions.fetch( {
				path: addQueryArgs( 'accelerate/v1/audiences/field-data', { field: name } ),
			} );
			return actions.setFieldData( name, field );
		} catch ( error ) {
			// Store an errored entry so the request counts as finished — the
			// rule editor drops its loading state and falls back to free text
			// instead of spinning forever.
			return actions.setFieldData( name, {
				name,
				label: '',
				type: 'string',
				data: [],
				options: {},
				error: true,
			} );
		}
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
			yield actions.setCurrentPost( post );
		} finally {
			yield actions.setIsLoading( false );
		}
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

		try {
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
		} finally {
			yield actions.setIsLoading( false );
		}
		return actions.setIsLoading( false );
	},
};

export const store = createReduxStore( 'audience', {
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

// Only register if not already registered (prevents duplicate registration from multiple entry points)
if ( ! select( 'audience' ) ) {
	register( store );
}
