/**
 * Tests for site-timezone day boundaries (#681).
 *
 * The analytics dashboard must compute calendar-day windows in the *site's*
 * timezone, not the viewer's browser timezone. These assert that — including
 * the browser≠site case, which is the actual bug (browser-local
 * reinterpretation), and which a same-timezone test would pass vacuously.
 *
 * Runs under `npm run test:js` (vitest).
 */

import moment from 'moment';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveSelectedDate, resolvePriorPeriod, siteOffsetMinutesAt } from '../../src/data';

// 14:23 UTC == 00:23 the NEXT calendar day in Sydney (+10). So for a Sydney
// site the host (UTC) and site disagree on which day "today" is — exactly the
// browser≠site condition.
const FROZEN_NOW = new Date( '2025-06-10T14:23:00Z' );

const setSiteTimezone = ( tz: { string: string, offset: number } | null ) => {
	( globalThis as { window?: unknown } ).window = tz
		? { AltisAccelerateDashboardData: { timezone: tz } }
		: {};
};

describe( 'site-timezone day boundaries (#681)', () => {
	beforeEach( () => {
		vi.useFakeTimers();
		vi.setSystemTime( FROZEN_NOW );
	} );
	afterEach( () => {
		vi.useRealTimers();
		delete ( globalThis as { window?: unknown } ).window;
	} );

	it( 'uses the manual offset when there is no IANA name', () => {
		setSiteTimezone( { string: '', offset: 10 } );
		expect( siteOffsetMinutesAt( moment( FROZEN_NOW ) ) ).toBe( 600 );
	} );

	it( 'honors quarter-hour manual offsets (+05:45 Nepal)', () => {
		setSiteTimezone( { string: '', offset: 5.75 } );
		expect( siteOffsetMinutesAt( moment( FROZEN_NOW ) ) ).toBe( 345 );
	} );

	it( 'uses the IANA zone and is DST-correct across the year', () => {
		setSiteTimezone( { string: 'Australia/Sydney', offset: 10 } );
		// June → AEST (UTC+10). January → AEDT (UTC+11). Sydney's offset can't be
		// a single fixed number; the IANA path must track it per-instant.
		expect( siteOffsetMinutesAt( moment.utc( '2025-06-10T00:00:00Z' ) ) ).toBe( 600 );
		expect( siteOffsetMinutesAt( moment.utc( '2025-01-10T00:00:00Z' ) ) ).toBe( 660 );
	} );

	it( 'TODAY starts at site-local midnight, not browser/UTC midnight', () => {
		setSiteTimezone( { string: '', offset: 10 } );
		// Site "today" is 2025-06-11 in Sydney → began 2025-06-10T14:00:00Z.
		const today = resolveSelectedDate( 'TODAY', null );
		expect( today.start.toISOString() ).toBe( '2025-06-10T14:00:00.000Z' );
	} );

	it( 'YESTERDAY prior is the site-local day-before-yesterday (browser≠site)', () => {
		setSiteTimezone( { string: '', offset: 10 } );
		// Site now = 2025-06-11 Sydney; day-before-yesterday = 2025-06-09 Sydney,
		// which begins at 2025-06-08T14:00:00Z.
		const prior = resolvePriorPeriod( 'YESTERDAY' );
		expect( prior ).not.toBeNull();
		expect( prior!.start.toISOString() ).toBe( '2025-06-08T14:00:00.000Z' );
	} );

	it( 'defaults to UTC when no site config is present', () => {
		setSiteTimezone( null );
		expect( siteOffsetMinutesAt( moment( FROZEN_NOW ) ) ).toBe( 0 );
		const today = resolveSelectedDate( 'TODAY', null );
		expect( today.start.toISOString() ).toBe( '2025-06-10T00:00:00.000Z' );
	} );
} );
