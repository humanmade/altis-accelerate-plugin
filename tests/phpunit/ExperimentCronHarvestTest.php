<?php
/**
 * Regression tests for the autonomous (cron-driven) bandit harvest fixes.
 *
 *  - A17: the bandit weight recompute is atomic. On a bandit→confirmatory
 *         transition the cron must write the variant traffic-percentage meta
 *         exactly once (the final vector), never the real bandit weights
 *         followed by an equal-split overwrite — that left a window where a
 *         concurrent read of the experiment row saw a transient even split.
 *
 *  - A18: when an experiment concludes autonomously via altis_post_ab_test_cron
 *         the harvest must NOT mint a spurious extra experiment row. The
 *         analyser completes the active row (with the winner) and then
 *         end_ab_test_for_post() pauses + ends the test; those trailing syncs
 *         must not create a fresh, winner-less ghost row.
 *
 * The cron query path runs against ClickHouse; we short-circuit it via the
 * pre_http_request filter so the test is deterministic and offline.
 *
 * @package altis-accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\GlobalBlocks;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';

class ExperimentCronHarvestTest extends WP_UnitTestCase {

	/**
	 * JSONEachRow rows the mocked ClickHouse endpoint should return.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	protected $ch_rows = [];

	public function set_up() : void {
		parent::set_up();
		wp_set_current_user( 1 );
		Experiments\flush_experiment_resolver_cache();

		// Short-circuit the ClickHouse HTTP call with our staged rows.
		add_filter( 'pre_http_request', [ $this, 'mock_clickhouse' ], 10, 3 );
	}

	public function tear_down() : void {
		remove_filter( 'pre_http_request', [ $this, 'mock_clickhouse' ], 10 );

		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// The experiments custom table is not covered by the WP transaction
		// rollback, so clear it between tests.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );

		parent::tear_down();
	}

	/**
	 * Return the staged rows as a JSONEachRow body for any ClickHouse request.
	 *
	 * @return array<string, mixed>
	 */
	public function mock_clickhouse( $pre, $args, $url ) {
		// Only intercept the analytics ClickHouse query (everything in tests).
		$body = implode( "\n", array_map( 'wp_json_encode', $this->ch_rows ) );
		return [
			'headers'  => [],
			'body'     => $body,
			'response' => [ 'code' => 200, 'message' => 'OK' ],
			'cookies'  => [],
			'filename' => null,
		];
	}

	/**
	 * Stage view + conversion rows for a two-variant block test. The goal event
	 * for block tests is `conversion`; anything else is treated as an impression.
	 *
	 * @param array<int, array{impressions:int, conversions:int}> $variants Per-variant counts.
	 */
	protected function stage_results( array $variants ) : void {
		$rows = [];
		foreach ( $variants as $variant_id => $counts ) {
			$rows[] = [
				'test_variant_id' => (string) $variant_id,
				'event_type'      => 'blockView',
				'max_timestamp'   => Utils\milliseconds(),
				'uniques'         => $counts['impressions'],
				'count'           => $counts['impressions'],
			];
			$rows[] = [
				'test_variant_id' => (string) $variant_id,
				'event_type'      => 'conversion',
				'max_timestamp'   => Utils\milliseconds(),
				'uniques'         => $counts['conversions'],
				'count'           => $counts['conversions'],
			];
		}
		$this->ch_rows = $rows;
	}

	/**
	 * Create a started two-variant block experiment in the bandit phase.
	 *
	 * Uses the create-ab-test ability (the same path the loop-fix tests use) so
	 * the experiment is genuinely running with the variants meta + bandit row the
	 * cron relies on, then advances the phase to 'bandit'.
	 */
	protected function make_running_bandit_block() : int {
		// Ensure the 'block' ab test is registered for the cron query path.
		if ( empty( Experiments\get_post_ab_tests()['block'] ?? null ) ) {
			GlobalBlocks\register_test();
		}

		$block_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_title'   => 'Cron Harvest Block',
			'post_content' => '<!-- wp:paragraph --><p>Original</p><!-- /wp:paragraph -->',
		] );

		Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>B</p><!-- /wp:paragraph -->' ],
			],
		] );

		// Give the test a far-future end time so is_ab_test_running stays true.
		Experiments\update_ab_test_end_time_for_post( 'block', $block_id, Utils\milliseconds() + 10_000_000 );

		Experiments\flush_experiment_resolver_cache();
		Experiments\update_test_phase_for_post( 'block', $block_id, 'bandit' );
		Experiments\flush_experiment_resolver_cache();

		return $block_id;
	}

	/**
	 * A17: on the bandit→confirmatory transition the weights meta key is written
	 * exactly once, and the persisted vector is the equal split (not the interim
	 * bandit weights followed by an even-split overwrite).
	 */
	public function test_bandit_to_confirmatory_writes_weights_meta_once() {
		$block_id = $this->make_running_bandit_block();
		$meta_key = '_altis_ab_test_block_variant_traffic_percentage';

		// Seed a non-equal starting vector so the single final write (to the equal
		// split) is observable as exactly one meta change. Before the A17 fix this
		// pass wrote the interim bandit weights AND then the equal split — two
		// distinct changes; after the fix it writes the final vector once.
		Experiments\update_ab_test_variant_traffic_percentage_for_post( 'block', $block_id, [ 79.5, 20.5 ] );
		Experiments\flush_experiment_resolver_cache();

		// Strongly separated data → P2BB max >= 0.95 → advance to confirmatory.
		$this->stage_results( [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		] );

		// Count writes to the weights meta key during a single cron pass.
		$writes = 0;
		$counter = function ( $meta_id, $object_id, $key ) use ( &$writes, $meta_key, $block_id ) {
			if ( $object_id === $block_id && $key === $meta_key ) {
				$writes++;
			}
		};
		add_action( 'updated_post_meta', $counter, 10, 3 );
		add_action( 'added_post_meta', $counter, 10, 3 );

		Experiments\process_post_ab_test_result( 'block', $block_id );

		remove_action( 'updated_post_meta', $counter, 10 );
		remove_action( 'added_post_meta', $counter, 10 );

		$this->assertSame(
			'confirmatory',
			Experiments\get_test_phase_for_post( 'block', $block_id ),
			'Pre-condition: the test must have advanced to confirmatory'
		);

		$this->assertSame(
			1,
			$writes,
			'The weights meta key must be written exactly once per cron pass (no interim bandit-then-equal overwrite)'
		);

		$stored = get_post_meta( $block_id, $meta_key, true );
		$this->assertEqualsWithDelta( 50.0, $stored[0], 0.001 );
		$this->assertEqualsWithDelta( 50.0, $stored[1], 0.001 );
	}

	/**
	 * A18: an experiment that concludes autonomously via the cron harvest must
	 * not mint a ghost row. Reproduces the cron done-transition tail:
	 * analyse_ab_test_results() completes the active row, end_ab_test_for_post()
	 * pauses + ends, then apply_winner() harvests the content.
	 */
	public function test_cron_autocompletion_does_not_mint_ghost_row() {
		$block_id = $this->make_running_bandit_block();
		Experiments\update_test_phase_for_post( 'block', $block_id, 'confirmatory' );
		Experiments\flush_experiment_resolver_cache();

		$this->assertSame( 1, $this->count_rows( $block_id ), 'Pre-condition: one active row' );

		// This is exactly the sequence process_post_ab_test_result() runs when
		// the confirmatory budget is met (mode === bandit, phase advances to
		// 'done'): the analyser declares + completes, end_ab_test_for_post()
		// pauses/ends, and apply_winner() harvests the winning content.
		$aggregations = [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		];
		$processed = Experiments\analyse_ab_test_results( $aggregations, 'block', $block_id );

		$this->assertNotNull( $processed['winner'], 'Pre-condition: the analyser must declare a winner' );

		GlobalBlocks\apply_winner( $block_id, (int) $processed['winner'] );
		Experiments\flush_experiment_resolver_cache();

		// A later stray cron sync of the kind that previously minted the ghost.
		Experiments\sync_experiment_to_table( 'block', $block_id, Experiment::TYPE_ABTEST );

		// No ghost row was minted.
		$this->assertSame(
			1,
			$this->count_rows( $block_id ),
			'Autonomous cron completion must not mint a ghost experiment row'
		);

		// The surviving row is completed AND carries the winner (not winner-NULL).
		$rows = Experiment::query(
			[ 'subject_post_id' => $block_id, 'test_id' => 'block' ],
			[ 'per_page' => 10 ]
		)->get_results();
		$this->assertCount( 1, $rows );
		$row = $rows[0];
		$this->assertSame( Experiment::STATUS_COMPLETED, $row->get_status() );

		$results = $row->get_results();
		$this->assertNotNull( $results['winner'] ?? null, 'The surviving row must carry the winner' );
		$this->assertSame( (int) $processed['winner'], (int) $results['winner'] );

		// And explicitly: no completed/winner-NULL ghost exists.
		foreach ( $rows as $candidate ) {
			$res = $candidate->get_results();
			$this->assertFalse(
				$candidate->get_status() === Experiment::STATUS_COMPLETED && ( $res['winner'] ?? null ) === null,
				'No completed/winner-NULL ghost row may exist'
			);
		}
	}

	/**
	 * Count experiment rows for a block.
	 */
	protected function count_rows( int $post_id ) : int {
		$results = Experiment::query(
			[ 'subject_post_id' => $post_id, 'test_id' => 'block' ],
			[ 'per_page' => 100 ]
		)->get_results();
		return is_wp_error( $results ) ? 0 : count( $results );
	}

	/**
	 * Drive a bandit block (already in bandit phase) to autonomous cron completion
	 * by using the same sequence the real cron takes:
	 *  1. analyse_ab_test_results() declares the winner + ends the test.
	 *  2. apply_winner() harvests the winning variant content.
	 *  3. A stray sync (as end_ab_test_for_post triggers) is fired explicitly.
	 *
	 * Returns the winning variant index declared by the analyser.
	 *
	 * @param int $block_id Subject block post ID.
	 * @param array $aggregations Per-variant impression/conversion counts.
	 * @return int Winning variant index.
	 */
	protected function drive_cron_completion( int $block_id, array $aggregations ) : int {
		Experiments\update_test_phase_for_post( 'block', $block_id, 'confirmatory' );
		Experiments\flush_experiment_resolver_cache();

		$processed = Experiments\analyse_ab_test_results( $aggregations, 'block', $block_id );

		$this->assertNotNull( $processed['winner'] ?? null, 'drive_cron_completion: analyser must declare a winner' );

		GlobalBlocks\apply_winner( $block_id, (int) $processed['winner'] );
		Experiments\flush_experiment_resolver_cache();

		// Simulate the trailing stray sync that end_ab_test_for_post triggers.
		Experiments\sync_experiment_to_table( 'block', $block_id, Experiment::TYPE_ABTEST );

		return (int) $processed['winner'];
	}

	// -------------------------------------------------------------------------
	// Edge-case tests (A15/A17/A18)
	// -------------------------------------------------------------------------

	/**
	 * A18 — cron idempotency: after an experiment auto-completes via the cron
	 * path, running process_post_ab_test_result a second and third time on the
	 * same block must not create additional rows and must not alter the winner.
	 */
	public function test_cron_idempotency_after_autocompletion() {
		// Guards A18: repeated cron ticks on a concluded experiment must be no-ops.
		$block_id = $this->make_running_bandit_block();

		// Stage strongly-separated data so the analyser declares a winner.
		$this->stage_results( [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		] );

		$first_winner = $this->drive_cron_completion( $block_id, [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		] );

		$this->assertSame( 1, $this->count_rows( $block_id ), 'Pre-condition: one completed row after first cron pass' );

		// Second and third cron ticks — test is no longer running, so
		// process_post_ab_test_result returns early without minting rows.
		Experiments\process_post_ab_test_result( 'block', $block_id );
		Experiments\flush_experiment_resolver_cache();
		Experiments\process_post_ab_test_result( 'block', $block_id );
		Experiments\flush_experiment_resolver_cache();

		$this->assertSame(
			1,
			$this->count_rows( $block_id ),
			'A18: repeated cron ticks after completion must not add rows'
		);

		// Winner must be unchanged across all repetitions.
		$rows = Experiment::query(
			[ 'subject_post_id' => $block_id, 'test_id' => 'block' ],
			[ 'per_page' => 10 ]
		)->get_results();
		$this->assertCount( 1, $rows );
		$res = $rows[0]->get_results();
		$this->assertSame(
			$first_winner,
			(int) ( $res['winner'] ?? null ),
			'A18: winner must be unchanged after repeated cron ticks'
		);
	}

	/**
	 * A17 — write-once holds for 2-variant blocks through bandit→confirmatory:
	 * a 2-variant block crossing the confirmatory phase must have its weight
	 * vector written exactly once during the bandit pass, and that vector must
	 * remain unmodified during the subsequent confirmatory→done transition.
	 */
	public function test_write_once_holds_for_two_variant_confirmatory_done() {
		// Guards A17: the equal-split written at bandit→confirmatory must not be
		// overwritten again when the confirmatory budget is met.
		$block_id = $this->make_running_bandit_block();
		$meta_key = '_altis_ab_test_block_variant_traffic_percentage';

		// Seed an unequal starting vector so both a bandit write and the equal-split
		// write are observable as distinct changes.
		Experiments\update_ab_test_variant_traffic_percentage_for_post( 'block', $block_id, [ 79.5, 20.5 ] );
		Experiments\flush_experiment_resolver_cache();

		// Strongly-separated data → P2BB max >= 0.95 → bandit phase advances to
		// confirmatory in this first cron pass.
		$this->stage_results( [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		] );

		// Count ALL writes to the weights meta key across BOTH the bandit and
		// subsequent confirmatory→done transitions.
		$writes = 0;
		$counter = function ( $meta_id, $object_id, $key ) use ( &$writes, $meta_key, $block_id ) {
			if ( $object_id === $block_id && $key === $meta_key ) {
				$writes++;
			}
		};
		add_action( 'updated_post_meta', $counter, 10, 3 );
		add_action( 'added_post_meta', $counter, 10, 3 );

		// Bandit pass — advances to confirmatory, writes the equal split once.
		Experiments\process_post_ab_test_result( 'block', $block_id );
		Experiments\flush_experiment_resolver_cache();

		// Now push the block into confirmatory completion (lower the threshold so
		// the current mock data meets it, and drive the confirmatory→done path).
		add_filter( 'altis.experiments.bandit.confirmatory_min_conversions', function () { return 0; } );
		Experiments\process_post_ab_test_result( 'block', $block_id );
		remove_all_filters( 'altis.experiments.bandit.confirmatory_min_conversions' );

		remove_action( 'updated_post_meta', $counter, 10 );
		remove_action( 'added_post_meta', $counter, 10 );

		// Exactly one write to the weights meta key across both cron passes.
		$this->assertSame(
			1,
			$writes,
			'A17: weights meta must be written exactly once even across bandit + confirmatory→done passes'
		);

		// The stored vector is the equal split (written at bandit→confirmatory).
		$stored = get_post_meta( $block_id, $meta_key, true );
		$this->assertIsArray( $stored );
		$this->assertCount( 2, $stored, 'A17: persisted vector must have one entry per variant (2)' );
		$this->assertEqualsWithDelta( 50.0, $stored[0], 0.001 );
		$this->assertEqualsWithDelta( 50.0, $stored[1], 0.001 );
	}

	/**
	 * A17 — weight vector integrity: after the single cron write the persisted
	 * variant_traffic_percentage vector has one entry per variant and sums to
	 * approximately 100 (tolerance 0.1).
	 */
	public function test_weight_vector_sums_to_100_after_single_write() {
		// Guards A17: the equal-split vector written at bandit→confirmatory must
		// be well-formed regardless of variant count.
		$block_id = $this->make_running_bandit_block();
		$meta_key = '_altis_ab_test_block_variant_traffic_percentage';

		$this->stage_results( [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		] );

		Experiments\process_post_ab_test_result( 'block', $block_id );
		Experiments\flush_experiment_resolver_cache();

		$stored = get_post_meta( $block_id, $meta_key, true );
		$this->assertIsArray( $stored );

		// One entry per variant.
		$num_variants = count( Experiments\get_ab_test_variants_for_post( 'block', $block_id ) );
		if ( $num_variants === 0 ) {
			// If apply_winner already collapsed the block (no variants left) the
			// meta was written before collapse — read count from stored directly.
			$num_variants = count( $stored );
		}
		$this->assertCount( $num_variants, $stored, 'A17: one weight entry per variant' );

		// Sums to ~100.
		$sum = array_sum( $stored );
		$this->assertEqualsWithDelta( 100.0, $sum, 0.1, 'A17: variant weight vector must sum to 100' );
	}

	/**
	 * A15 + A18 — guard does not suppress legitimate new generations: after a
	 * cron-driven completion of experiment 1, creating a new experiment via the
	 * ability path (which calls reset_ab_test_state_for_post) must produce a
	 * second, running, winner-less row for the same block.
	 *
	 * Table must contain exactly 2 rows: one completed-with-winner (gen 1) and
	 * one running-without-winner (gen 2).
	 */
	public function test_new_generation_after_cron_completion_is_not_suppressed() {
		// Guards A15 (new generation clears stale state) and A18 (ghost-row guard
		// must not block fresh starts).
		$block_id = $this->make_running_bandit_block();

		$this->stage_results( [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		] );

		$this->drive_cron_completion( $block_id, [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		] );

		$this->assertSame( 1, $this->count_rows( $block_id ), 'Pre-condition: one completed row after cron finish' );

		// Generation 2: the ability path calls reset_ab_test_state_for_post before
		// creating the new experiment, which clears the _ended flag so sync may
		// mint a fresh row.
		$result = Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control',   'content' => '<!-- wp:paragraph --><p>Gen2 A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>Gen2 B</p><!-- /wp:paragraph -->' ],
			],
		] );
		$this->assertTrue( $result['success'] ?? false, 'Generation 2 create must succeed' );
		Experiments\flush_experiment_resolver_cache();

		// Must be exactly 2 rows.
		$this->assertSame(
			2,
			$this->count_rows( $block_id ),
			'A15/A18: after gen-2 create there must be exactly 2 rows (one per generation)'
		);

		// Row 1: completed + has a winner.
		// Row 2: running + no winner.
		$rows = Experiment::query(
			[ 'subject_post_id' => $block_id, 'test_id' => 'block' ],
			[ 'per_page' => 10 ]
		)->get_results();
		$this->assertCount( 2, $rows );

		$completed = [];
		$running   = [];
		foreach ( $rows as $r ) {
			if ( $r->get_status() === Experiment::STATUS_COMPLETED ) {
				$completed[] = $r;
			} elseif ( $r->get_status() === Experiment::STATUS_RUNNING ) {
				$running[] = $r;
			}
		}
		$this->assertCount( 1, $completed, 'A15/A18: exactly one completed row' );
		$this->assertCount( 1, $running,   'A15/A18: exactly one running row' );

		$completed_res = $completed[0]->get_results();
		$running_res   = $running[0]->get_results();
		$this->assertNotNull( $completed_res['winner'] ?? null, 'A15/A18: completed row must carry the winner' );
		$this->assertNull( $running_res['winner'] ?? null,      'A15/A18: running row must have no winner' );
	}

	/**
	 * A15 + A18 interplay: drive experiment 2 (from test_new_generation_after_cron_completion_is_not_suppressed)
	 * to cron completion. The table must end up with exactly 2 rows, both
	 * completed with winners, and no winner-NULL row anywhere for the block.
	 */
	public function test_both_generations_complete_with_winners() {
		// Guards A15 + A18: the ghost-row guard must not interfere with gen-2
		// reaching its own completed+winner state.
		$block_id = $this->make_running_bandit_block();

		$aggregations = [
			0 => [ 'impressions' => 1000, 'conversions' => 20 ],
			1 => [ 'impressions' => 1000, 'conversions' => 300 ],
		];
		$this->stage_results( $aggregations );

		// Complete generation 1 via the cron path.
		$this->drive_cron_completion( $block_id, $aggregations );
		$this->assertSame( 1, $this->count_rows( $block_id ), 'Pre-condition: one row after gen-1' );

		// Start generation 2 via the ability path.
		$result = Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control',   'content' => '<!-- wp:paragraph --><p>Gen2 A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>Gen2 B</p><!-- /wp:paragraph -->' ],
			],
		] );
		$this->assertTrue( $result['success'] ?? false, 'Generation 2 create must succeed' );
		Experiments\flush_experiment_resolver_cache();
		$this->assertSame( 2, $this->count_rows( $block_id ), 'Pre-condition: two rows after gen-2 create' );

		// Re-stage results and advance gen-2 to bandit phase (required by
		// drive_cron_completion which sets the phase to confirmatory).
		$this->stage_results( $aggregations );
		Experiments\update_test_phase_for_post( 'block', $block_id, 'bandit' );
		Experiments\flush_experiment_resolver_cache();

		// Complete generation 2 via the cron path.
		$gen2_winner = $this->drive_cron_completion( $block_id, $aggregations );
		$this->assertSame( 1, $gen2_winner, 'Generation 2 winner must be variant 1' );

		// Exactly 2 rows, both completed with winners.
		$this->assertSame(
			2,
			$this->count_rows( $block_id ),
			'A15/A18: exactly 2 rows after both generations complete'
		);

		$rows = Experiment::query(
			[ 'subject_post_id' => $block_id, 'test_id' => 'block' ],
			[ 'per_page' => 10 ]
		)->get_results();
		$this->assertCount( 2, $rows );

		foreach ( $rows as $row ) {
			$this->assertSame(
				Experiment::STATUS_COMPLETED,
				$row->get_status(),
				'A15/A18: every row must be completed'
			);
			$res = $row->get_results();
			$this->assertNotNull(
				$res['winner'] ?? null,
				'A15/A18: no completed/winner-NULL row may exist for the block'
			);
		}
	}
}
