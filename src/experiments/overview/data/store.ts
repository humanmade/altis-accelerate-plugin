import apiFetch, { APIFetchOptions } from '@wordpress/api-fetch';
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
}

interface Pagination {
	total: number;
	pages: number;
}

interface State {
	experiments: Experiment[];
	pagination: Pagination;
	isLoading: boolean;
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

interface FetchAction {
	type: 'FETCH_FROM_API';
	options: APIFetchOptions;
}

const initialState: State = {
	experiments: [],
	pagination: {
		total: 0,
		pages: 0,
	},
	isLoading: true,
};

const controls = {
	FETCH_FROM_API( action: FetchAction ): Promise<Response> {
		return apiFetch( {
			credentials: 'same-origin',
			...action.options,
		} );
	},
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
	fetch( options: APIFetchOptions ): FetchAction {
		return {
			type: 'FETCH_FROM_API',
			options,
		};
	},
};

type Action = ReturnType<typeof actions.setExperiments>
	| ReturnType<typeof actions.setPagination>
	| ReturnType<typeof actions.setIsLoading>;

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
};

const resolvers = {
	*getExperiments( queryArgs: QueryArgs = {} ) {
		yield actions.setIsLoading( true );

		const response: Response = yield actions.fetch( {
			path: addQueryArgs( API_ENDPOINT, queryArgs ),
			headers: {
				'Access-Control-Expose-Headers': 'X-WP-Total, X-WP-TotalPages',
			},
			parse: false,
		} );

		if ( ! response ) {
			return actions.setIsLoading( false );
		}

		const experiments: Experiment[] = yield {
			type: 'RESPONSE_TO_JSON',
			response,
		};

		yield actions.setExperiments( experiments );
		yield actions.setPagination(
			parseInt( response.headers.get( 'x-wp-total' ) || '0', 10 ),
			parseInt( response.headers.get( 'x-wp-totalpages' ) || '0', 10 )
		);
		return actions.setIsLoading( false );
	},
};

export const store = createReduxStore( 'accelerate/experiments', {
	actions,
	controls: {
		...controls,
		RESPONSE_TO_JSON( action: { response: Response } ): Promise<Experiment[]> {
			return action.response.json();
		},
	},
	initialState,
	reducer,
	resolvers,
	selectors,
} );
