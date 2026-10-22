import { beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '../../src/data';

const { apiFetchMock } = vi.hoisted( () => ( { apiFetchMock: vi.fn() } ) );
vi.mock( '@wordpress/api-fetch', () => ( { default: apiFetchMock } ) );
vi.mock( '@wordpress/data', () => ( {
	createReduxStore: ( _name: string, config: unknown ) => config,
} ) );

// Drive the real resolver, controls and reducer through network responses.
const config = store as any;
async function load( state = config.initialState, main = true ) {
	const iterator = config.resolvers.getPosts( {
		type: 'broadcast',
		period: 'P7D',
	}, main );
	let step = iterator.next();
	while ( ! step.done ) {
		const action = step.value;
		try {
			if ( config.controls[ action.type ] ) {
				step = iterator.next( await config.controls[ action.type ]( action ) );
			} else {
				state = config.reducer( state, action );
				step = iterator.next();
			}
		} catch ( error ) {
			step = iterator.throw( error );
		}
	}
	return state;
}
const emptyResponse = () => ( {
	headers: new Headers( {
		'x-wp-total': '0',
		'x-wp-totalpages': '0',
	} ),
	json: async () => [],
} );

beforeEach( () => {
	apiFetchMock.mockReset();
} );
describe( 'content list loading', () => {
	it( 'settles a real empty response without an error', async () => {
		apiFetchMock.mockResolvedValue( emptyResponse() );
		const state = await load();
		expect( state.isLoading ).toBe( false );
		expect( state.postsError ).toBeNull();
		expect( state.pagination ).toEqual( {
			total: 0,
			pages: 0,
		} );
	} );
	it( 'stops loading on transport failure without pretending it is empty', async () => {
		apiFetchMock.mockRejectedValue( new Error( 'Unavailable' ) );
		const state = await load();
		expect( state.isLoading ).toBe( false );
		expect( state.postsError ).toBeTruthy();
		expect( state.queries ).toEqual( {} );
	} );
	it( 'stops loading on malformed JSON', async () => {
		apiFetchMock.mockResolvedValue( {
			...emptyResponse(),
			json: async () => {
				throw new Error( 'Invalid JSON' );
			},
		} );
		const state = await load();
		expect( state.isLoading ).toBe( false );
		expect( state.postsError ).toBeTruthy();
	} );
	it( 'clears the failure when a retry succeeds', async () => {
		apiFetchMock.mockRejectedValueOnce( new Error( 'Unavailable' ) ).mockResolvedValueOnce( emptyResponse() );
		const state = await load( await load() );
		expect( state.isLoading ).toBe( false );
		expect( state.postsError ).toBeNull();
	} );
	it( 'preserves secondary request rejection without changing the main list', async () => {
		apiFetchMock.mockRejectedValue( new Error( 'Unavailable' ) );
		await expect( load( config.initialState, false ) ).rejects.toThrow( 'Unavailable' );
	} );
} );
