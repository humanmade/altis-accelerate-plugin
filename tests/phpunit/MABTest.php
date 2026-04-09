<?php

namespace Altis\Accelerate\Experiments;

use WP_UnitTestCase;

class MABTest extends WP_UnitTestCase {

	/**
	 * Test that burn-in phase returns equal split regardless of P2BB values.
	 */
	public function test_compute_mab_weights_burn_in_returns_equal_split() {
		$p2bb = [ 0 => 0.8, 1 => 0.2 ];
		$weights = compute_mab_weights( $p2bb, 'burn_in' );

		$this->assertCount( 2, $weights );
		$this->assertEquals( $weights[0], $weights[1], 'Burn-in should return equal split' );
		$this->assertEqualsWithDelta( 100, array_sum( $weights ), 1.0 );
	}

	/**
	 * Test that bandit phase shifts weights toward higher P2BB variant.
	 */
	public function test_compute_mab_weights_bandit_follows_p2bb() {
		$p2bb = [ 0 => 0.8, 1 => 0.2 ];
		$weights = compute_mab_weights( $p2bb, 'bandit' );

		$this->assertGreaterThan( $weights[1], $weights[0], 'Higher P2BB variant should get more traffic' );
	}

	/**
	 * Test that floor and cap constraints are enforced.
	 */
	public function test_compute_mab_weights_enforces_floor_and_cap() {
		// Extreme P2BB: one variant dominates.
		$p2bb = [ 0 => 0.99, 1 => 0.01 ];
		$weights = compute_mab_weights( $p2bb, 'bandit' );

		// After floor/cap and normalization, the losing variant should still get meaningful traffic.
		$this->assertGreaterThanOrEqual( 5, $weights[1], 'Losing variant should retain minimum traffic after normalization' );
		// Winner should not get 100%.
		$this->assertLessThan( 100, $weights[0], 'Winning variant should not get 100% traffic' );
	}

	/**
	 * Test that weights always sum to 100.
	 */
	public function test_compute_mab_weights_sum_to_100() {
		$test_cases = [
			[ 0 => 0.5, 1 => 0.5 ],
			[ 0 => 0.8, 1 => 0.2 ],
			[ 0 => 0.99, 1 => 0.01 ],
			[ 0 => 0.33, 1 => 0.33, 2 => 0.34 ],
		];

		foreach ( $test_cases as $p2bb ) {
			$weights = compute_mab_weights( $p2bb, 'bandit' );
			$this->assertEqualsWithDelta( 100, array_sum( $weights ), 1.0, 'Weights should sum to ~100 for: ' . wp_json_encode( $p2bb ) );
		}
	}

	/**
	 * Test burn-in to bandit transition when minimum conversions are met.
	 */
	public function test_determine_mab_phase_burn_in_to_bandit() {
		$sorted_aggs = [
			0 => [ 'impressions' => 2000, 'conversions' => 150 ],
			1 => [ 'impressions' => 2000, 'conversions' => 120 ],
		];
		$mab_state = [ 'mode' => 'bandit', 'phase' => 'burn_in' ];

		$result = determine_mab_phase( $sorted_aggs, $mab_state );

		$this->assertEquals( 'bandit', $result['phase'], 'Should transition to bandit when conversions >= threshold' );
	}

	/**
	 * Test that burn-in stays when conversions are below threshold.
	 */
	public function test_determine_mab_phase_stays_in_burn_in() {
		$sorted_aggs = [
			0 => [ 'impressions' => 500, 'conversions' => 50 ],
			1 => [ 'impressions' => 500, 'conversions' => 30 ],
		];
		$mab_state = [ 'mode' => 'bandit', 'phase' => 'burn_in' ];

		$result = determine_mab_phase( $sorted_aggs, $mab_state );

		$this->assertEquals( 'burn_in', $result['phase'], 'Should stay in burn_in below threshold' );
	}

	/**
	 * Test that classic mode skips all MAB logic.
	 */
	public function test_classic_mode_skips_mab() {
		$sorted_aggs = [
			0 => [ 'impressions' => 5000, 'conversions' => 500 ],
			1 => [ 'impressions' => 5000, 'conversions' => 200 ],
		];
		$mab_state = [ 'mode' => 'classic', 'phase' => 'burn_in' ];

		$result = determine_mab_phase( $sorted_aggs, $mab_state );

		$this->assertEquals( 'classic', $result['mode'] );
		$this->assertEquals( 'burn_in', $result['phase'], 'Classic mode should not transition phases' );
	}
}
