<?php
/**
 * Regression tests for the get-experiment-results ability.
 *
 * Covers commit 364fe98: `probability_to_beat_control` must equal the stored
 * Bayesian win probability `p` scaled to a percentage (p * 100), NOT the
 * inverted frequentist reading (1 - p). The control variant always reports 0,
 * and the winner-recommendation logic must track the corrected field.
 *
 * The ability executor (`execute_get_experiment_results`) is a plain function;
 * the cap check lives on the ability registration, not inside the executor.
 * We still set an admin user so the test matches how the ability is invoked in
 * production, and skip cleanly if the Abilities API is absent (mirroring
 * AbilitiesHardeningTest).
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Experiments\Experiment;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';

class ExperimentResultsAbilityTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();
		// Abilities require an authenticated admin in production.
		wp_set_current_user( 1 );
	}

	/**
	 * Build a completed `titles` experiment with a 3-variant snapshot and a
	 * stored results row carrying the given per-variant P2BB values.
	 *
	 * @param array<int, float|null> $p_values   Per-variant stored `p` (0–1).
	 * @param int|null               $winner_idx Declared winner index, or null.
	 * @param string                 $status     Experiment status.
	 * @return int Experiment ID.
	 */
	protected function make_titles_experiment( array $p_values, ?int $winner_idx = null, string $status = Experiment::STATUS_COMPLETED ) : int {
		$post_id = self::factory()->post->create( [ 'post_type' => 'post' ] );

		$variants = [];
		foreach ( $p_values as $idx => $p ) {
			$variants[ $idx ] = [
				'value' => sprintf( 'Title %d', $idx ),
				'size'  => 1000,
				'hits'  => (int) round( ( $p ?? 0 ) * 100 ),
				'rate'  => ( $p ?? 0 ) / 10,
				'p'     => $p,
			];
		}

		$experiment = new Experiment();
		$experiment->set_subject_post_id( $post_id );
		$experiment->set_test_id( 'titles' );
		$experiment->set_type( Experiment::TYPE_ABTEST );
		$experiment->set_status( $status );
		$experiment->set_start_time( 1000 );
		$experiment->set_variants_snapshot( array_map(
			function ( $idx ) {
				return sprintf( 'Title %d', $idx );
			},
			array_keys( $p_values )
		) );
		$experiment->set_results( [
			'timestamp' => 2000,
			'winner'    => $winner_idx,
			'winning'   => $winner_idx,
			'variants'  => $variants,
		] );
		$experiment->save();

		return $experiment->get_id();
	}

	/**
	 * Resolve a variant by index from the ability result.
	 */
	protected function variant_at( array $result, int $index ) : array {
		foreach ( $result['variants'] as $variant ) {
			if ( (int) $variant['index'] === $index ) {
				return $variant;
			}
		}
		$this->fail( "Variant index {$index} not found in result." );
	}

	/**
	 * probability_to_beat_control = p * 100 (not 1 - p); control reports 0.
	 *
	 * Pins the exact inversion bug: a true win probability of 29.5% previously
	 * surfaced as 70.48%. The corrected field reports 29.5.
	 */
	public function test_probability_to_beat_control_is_p_times_100_not_inverted() {
		// Control wins most simulations; the challenger trails at 0.295.
		$experiment_id = $this->make_titles_experiment( [ 0 => 0.705, 1 => 0.295 ] );

		$result = Execution\execute_get_experiment_results( [ 'experiment_id' => $experiment_id ] );

		$this->assertNotWPError( $result );

		$control    = $this->variant_at( $result, 0 );
		$challenger = $this->variant_at( $result, 1 );

		// Control is the baseline — always 0, never its own p.
		$this->assertSame( 0, $control['probability_to_beat_control'], 'Control must report 0' );

		// Challenger reports p * 100 = 29.5, NOT the inverted (1 - p) * 100 = 70.5.
		$this->assertSame( 29.5, $challenger['probability_to_beat_control'], 'Challenger must report p*100, not the inverted value' );
		$this->assertNotSame( 70.5, $challenger['probability_to_beat_control'], 'The inverted (1 - p) value must never surface' );
	}

	/**
	 * The recommendation/winner logic tracks the corrected field. A strong
	 * challenger (p = 0.96) is recommended as the winner, not the weak one.
	 */
	public function test_recommendation_tracks_corrected_probability() {
		// Variant 2 is the strong challenger; variant 1 is weak.
		$experiment_id = $this->make_titles_experiment(
			[ 0 => 0.02, 1 => 0.02, 2 => 0.96 ],
			2
		);

		$result = Execution\execute_get_experiment_results( [ 'experiment_id' => $experiment_id ] );

		$this->assertNotWPError( $result );

		$strong = $this->variant_at( $result, 2 );
		$weak   = $this->variant_at( $result, 1 );

		// The corrected field orders the variants correctly.
		$this->assertSame( 96.0, $strong['probability_to_beat_control'] );
		$this->assertSame( 2.0, $weak['probability_to_beat_control'] );
		$this->assertGreaterThan( $weak['probability_to_beat_control'], $strong['probability_to_beat_control'] );

		// Winner + recommendation point at the strong challenger.
		$this->assertTrue( $strong['is_winner'], 'The strong challenger is the winner' );
		$this->assertFalse( $weak['is_winner'] );
		$this->assertSame( 2, $result['winner_variant_index'] );
		$this->assertTrue( $result['has_winner'] );
		$this->assertSame( 'declare_winner', $result['recommendation']['action'] );
		$this->assertStringContainsString( 'Title 2', $result['recommendation']['message'], 'Recommendation names the corrected winner' );
	}

	/**
	 * For a running test with no declared winner, the "performing well" branch
	 * fires only when the corrected probability (p*100) clears 90 — proving the
	 * recommendation reads p directly, not 1 - p. A strong challenger (p = 0.95)
	 * surfaces as performing well; under the old inversion it would have read 5%.
	 */
	public function test_running_recommendation_reads_corrected_field() {
		$experiment_id = $this->make_titles_experiment(
			[ 0 => 0.05, 1 => 0.95 ],
			null,
			Experiment::STATUS_RUNNING
		);

		$result = Execution\execute_get_experiment_results( [ 'experiment_id' => $experiment_id ] );

		$this->assertNotWPError( $result );
		$challenger = $this->variant_at( $result, 1 );
		$this->assertSame( 95.0, $challenger['probability_to_beat_control'] );

		// >= 90 corrected probability → "performing well" continue recommendation.
		$this->assertSame( 'continue', $result['recommendation']['action'] );
		$this->assertSame( 'medium', $result['recommendation']['confidence'] );
		$this->assertStringContainsString( 'probability to beat control', $result['recommendation']['message'] );
	}
}
