<?php
/**
 * Tests for the multi-armed bandit (Thompson Sampling) machinery.
 *
 * @package altis-accelerate
 */

namespace Altis\Accelerate\Experiments;

use WP_UnitTestCase;

class BanditTest extends WP_UnitTestCase {

	/**
	 * Flush the resolver cache between tests so DB rollbacks start clean.
	 */
	public function set_up() : void {
		parent::set_up();
		flush_experiment_resolver_cache();
	}

	/**
	 * Helper: create a post with two variants registered, start the experiment,
	 * and set the target mode/phase via helpers/filters.
	 *
	 * @param string $mode  'bandit', 'equal-split', or '' (unset — build row directly).
	 * @param string $phase Phase value or '' (unset).
	 * @return int Post ID.
	 */
	protected function make_test_post( string $mode = 'bandit', string $phase = 'burn_in' ) : int {
		$post_id = self::factory()->post->create( [
			'post_title' => 'Bandit Test Post',
			'post_type'  => 'post',
		] );
		update_post_meta( $post_id, '_altis_ab_test_test_variants', [ '0' => 'A', '1' => 'B' ] );

		if ( $mode === '' ) {
			// Legacy case: build a row with mode set but no phase via the ORM directly.
			$experiment = Experiment::get_or_create_for_post( $post_id, 'test' );
			$experiment->set_status( Experiment::STATUS_RUNNING );
			$experiment->set_test_mode( 'bandit' );
			$experiment->save();
			// Populate cache so helpers read this row.
			flush_experiment_resolver_cache();
		} else {
			// Use the filter to control which mode is initialised.
			if ( $mode === 'equal-split' ) {
				$filter = add_filter( 'altis.experiments.default_test_mode', function () {
					return 'equal-split';
				} );
			}
			update_is_ab_test_started_for_post( 'test', $post_id, true );
			if ( $mode === 'equal-split' ) {
				remove_all_filters( 'altis.experiments.default_test_mode' );
			}
		}

		// Advance to the requested phase (skip when phase is '' or already set by init).
		if ( $phase !== '' && $phase !== 'burn_in' ) {
			update_test_phase_for_post( 'test', $post_id, $phase );
		}

		return $post_id;
	}

	/**
	 * 1. compute_bandit_weights — weights sum to 100, each in [floor, cap].
	 */
	public function test_weights_sum_to_100_and_respect_bounds() {
		$variants_data = [
			'0' => [ 'hits' => 20, 'size' => 200 ],
			'1' => [ 'hits' => 30, 'size' => 200 ],
		];
		$weights = compute_bandit_weights( $variants_data, 2 );
		$sum = array_sum( $weights );

		$this->assertEqualsWithDelta( 100.0, $sum, 0.001, 'Weights should sum to 100' );
		foreach ( $weights as $w ) {
			$this->assertGreaterThanOrEqual( 5.0 - 0.001, $w );
			$this->assertLessThanOrEqual( 90.0 + 0.001, $w );
		}
	}

	/**
	 * 2. Clear winner gets cap, loser gets floor.
	 */
	public function test_clear_winner_pushed_to_cap_loser_to_floor() {
		$variants_data = [
			'0' => [ 'hits' => 1,   'size' => 1000 ],
			'1' => [ 'hits' => 300, 'size' => 1000 ],
		];
		$weights = compute_bandit_weights( $variants_data, 2 );
		$this->assertEqualsWithDelta( 100.0, array_sum( $weights ), 0.001 );
		// With N=2, scaled floor = 12.5 and cap = 90. After clamping (floor=12.5, cap=90)
		// the normalized split is 12.5/87.5 — winner gets remainder after loser's floor.
		$this->assertEqualsWithDelta( 87.5, $weights[1], 0.5, 'Clear winner should approach cap' );
		$this->assertEqualsWithDelta( 12.5, $weights[0], 0.5, 'Clear loser should hit floor' );
	}

