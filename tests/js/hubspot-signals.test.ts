/**
 * HubSpot signals — classifier and helper tests.
 *
 * Covers the three pure classifiers (forms postMessage, _hsmi email arrival,
 * chat SDK wiring) plus the shared name-resolution and endpoint-list-append
 * helpers. Hostile/malformed payloads are first-class cases: these handlers
 * sit on a public window message listener and a third-party widget API, so
 * anything can arrive.
 */

import { describe, expect, it, vi } from 'vitest';

import { wireChat } from '../../src/integrations/hubspot/chat';
import { getEmailArrival } from '../../src/integrations/hubspot/email';
import { getFormSubmission } from '../../src/integrations/hubspot/forms';
import { appendedList, resolveName } from '../../src/integrations/hubspot/index';

describe( 'getFormSubmission', () => {
	const GUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

	it( 'accepts the shared v2/v4 submission callback shape', () => {
		expect( getFormSubmission( {
			type: 'hsFormCallback',
			eventName: 'onFormSubmitted',
			id: GUID,
		} ) ).toEqual( { formId: GUID } );
	} );

	it( 'falls back to data.formGuid when id is absent', () => {
		expect( getFormSubmission( {
			type: 'hsFormCallback',
			eventName: 'onFormSubmitted',
			data: { formGuid: GUID },
		} ) ).toEqual( { formId: GUID } );
	} );

	it( 'ignores onFormSubmit (fires before completion)', () => {
		expect( getFormSubmission( {
			type: 'hsFormCallback',
			eventName: 'onFormSubmit',
			id: GUID,
		} ) ).toBeNull();
	} );

	it.each( [
		[ 'null', null ],
		[ 'string data', 'hello' ],
		[ 'number data', 42 ],
		[ 'unrelated message', { type: 'webpackOk' } ],
		[ 'wrong type right event', { type: 'other', eventName: 'onFormSubmitted', id: 'x' } ],
		[ 'missing form id', { type: 'hsFormCallback', eventName: 'onFormSubmitted' } ],
		[ 'empty form id', { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: '' } ],
		[ 'non-string form id', { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: { toString: 'nope' } } ],
	] )( 'rejects hostile payload: %s', ( _label, data ) => {
		expect( getFormSubmission( data ) ).toBeNull();
	} );
} );

describe( 'getEmailArrival', () => {
	it( 'extracts a numeric _hsmi', () => {
		expect( getEmailArrival( '?_hsmi=123456789&_hsenc=p2ANqtz-abc&utm_campaign=x' ) )
			.toEqual( { emailId: '123456789' } );
	} );

	it.each( [
		[ 'empty string', '' ],
		[ 'no params', '?utm_campaign=x' ],
		[ 'non-numeric _hsmi', '?_hsmi=abc123' ],
		[ 'negative _hsmi', '?_hsmi=-5' ],
		[ 'empty _hsmi', '?_hsmi=' ],
		[ 'only _hsenc', '?_hsenc=p2ANqtz-abc' ],
	] )( 'returns null for %s', ( _label, search ) => {
		expect( getEmailArrival( search ) ).toBeNull();
	} );

	it( 'never exposes _hsenc in its output', () => {
		const result = getEmailArrival( '?_hsmi=42&_hsenc=recipient-identifying-token' );
		expect( JSON.stringify( result ) ).not.toContain( 'hsenc' );
		expect( JSON.stringify( result ) ).not.toContain( 'recipient-identifying-token' );
	} );
} );

describe( 'wireChat', () => {
	function makeConversations() {
		const handlers: Record<string, ( payload: unknown ) => void> = {};
		return {
			handlers,
			sdk: {
				on: ( event: string, cb: ( payload: unknown ) => void ) => {
					handlers[ event ] = cb;
				},
			},
		};
	}

	it( 'registers immediately when the SDK is already loaded', () => {
		const { handlers, sdk } = makeConversations();
		const win = { HubSpotConversations: sdk } as any;
		const onInteraction = vi.fn();

		wireChat( onInteraction, win );

		handlers.conversationStarted( { conversation: { conversationId: 99 } } );
		expect( onInteraction ).toHaveBeenCalledWith( 'started' );

		handlers.conversationClosed( {} );
		expect( onInteraction ).toHaveBeenCalledWith( 'closed' );
	} );

	it( 'defers registration via hsConversationsOnReady when the SDK loads late', () => {
		const win = {} as any;
		const onInteraction = vi.fn();

		wireChat( onInteraction, win );
		expect( Array.isArray( win.hsConversationsOnReady ) ).toBe( true );
		expect( win.hsConversationsOnReady ).toHaveLength( 1 );

		// Widget loads later and drains the ready queue.
		const { handlers, sdk } = makeConversations();
		win.HubSpotConversations = sdk;
		win.hsConversationsOnReady.forEach( ( cb: () => void ) => cb() );

		handlers.conversationStarted( {} );
		expect( onInteraction ).toHaveBeenCalledWith( 'started' );
	} );

	it( 'appends to an existing hsConversationsOnReady array', () => {
		const existing = vi.fn();
		const win = { hsConversationsOnReady: [ existing ] } as any;

		wireChat( vi.fn(), win );

		expect( win.hsConversationsOnReady ).toHaveLength( 2 );
		expect( win.hsConversationsOnReady[ 0 ] ).toBe( existing );
	} );

	it( 'tolerates an SDK without an on() method', () => {
		const win = { HubSpotConversations: {} } as any;
		expect( () => wireChat( vi.fn(), win ) ).not.toThrow();
	} );
} );

describe( 'resolveName', () => {
	const directory = { abc: 'RFI Form — P&ED' };

	it( 'resolves a known id to its name', () => {
		expect( resolveName( directory, 'abc' ) ).toBe( 'RFI Form — P&ED' );
	} );

	it.each( [
		[ 'unknown id', directory, 'zzz', 'zzz' ],
		[ 'empty directory', {}, 'abc', 'abc' ],
		[ 'null directory', null, 'abc', 'abc' ],
		[ 'empty name value', { abc: '' }, 'abc', 'abc' ],
		[ 'non-string name value', { abc: 42 }, 'abc', 'abc' ],
	] )( 'falls back to the raw id for %s', ( _label, dir, id, expected ) => {
		expect( resolveName( dir as any, id ) ).toBe( expected );
	} );
} );

describe( 'appendedList', () => {
	it( 'starts a list from nothing', () => {
		expect( appendedList( undefined, [ 'a' ] ) ).toEqual( [ 'a' ] );
	} );

	it( 'appends new values without mutating the input', () => {
		const current = [ 'a' ];
		expect( appendedList( current, [ 'b' ] ) ).toEqual( [ 'a', 'b' ] );
		expect( current ).toEqual( [ 'a' ] );
	} );

	it( 'returns null when every value is already present (no write needed)', () => {
		expect( appendedList( [ 'a', 'b' ], [ 'a' ] ) ).toBeNull();
	} );

	it( 'dedupes within a single call', () => {
		expect( appendedList( [], [ 'a', 'a' ] ) ).toEqual( [ 'a' ] );
	} );
} );
