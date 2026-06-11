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

	it( 'PT30M returns null (realtime has no meaningful prior)', () => {
		expect( resolvePriorPeriod( 'PT30M' ) ).toBeNull();
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
		const expectedStart = moment( FROZEN_NOW ).subtract( 2, 'day' ).startOf( 'day' );
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