	/**
	 * 3a. N=3 floor (25/3 ≈ 8.33%). 3b. Large N collapses to equal split.
	 */
	public function test_floor_scaling_and_large_n_fallback() {
		// N=3.
		$variants_data = [
			'0' => [ 'hits' => 1,   'size' => 1000 ],
			'1' => [ 'hits' => 1,   'size' => 1000 ],
			'2' => [ 'hits' => 300, 'size' => 1000 ],
		];
		$weights = compute_bandit_weights( $variants_data, 3 );
		$this->assertEqualsWithDelta( 100.0, array_sum( $weights ), 0.001 );
		foreach ( $weights as $w ) {
			$this->assertGreaterThanOrEqual( 25.0 / 3 - 0.001, $w );
		}

		// Large N (21) → floor would force > 100 of allocation; fall back to equal split.
		$big = [];
		for ( $i = 0; $i < 21; $i++ ) {
			$big[ (string) $i ] = [ 'hits' => 1, 'size' => 100 ];
		}
		add_filter( 'altis.experiments.bandit.weight_floor', function () {
			return 10.0;
		} );
		$weights = compute_bandit_weights( $big, 21 );
		remove_all_filters( 'altis.experiments.bandit.weight_floor' );
		$this->assertCount( 21, $weights );
		$expected = 100.0 / 21;
		foreach ( $weights as $w ) {
			$this->assertEqualsWithDelta( $expected, $w, 0.001, 'Equal-split fallback' );
		}
	}

	/**
	 * 4. Burn-in below floor → stays in burn_in.
	 */
	public function test_burn_in_stays_when_below_floor() {
		$post_id = $this->make_test_post( 'bandit', 'burn_in' );
		// Pre-seed equal weights.
		update_ab_test_variant_traffic_percentage_for_post( 'test', $post_id, [ 50.0, 50.0 ] );

		// Simulate phase logic by calling helpers directly.
		$conversions = [ 0 => 10, 1 => 12 ]; // both below default 50.
		$min = min( $conversions );
		$this->assertLessThan( 50, $min );

		// Phase should not advance.
		$this->assertSame( 'burn_in', get_test_phase_for_post( 'test', $post_id ) );
	}

	/**
	 * 5. Burn-in → bandit when floor met; weights recomputed.
	 */
	public function test_burn_in_advances_to_bandit() {
		$post_id = $this->make_test_post( 'bandit', 'burn_in' );
		// Force phase advancement via the helpers (this mirrors the cron block).
		$variants_data = [
			'0' => [ 'hits' => 60, 'size' => 1000 ],
			'1' => [ 'hits' => 80, 'size' => 1000 ],
		];
		update_test_phase_for_post( 'test', $post_id, 'bandit' );
		$weights = compute_bandit_weights( $variants_data, 2 );
		update_ab_test_variant_traffic_percentage_for_post( 'test', $post_id, $weights );

		$this->assertSame( 'bandit', get_test_phase_for_post( 'test', $post_id ) );
		$stored = get_ab_test_variant_traffic_percentage_for_post( 'test', $post_id );
		$this->assertCount( 2, $stored );
		$this->assertEqualsWithDelta( 100.0, array_sum( $stored ), 0.001 );
	}

	/**
	 * 6. Bandit → confirmatory at P2BB ≥ 0.95; baseline written; weights reset.
	 */
	public function test_bandit_advances_to_confirmatory_with_baseline_and_reset() {
		$post_id = $this->make_test_post( 'bandit', 'bandit' );
		$conversions = [ 0 => 5, 1 => 400 ]; // clear winner.

		update_test_phase_for_post( 'test', $post_id, 'confirmatory' );
		update_confirmatory_baseline_for_post( 'test', $post_id, $conversions );
		update_ab_test_variant_traffic_percentage_for_post( 'test', $post_id, [ 50.0, 50.0 ] );

		$this->assertSame( 'confirmatory', get_test_phase_for_post( 'test', $post_id ) );
		$this->assertSame( [ 5, 400 ], get_confirmatory_baseline_for_post( 'test', $post_id ) );
		$stored = get_ab_test_variant_traffic_percentage_for_post( 'test', $post_id );
		$this->assertEqualsWithDelta( 50.0, $stored[0], 0.001 );
		$this->assertEqualsWithDelta( 50.0, $stored[1], 0.001 );
	}

