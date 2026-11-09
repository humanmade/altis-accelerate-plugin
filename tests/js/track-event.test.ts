import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '../../src/utils/admin.js';

describe( 'trackEvent', () => {
	let capturedArgs: Array<{ event: string; payload: Record<string, any> }>;

	beforeEach( () => {
		capturedArgs = [];
		( window as any ).posthog = {
			capture: ( event: string, payload: Record<string, any> ) => {
				capturedArgs.push( { event, payload } );
			},
		};
		( window as any ).accelerateTelemetrySiteGroup = undefined;
		( window as any ).accelerateTelemetryDomain = undefined;
	} );

	afterEach( () => {
		delete ( window as any ).posthog;
		delete ( window as any ).accelerateTelemetrySiteGroup;
		delete ( window as any ).accelerateTelemetryDomain;
	} );

	it( 'injects $groups.site when accelerateTelemetrySiteGroup is set', () => {
		( window as any ).accelerateTelemetrySiteGroup = 'my-site-uuid';
		trackEvent( 'test_event' );
		expect( capturedArgs ).toHaveLength( 1 );
		expect( capturedArgs[ 0 ].payload.$groups ).toEqual( { site: 'my-site-uuid' } );
	} );

	it( 'merges caller $groups with injected site, site wins', () => {
		( window as any ).accelerateTelemetrySiteGroup = 'my-site-uuid';
		trackEvent( 'test_event', { $groups: { other: 'keep' } } );
		expect( capturedArgs[ 0 ].payload.$groups ).toEqual( { other: 'keep', site: 'my-site-uuid' } );
	} );

	it( 'omits $groups entirely when accelerateTelemetrySiteGroup is absent', () => {
		trackEvent( 'test_event' );
		expect( capturedArgs[ 0 ].payload ).not.toHaveProperty( '$groups' );
	} );

	it( 'does not throw and does not call capture when posthog is absent', () => {
		delete ( window as any ).posthog;
		expect( () => trackEvent( 'test_event' ) ).not.toThrow();
		expect( capturedArgs ).toHaveLength( 0 );
	} );
} );
