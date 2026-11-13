<?php
/**
 * Historical result revisions let consumers refresh only changed detail rows.
 *
 * @package altis-accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Discovery;
use Altis\Accelerate\Experiments\Experiment;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/discovery.php';

class ExperimentListingRevisionTest extends WP_UnitTestCase {

	public function test_revision_changes_for_corrected_results_and_snapshot_only() : void {
		$post_id = self::factory()->post->create();
		$experiment = new Experiment();
		$experiment->set_subject_post_id( $post_id );
		$experiment->set_test_id( 'titles' );
		$experiment->set_type( Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_COMPLETED );
		$experiment->set_variants_snapshot( [ 'Control', 'Challenger' ] );
		$experiment->set_results( [ 'winner' => 1, 'variants' => [ [ 'hits' => 25 ], [ 'hits' => 40 ] ] ] );
		$experiment->save();

		$input = [ 'status' => 'completed', 'subject_post_id' => $post_id, 'per_page' => 1 ];
		$first = Discovery\execute_list_experiments( $input )['experiments'][0];
		$this->assertSame( $experiment->get_id(), $first['experiment_id'] );
		$this->assertMatchesRegularExpression( '/^[a-f0-9]{64}$/', $first['result_revision'] );
		$this->assertNotEmpty( $first['updated_at'] );
		$this->assertSame( $first['result_revision'], Discovery\execute_list_experiments( $input )['experiments'][0]['result_revision'] );

		// An unchanged winner and end time must not hide corrected aggregates.
		$experiment->set_results( [ 'winner' => 1, 'variants' => [ [ 'hits' => 25 ], [ 'hits' => 41 ] ] ] );
		$experiment->save();
		$corrected = Discovery\execute_list_experiments( $input )['experiments'][0];
		$this->assertSame( $first['winner_variant_index'], $corrected['winner_variant_index'] );
		$this->assertSame( $first['ended_at'], $corrected['ended_at'] );
		$this->assertNotSame( $first['result_revision'], $corrected['result_revision'] );

		$experiment->set_variants_snapshot( [ 'Control', 'Corrected title' ] );
		$experiment->save();
		$renamed = Discovery\execute_list_experiments( $input )['experiments'][0];
		$this->assertNotSame( $corrected['result_revision'], $renamed['result_revision'] );

		// Annotations are already returned directly; consumers fingerprint them separately.
		$experiment->set_annotations( [ 'toolkit:pattern' => 'headline-rewrite' ] );
		$experiment->save();
		$annotated = Discovery\execute_list_experiments( $input )['experiments'][0];
		$this->assertSame( $renamed['result_revision'], $annotated['result_revision'] );
		$this->assertSame( 'headline-rewrite', $annotated['annotations']['toolkit:pattern'] );
	}
}