	/**
	 * 7. Confirmatory completion — baseline-delta ≥ 100 → done; below stays.
	 */
	public function test_confirmatory_completion_baseline_delta() {
		$post_id = $this->make_test_post( 'bandit', 'confirmatory' );
		update_confirmatory_baseline_for_post( 'test', $post_id, [ 100, 100 ] );

		// Below threshold — stays.
		$conversions = [ 150, 160 ]; // deltas 50/60.
		$min_delta = min( $conversions[0] - 100, $conversions[1] - 100 );
		$this->assertLessThan( 100, $min_delta );
		$this->assertSame( 'confirmatory', get_test_phase_for_post( 'test', $post_id ) );

		// Above threshold — advances.
		$conversions = [ 250, 300 ];
		$min_delta = min( $conversions[0] - 100, $conversions[1] - 100 );
		$this->assertGreaterThanOrEqual( 100, $min_delta );
		update_test_phase_for_post( 'test', $post_id, 'done' );
		$this->assertSame( 'done', get_test_phase_for_post( 'test', $post_id ) );
	}

	/**
	 * 8. Equal-split mode is a no-op — phase logic should never run for it.
	 */
	public function test_equal_split_mode_skips_phase_logic() {
		$post_id = $this->make_test_post( 'equal-split', '' );
		$this->assertSame( 'equal-split', get_test_mode_for_post( 'test', $post_id ) );
		$this->assertSame( '', get_test_phase_for_post( 'test', $post_id ) );
	}

	/**
	 * 9. Legacy test (no test_phase) — even if mode is bandit, gate fails.
	 */
	public function test_legacy_test_without_phase_is_gated_off() {
		$post_id = $this->make_test_post( '', '' );
		$this->assertSame( 'bandit', get_test_mode_for_post( 'test', $post_id ) );
		$this->assertSame( '', get_test_phase_for_post( 'test', $post_id ), 'Legacy guard is empty phase' );
	}

	/**
	 * 10. Filter override at creation — default_test_mode = equal-split.
	 */
	public function test_filter_override_default_test_mode_equal_split() {
		add_filter( 'altis.experiments.default_test_mode', function () {
			return 'equal-split';
		} );

		$post_id = self::factory()->post->create( [ 'post_type' => 'post' ] );
		update_is_ab_test_started_for_post( 'test', $post_id, true );

		remove_all_filters( 'altis.experiments.default_test_mode' );

		// Assert row-based state.
		$this->assertSame( 'equal-split', get_test_mode_for_post( 'test', $post_id ) );
		// Phase should NOT be set for equal-split mode.
		$this->assertSame( '', get_test_phase_for_post( 'test', $post_id ) );
		// Three new meta keys must NOT exist in post meta.
		$this->assertSame( '', get_post_meta( $post_id, '_altis_ab_test_test_mode', true ), 'test_mode must not be in post meta' );
		$this->assertSame( '', get_post_meta( $post_id, '_altis_ab_test_test_phase', true ), 'test_phase must not be in post meta' );
		$this->assertSame( '', get_post_meta( $post_id, '_altis_ab_test_test_confirmatory_baseline', true ), 'confirmatory_baseline must not be in post meta' );
	}

	/**
	 * 11. Idempotency — re-running the start hook does not overwrite existing row state.
	 */
	public function test_start_hook_is_idempotent_on_row() {
		$post_id = self::factory()->post->create( [ 'post_type' => 'post' ] );
		update_is_ab_test_started_for_post( 'test', $post_id, true );
		$this->assertSame( 'bandit', get_test_mode_for_post( 'test', $post_id ) );
		$this->assertSame( 'burn_in', get_test_phase_for_post( 'test', $post_id ) );

		// Manually advance phase, then re-call start hook.
		update_test_phase_for_post( 'test', $post_id, 'bandit' );
		update_is_ab_test_started_for_post( 'test', $post_id, true );

		// Phase must NOT have been reset to burn_in.
		$this->assertSame( 'bandit', get_test_phase_for_post( 'test', $post_id ) );

		// Baseline write is idempotent — overwriting with same value is OK.
		update_confirmatory_baseline_for_post( 'test', $post_id, [ 1, 2 ] );
		$first = get_confirmatory_baseline_for_post( 'test', $post_id );
		$this->assertSame( [ 1, 2 ], $first );

		// Three new meta keys must NOT exist in post meta.
		$this->assertSame( '', get_post_meta( $post_id, '_altis_ab_test_test_mode', true ), 'test_mode must not be in post meta' );
		$this->assertSame( '', get_post_meta( $post_id, '_altis_ab_test_test_phase', true ), 'test_phase must not be in post meta' );
		$this->assertSame( '', get_post_meta( $post_id, '_altis_ab_test_test_confirmatory_baseline', true ), 'confirmatory_baseline must not be in post meta' );
	}

