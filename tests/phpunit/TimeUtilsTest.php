<?php
/**
 * Time utility tests.
 *
 * Pins behaviour of `Utils\milliseconds()` and `Utils\date_in_milliseconds()`.
 * These functions feed every dashboard date range and ClickHouse query, so
 * silent changes (TZ shift after an infra move, rounding direction flip)
 * would skew client-visible numbers without raising an alarm.
 *
 * What this test DOES prove:
 *   - Returned value is in milliseconds, not seconds.
 *   - Floor-rounding direction (always down) at minute/hour boundaries.
 *   - Invalid input returns null and triggers a user warning.
 *   - strtotime() respects whatever TZ is set in `date_default_timezone_set()`
 *     at call time — pinned by forcing UTC in setUp.
 *
 * What this test does NOT prove:
 *   - Behaviour across DST transitions (PHP strtotime is DST-aware but timezone
 *     coverage is out of scope for slice 3).
 *   - That every CALL SITE uses the same TZ — that's a callers-side concern.
 *
 * See `docs/test-coverage-audit.md` → P1 #5.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Utils;
use WP_UnitTestCase;

class TimeUtilsTest extends WP_UnitTestCase {

	/** @var string */
	private $original_tz;

	public function set_up() {
		parent::set_up();
		// Pin TZ so test expectations are stable regardless of host config.
		$this->original_tz = date_default_timezone_get();
		date_default_timezone_set( 'UTC' );
	}

	public function tear_down() {
		date_default_timezone_set( $this->original_tz );
		parent::tear_down();
	}

	// -- milliseconds() ----------------------------------------------------

	public function test_milliseconds_returns_int_in_millisecond_range() {
		$now_seconds = time();
		$ms = Utils\milliseconds();

		// Should be on the order of seconds * 1000.
		$this->assertGreaterThanOrEqual( $now_seconds * 1000, $ms );
		$this->assertLessThan( ( $now_seconds + 5 ) * 1000, $ms );
		$this->assertIsInt( $ms );
	}

	public function test_milliseconds_drops_sub_millisecond_precision_due_to_int_cast() {
		// `(int) microtime(true) * 1000` casts the float to int BEFORE
		// multiplying — meaning sub-second precision is lost. This is a
		// known surprise pinned for awareness; do NOT rely on this for
		// high-resolution timing.
		$a = Utils\milliseconds();
		usleep( 1000 ); // 1ms
		$b = Utils\milliseconds();
		// Within the same second, both calls cast to the same integer
		// seconds-value, so the diff is exactly 0 or exactly 1000 (whole second).
		$this->assertContains( $b - $a, [ 0, 1000 ] );
	}

	// -- date_in_milliseconds() -------------------------------------------

	public function test_date_in_milliseconds_resolves_a_fixed_date() {
		// 2024-01-15 12:00:00 UTC → known epoch.
		$expected_seconds = strtotime( '2024-01-15 12:00:00 UTC' );
		$this->assertNotFalse( $expected_seconds );

		$ms = Utils\date_in_milliseconds( '2024-01-15 12:00:00 UTC' );
		$this->assertSame( $expected_seconds * 1000, $ms );
	}

	public function test_date_in_milliseconds_resolves_relative_strings() {
		$ms = Utils\date_in_milliseconds( '-1 week' );
		$this->assertIsInt( $ms );

		$one_week_ago = time() - WEEK_IN_SECONDS;
		// Allow ±5 seconds for the gap between strtotime() calls.
		$this->assertGreaterThan( ( $one_week_ago - 5 ) * 1000, $ms );
		$this->assertLessThan( ( $one_week_ago + 5 ) * 1000, $ms );
	}

	public function test_floor_rounding_drops_to_start_of_hour() {
		// 2024-01-15 14:59:59 UTC, rounded to HOUR_IN_SECONDS, should drop to 14:00:00.
		$ms = Utils\date_in_milliseconds( '2024-01-15 14:59:59 UTC', HOUR_IN_SECONDS );
		$expected_seconds = strtotime( '2024-01-15 14:00:00 UTC' );
		$this->assertSame( $expected_seconds * 1000, $ms );
	}

	public function test_floor_rounding_drops_to_start_of_minute() {
		// 14:59:59 → 14:59:00 at MINUTE_IN_SECONDS granularity.
		$ms = Utils\date_in_milliseconds( '2024-01-15 14:59:59 UTC', MINUTE_IN_SECONDS );
		$expected_seconds = strtotime( '2024-01-15 14:59:00 UTC' );
		$this->assertSame( $expected_seconds * 1000, $ms );
	}

	public function test_floor_rounding_at_exact_boundary_is_a_no_op() {
		// 14:00:00 + HOUR floor → 14:00:00 (no change).
		$ms = Utils\date_in_milliseconds( '2024-01-15 14:00:00 UTC', HOUR_IN_SECONDS );
		$expected_seconds = strtotime( '2024-01-15 14:00:00 UTC' );
		$this->assertSame( $expected_seconds * 1000, $ms );
	}

	public function test_round_to_zero_skips_rounding() {
		$ms_a = Utils\date_in_milliseconds( '2024-01-15 14:59:59 UTC', 0 );
		$ms_b = Utils\date_in_milliseconds( '2024-01-15 14:59:59 UTC' );
		$this->assertSame( $ms_a, $ms_b );
		$expected_seconds = strtotime( '2024-01-15 14:59:59 UTC' );
		$this->assertSame( $expected_seconds * 1000, $ms_a );
	}

	public function test_unix_epoch_is_treated_as_invalid_a_known_bug() {
		// `date_in_milliseconds()` rejects via `if ( ! $since_epoch )`, so
		// `0` (Unix epoch / "1970-01-01 00:00:00 UTC") triggers the
		// "cannot be resolved" path. This is a real bug: epoch is a valid
		// timestamp. Pinned so we notice if it's fixed or worsens.
		// TODO (slice 2): add to `docs/test-coverage-audit.md` open decisions
		// — should `date_in_milliseconds()` accept epoch as valid?
		set_error_handler( function () { return true; }, E_USER_WARNING );
		$ms = Utils\date_in_milliseconds( '1970-01-01 00:00:00 UTC' );
		restore_error_handler();

		$this->assertNull( $ms );
	}

	public function test_invalid_input_returns_null_and_warns() {
		// `@` suppresses the E_USER_WARNING so the test framework doesn't
		// fail on it; we verify both the null return AND the warning fires.
		$saw_warning = false;
		set_error_handler( function ( $errno, $errstr ) use ( &$saw_warning ) {
			if ( $errno === E_USER_WARNING && strpos( $errstr, 'cannot be resolved' ) !== false ) {
				$saw_warning = true;
				return true; // Swallow.
			}
			return false;
		}, E_USER_WARNING );

		$ms = Utils\date_in_milliseconds( 'this is not a date' );

		restore_error_handler();

		$this->assertNull( $ms );
		$this->assertTrue( $saw_warning, 'date_in_milliseconds should trigger E_USER_WARNING on invalid input' );
	}
}
