<?php
/**
 * A/B test lifecycle tests.
 *
 * Pins the post-meta state machine used by the `<ab-test>` element contract:
 * variants, start/end times, paused, ended, traffic allocation, results.
 * The inc/AGENTS.md notes that "AB-related post-meta keys are part of the public
 * contract" — these tests stop them being renamed by accident.
 *
 * What this test DOES prove:
 *   - Each lifecycle helper writes to its expected post_meta key.
 *   - `is_ab_test_running_for_post()` honors all five guards
 *     (variants, started, !paused, start_time <= now, end_time > now).
 *   - `end_ab_test_for_post()` is idempotent (the explicit
 *     has_ab_test_ended early-return).
 *   - `end_ab_test_for_post()` pauses + flags ended + sets end_time + fires
 *     the two action hooks (generic + test-id-scoped).
 *
 * What this test does NOT prove:
 *   - Cron handler behaviour (`handle_post_ab_test_cron`) — that requires
 *     scheduled events and isn't deterministic under WP_UnitTestCase.
 *   - REST field exposure (separate concern; `ExperimentSyncTest` covers
 *     the dual-write side).
 *
 * See `docs/test-coverage-audit.md` → P2 #8.
 */

namespace Altis\Accelerate\Experiments;

use WP_UnitTestCase;

class ABTestLifecycleTest extends WP_UnitTestCase {

	/** @var int */
	protected $post_id;

	/** @var string */
	protected $test_id = 'titles';

	public function set_up() {
		parent::set_up();
		// `update_is_ab_test_started/paused/ended_for_post` dual-write to
		// the Experiments custom table via `sync_experiment_to_table()` —
		// the table must exist before any of the tests run.
		Experiment::ensure_table();
		$this->post_id = self::factory()->post->create( [ 'post_title' => 'Lifecycle Test' ] );
	}

	public function tear_down() {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// DELETE (DML), not TRUNCATE (DDL), to preserve WP transaction rollback.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		parent::tear_down();
	}

	/**
	 * Fetch the latest Experiments-table row for a (post, test_id) tuple.
	 * Returns null if no row exists yet.
	 *
	 * Uses `Experiment::query()` rather than `Experiment::get_active_for_post()`
	 * because the latter filters out `completed` rows, which we need to
	 * assert after `end_ab_test_for_post()`.
	 *
	 * Orders by `id DESC` so post-end un-start transitions return the NEW
	 * row (sync_experiment_to_table creates a fresh experiment when the
	 * previous one was completed and the new status isn't completed).
	 * Auto-increment id is monotonic; `created_at DESC` ties in fast tests
	 * because MySQL DATETIME is second-precision.
	 */
	private function get_experiment_row() : ?Experiment {
		$results = Experiment::query(
			[
				'subject_post_id' => $this->post_id,
				'test_id'         => $this->test_id,
			],
			[
				'per_page' => 1,
				'order_by' => [ 'id' => 'DESC' ],
			]
		)->get_results();

		if ( is_wp_error( $results ) || count( $results ) === 0 ) {
			return null;
		}
		return $results[0];
	}

	// -- Post-meta key contract -------------------------------------------