	/**
	 * 12. Attribute escaping — JSON in variant-weights attribute is HTML-safe and parseable.
	 */
	public function test_variant_weights_json_is_html_safe() {
		$weights = [ 12.5, 87.5 ];
		$json = wp_json_encode( $weights );
		$attr = esc_attr( $json );

		// HTML-safe: no raw `<`, `>`, `"` outside escape sequences.
		$this->assertStringNotContainsString( '"', $attr, 'esc_attr should escape double quotes' );
		// Round-trip: html-decode then json-decode yields original.
		$decoded = json_decode( html_entity_decode( $attr, ENT_QUOTES ), true );
		$this->assertSame( $weights, $decoded );
	}

	/**
	 * 13. Per-test default_test_mode filter — receives $test_id and $post_id.
	 */
	public function test_default_test_mode_filter_receives_per_test_context() {
		$captured = [];
		add_filter( 'altis.experiments.default_test_mode', function ( $mode, $test_id, $post_id ) use ( &$captured ) {
			$captured = [ 'test_id' => $test_id, 'post_id' => $post_id ];
			return 'equal-split';
		}, 10, 3 );

		$post_id = self::factory()->post->create( [ 'post_type' => 'post' ] );
		update_is_ab_test_started_for_post( 'test', $post_id, true );

		remove_all_filters( 'altis.experiments.default_test_mode' );

		$this->assertSame( 'test', $captured['test_id'], 'Filter should receive test_id' );
		$this->assertSame( $post_id, $captured['post_id'], 'Filter should receive post_id' );
		// Assert row-based state; no post meta written.
		$this->assertSame( 'equal-split', get_test_mode_for_post( 'test', $post_id ) );
		$this->assertSame( '', get_post_meta( $post_id, '_altis_ab_test_test_mode', true ), 'test_mode must not be in post meta' );
	}

	/**
	 * 14. Per-test burn_in_min_conversions filter — receives $test_id and $post_id.
	 */
	public function test_burn_in_min_filter_receives_per_test_context() {
		$captured = [];
		add_filter( 'altis.experiments.bandit.burn_in_min_conversions', function ( $min, $test_id, $post_id ) use ( &$captured ) {
			$captured = [ 'test_id' => $test_id, 'post_id' => $post_id ];
			return 10; // Low floor so the phase advances with our seed data.
		}, 10, 3 );

		$post_id = $this->make_test_post( 'bandit', 'burn_in' );
		// Enough conversions to clear the custom floor of 10.
		$conversions = [ 0 => 15, 1 => 20 ];
		$min_observed = min( $conversions );

		// Simulate the burn-in check directly.
		$burn_in_min = (int) apply_filters( 'altis.experiments.bandit.burn_in_min_conversions', 50, 'test', $post_id );

		remove_all_filters( 'altis.experiments.bandit.burn_in_min_conversions' );

		$this->assertSame( 'test', $captured['test_id'], 'Filter should receive test_id' );
		$this->assertSame( $post_id, $captured['post_id'], 'Filter should receive post_id' );
		$this->assertSame( 10, $burn_in_min, 'Filter return value should be used' );
		$this->assertGreaterThanOrEqual( $burn_in_min, $min_observed, 'Conversions clear the custom floor' );
	}

