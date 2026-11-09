/**
 * Idle-aware engaged-time accrual engine.
 *
 * Pure module with injected dependencies — no direct DOM access. Wire it up
 * in accelerate.js, pass activity + visibility events in, and flush accrued
 * time via `takeDelta()`. The engine does NOT emit events: each `_session.stop`
 * event carries the engaged time accrued since the previous flush as
 * `metrics['engaged']`. Deltas are additive facts — `sum()` over stop rows is
 * exact, the same correctness model as `count()` over pageView rows — so the
 * server never needs per-session max() reassembly.
 *
 * Credit-window model: each activity event keeps the visitor "engaged" for up
 * to `idleThresholdMs` afterwards. Overlapping windows merge. `finalizeTo(t)`
 * counts elapsed engaged time up to `t` (clamped to the current window) and is
 * idempotent — calling it repeatedly never double-credits, so reading the total
 * has no ordering dependency with the visibilitychange / `_session.stop`
 * handler that records the value.
 */

export function createEngagementTracker( {
	idleThresholdMs = 5_000,
	capMs = 30 * 60 * 1000,
	sweepMs = 15_000,
	now = () => Date.now(),
	isVisible = () => document.visibilityState === 'visible',
} = {} ) {
	let engagedMs = 0;
	let flushedMs = 0;          // engaged time already handed out via takeDelta()
	let lastActivityAt = null;  // timestamp of the most recent activity event
	let creditedUntil = 0;      // timestamp up to which engaged time is counted
	let stopped = false;
	let timerId = null;

	/**
	 * Count engaged time up to `t`, clamped to the current activity window.
	 * Idempotent: re-running with a later `t` only adds genuinely new time.
	 *
	 * @param {number} t Timestamp to finalise the engaged window up to.
	 */
	function finalizeTo( t ) {
		if ( stopped || lastActivityAt === null ) {
			return;
		}
		// Engagement from an activity extends to lastActivityAt + idleThreshold.
		const windowEnd = lastActivityAt + idleThresholdMs;
		const end = Math.min( t, windowEnd );
		if ( end > creditedUntil ) {
			engagedMs = Math.min( capMs, engagedMs + ( end - creditedUntil ) );
			creditedUntil = end;
			if ( engagedMs >= capMs ) {
				stop();
			}
		}
	}

	function onActivity() {
		if ( stopped || ! isVisible() ) {
			return;
		}
		const t = now();
		// Close out the prior window, then start/extend the window at `t`.
		// max() ensures an idle gap before this activity is never back-credited.
		finalizeTo( t );
		lastActivityAt = t;
		creditedUntil = Math.max( creditedUntil, t );
	}

	/**
	 * @param {string} state The new document.visibilityState.
	 */
	function onVisibilityChange( state ) {
		if ( stopped ) {
			return;
		}
		// Finalise up to now, then disarm so the hidden gap is never credited.
		// On restore, the next activity event re-arms the window.
		finalizeTo( now() );
		lastActivityAt = null;
	}

	/**
	 * @returns {number} Cumulative engaged time in milliseconds.
	 */
	function getEngagedMs() {
		finalizeTo( now() );
		return Math.round( engagedMs );
	}

	/**
	 * Flush engaged time accrued since the previous flush.
	 *
	 * Marks the returned amount as flushed, so consecutive calls never hand
	 * out the same millisecond twice — summing every delta a page emits
	 * always equals the page's cumulative total. Still callable after stop()
	 * (e.g. the cap fired between flushes) to drain the remainder.
	 *
	 * @returns {number} Engaged milliseconds accrued since the last flush.
	 */
	function takeDelta() {
		finalizeTo( now() );
		const delta = Math.round( engagedMs - flushedMs );
		flushedMs = engagedMs;
		return delta;
	}

	function sweep() {
		timerId = null;
		if ( stopped ) {
			return;
		}
		finalizeTo( now() );
		timerId = setTimeout( sweep, sweepMs );
	}

	function stop() {
		stopped = true;
		if ( timerId !== null ) {
			clearTimeout( timerId );
			timerId = null;
		}
	}

	// Self-rescheduling sweep keeps the total current and applies the cap even
	// with no reads. setTimeout (not setInterval) avoids drift in backgrounded
	// tabs, and timers are frozen in bfcache so no time is credited there.
	timerId = setTimeout( sweep, sweepMs );

	return {
		onActivity,
		onVisibilityChange,
		getEngagedMs,
		takeDelta,
		stop,
	};
}
