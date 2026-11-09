import apiFetch from '@wordpress/api-fetch';
import { createReduxStore } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

const API_ENDPOINT = 'accelerate/v1/experiments';

export interface Experiment {
	id: number;
	title: string;
	type: 'block' | 'personalization' | 'titles' | 'featured_images';
	status: 'running' | 'paused' | 'completed' | 'draft';
	post_type: string;
	variant_count: number;
	conversion_rate: number | null;
	lift: number | null;
	winner: number | null;
	start_time: string | null;
	end_time: string | null;
	usage_count: number;
	usage_label: string;
	edit_url: string;
	raw_content: string | null;
	thumbnail_url: string | null;
	variant_thumbnails: string[] | null;
	default_title: string | null;
	annotations?: Record<string, string>;
	source?: string;
}

interface Pagination {
	total: number;
	pages: number;
}

interface State {
	experiments: Experiment[];
	pagination: Pagination;
	isLoading: boolean;
	error: string | null;
}

export interface QueryArgs {
	status?: string;
	type?: string;
	search?: string;
	orderby?: string;
	order?: string;
	page?: number;
	per_page?: number;
}

const initialState: State = {
	experiments: [],
	pagination: {
		total: 0,
		pages: 0,
	},
	isLoading: true,
	error: null,
};

const actions = {
	setExperiments( experiments: Experiment[] ) {
		return {
			type: 'SET_EXPERIMENTS' as const,
			experiments,
		};
	},
	setPagination( total: number, pages: number ) {
		return {
			type: 'SET_PAGINATION' as const,
			total,
			pages,
		};
	},
	setIsLoading( isLoading: boolean ) {
		return {
			type: 'SET_IS_LOADING' as const,
			isLoading,
		};
	},
	setError( error: string | null ) {
		return {
			type: 'SET_ERROR' as const,
			error,
		};
	},
	fetchExperiments( queryArgs: QueryArgs = {} ) {
		return async ( { dispatch }: { dispatch: Record<string, ( ...args: any[] ) => void> } ) => {
			dispatch.setIsLoading( true );

			try {
				const response: Response = await apiFetch( {
					path: addQueryArgs( API_ENDPOINT, queryArgs ),
					parse: false,
				} );

				const experiments: Experiment[] = await response.json();

				dispatch.setExperiments( experiments );
				dispatch.setPagination(
					parseInt( response.headers.get( 'x-wp-total' ) || '0', 10 ),
					parseInt( response.headers.get( 'x-wp-totalpages' ) || '0', 10 )
				);
				dispatch.setError( null );
			} catch ( e ) {
				dispatch.setError( e instanceof Error ? e.message : 'Failed to load experiments' );
			}

			dispatch.setIsLoading( false );
		};
	},
};

type Action = ReturnType<typeof actions.setExperiments>
	| ReturnType<typeof actions.setPagination>
	| ReturnType<typeof actions.setIsLoading>
	| ReturnType<typeof actions.setError>;

function reducer( state: State = initialState, action: Action ): State {
	switch ( action.type ) {
		case 'SET_EXPERIMENTS':
			return {
				...state,
				experiments: action.experiments,
			};
		case 'SET_PAGINATION':
			return {
				...state,
				pagination: {
					total: action.total,
					pages: action.pages,
				},
			};
		case 'SET_IS_LOADING':
			return {
				...state,
				isLoading: action.isLoading,
			};
		case 'SET_ERROR':
			return {
				...state,
				error: action.error,
			};
		default:
			return state;
	}
}

const selectors = {
	getExperiments( state: State ): Experiment[] {
		return state.experiments;
	},
	getPagination( state: State ): Pagination {
		return state.pagination;
	},
	getIsLoading( state: State ): boolean {
		return state.isLoading;
	},
	getError( state: State ): string | null {
		return state.error;
	},
};

export const store = createReduxStore( 'accelerate/experiments', {
	actions,
	initialState,
	reducer,
	selectors,
} );