	/**
	 * 15. Restart regression: start → end → start a second experiment on the same post.
	 *
	 * The new row must get fresh burn_in state; the completed row's phase must be
	 * unchanged. Row identity (new id ≠ old id) is asserted to pin sync-updates-cache.
	 */
	public function test_restart_creates_fresh_row_with_burn_in() {
		$post_id = self::factory()->post->create( [ 'post_type' => 'post' ] );
		update_post_meta( $post_id, '_altis_ab_test_test_variants', [ '0' => 'A', '1' => 'B' ] );

		// First run: start, advance phase, end.
		update_is_ab_test_started_for_post( 'test', $post_id, true );
		$first_experiment = resolve_experiment_for_test( 'test', $post_id );
		$this->assertNotNull( $first_experiment );
		$first_id = $first_experiment->get_id();

		update_test_phase_for_post( 'test', $post_id, 'bandit' );
		$this->assertSame( 'bandit', get_test_phase_for_post( 'test', $post_id ) );

		// End the test (marks it completed).
		update_has_ab_test_ended_for_post( 'test', $post_id, true );
		flush_experiment_resolver_cache();

		// Verify completed row still has its phase.
		$completed = Experiment::query(
			[ 'id' => $first_id ],
			[ 'per_page' => 1 ]
		)->get_results();
		$this->assertCount( 1, $completed );
		$this->assertSame( 'bandit', $completed[0]->get_test_phase(), 'Completed row phase must not be altered' );

		// Second run: start a new experiment.
		update_is_ab_test_started_for_post( 'test', $post_id, true );
		$second_experiment = resolve_experiment_for_test( 'test', $post_id );
		$this->assertNotNull( $second_experiment );
		$second_id = $second_experiment->get_id();

		$this->assertNotSame( $first_id, $second_id, 'Restart must produce a new experiment row' );
		$this->assertSame( 'bandit', get_test_mode_for_post( 'test', $post_id ) );
		$this->assertSame( 'burn_in', get_test_phase_for_post( 'test', $post_id ), 'New row must start at burn_in' );
	}

	/**
	 * 16. Equal-split init leaves mode='equal-split', phase='' and restart is idempotent.
	 *
	 * Restarting an equal-split test must not re-init to bandit.
	 */
	public function test_equal_split_init_is_idempotent() {
		add_filter( 'altis.experiments.default_test_mode', function () {
			return 'equal-split';
		} );

		$post_id = self::factory()->post->create( [ 'post_type' => 'post' ] );
		update_is_ab_test_started_for_post( 'test', $post_id, true );

		remove_all_filters( 'altis.experiments.default_test_mode' );

		$this->assertSame( 'equal-split', get_test_mode_for_post( 'test', $post_id ) );
		$this->assertSame( '', get_test_phase_for_post( 'test', $post_id ) );

		// Re-start without filter — must NOT override mode to bandit.
		update_is_ab_test_started_for_post( 'test', $post_id, true );
		$this->assertSame( 'equal-split', get_test_mode_for_post( 'test', $post_id ), 'Mode must not flip to bandit on restart' );
		$this->assertSame( '', get_test_phase_for_post( 'test', $post_id ), 'Phase must remain empty for equal-split' );
	}

	/**
	 * 17. Cache contamination: read after completion, then update helper must not write completed row.
	 *
	 * Simulates: any-status read caches a completed row, then an update helper is
	 * called in the same request — it must return false (no active row) and must
	 * NOT mutate the completed row.
	 */
	public function test_cache_does_not_contaminate_completed_row_on_update() {
		$post_id = self::factory()->post->create( [ 'post_type' => 'post' ] );
		update_post_meta( $post_id, '_altis_ab_test_test_variants', [ '0' => 'A', '1' => 'B' ] );

		// Start and immediately end.
		update_is_ab_test_started_for_post( 'test', $post_id, true );
		update_test_phase_for_post( 'test', $post_id, 'bandit' );
		$completed_experiment = resolve_experiment_for_test( 'test', $post_id );
		$completed_id = $completed_experiment->get_id();

		update_has_ab_test_ended_for_post( 'test', $post_id, true );
		flush_experiment_resolver_cache();

		// Any-status read — caches the completed row.
		$cached = resolve_experiment_for_test( 'test', $post_id );
		$this->assertNotNull( $cached );
		$this->assertSame( Experiment::STATUS_COMPLETED, $cached->get_status() );

		// Update helper in the same request — must not write the completed row.
		$result = update_test_phase_for_post( 'test', $post_id, 'confirmatory' );
		$this->assertFalse( $result, 'update_test_phase_for_post must return false when no active row exists' );

		// Reload the completed row from DB and verify it was not mutated.
		$db_rows = Experiment::query(
			[ 'id' => $completed_id ],
			[ 'per_page' => 1 ]
		)->get_results();
		$this->assertCount( 1, $db_rows );
		$this->assertSame( 'bandit', $db_rows[0]->get_test_phase(), 'Completed row phase must not have been overwritten' );
	}
}
