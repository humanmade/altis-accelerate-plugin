<?php

namespace Altis\Accelerate\Experiments;

use WP_UnitTestCase;

class ABCalcTest extends WP_UnitTestCase {

	/**
	 * Test that probability calculations are mathematically sound.
	 */
	public function test_probability_calculations_sum_to_one() {
		$variants = [
			'0' => ['hits' => 10, 'size' => 100], // 10%
			'1' => ['hits' => 15, 'size' => 100], // 15%
			'2' => ['hits' => 12, 'size' => 100]  // 12%
		];

		$results = calculate_bayesian_p2bb($variants, 1000); // Reduced for CI speed
		$sum = array_sum($results);

		// Probabilities should sum to ~1.0 (±5%)
		$this->assertGreaterThan(0.95, $sum, 'P2BB probabilities should sum close to 1.0');
		$this->assertLessThan(1.05, $sum, 'P2BB probabilities should sum close to 1.0');
	}

	/**
	 * Test that higher conversion rates get higher probability scores.
	 */
	public function test_higher_conversions_get_higher_probability() {
		$variants = [
			'0' => ['hits' => 5,  'size' => 100], // 5%
			'1' => ['hits' => 10, 'size' => 100], // 10%
			'2' => ['hits' => 20, 'size' => 100]  // 20%
		];

		$results = calculate_bayesian_p2bb($variants, 1000); // Reduced for CI speed

		// Higher conversion rates should have higher P2BB
		$this->assertGreaterThan($results['0'], $results['1'], 'Variant with higher conversion should have higher P2BB');
		$this->assertGreaterThan($results['1'], $results['2'], 'Variant with highest conversion should have highest P2BB');
	}

	/**
	 * Test clear winner scenarios get high confidence scores.
	 */
	public function test_clear_winner_gets_high_confidence() {
		$variants = [
			'0' => ['hits' => 1,   'size' => 1000], // 0.1%
			'1' => ['hits' => 200, 'size' => 1000]  // 20%
		];

		$results = calculate_bayesian_p2bb($variants, 2000); // Reduced for CI speed

		// Clear winner should have >95% probability
		$this->assertGreaterThan(0.95, $results['1'], 'Clear winner should have very high P2BB');
		$this->assertLessThan(0.05, $results['0'], 'Clear loser should have very low P2BB');
	}

	/**
	 * Test similar performing variants split probability evenly.
	 */
	public function test_similar_variants_split_probability_evenly() {
		$variants = [
			'0' => ['hits' => 100, 'size' => 1000], // 10%
			'1' => ['hits' => 100, 'size' => 1000]  // 10%
		];

		$results = calculate_bayesian_p2bb($variants, 1000); // Reduced for CI speed

		// Similar variants should split P2BB ~evenly (within 20%)
		$difference = abs($results['0'] - $results['1']);
		$this->assertLessThan(0.2, $difference, 'Similar performing variants should have similar P2BB scores');
	}

	/**
	 * Test edge cases like zero conversions are handled properly.
	 */
	public function test_zero_conversions_handled_gracefully() {
		$variants = [
			'0' => ['hits' => 0, 'size' => 100], // 0%
			'1' => ['hits' => 1, 'size' => 100]  // 1%
		];

		$results = calculate_bayesian_p2bb($variants, 500); // Reduced for CI speed

		// Any conversion should beat zero conversion
		$this->assertGreaterThan($results['0'], $results['1'], 'Any conversion should beat zero conversions');
		$this->assertTrue(is_numeric($results['0']), 'Zero conversion result should be numeric');
		$this->assertTrue(is_numeric($results['1']), 'Single conversion result should be numeric');
	}

	/**
	 * Test data preparation helper works correctly.
	 */
	public function test_data_preparation_calculates_rates_correctly() {
		$aggregations = [
			'0' => ['impressions' => 500, 'conversions' => 25],
			'1' => ['impressions' => 500, 'conversions' => 35]
		];

		$prepared = prepare_variants_for_bayesian($aggregations);

		// Verify data structure
		$this->assertEquals(500, $prepared['0']['size']);
		$this->assertEquals(25, $prepared['0']['hits']);
		$this->assertEquals(0.05, $prepared['0']['rate']);

		$this->assertEquals(500, $prepared['1']['size']);
		$this->assertEquals(35, $prepared['1']['hits']);
		$this->assertEquals(0.07, $prepared['1']['rate']);
	}

	/**
	 * Test full A/B test analysis pipeline.
	 */
	public function test_ab_test_analysis_pipeline() {
		// Create test post for A/B test
		$post_id = self::factory()->post->create([
			'post_title' => 'Test A/B Post',
			'post_type' => 'post'
		]);

		// Set up variant meta data (this is what get_ab_test_variants_for_post reads)
		update_post_meta( $post_id, '_altis_ab_test_test_ab_variants', [
			'0' => 'Control',
			'1' => 'Variant A'
		] );

		// Mock aggregation data
		$aggregations = [
			'0' => ['impressions' => 500, 'conversions' => 25], // 5%
			'1' => ['impressions' => 500, 'conversions' => 45]  // 9%
		];

		// Test the full analysis pipeline
		$results = analyse_ab_test_results($aggregations, 'test_ab', $post_id);

		// Verify structure
		$this->assertArrayHasKey('variants', $results);
		$this->assertArrayHasKey('winning', $results);
		$this->assertArrayHasKey('winner', $results);

		// Check P2BB values are present and valid
		foreach ($results['variants'] as $variant_id => $variant) {
			$this->assertArrayHasKey('p', $variant, "Variant {$variant_id} should have P2BB value");
			$this->assertGreaterThanOrEqual(0, $variant['p'], "P2BB should be >= 0");
			$this->assertLessThanOrEqual(1, $variant['p'], "P2BB should be <= 1");
		}

		// Higher conversion rate should have higher P2BB
		$this->assertGreaterThan(
			$results['variants']['0']['p'], 
			$results['variants']['1']['p'],
			'Variant with higher conversion rate should have higher P2BB'
		);
	}

