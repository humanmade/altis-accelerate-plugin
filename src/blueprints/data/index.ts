import apiFetch from '@wordpress/api-fetch';
import { register, createReduxStore, select } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { Blueprint, BlueprintsState } from '../types';

import reducer from './reducer';

type Action = {
	type: string,
	[ key: string ]: any,
};

const REST_BASE = 'accelerate/v1/blueprints';

const initialState: BlueprintsState = {
	items: [],
	loaded: false,
	isLoading: false,
	isUpdating: false,
	isDeleting: false,
	error: null,
};

const controls = {
	FETCH_FROM_API( action: Action ): Promise<any> {
		return apiFetch( action.options );
	},
};

const actions = {
	setItems( items: Blueprint[] ): Action {
		return {
			type: 'SET_ITEMS',
			items,
		};
	},
	addOrUpdateItem( item: Blueprint ): Action {
		return {
			type: 'ADD_OR_UPDATE_ITEM',
			item,
		};
	},
	removeItem( id: number ): Action {
		return {
			type: 'REMOVE_ITEM',
			id,
		};
	},
	setIsLoading( isLoading: boolean ): Action {
		return {
			type: 'SET_IS_LOADING',
			isLoading,
		};
	},
	setIsUpdating( isUpdating: boolean ): Action {
		return {
			type: 'SET_IS_UPDATING',
			isUpdating,
		};
	},
	setIsDeleting( isDeleting: boolean ): Action {
		return {
			type: 'SET_IS_DELETING',
			isDeleting,
		};
	},
	setError( error: string | null ): Action {
		return {
			type: 'SET_ERROR',
			error,
		};
	},
	fetch( options: object ): Action {
		return {
			type: 'FETCH_FROM_API',
			options,
		};
	},
};

const actionGenerators = {
	/**
	 * Create a blueprint.
	 */
	*createBlueprint( blueprint: Blueprint ): Generator<Action, Blueprint | undefined, any> {
		yield actions.setIsUpdating( true );
		try {
			const created: Blueprint = yield actions.fetch( {
				path: REST_BASE,
				method: 'POST',
				data: blueprint,
			} );
			yield actions.addOrUpdateItem( created );
			return created;
		} finally {
			yield actions.setIsUpdating( false );
		}
	},

	/**
	 * Update an existing blueprint.
	 */
	*updateBlueprint( blueprint: Blueprint ): Generator<Action, Blueprint | undefined, any> {
		if ( ! blueprint.id ) {
			return;
		}
		yield actions.setIsUpdating( true );
		try {
			const updated: Blueprint = yield actions.fetch( {
				path: `${ REST_BASE }/${ blueprint.id }`,
				method: 'PUT',
				data: blueprint,
			} );
			yield actions.addOrUpdateItem( updated );
			return updated;
		} finally {
			yield actions.setIsUpdating( false );
		}
	},

	/**
	 * Delete a blueprint.
	 */
	*deleteBlueprint( id: number ): Generator<Action, void, any> {
		yield actions.setIsDeleting( true );
		try {
			yield actions.fetch( {
				path: `${ REST_BASE }/${ id }`,
				method: 'DELETE',
			} );
			yield actions.removeItem( id );
		} finally {
			yield actions.setIsDeleting( false );
		}
	},
};

const selectors = {
	getBlueprints( state: BlueprintsState ): Blueprint[] {
		return state.items;
	},
	getBlueprint( state: BlueprintsState, id: number ): Blueprint | undefined {
		return state.items.find( bp => bp.id === id );
	},
	isLoaded( state: BlueprintsState ): boolean {
		return state.loaded;
	},
	getIsLoading( state: BlueprintsState ): boolean {
		return state.isLoading;
	},
	getIsUpdating( state: BlueprintsState ): boolean {
		return state.isUpdating;
	},
	getIsDeleting( state: BlueprintsState ): boolean {
		return state.isDeleting;
	},
	getError( state: BlueprintsState ): string | null {
		return state.error;
	},
};

const resolvers = {
	/**
	 * Resolve the full blueprint list.
	 *
	 * Failures are stored rather than thrown so the UI can show an error state
	 * (an uncaught resolver error would surface as a silent empty list).
	 */
	*getBlueprints(): Generator<Action, Action, any> {
		yield actions.setIsLoading( true );
		yield actions.setError( null );
		try {
			const items: Blueprint[] = yield actions.fetch( { path: REST_BASE } );
			yield actions.setItems( items );
		} catch ( error: any ) {
			yield actions.setError( error?.message || __( 'Could not load blueprints.', 'altis' ) );
		} finally {
			yield actions.setIsLoading( false );
		}
		return actions.setIsLoading( false );
	},
};

export const store = createReduxStore( 'blueprints', {
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

// Only register if not already registered (prevents duplicate registration from multiple entry points).
if ( ! select( 'blueprints' ) ) {
	register( store );
}
