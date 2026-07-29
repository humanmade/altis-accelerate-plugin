import { Blueprint, BlueprintsState } from '../types';

type Action = {
	type: string,
	[ key: string ]: any,
};

const initialState: BlueprintsState = {
	items: [],
	loaded: false,
	isLoading: false,
	isUpdating: false,
	isDeleting: false,
	error: null,
};

/**
 * Blueprints store reducer.
 */
export default function reducer( state: BlueprintsState = initialState, action: Action ): BlueprintsState {
	switch ( action.type ) {
		case 'SET_ITEMS':
			return {
				...state,
				items: action.items,
				loaded: true,
			};

		case 'ADD_OR_UPDATE_ITEM': {
			const item: Blueprint = action.item;
			const exists = state.items.some( bp => bp.id === item.id );
			return {
				...state,
				items: exists
					? state.items.map( bp => ( bp.id === item.id ? item : bp ) )
					: [ item, ...state.items ],
			};
		}

		case 'REMOVE_ITEM':
			return {
				...state,
				items: state.items.filter( bp => bp.id !== action.id ),
			};

		case 'SET_ERROR':
			return {
				...state,
				error: action.error,
			};

		case 'SET_IS_LOADING':
			return {
				...state,
				isLoading: action.isLoading,
			};

		case 'SET_IS_UPDATING':
			return {
				...state,
				isUpdating: action.isUpdating,
			};

		case 'SET_IS_DELETING':
			return {
				...state,
				isDeleting: action.isDeleting,
			};

		default:
			return state;
	}
}
