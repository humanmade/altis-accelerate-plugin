/**
 * Tests for resolvePriorPeriod() — calendar-aware prior-window math.
 *
 * Runs under the vitest setup landing in PR #621
 * (humanmade/accelerate#621). Once that PR merges, `composer test:js`
 * picks this up automatically.
 */

import moment from 'moment';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resolvePriorPeriod, resolveSelectedDate } from '../../src/data';

// Pin "now" to a non-DST-crossing weekday afternoon so the calendar
// math is deterministic across CI hosts and TZs.
const FROZEN_NOW = new Date( '2025-06-10T14:23:00Z' );

describe( 'resolvePriorPeriod', () => {
	beforeAll( () => {
		vi.useFakeTimers();
		vi.setSystemTime( FROZEN_NOW );
	} );
	afterAll( () => {
		vi.useRealTimers();
	} );

	it( 'PT30M returns the prior 30-minute window on realtime boundaries', () => {
		// Realtime compares last-30 vs prior-30 on the same minute-snapped
		// boundaries as resolveCurrentRealtimeWindow(): with now frozen at
		// 14:23, the prior window is 13:23:00.000 → 13:53:59.999.
		const prior = resolvePriorPeriod( 'PT30M' );
		expect( prior ).not.toBeNull();
		expect( prior!.interval ).toBe( 'PT1M' );
		expect( prior!.start.toISOString() ).toBe( '2025-06-10T13:23:00.000Z' );
		expect( prior!.end.toISOString() ).toBe( '2025-06-10T13:53:59.999Z' );
	} );

	it( 'TODAY returns yesterday clipped to same elapsed time', () => {
		const prior = resolvePriorPeriod( 'TODAY' );
		const today = resolveSelectedDate( 'TODAY', null );
		expect( prior ).not.toBeNull();
		// Prior window starts at yesterday's day-start (one full day earlier).
		expect( prior!.start.diff( today.start, 'days' ) ).toBe( -1 );
		// Prior window length matches today's elapsed length (within 1s).
		const todayElapsed = today.end.diff( today.start );
		const priorElapsed = prior!.end.diff( prior!.start );
		expect( Math.abs( priorElapsed - todayElapsed ) ).toBeLessThan( 1000 );
	} );

	it( 'YESTERDAY returns the day before yesterday in full', () => {
		const prior = resolvePriorPeriod( 'YESTERDAY' );
		expect( prior ).not.toBeNull();
		// Boundaries are computed in the site timezone, which defaults to UTC
		// when no site config is present (as here) — so the expectation is
		// UTC-framed and host-timezone independent (#681).
		const expectedStart = moment.utc( FROZEN_NOW ).subtract( 2, 'day' ).startOf( 'day' );
		expect( prior!.start.isSame( expectedStart ) ).toBe( true );
	} );

	it( 'P7D returns the previous 7-day calendar window', () => {
		const prior = resolvePriorPeriod( 'P7D' );
		const current = resolveSelectedDate( 'P7D', null );
		expect( prior ).not.toBeNull();
		// Prior window ends roughly where current starts (within a day).
		const gap = current.start.diff( prior!.end, 'hours' );
		expect( Math.abs( gap ) ).toBeLessThan( 25 );
	} );
} );
