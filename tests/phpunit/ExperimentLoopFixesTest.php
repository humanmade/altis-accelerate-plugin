<?php
/**
 * Regression tests for the experiment-loop fixes (create → run → harvest).
 *
 * Covers the defects found driving the abilities end-to-end:
 *  - A1:  create-ab-test / create-personalization-rule actually start the test
 *         (running status, variants meta present, bandit burn_in phase).
 *  - A4:  a pre-set test_mode='bandit' still gets a burn_in phase on start.
 *  - A8:  variant titles with `&` round-trip (no lost-backslash `u0026`).
 *  - A13a: the bandit done-transition applies the winning variant content.
 *  - A13b: stop-experiment declare_winner works on a completed test and is
 *          idempotent.
 *  - A14: applying a winner does not mint a fresh "ghost" experiment row.
 *
 * Abilities require an authenticated admin in production; we set one and skip
 * cleanly if the Abilities API is absent (mirroring AbilitiesHardeningTest).
 *
 * @package altis-accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\Experiments\REST_API as RestApi;
use Altis\Accelerate\GlobalBlocks;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';
require_once dirname( __DIR__, 2 ) . '/inc/experiments/rest_api/namespace.php';

class ExperimentLoopFixesTest extends WP_UnitTestCase {

	public function set_up() : void {
		parent::set_up();
		wp_set_current_user( 1 );
		Experiments\flush_experiment_resolver_cache();
	}

	public function tear_down() : void {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// The experiments custom table is not covered by the WP transaction
		// rollback, so clear it between tests. Use DELETE (DML) not TRUNCATE.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		parent::tear_down();
	}

	/**
	 * Count experiment rows for a post/test pair.
	 */
	protected function count_rows( int $post_id ) : int {
		$results = Experiment::query(
			[ 'subject_post_id' => $post_id, 'test_id' => 'block' ],
			[ 'per_page' => 100 ]
		)->get_results();
		return is_wp_error( $results ) ? 0 : count( $results );
	}

	/**
	 * Create a standard wp_block to build experiments on.
	 */
	protected function make_block( string $content = '<!-- wp:paragraph --><p>Original</p><!-- /wp:paragraph -->' ) : int {
		return self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_title'   => 'Loop Fix Block',
			'post_content' => $content,
		] );
	}

	/**
	 * A1: create-ab-test must leave the experiment actually running in bandit
	 * burn_in with the variants meta the cron query relies on.
	 */
	public function test_create_ab_test_starts_running_in_burn_in() {
		$block_id = $this->make_block();

		$result = Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>B</p><!-- /wp:paragraph -->' ],
			],
		] );

		$this->assertIsArray( $result );
		$this->assertTrue( $result['success'] );

		$experiment = Experiment::get_active_for_post( $block_id, 'block' );
		$this->assertNotNull( $experiment, 'Created A/B test must have an active experiment' );
		$this->assertSame( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertSame( 'bandit', $experiment->get_test_mode() );
		$this->assertSame( 'burn_in', $experiment->get_test_phase() );

		$this->assertNotEmpty(
			get_post_meta( $block_id, '_altis_ab_test_block_variants', true ),
			'Cron query relies on the variants meta existing'
		);
	}

	/**
	 * A1: a non-default traffic_percentage must survive the start sequence.
	 */
	public function test_create_ab_test_preserves_traffic_percentage() {
		$block_id = $this->make_block();

		Execution\execute_create_ab_test( [
			'block_id'           => $block_id,
			'traffic_percentage' => 40,
			'variants'           => [
				[ 'title' => 'Control', 'content' => 'A' ],
				[ 'title' => 'Variant B', 'content' => 'B' ],
			],
		] );

		$this->assertSame(
			40,
			(int) get_post_meta( $block_id, '_altis_ab_test_block_traffic_percentage', true )
		);
	}

	/**
	 * A1 (personalization): create-personalization-rule must start running with
	 * NO bandit phase (personalization has no phases).
	 */
	public function test_create_personalization_rule_starts_running_without_phase() {
		$audience_id = self::factory()->post->create( [
			'post_type'  => 'audience',
			'post_title' => 'Coffee Drinkers',
		] );
		$block_id = $this->make_block();

		$result = Execution\execute_create_personalization_rule( [
			'block_id'             => $block_id,
			'audience_id'          => $audience_id,
			'personalized_content' => '<!-- wp:paragraph --><p>Hello coffee fans</p><!-- /wp:paragraph -->',
		] );

		$this->assertTrue( $result['success'] );

		$experiment = Experiment::get_active_for_post( $block_id, 'block' );
		$this->assertNotNull( $experiment );
		$this->assertSame( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertSame( Experiment::TYPE_PERSONALIZATION, $experiment->get_type() );
		$this->assertSame( '', $experiment->get_test_phase(), 'Personalization must not get a bandit phase' );
	}

	/**
	 * A8: an audience name containing `&` must round-trip into the variant title
	 * (the lost-backslash bug produced `u0026`).
	 */
	public function test_personalization_variant_title_escapes_ampersand() {
		$audience_id = self::factory()->post->create( [
			'post_type'  => 'audience',
			'post_title' => 'Coffee & Tea',
		] );
		$block_id = $this->make_block();

		Execution\execute_create_personalization_rule( [
			'block_id'             => $block_id,
			'audience_id'          => $audience_id,
			'personalized_content' => '<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->',
		] );

		$content = get_post( $block_id )->post_content;
		// The lost-backslash bug stored `Coffee u0026 Tea` (a literal token); a
		// correctly-escaped attribute stores `Coffee & Tea` which parses
		// back to `&`. Assert the broken, backslash-less form is absent and the
		// title round-trips.
		$this->assertStringNotContainsString( 'Coffee u0026', $content, 'Backslash must not be stripped from the JSON escape' );

		$titles = [];
		foreach ( parse_blocks( $content ) as $block ) {
			if ( $block['blockName'] === 'altis/variant' ) {
				$titles[] = $block['attrs']['title'] ?? '';
			}
		}
		$this->assertContains( 'Coffee & Tea', $titles );
	}

	/**
	 * A4: a row that was pre-set to test_mode='bandit' but left phase-less must
	 * still initialise the burn_in phase when started.
	 */
	public function test_preset_bandit_mode_still_inits_burn_in() {
		$block_id = $this->make_block();
		update_post_meta( $block_id, '_xb_type', 'abtest' );
		update_post_meta( $block_id, '_altis_ab_test_block_variants', [ '0' => 'A', '1' => 'B' ] );

		// Pre-create a row with mode=bandit but no phase, mimicking the wild case.
		$experiment = Experiment::get_or_create_for_post( $block_id, 'block', Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_RUNNING );
		$experiment->set_test_mode( 'bandit' );
		$experiment->save();
		Experiments\flush_experiment_resolver_cache();

		Experiments\update_is_ab_test_started_for_post( 'block', $block_id, true );

		$this->assertSame( 'bandit', Experiments\get_test_mode_for_post( 'block', $block_id ) );
		$this->assertSame( 'burn_in', Experiments\get_test_phase_for_post( 'block', $block_id ) );
	}

	/**
	 * A13a: apply_winner() rewrites the block to the winning variant content and
	 * records the winner so the front end serves it.
	 */
	public function test_apply_winner_collapses_block_to_winning_variant() {
		$block_id = $this->make_block();
		Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>Control copy</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>Winning copy</p><!-- /wp:paragraph -->' ],
			],
		] );

		$applied = GlobalBlocks\apply_winner( $block_id, 1 );
		$this->assertTrue( $applied );

		$content = get_post( $block_id )->post_content;
		$this->assertStringNotContainsString( 'altis/variant', $content, 'Variant wrappers must be removed' );
		$this->assertStringContainsString( 'Winning copy', $content );
		$this->assertStringNotContainsString( 'Control copy', $content );

		$results = Experiments\get_ab_test_results_for_post( 'block', $block_id );
		$this->assertSame( 1, (int) $results['winner'] );
	}

	/**
	 * A14: applying a winner (and any later stray sync) must not mint a fresh
	 * ghost experiment row.
	 */
	public function test_apply_winner_does_not_mint_ghost_row() {
		$block_id = $this->make_block();
		Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>c</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>w</p><!-- /wp:paragraph -->' ],
			],
		] );
		$this->assertSame( 1, $this->count_rows( $block_id ) );

		GlobalBlocks\apply_winner( $block_id, 1 );
		Experiments\flush_experiment_resolver_cache();

		// A stray sync of the kind a cron tick would trigger.
		Experiments\sync_experiment_to_table( 'block', $block_id, Experiment::TYPE_ABTEST );

		$this->assertSame( 1, $this->count_rows( $block_id ), 'No ghost row may be minted on winner application' );
	}

	/**
	 * A13b: stop-experiment declare_winner succeeds on a completed test and is
	 * idempotent on a second call.
	 */
	public function test_stop_experiment_declare_winner_on_completed_test_is_idempotent() {
		$block_id = $this->make_block();
		Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>Control copy</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>Winning copy</p><!-- /wp:paragraph -->' ],
			],
		] );

		// Complete the test first.
		Execution\execute_stop_experiment( [ 'block_id' => $block_id, 'action' => 'stop' ] );
		Experiments\flush_experiment_resolver_cache();

		// declare_winner on the completed test.
		$first = Execution\execute_stop_experiment( [
			'block_id'             => $block_id,
			'action'               => 'declare_winner',
			'winner_variant_index' => 1,
		] );
		$this->assertIsArray( $first, 'declare_winner must succeed on a completed test' );
		$this->assertTrue( $first['success'] );
		$this->assertStringContainsString( 'Winning copy', get_post( $block_id )->post_content );

		$rows_after_first = $this->count_rows( $block_id );

		// Idempotent second call — no error, no extra rows.
		Experiments\flush_experiment_resolver_cache();
		$second = Execution\execute_stop_experiment( [
			'block_id'             => $block_id,
			'action'               => 'declare_winner',
			'winner_variant_index' => 1,
		] );
		$this->assertIsArray( $second );
		$this->assertTrue( $second['success'] );
		$this->assertSame( $rows_after_first, $this->count_rows( $block_id ), 'Re-declaring a winner must not add rows' );
	}

	/**
	 * A15: creating a SECOND experiment on a block that already completed one must
	 * start from a clean slate — the new experiment runs with no winner, the stale
	 * block-level results meta is cleared, and the list endpoint reports the new
	 * experiment's winner as NULL (not the prior generation's winner).
	 */
	public function test_second_generation_clears_stale_winner_state() {
		$block_id = $this->make_block();

		// Generation 1: create, then complete with a declared winner. This leaves
		// behind the stale block-level state (results winner, end_time, ended,
		// completed) that would otherwise insta-complete generation 2.
		Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>Gen1 A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>Gen1 B</p><!-- /wp:paragraph -->' ],
			],
		] );

		// Simulate a completed test with a winner in block-level meta + a past
		// end time + the completed snapshot, mirroring the live cascade.
		$past = Experiments\get_ab_test_start_time_for_post( 'block', $block_id ) - 1000;
		Experiments\update_ab_test_results_for_post( 'block', $block_id, [
			'timestamp' => $past,
			'winning'   => 1,
			'winner'    => 1,
			'aggs'      => [],
			'variants'  => [ [ 'size' => 100, 'rate' => 0.5 ], [ 'size' => 100, 'rate' => 0.7 ] ],
		] );
		Experiments\save_ab_test_results_for_post( 'block', $block_id, [ 'winner' => 1 ] );
		Experiments\end_ab_test_for_post( 'block', $block_id );
		Experiments\update_ab_test_end_time_for_post( 'block', $block_id, $past );
		Experiments\flush_experiment_resolver_cache();

		$this->assertTrue(
			Experiments\has_ab_test_ended_for_post( 'block', $block_id ),
			'Pre-condition: generation 1 must be ended'
		);

		// Generation 2: a fresh experiment on the SAME block.
		$result = Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>Gen2 A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>Gen2 B</p><!-- /wp:paragraph -->' ],
			],
		] );
		$this->assertTrue( $result['success'] );
		Experiments\flush_experiment_resolver_cache();

		// The new experiment must be running with no winner.
		$experiment = Experiment::get_active_for_post( $block_id, 'block' );
		$this->assertNotNull( $experiment, 'Generation 2 must have an active experiment' );
		$this->assertSame( Experiment::STATUS_RUNNING, $experiment->get_status() );

		// Block-level results meta must be cleared (no inherited winner).
		$results = Experiments\get_ab_test_results_for_post( 'block', $block_id );
		$this->assertNull( $results['winner'], 'Stale winner must not survive into generation 2' );

		// The ended flag and completed snapshot must be cleared.
		$this->assertFalse( Experiments\has_ab_test_ended_for_post( 'block', $block_id ) );
		$this->assertSame( '', get_post_meta( $block_id, '_altis_ab_test_block_completed', true ) );

		// The list endpoint must report the new experiment's winner as NULL, not
		// the prior generation's winner.
		$ui = RestApi\format_experiment_for_ui( $experiment );
		$this->assertNull( $ui['winner'], 'List endpoint must not serve the stale winner for a fresh experiment' );
	}

	/**
	 * A13b: pause still requires an active experiment (declare_winner is the only
	 * action relaxed to accept a completed test).
	 */
	public function test_pause_still_requires_active_experiment() {
		$block_id = $this->make_block();
		Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => 'c' ],
				[ 'title' => 'Variant B', 'content' => 'w' ],
			],
		] );
		Execution\execute_stop_experiment( [ 'block_id' => $block_id, 'action' => 'stop' ] );
		Experiments\flush_experiment_resolver_cache();

		$result = Execution\execute_stop_experiment( [ 'block_id' => $block_id, 'action' => 'pause' ] );
		$this->assertWPError( $result );
		$this->assertSame( 'not_experiment', $result->get_error_code() );
	}
}
