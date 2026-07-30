/**
 * HubSpot signals — bootstrap wiring tests.
 *
 * Drives `bootstrap()` against a fake Altis.Analytics API + jsdom window to
 * verify the end-to-end behaviours the classifiers alone can't: events
 * recorded with the right attributes, endpoint lists accumulated with
 * dedupe, the once-per-session email guard, per-signal kill switches, and
 * that nothing registers without config.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bootstrap } from '../../src/integrations/hubspot/index';

const FORM_GUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

type FakeWindow = Window & { Altis: any };

function makeAnalytics( endpointAttributes: Record<string, string[]> = {} ) {
	const endpoint = { Attributes: { ...endpointAttributes } };
	return {
		record: vi.fn(),
		getEndpoint: vi.fn( () => endpoint ),
		updateEndpoint: vi.fn( next => {
			endpoint.Attributes = {
				...endpoint.Attributes,
				...next.Attributes,
			};
		} ),
	};
}

function makeWindow( {
	analytics = makeAnalytics(),
	signals = { forms: true, email: true, chat: true },
	formDirectory = {},
	emailDirectory = {},
	search = '',
}: any = {} ): FakeWindow {
	const listeners: Record<string, Array<( e: any ) => void>> = {};
	const storage = new Map<string, string>();
	return {
		Altis: {
			Analytics: {
				...analytics,
				Integrations: {
					HubSpot: {
						Signals: signals,
						FormDirectory: formDirectory,
						EmailDirectory: emailDirectory,
					},
				},
			},
		},
		location: { search },
		sessionStorage: {
			getItem: ( k: string ) => storage.get( k ) ?? null,
			setItem: ( k: string, v: string ) => storage.set( k, v ),
		},
		addEventListener: ( type: string, cb: ( e: any ) => void ) => {
			listeners[ type ] = listeners[ type ] || [];
			listeners[ type ].push( cb );
		},
		dispatch: ( type: string, event: any ) => {
			( listeners[ type ] || [] ).forEach( cb => cb( event ) );
		},
	} as unknown as FakeWindow;
}

beforeEach( () => {
	vi.clearAllMocks();
} );

afterEach( () => {
	vi.restoreAllMocks();
} );

describe( 'bootstrap', () => {
	it( 'does nothing without HubSpot config', () => {
		const analytics = makeAnalytics();
		const win = makeWindow( { analytics } );
		delete win.Altis.Analytics.Integrations;

		bootstrap( win );
		( win as any ).dispatch( 'message', { data: { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: FORM_GUID } } );

		expect( win.Altis.Analytics.record ).not.toHaveBeenCalled();
	} );

	it( 'records a form submission with resolved name and accumulates the endpoint lists', () => {
		const win = makeWindow( {
			formDirectory: { [ FORM_GUID ]: 'P&ED RFI' },
		} );
		bootstrap( win );

		( win as any ).dispatch( 'message', { data: { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: FORM_GUID } } );

		expect( win.Altis.Analytics.record ).toHaveBeenCalledWith( 'formSubmission', {
			attributes: {
				formId: FORM_GUID,
				formName: 'P&ED RFI',
				formProvider: 'hubspot',
			},
		} );
		expect( win.Altis.Analytics.updateEndpoint ).toHaveBeenCalledWith( {
			Attributes: {
				hubspot_forms_submitted: [ 'P&ED RFI' ],
				hubspot_forms_submitted_ids: [ FORM_GUID ],
			},
		} );
	} );

	it( 'does not rewrite the endpoint when the form was already recorded', () => {
		const analytics = makeAnalytics( {
			hubspot_forms_submitted: [ 'P&ED RFI' ],
			hubspot_forms_submitted_ids: [ FORM_GUID ],
		} );
		const win = makeWindow( {
			analytics,
			formDirectory: { [ FORM_GUID ]: 'P&ED RFI' },
		} );
		bootstrap( win );

		( win as any ).dispatch( 'message', { data: { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: FORM_GUID } } );

		// The repeat submission is still an event…
		expect( win.Altis.Analytics.record ).toHaveBeenCalledTimes( 1 );
		// …but the endpoint lists are unchanged, so no write happens.
		expect( win.Altis.Analytics.updateEndpoint ).not.toHaveBeenCalled();
	} );

	it( 'records an email arrival once per session', () => {
		const win = makeWindow( {
			search: '?_hsmi=42&_hsenc=junk',
			emailDirectory: { 42: 'Certificate nurture #3' },
		} );
		bootstrap( win );

		expect( win.Altis.Analytics.record ).toHaveBeenCalledWith( 'emailArrival', {
			attributes: {
				emailId: '42',
				emailName: 'Certificate nurture #3',
				emailProvider: 'hubspot',
			},
		} );

		// A second bootstrap on the same window (SPA-ish re-run) is guarded.
		bootstrap( win );
		expect( win.Altis.Analytics.record ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'never includes _hsenc in anything it records', () => {
		const win = makeWindow( { search: '?_hsmi=42&_hsenc=recipient-token' } );
		bootstrap( win );

		const allCalls = JSON.stringify( [
			( win.Altis.Analytics.record as any ).mock.calls,
			( win.Altis.Analytics.updateEndpoint as any ).mock.calls,
		] );
		expect( allCalls ).not.toContain( 'recipient-token' );
		expect( allCalls ).not.toContain( 'hsenc' );
	} );

	it( 'records chat engagement and appends the engaged flag once', () => {
		const handlers: Record<string, ( p: unknown ) => void> = {};
		const win = makeWindow();
		( win as any ).HubSpotConversations = {
			on: ( event: string, cb: ( p: unknown ) => void ) => {
				handlers[ event ] = cb;
			},
		};
		bootstrap( win );

		handlers.conversationStarted( {} );
		handlers.conversationStarted( {} );

		expect( win.Altis.Analytics.record ).toHaveBeenCalledTimes( 2 );
		expect( win.Altis.Analytics.record ).toHaveBeenCalledWith( 'chatInteraction', {
			attributes: {
				interactionType: 'started',
				chatProvider: 'hubspot',
			},
		} );
		// Second start doesn't rewrite the endpoint (value already present).
		expect( win.Altis.Analytics.updateEndpoint ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'honors per-signal kill switches', () => {
		const win = makeWindow( {
			signals: { forms: false, email: false, chat: false },
			search: '?_hsmi=42',
		} );
		bootstrap( win );

		( win as any ).dispatch( 'message', { data: { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: FORM_GUID } } );

		expect( win.Altis.Analytics.record ).not.toHaveBeenCalled();
		expect( ( win as any ).hsConversationsOnReady ).toBeUndefined();
	} );

	it( 'survives hostile message payloads without throwing', () => {
		const win = makeWindow();
		bootstrap( win );

		expect( () => {
			( win as any ).dispatch( 'message', { data: null } );
			( win as any ).dispatch( 'message', { data: 'string' } );
			( win as any ).dispatch( 'message', {} );
		} ).not.toThrow();
		expect( win.Altis.Analytics.record ).not.toHaveBeenCalled();
	} );
} );