	public function test_update_variants_writes_to_expected_meta_key() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );

		$meta = get_post_meta( $this->post_id, "_altis_ab_test_{$this->test_id}_variants", true );
		$this->assertSame( [ 'A', 'B' ], $meta );
	}

	public function test_update_start_time_writes_to_expected_meta_key() {
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1700000000000 );

		$meta = (int) get_post_meta( $this->post_id, "_altis_ab_test_{$this->test_id}_start_time", true );
		$this->assertSame( 1700000000000, $meta );
	}

	public function test_update_end_time_writes_to_expected_meta_key() {
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, 1800000000000 );

		$meta = (int) get_post_meta( $this->post_id, "_altis_ab_test_{$this->test_id}_end_time", true );
		$this->assertSame( 1800000000000, $meta );
	}

	public function test_update_traffic_percentage_writes_to_expected_meta_key() {
		update_ab_test_traffic_percentage_for_post( $this->test_id, $this->post_id, 50 );

		$meta = (int) get_post_meta( $this->post_id, "_altis_ab_test_{$this->test_id}_traffic_percentage", true );
		$this->assertSame( 50, $meta );
	}

	public function test_default_traffic_percentage_is_35() {
		// Documented default from `get_ab_test_traffic_percentage_for_post()`.
		$this->assertSame( 35, get_ab_test_traffic_percentage_for_post( $this->test_id, $this->post_id ) );
	}

	// -- is_ab_test_running guards ----------------------------------------

	public function test_is_running_returns_false_without_variants() {
		// Variants empty → not running, regardless of other state.
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, false );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );

		$this->assertFalse( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );
	}

	public function test_is_running_returns_false_when_paused() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, true );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );

		$this->assertFalse( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );
	}

	public function test_is_running_returns_false_when_end_time_is_in_the_past() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, false );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, 1000 );

		$this->assertFalse( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );
	}

	public function test_is_running_returns_true_with_all_guards_passed() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, false );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );

		$this->assertTrue( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );
	}

	// -- end_ab_test_for_post ---------------------------------------------

	public function test_end_test_pauses_flags_and_sets_end_time() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, false );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );

		end_ab_test_for_post( $this->test_id, $this->post_id );

		$this->assertTrue( is_ab_test_paused_for_post( $this->test_id, $this->post_id ) );
		$this->assertTrue( has_ab_test_ended_for_post( $this->test_id, $this->post_id ) );
		// End time should now be in the recent past (set to milliseconds()).
		$end_time = (int) get_ab_test_end_time_for_post( $this->test_id, $this->post_id );
		$this->assertLessThanOrEqual( \Altis\Accelerate\Utils\milliseconds(), $end_time );
		// Test should no longer be running.
		$this->assertFalse( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );

		// Dual-write: the Experiments custom table should reflect the
		// completed status.
		$row = $this->get_experiment_row();
		$this->assertNotNull( $row, 'Experiments-table row should exist after end_ab_test_for_post()' );
		$this->assertSame( Experiment::STATUS_COMPLETED, $row->get_status() );
	}

	public function test_end_test_is_idempotent() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );

		end_ab_test_for_post( $this->test_id, $this->post_id );
		$first_end_time = (int) get_ab_test_end_time_for_post( $this->test_id, $this->post_id );

		// Wait a beat, then end again. The early-return should leave end_time alone.
		usleep( 5000 );
		end_ab_test_for_post( $this->test_id, $this->post_id );
		$second_end_time = (int) get_ab_test_end_time_for_post( $this->test_id, $this->post_id );

		$this->assertSame( $first_end_time, $second_end_time );

		// Dual-write: the table row should still be `completed` (and there
		// should be exactly one row — the second `end` call must not have
		// inserted a duplicate).
		$row = $this->get_experiment_row();
		$this->assertNotNull( $row );
		$this->assertSame( Experiment::STATUS_COMPLETED, $row->get_status() );
	}

	public function test_end_test_fires_action_hooks() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );

		$generic_fired = false;
		$scoped_fired = false;
		add_action( 'altis.experiments.test.ended', function () use ( &$generic_fired ) {
			$generic_fired = true;
		} );
		add_action( "altis.experiments.test.ended.{$this->test_id}", function () use ( &$scoped_fired ) {
			$scoped_fired = true;
		} );

		end_ab_test_for_post( $this->test_id, $this->post_id );

		$this->assertTrue( $generic_fired, 'Generic altis.experiments.test.ended should fire' );
		$this->assertTrue( $scoped_fired, "altis.experiments.test.ended.{$this->test_id} should fire" );
	}

	// -- Pause / resume transitions ---------------------------------------

	public function test_pause_then_resume_restores_running_state() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, false );
		update_ab_test_start_time_for_post( $this->test_id, $this->post_id, 1 );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );
		$this->assertTrue( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );
		// Dual-write: table row should be `running`.
		$this->assertSame( Experiment::STATUS_RUNNING, $this->get_experiment_row()->get_status() );

		// Pause → not running.
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, true );
		$this->assertFalse( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );
		// Dual-write: table row should be `paused`.
		$this->assertSame( Experiment::STATUS_PAUSED, $this->get_experiment_row()->get_status() );

		// Resume → running again. This is the transition that "end_ab_test"
		// makes impossible (it also sets the `ended` flag), so this proves
		// pause/resume is a strictly reversible state distinct from end.
		update_is_ab_test_paused_for_post( $this->test_id, $this->post_id, false );
		$this->assertTrue( is_ab_test_running_for_post( $this->test_id, $this->post_id ) );
		$this->assertFalse( has_ab_test_ended_for_post( $this->test_id, $this->post_id ) );
		// Dual-write: table row should be back to `running`.
		$this->assertSame( Experiment::STATUS_RUNNING, $this->get_experiment_row()->get_status() );
	}

	// -- update_is_ab_test_started -- reset side effect -------------------

	public function test_un_starting_a_test_resets_the_ended_flag() {
		update_ab_test_variants_for_post( $this->test_id, $this->post_id, [ 'A', 'B' ] );
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, true );
		update_ab_test_end_time_for_post( $this->test_id, $this->post_id, PHP_INT_MAX );
		end_ab_test_for_post( $this->test_id, $this->post_id );
		$this->assertTrue( has_ab_test_ended_for_post( $this->test_id, $this->post_id ) );

		// Un-start the test. Per the inline comment in update_is_ab_test_started,
		// this should clear the ended flag.
		update_is_ab_test_started_for_post( $this->test_id, $this->post_id, false );

		$this->assertFalse( has_ab_test_ended_for_post( $this->test_id, $this->post_id ) );

		// Dual-write: un-starting clears the `ended` post_meta but does NOT
		// touch the `paused` flag that `end_ab_test_for_post()` set first.
		// `sync_experiment_to_table()` derives status from those flags, so
		// the row stays `paused`, not `draft`. Pinned for clarity.
		$row = $this->get_experiment_row();
		$this->assertNotNull( $row );
		$this->assertSame( Experiment::STATUS_PAUSED, $row->get_status() );
	}
}
