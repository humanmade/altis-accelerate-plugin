/**
 * Engaged-time accrual engine tests.
 *
 * Drives createEngagementTracker via its pure interface: onActivity,
 * onVisibilityChange, getEngagedMs, takeDelta, stop. Time is controlled with an injected
 * manual clock (`now: () => clock`) so accrual is fully deterministic. Fake
 * timers are enabled only so the internal sweep setTimeout is controllable and
 * never leaks into real time.
 *
 * Credit-window model: each activity keeps the visitor engaged for up to
 * idleThresholdMs afterwards. getEngagedMs() finalises the pending window up to
 * now() and is idempotent — repeated reads never double-credit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEngagementTracker } from '../../src/engaged-time.js';

const IDLE_MS = 5_000;
const SWEEP_MS = 15_000;

function makeTracker( overrides: Record<string, unknown> = {} ) {
	let clock = 0;
	let visible = true;

	const tracker = createEngagementTracker( {
		idleThresholdMs: IDLE_MS,
		capMs: 30 * 60 * 1000,
		sweepMs: SWEEP_MS,
		now: () => clock,
		isVisible: () => visible,
		...overrides,
	} );

	return {
		tracker,
		advanceTo: ( t: number ) => { clock = t; },
		setVisible: ( v: boolean ) => { visible = v; },
	};
}

beforeEach( () => {
	vi.useFakeTimers();
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'single activity credits at most idleThresholdMs', () => {
	it( 'caps a lone activity window at idleThresholdMs and is idempotent', () => {
		const { tracker, advanceTo } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();

		advanceTo( 2_000 );
		expect( tracker.getEngagedMs() ).toBe( 1_000 );

		advanceTo( 4_000 );
		expect( tracker.getEngagedMs() ).toBe( 3_000 );

		// The window [1000, 6000] tops out at idleThresholdMs of credit.
		advanceTo( 15_000 );
		expect( tracker.getEngagedMs() ).toBe( IDLE_MS );

		// Re-reading much later must not add more (idempotent).
		advanceTo( 100_000 );
		expect( tracker.getEngagedMs() ).toBe( IDLE_MS );
	} );
} );

describe( 'continuous activity accrues close to real elapsed time', () => {
	it( 'credits ~14 s for 14 s of 1 Hz activity', () => {
		const { tracker, advanceTo } = makeTracker();

		for ( let t = 1_000; t <= 15_000; t += 1_000 ) {
			advanceTo( t );
			tracker.onActivity();
		}

		// Activity spans [1000, 15000] with sub-idle gaps → fully credited.
		expect( tracker.getEngagedMs() ).toBe( 14_000 );
	} );
} );

describe( 'idle gaps are not credited', () => {
	it( 'does not back-credit a long idle gap between activity bursts', () => {
		const { tracker, advanceTo } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();

		// 19 s idle — only the 5 s window after the activity counts.
		advanceTo( 20_000 );
		expect( tracker.getEngagedMs() ).toBe( IDLE_MS );

		// New activity opens a fresh window; the idle gap stays uncredited.
		tracker.onActivity();
		advanceTo( 21_000 );
		expect( tracker.getEngagedMs() ).toBe( IDLE_MS + 1_000 );
	} );
} );

describe( 'visibility: hidden gap is never credited', () => {
	it( 'finalises on hide, stays frozen while hidden, resumes after re-arm', () => {
		const { tracker, advanceTo, setVisible } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();

		// Hide at t=3 s → credit the 2 s window so far, then disarm.
		advanceTo( 3_000 );
		setVisible( false );
		tracker.onVisibilityChange( 'hidden' );
		expect( tracker.getEngagedMs() ).toBe( 2_000 );

		// Long hidden period adds nothing.
		advanceTo( 100_000 );
		expect( tracker.getEngagedMs() ).toBe( 2_000 );

		// Restore + next activity re-arms without crediting the hidden gap.
		setVisible( true );
		tracker.onVisibilityChange( 'visible' );
		tracker.onActivity();
		advanceTo( 101_000 );
		expect( tracker.getEngagedMs() ).toBe( 3_000 );
	} );

	it( 'ignores activity fired while hidden', () => {
		const { tracker, advanceTo, setVisible } = makeTracker();

		setVisible( false );
		advanceTo( 1_000 );
		tracker.onActivity();
		advanceTo( 10_000 );

		expect( tracker.getEngagedMs() ).toBe( 0 );
	} );
} );

describe( 'per-page cap stops accrual', () => {
	it( 'clamps at capMs and ignores further activity', () => {
		const { tracker, advanceTo } = makeTracker( { capMs: 9_000 } );

		for ( let t = 1_000; t <= 10_000; t += 1_000 ) {
			advanceTo( t );
			tracker.onActivity();
		}

		expect( tracker.getEngagedMs() ).toBe( 9_000 );

		// Stopped — nothing further accrues.
		advanceTo( 60_000 );
		tracker.onActivity();
		advanceTo( 120_000 );
		expect( tracker.getEngagedMs() ).toBe( 9_000 );
	} );
} );

describe( 'stop() freezes the total', () => {
	it( 'returns the value at stop and never grows again', () => {
		const { tracker, advanceTo } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();
		advanceTo( 3_000 );
		expect( tracker.getEngagedMs() ).toBe( 2_000 );

		tracker.stop();

		advanceTo( 13_000 );
		tracker.onActivity();
		expect( tracker.getEngagedMs() ).toBe( 2_000 );
	} );
} );

describe( 'repeated reads are monotonic and never double-credit', () => {
	it( 'returns the same value for repeated reads at the same instant', () => {
		const { tracker, advanceTo } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();
		advanceTo( 4_000 );

		const first = tracker.getEngagedMs();
		expect( tracker.getEngagedMs() ).toBe( first );
		expect( tracker.getEngagedMs() ).toBe( first );
		expect( first ).toBe( 3_000 );
	} );
} );

describe( 'internal sweep finalises the pending window without a read', () => {
	it( 'advances the total when the sweep timer fires', () => {
		const { tracker, advanceTo } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();

		// Move the clock forward, then fire the sweep timer.
		advanceTo( 4_000 );
		vi.advanceTimersByTime( SWEEP_MS );

		// Sweep finalised [1000, 4000]; a read at the same instant agrees.
		expect( tracker.getEngagedMs() ).toBe( 3_000 );
	} );
} );

describe( 'takeDelta() flushes additive increments', () => {
	it( 'hands out each accrued millisecond exactly once', () => {
		const { tracker, advanceTo } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();
		advanceTo( 4_000 );

		// First flush: 3s accrued since start.
		expect( tracker.takeDelta() ).toBe( 3_000 );
		// Immediate re-flush: nothing new.
		expect( tracker.takeDelta() ).toBe( 0 );

		// New activity at 10s first closes the previous window (which extends
		// idleThresholdMs past the activity at 1s, crediting the 4s→6s tail),
		// then 2s of new time accrues. The second flush hands out only what
		// wasn't flushed before: 2s tail + 2s new.
		advanceTo( 10_000 );
		tracker.onActivity();
		advanceTo( 12_000 );
		expect( tracker.takeDelta() ).toBe( 4_000 );

		// Sum of deltas equals the cumulative total.
		expect( tracker.getEngagedMs() ).toBe( 7_000 );
	} );

	it( 'returns 0 with no engagement', () => {
		const { tracker, advanceTo } = makeTracker();
		advanceTo( 10_000 );
		expect( tracker.takeDelta() ).toBe( 0 );
	} );

	it( 'drains the remainder after stop() (e.g. the cap fired)', () => {
		const { tracker, advanceTo } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();
		advanceTo( 3_000 );
		expect( tracker.takeDelta() ).toBe( 2_000 );

		// The activity at 10s closes the first window (crediting its 3s→6s
		// tail), then stop() freezes the total — time after the last
		// finalisation is never credited.
		advanceTo( 10_000 );
		tracker.onActivity();
		advanceTo( 12_000 );
		tracker.stop();

		// Credited-but-unflushed time (the 3s tail) is still drainable after
		// stop(), exactly once.
		expect( tracker.takeDelta() ).toBe( 3_000 );
		expect( tracker.takeDelta() ).toBe( 0 );
	} );

	it( 'is idempotent against the visibilitychange finalisation ordering', () => {
		const { tracker, advanceTo, setVisible } = makeTracker();

		advanceTo( 1_000 );
		tracker.onActivity();
		advanceTo( 4_000 );

		// Tab hides: the tracker's own listener finalises first, then the
		// session-stop handler flushes. The order must not change the delta.
		setVisible( false );
		tracker.onVisibilityChange( 'hidden' );
		expect( tracker.takeDelta() ).toBe( 3_000 );
		expect( tracker.takeDelta() ).toBe( 0 );
	} );
} );