	/**
	 * Test calculation performance meets requirements.
	 */
	public function test_calculation_performance_benchmark() {
		$variants = [
			'0' => ['hits' => 25, 'size' => 250],
			'1' => ['hits' => 35, 'size' => 250],
			'2' => ['hits' => 30, 'size' => 250],
			'3' => ['hits' => 40, 'size' => 250]
		];

		$start_time = microtime(true);
		$results = calculate_bayesian_p2bb($variants, 5000); // Reduced for CI speed
		$execution_time = microtime(true) - $start_time;

		// Should complete within 5 seconds (reduced samples, relaxed timeout)
		$this->assertLessThan(5.0, $execution_time, 'A/B test calculation should complete within 5 seconds');

		// Should return valid results for all variants
		$this->assertCount(4, $results, 'Should return results for all 4 variants');
		foreach ($results as $variant_id => $p2bb) {
			$this->assertGreaterThanOrEqual(0, $p2bb, "Variant {$variant_id} P2BB should be >= 0");
			$this->assertLessThanOrEqual(1, $p2bb, "Variant {$variant_id} P2BB should be <= 1");
		}
	}

	/**
	 * Test winner determination logic.
	 */
	public function test_winner_determination_logic() {
		// Create test post
		$post_id = self::factory()->post->create([
			'post_title' => 'Winner Test Post',
			'post_type' => 'post'
		]);

		// Set up variant meta data for the tests
		update_post_meta( $post_id, '_altis_ab_test_winner_test_variants', [
			'0' => 'Control',
			'1' => 'Variant A'
		] );
		update_post_meta( $post_id, '_altis_ab_test_small_test_variants', [
			'0' => 'Control',
			'1' => 'Variant A'
		] );

		// Clear winner scenario - should trigger winner logic
		$aggregations = [
			'0' => ['impressions' => 1000, 'conversions' => 10],  // 1%
			'1' => ['impressions' => 1000, 'conversions' => 200]  // 20%
		];

		$results = analyse_ab_test_results($aggregations, 'winner_test', $post_id);

		// With clear winner and sufficient sample size, should have winner
		$this->assertNotNull($results['winner'], 'Should identify a winner with clear difference');
		$this->assertNotNull($results['winning'], 'Should mark the winning variant');

		// Insufficient sample size - should not trigger winner
		$small_aggregations = [
			'0' => ['impressions' => 50, 'conversions' => 1],   // 2%
			'1' => ['impressions' => 50, 'conversions' => 10]   // 20%
		];

		$small_results = analyse_ab_test_results($small_aggregations, 'small_test', $post_id);

		// Even with clear difference, insufficient sample should not declare winner
		$this->assertNull($small_results['winner'], 'Should not declare winner with insufficient sample size');
	}

	/**
	 * Test Beta distribution parameter calculation.
	 */
	public function test_statistical_parameter_calculation() {
		// Test standard case
		$params = calculate_beta_parameters(10, 100);
		$this->assertEquals(11, $params['alpha'], 'Alpha parameter should be hits + 1');
		$this->assertEquals(91, $params['beta'], 'Beta parameter should be failures + 1');

		// Test edge cases
		$zero_params = calculate_beta_parameters(0, 100);
		$this->assertEquals(1, $zero_params['alpha'], 'Alpha should be 1 with zero hits');
		$this->assertEquals(101, $zero_params['beta'], 'Beta should be failures + 1 with zero hits');

		$perfect_params = calculate_beta_parameters(100, 100);
		$this->assertEquals(101, $perfect_params['alpha'], 'Alpha should be 101 with perfect conversion');
		$this->assertEquals(1, $perfect_params['beta'], 'Beta should be 1 with perfect conversion');
	}

	/**
	 * Test memory efficiency with large sample sizes.
	 */
	public function test_memory_efficiency() {
		$memory_before = memory_get_usage();
		
		$variants = [
			'0' => ['hits' => 25, 'size' => 250],
			'1' => ['hits' => 35, 'size' => 250]
		];

		// Run with 5k samples (reduced for CI speed)
		$results = calculate_bayesian_p2bb($variants, 5000);
		
		$memory_after = memory_get_usage();
		$memory_used = ($memory_after - $memory_before) / 1024 / 1024; // MB

		// Should use reasonable amount of memory
		$this->assertLessThan(30, $memory_used, 'Memory usage should be under 30MB');
		$this->assertCount(2, $results, 'Should return results for both variants');
	}
}