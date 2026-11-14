<?php
/**
 * Tests for experiment migration and dual-write syncing across all experiment
 * types (block, titles, featured_images), both mechanism types (A/B test,
 * personalization), and all lifecycle state transitions.
 *
 * @package Altis\Accelerate\Experiments
 */

namespace Altis\Accelerate\Experiments;

use Altis\Accelerate\Utils;
use WP_UnitTestCase;

class ExperimentSyncTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();
		Experiment::ensure_table();
	}

	public function tear_down() {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// Use DELETE (DML) not TRUNCATE (DDL) to preserve WP transaction rollback.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		parent::tear_down();
	}

	// ---------------------------------------------------------------
	// Helper: set up a wp_block post with full experiment meta.
	// ---------------------------------------------------------------

	/**
	 * Create a wp_block post pre-configured with experiment meta.
	 *
	 * @param array $overrides Meta overrides.
	 * @return int Post ID.
	 */
	private function create_block_experiment( array $overrides = [] ) : int {
		$now = Utils\milliseconds();

		$defaults = [
			'post_title'       => 'Test Block',
			'variants'         => [ 'Control', 'Variant A' ],
			'started'          => true,
			'paused'           => 'false',
			'ended'            => 'false',
			'start_time'       => $now - 86400000,
			'end_time'         => $now + 86400000 * 89,
			'traffic_pct'      => 100,
			'variant_pcts'     => [ 50, 50 ],
			'xb_type'          => 'abtest',
			'goal'             => 'click_any_link',
		];

		$meta = array_merge( $defaults, $overrides );

		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => $meta['post_title'],
		] );

		update_post_meta( $post_id, '_altis_ab_test_block_variants', $meta['variants'] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', $meta['started'] );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', $meta['paused'] );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', $meta['ended'] );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $meta['start_time'] );
		update_post_meta( $post_id, '_altis_ab_test_block_end_time', $meta['end_time'] );
		update_post_meta( $post_id, '_altis_ab_test_block_traffic_percentage', $meta['traffic_pct'] );
		update_post_meta( $post_id, '_altis_ab_test_block_variant_traffic_percentage', $meta['variant_pcts'] );
		update_post_meta( $post_id, '_xb_type', $meta['xb_type'] );
		update_post_meta( $post_id, '_xb_goal', $meta['goal'] );

		return $post_id;
	}

	/**
	 * Create a post with title experiment meta.
	 *
	 * @param array $overrides Meta overrides.
	 * @return int Post ID.
	 */
	private function create_titles_experiment( array $overrides = [] ) : int {
		$now = Utils\milliseconds();

		$defaults = [
			'post_title'  => 'Original Title',
			'post_type'   => 'post',
			'variants'    => [ 'Original Title', 'Better Title', 'Best Title' ],
			'started'     => true,
			'paused'      => 'false',
			'ended'       => 'false',
			'start_time'  => $now - 86400000,
			'end_time'    => $now + 86400000 * 30,
			'traffic_pct' => 100,
			'variant_pcts' => [ 34, 33, 33 ],
		];

		$meta = array_merge( $defaults, $overrides );

		$post_id = self::factory()->post->create( [
			'post_type'  => $meta['post_type'],
			'post_title' => $meta['post_title'],
		] );

		update_post_meta( $post_id, '_altis_ab_test_titles_variants', $meta['variants'] );
		update_post_meta( $post_id, '_altis_ab_test_titles_started', $meta['started'] );
		update_post_meta( $post_id, '_altis_ab_test_titles_paused', $meta['paused'] );
		update_post_meta( $post_id, '_altis_ab_test_titles_ended', $meta['ended'] );
		update_post_meta( $post_id, '_altis_ab_test_titles_start_time', $meta['start_time'] );
		update_post_meta( $post_id, '_altis_ab_test_titles_end_time', $meta['end_time'] );
		update_post_meta( $post_id, '_altis_ab_test_titles_traffic_percentage', $meta['traffic_pct'] );
		update_post_meta( $post_id, '_altis_ab_test_titles_variant_traffic_percentage', $meta['variant_pcts'] );

		return $post_id;
	}

	/**
	 * Create a post with featured images experiment meta.
	 *
	 * @param array $overrides Meta overrides.
	 * @return int Post ID.
	 */
	private function create_featured_images_experiment( array $overrides = [] ) : int {
		$now = Utils\milliseconds();

		$defaults = [
			'post_title'  => 'Image Test Post',
			'post_type'   => 'post',
			'variants'    => [ 101, 102 ],  // Attachment IDs.
			'started'     => true,
			'paused'      => 'false',
			'ended'       => 'false',
			'start_time'  => $now - 86400000,
			'end_time'    => $now + 86400000 * 30,
			'traffic_pct' => 100,
			'variant_pcts' => [ 50, 50 ],
		];

		$meta = array_merge( $defaults, $overrides );

		$post_id = self::factory()->post->create( [
			'post_type'  => $meta['post_type'],
			'post_title' => $meta['post_title'],
		] );

		update_post_meta( $post_id, '_altis_ab_test_featured_images_variants', $meta['variants'] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_started', $meta['started'] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_paused', $meta['paused'] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_ended', $meta['ended'] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_start_time', $meta['start_time'] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_end_time', $meta['end_time'] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_traffic_percentage', $meta['traffic_pct'] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_variant_traffic_percentage', $meta['variant_pcts'] );

		return $post_id;
	}

	/**
	 * Get the experiment row for a given post and test_id.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $test_id Test ID.
	 * @return Experiment|null
	 */
	private function get_experiment_row( int $post_id, string $test_id ) : ?Experiment {
		$results = Experiment::query(
			[
				'subject_post_id' => $post_id,
				'test_id'         => $test_id,
			],
			[ 'per_page' => 10 ]
		)->get_results();

		if ( is_wp_error( $results ) || count( $results ) === 0 ) {
			return null;
		}
		return $results[0];
	}

	/**
	 * Count all experiment rows for a post.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $test_id Test ID.
	 * @return int
	 */
	private function count_experiment_rows( int $post_id, string $test_id ) : int {
		$results = Experiment::query(
			[
				'subject_post_id' => $post_id,
				'test_id'         => $test_id,
			],
			[ 'per_page' => 100 ]
		)->get_results();

		if ( is_wp_error( $results ) ) {
			return 0;
		}
		return count( $results );
	}

	// ===================================================================
	// SECTION 1: Migration — create_experiment_from_meta for all test IDs
	// ===================================================================

	// --- Block experiments (test_id=block, post_type=wp_block) ---

	public function test_migrate_block_abtest_running() {
		$post_id = $this->create_block_experiment();
		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'block', $experiment->get_test_id() );
		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertEquals( $post_id, $experiment->get_subject_post_id() );
		$this->assertEquals( 'Test Block', $experiment->get_title() );
		$this->assertEquals( 'click_any_link', $experiment->get_goal() );
		$this->assertEquals( [ 'Control', 'Variant A' ], $experiment->get_variants_snapshot() );
		$this->assertEquals( 100, $experiment->get_traffic_percentage() );
		$this->assertEquals( [ 50, 50 ], $experiment->get_variant_traffic_percentage() );
	}

	public function test_migrate_block_abtest_paused() {
		$post_id = $this->create_block_experiment( [ 'paused' => 'true' ] );
		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( Experiment::STATUS_PAUSED, $experiment->get_status() );
	}

	public function test_migrate_block_abtest_completed() {
		$post_id = $this->create_block_experiment( [
			'ended' => 'true',
			'paused' => 'true',
		] );
		$completed = [
			'timestamp' => Utils\milliseconds(),
			'winner'    => 1,
			'variants'  => [
				[ 'value' => 'Control', 'size' => 500, 'hits' => 25, 'rate' => 0.05, 'p' => 0.15 ],
				[ 'value' => 'Variant A', 'size' => 500, 'hits' => 50, 'rate' => 0.10, 'p' => 0.95 ],
			],
		];
		update_post_meta( $post_id, '_altis_ab_test_block_completed', $completed );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( Experiment::STATUS_COMPLETED, $experiment->get_status() );
		$results = $experiment->get_results();
		$this->assertEquals( 1, $results['winner'] );
		$this->assertCount( 2, $results['variants'] );
		// Completed experiments should NOT store _current_experiment_id.
		$this->assertEmpty( get_post_meta( $post_id, '_current_experiment_id', true ) );
	}

	public function test_migrate_block_abtest_draft() {
		$future = Utils\milliseconds() + 86400000 * 7;
		$post_id = $this->create_block_experiment( [
			'started'    => false,
			'start_time' => $future,
		] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( Experiment::STATUS_DRAFT, $experiment->get_status() );
	}

	public function test_migrate_block_personalization_running() {
		$post_id = $this->create_block_experiment( [
			'xb_type' => 'personalization',
			'end_time' => 0,  // always-on.
		] );
		update_post_meta( $post_id, '_xb_personalization', true );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $experiment->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertNull( $experiment->get_end_time(), 'Always-on personalization should have null end_time' );
	}

	public function test_migrate_block_personalization_via_xb_personalization_flag() {
		// _xb_type is NOT set, but _xb_personalization is true.
		$post_id = $this->create_block_experiment( [ 'xb_type' => '' ] );
		delete_post_meta( $post_id, '_xb_type' );
		update_post_meta( $post_id, '_xb_personalization', true );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $experiment->get_type() );
	}

	public function test_migrate_block_three_variants() {
		$post_id = $this->create_block_experiment( [
			'variants'     => [ 'Control', 'Variant A', 'Variant B' ],
			'variant_pcts' => [ 34, 33, 33 ],
		] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertCount( 3, $experiment->get_variants_snapshot() );
		$this->assertCount( 3, $experiment->get_variant_traffic_percentage() );
	}

	public function test_migrate_block_four_variants() {
		$post_id = $this->create_block_experiment( [
			'variants'     => [ 'Control', 'A', 'B', 'C' ],
			'variant_pcts' => [ 25, 25, 25, 25 ],
		] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertCount( 4, $experiment->get_variants_snapshot() );
		$pcts = $experiment->get_variant_traffic_percentage();
		$this->assertCount( 4, $pcts );
		$this->assertEquals( 100, array_sum( $pcts ) );
	}

	public function test_migrate_block_uneven_traffic_split() {
		$post_id = $this->create_block_experiment( [
			'traffic_pct'  => 80,
			'variant_pcts' => [ 70, 30 ],
		] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( 80, $experiment->get_traffic_percentage() );
		$this->assertEquals( [ 70, 30 ], $experiment->get_variant_traffic_percentage() );
	}

	public function test_migrate_block_with_in_progress_results() {
		$post_id = $this->create_block_experiment();
		$results = [
			'timestamp' => Utils\milliseconds(),
			'winning'   => 1,
			'winner'    => null,
			'aggs'      => [
				[ 'impressions' => 200, 'conversions' => 10 ],
				[ 'impressions' => 200, 'conversions' => 18 ],
			],
			'variants'  => [
				[ 'value' => 'Control', 'size' => 200, 'hits' => 10, 'rate' => 0.05, 'p' => 0.2 ],
				[ 'value' => 'Variant A', 'size' => 200, 'hits' => 18, 'rate' => 0.09, 'p' => 0.8 ],
			],
		];
		update_post_meta( $post_id, '_altis_ab_test_block_results', $results );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );
		$stored = $experiment->get_results();

		$this->assertNull( $stored['winner'] );
		$this->assertEquals( 1, $stored['winning'] );
		$this->assertCount( 2, $stored['variants'] );
	}

	// --- Title experiments (test_id=titles, post_type=post/page) ---

	public function test_migrate_titles_running() {
		$post_id = $this->create_titles_experiment();

		$experiment = Migration\create_experiment_from_meta( $post_id, 'titles' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'titles', $experiment->get_test_id() );
		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertEquals( 'Original Title', $experiment->get_title() );
		$snapshot = $experiment->get_variants_snapshot();
		$this->assertCount( 3, $snapshot );
		$this->assertEquals( 'Better Title', $snapshot[1] );
	}

	public function test_migrate_titles_on_page() {
		$post_id = $this->create_titles_experiment( [ 'post_type' => 'page' ] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'titles' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'titles', $experiment->get_test_id() );
	}

	public function test_migrate_titles_completed_with_winner() {
		$post_id = $this->create_titles_experiment( [ 'ended' => 'true' ] );
		$completed = [
			'timestamp' => Utils\milliseconds(),
			'winner'    => 2,
			'variants'  => [
				[ 'value' => 'Original Title', 'size' => 1000, 'hits' => 50, 'rate' => 0.05, 'p' => 0.05 ],
				[ 'value' => 'Better Title', 'size' => 1000, 'hits' => 55, 'rate' => 0.055, 'p' => 0.15 ],
				[ 'value' => 'Best Title', 'size' => 1000, 'hits' => 80, 'rate' => 0.08, 'p' => 0.95 ],
			],
		];
		update_post_meta( $post_id, '_altis_ab_test_titles_completed', $completed );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'titles' );

		$this->assertEquals( Experiment::STATUS_COMPLETED, $experiment->get_status() );
		$results = $experiment->get_results();
		$this->assertEquals( 2, $results['winner'] );
		$this->assertCount( 3, $results['variants'] );
	}

	public function test_migrate_titles_paused() {
		$post_id = $this->create_titles_experiment( [ 'paused' => 'true' ] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'titles' );

		$this->assertEquals( Experiment::STATUS_PAUSED, $experiment->get_status() );
	}

	// --- Featured images experiments (test_id=featured_images, variants are int IDs) ---

	public function test_migrate_featured_images_running() {
		$post_id = $this->create_featured_images_experiment();

		$experiment = Migration\create_experiment_from_meta( $post_id, 'featured_images' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'featured_images', $experiment->get_test_id() );
		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$snapshot = $experiment->get_variants_snapshot();
		$this->assertCount( 2, $snapshot );
		$this->assertEquals( 101, $snapshot[0] );
		$this->assertEquals( 102, $snapshot[1] );
	}

	public function test_migrate_featured_images_three_variants() {
		$post_id = $this->create_featured_images_experiment( [
			'variants'     => [ 101, 102, 103 ],
			'variant_pcts' => [ 34, 33, 33 ],
		] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'featured_images' );

		$this->assertCount( 3, $experiment->get_variants_snapshot() );
		$this->assertCount( 3, $experiment->get_variant_traffic_percentage() );
	}

	public function test_migrate_featured_images_completed() {
		$post_id = $this->create_featured_images_experiment( [ 'ended' => 'true' ] );
		$completed = [
			'timestamp' => Utils\milliseconds(),
			'winner'    => 1,
			'variants'  => [
				[ 'value' => 101, 'size' => 500, 'hits' => 20, 'rate' => 0.04, 'p' => 0.1 ],
				[ 'value' => 102, 'size' => 500, 'hits' => 45, 'rate' => 0.09, 'p' => 0.9 ],
			],
		];
		update_post_meta( $post_id, '_altis_ab_test_featured_images_completed', $completed );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'featured_images' );

		$this->assertEquals( Experiment::STATUS_COMPLETED, $experiment->get_status() );
		$this->assertEquals( 1, $experiment->get_results()['winner'] );
	}

	public function test_migrate_featured_images_on_page() {
		$post_id = $this->create_featured_images_experiment( [ 'post_type' => 'page' ] );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'featured_images' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'featured_images', $experiment->get_test_id() );
	}

	// ===================================================================
	// SECTION 2: Backfill across all test IDs
	// ===================================================================

	public function test_backfill_finds_block_experiments() {
		$this->create_block_experiment();
		$stats = Migration\backfill_test_id( 'block', 1, 100 );

		$this->assertEquals( 1, $stats['processed'] );
		$this->assertEquals( 1, $stats['created'] );
	}

	public function test_backfill_finds_titles_experiments() {
		$this->create_titles_experiment();
		$stats = Migration\backfill_test_id( 'titles', 1, 100 );

		$this->assertEquals( 1, $stats['processed'] );
		$this->assertEquals( 1, $stats['created'] );
	}

	public function test_backfill_finds_featured_images_experiments() {
		$this->create_featured_images_experiment();
		$stats = Migration\backfill_test_id( 'featured_images', 1, 100 );

		$this->assertEquals( 1, $stats['processed'] );
		$this->assertEquals( 1, $stats['created'] );
	}

	public function test_backfill_all_types_together() {
		$this->create_block_experiment();
		$this->create_titles_experiment();
		$this->create_featured_images_experiment();

		$stats = Migration\backfill();

		$this->assertEquals( 3, $stats['created'] );
		$this->assertEquals( 0, $stats['errors'] );
	}

	public function test_backfill_post_with_both_titles_and_featured_images() {
		// A single post can have experiments for both titles and featured_images.
		$now = Utils\milliseconds();
		$post_id = self::factory()->post->create( [
			'post_type'  => 'post',
			'post_title' => 'Dual Experiment Post',
		] );

		// Title experiment.
		update_post_meta( $post_id, '_altis_ab_test_titles_variants', [ 'Title A', 'Title B' ] );
		update_post_meta( $post_id, '_altis_ab_test_titles_started', true );
		update_post_meta( $post_id, '_altis_ab_test_titles_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_titles_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_titles_start_time', $now - 86400000 );

		// Featured images experiment.
		update_post_meta( $post_id, '_altis_ab_test_featured_images_variants', [ 10, 20 ] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_started', true );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_start_time', $now - 86400000 );

		$stats = Migration\backfill();

		$this->assertEquals( 2, $stats['created'], 'Same post should produce 2 experiments (different test_ids)' );

		// Both should exist with distinct test_ids.
		$titles_row = $this->get_experiment_row( $post_id, 'titles' );
		$fi_row     = $this->get_experiment_row( $post_id, 'featured_images' );
		$this->assertNotNull( $titles_row );
		$this->assertNotNull( $fi_row );
		$this->assertEquals( 'titles', $titles_row->get_test_id() );
		$this->assertEquals( 'featured_images', $fi_row->get_test_id() );
	}

	public function test_backfill_idempotent_across_test_ids() {
		$this->create_block_experiment();
		$this->create_titles_experiment();

		$stats1 = Migration\backfill();
		$this->assertEquals( 2, $stats1['created'] );

		$stats2 = Migration\backfill();
		$this->assertEquals( 0, $stats2['created'] );
		$this->assertEquals( 2, $stats2['skipped'] );
	}

	// ===================================================================
	// SECTION 3: Dual-write via sync_experiment_to_table
	// ===================================================================

	public function test_sync_creates_experiment_for_running_block() {
		$post_id = $this->create_block_experiment();

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
		$this->assertEquals( 'block', $experiment->get_test_id() );
		$this->assertNotNull( $experiment->get_id() );
	}

	public function test_sync_creates_personalization_experiment() {
		$post_id = $this->create_block_experiment( [ 'xb_type' => 'personalization' ] );
		update_post_meta( $post_id, '_xb_personalization', true );

		$experiment = sync_experiment_to_table( 'block', $post_id, Experiment::TYPE_PERSONALIZATION );

		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $experiment->get_type() );
	}

	public function test_sync_auto_detects_type_from_xb_type_meta() {
		$post_id = $this->create_block_experiment( [ 'xb_type' => 'personalization' ] );
		update_post_meta( $post_id, '_xb_personalization', true );

		// Don't pass type explicitly — should auto-detect from meta.
		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $experiment->get_type() );
	}

	public function test_sync_auto_detects_abtest_by_default() {
		$post_id = $this->create_block_experiment();

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
	}

	public function test_sync_stores_current_experiment_id() {
		$post_id = $this->create_block_experiment();

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$stored_id = get_post_meta( $post_id, '_current_experiment_id', true );
		$this->assertEquals( $experiment->get_id(), (int) $stored_id );
	}

	public function test_sync_does_not_store_id_for_completed() {
		$post_id = $this->create_block_experiment( [ 'ended' => 'true' ] );

		sync_experiment_to_table( 'block', $post_id );

		$stored_id = get_post_meta( $post_id, '_current_experiment_id', true );
		$this->assertEmpty( $stored_id );
	}

	public function test_sync_is_idempotent() {
		$post_id = $this->create_block_experiment();

		$exp1 = sync_experiment_to_table( 'block', $post_id );
		$exp2 = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( $exp1->get_id(), $exp2->get_id(), 'Repeat sync should reuse same row' );
		$this->assertEquals( 1, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	public function test_sync_reads_goal_fallback_chain() {
		// _xb_goal → _goal → 'engagement'
		$post_id = $this->create_block_experiment( [ 'goal' => '' ] );
		delete_post_meta( $post_id, '_xb_goal' );
		update_post_meta( $post_id, '_goal', 'submit_form' );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( 'submit_form', $experiment->get_goal() );
	}

	public function test_sync_defaults_goal_to_engagement() {
		$post_id = $this->create_block_experiment( [ 'goal' => '' ] );
		delete_post_meta( $post_id, '_xb_goal' );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( 'engagement', $experiment->get_goal() );
	}

	public function test_sync_captures_traffic_percentage() {
		$post_id = $this->create_block_experiment( [ 'traffic_pct' => 75 ] );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( 75, $experiment->get_traffic_percentage() );
	}

	public function test_sync_captures_variant_traffic_percentage() {
		$post_id = $this->create_block_experiment( [
			'variant_pcts' => [ 70, 30 ],
		] );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( [ 70, 30 ], $experiment->get_variant_traffic_percentage() );
	}

	public function test_sync_captures_start_and_end_times() {
		$start = 1700000000000;
		$end   = 1700086400000;
		$post_id = $this->create_block_experiment( [
			'start_time' => $start,
			'end_time'   => $end,
		] );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( $start, $experiment->get_start_time() );
		$this->assertEquals( $end, $experiment->get_end_time() );
	}

	public function test_sync_captures_post_title() {
		$post_id = $this->create_block_experiment( [ 'post_title' => 'My Special Block' ] );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( 'My Special Block', $experiment->get_title() );
	}

	// ===================================================================
	// SECTION 4: Lifecycle state transitions via dual-write functions
	// ===================================================================

	public function test_lifecycle_start_creates_running_experiment() {
		$now = Utils\milliseconds();
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 1000 );
		update_post_meta( $post_id, '_altis_ab_test_block_end_time', $now + 86400000 );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		// This calls sync_experiment_to_table internally.
		update_is_ab_test_started_for_post( 'block', $post_id, true );

		$row = $this->get_experiment_row( $post_id, 'block' );
		$this->assertNotNull( $row );
		$this->assertEquals( Experiment::STATUS_RUNNING, $row->get_status() );
	}

	public function test_lifecycle_pause_sets_paused_status() {
		$post_id = $this->create_block_experiment();
		// Initial sync to create the experiment row.
		sync_experiment_to_table( 'block', $post_id );

		// Pause — this calls sync internally.
		update_is_ab_test_paused_for_post( 'block', $post_id, true );

		$row = $this->get_experiment_row( $post_id, 'block' );
		$this->assertEquals( Experiment::STATUS_PAUSED, $row->get_status() );
	}

	public function test_lifecycle_resume_from_paused() {
		$post_id = $this->create_block_experiment( [ 'paused' => 'true' ] );
		sync_experiment_to_table( 'block', $post_id );

		// Resume — unpause.
		update_is_ab_test_paused_for_post( 'block', $post_id, false );

		$row = $this->get_experiment_row( $post_id, 'block' );
		$this->assertEquals( Experiment::STATUS_RUNNING, $row->get_status() );
	}

	public function test_lifecycle_end_sets_completed_status() {
		$post_id = $this->create_block_experiment();
		sync_experiment_to_table( 'block', $post_id );

		// End the experiment.
		update_has_ab_test_ended_for_post( 'block', $post_id, true );

		$row = $this->get_experiment_row( $post_id, 'block' );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $row->get_status() );
	}

	public function test_lifecycle_update_results_syncs_to_table() {
		$post_id = $this->create_block_experiment();
		sync_experiment_to_table( 'block', $post_id );

		$results = [
			'timestamp' => Utils\milliseconds(),
			'winning'   => 1,
			'winner'    => null,
			'variants'  => [
				[ 'value' => 'Control', 'size' => 300, 'hits' => 15, 'rate' => 0.05, 'p' => 0.3 ],
				[ 'value' => 'Variant A', 'size' => 300, 'hits' => 30, 'rate' => 0.10, 'p' => 0.7 ],
			],
		];
		// This dual-writes results.
		update_ab_test_results_for_post( 'block', $post_id, $results );

		$row = $this->get_experiment_row( $post_id, 'block' );
		$stored = $row->get_results();
		$this->assertEquals( 1, $stored['winning'] );
		$this->assertNull( $stored['winner'] );
		$this->assertCount( 2, $stored['variants'] );
	}

	public function test_lifecycle_save_completed_results_marks_completed() {
		$post_id = $this->create_block_experiment();
		sync_experiment_to_table( 'block', $post_id );

		$data = [
			'timestamp' => Utils\milliseconds(),
			'winner'    => 1,
			'variants'  => [
				[ 'value' => 'Control', 'size' => 500, 'hits' => 25 ],
				[ 'value' => 'Variant A', 'size' => 500, 'hits' => 50 ],
			],
		];
		// This marks the experiment completed.
		save_ab_test_results_for_post( 'block', $post_id, $data );

		$row = $this->get_experiment_row( $post_id, 'block' );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $row->get_status() );
		$this->assertEquals( 1, $row->get_results()['winner'] );
	}

	public function test_lifecycle_start_after_not_started_resets_ended() {
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );
		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 1000 );
		update_post_meta( $post_id, '_altis_ab_test_block_end_time', $now + 86400000 );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'true' );

		// Un-start the test — should also reset ended.
		update_is_ab_test_started_for_post( 'block', $post_id, false );

		$ended = get_post_meta( $post_id, '_altis_ab_test_block_ended', true );
		$this->assertEquals( 'false', $ended );
	}

	// ===================================================================
	// SECTION 5: Experiment history — new experiment after completion
	// ===================================================================

	public function test_new_experiment_row_after_previous_completed() {
		$post_id = $this->create_block_experiment();

		// First experiment: run and complete.
		$exp1 = sync_experiment_to_table( 'block', $post_id );
		$exp1->set_status( Experiment::STATUS_COMPLETED );
		$exp1->set_results( [ 'winner' => 0 ] );
		$exp1->save();

		// Now start a new test on the same block.
		// sync sees the old experiment is completed and creates a new row.
		$exp2 = sync_experiment_to_table( 'block', $post_id );

		$this->assertNotEquals( $exp1->get_id(), $exp2->get_id(), 'Should create a new experiment row' );
		$this->assertEquals( 2, $this->count_experiment_rows( $post_id, 'block' ) );
		$this->assertEquals( Experiment::STATUS_RUNNING, $exp2->get_status() );
	}

	public function test_experiment_history_preserves_old_data() {
		$post_id = $this->create_block_experiment();

		// First experiment: complete with results.
		$exp1 = sync_experiment_to_table( 'block', $post_id );
		$old_results = [
			'winner' => 1,
			'variants' => [
				[ 'value' => 'Control', 'size' => 1000 ],
				[ 'value' => 'Variant A', 'size' => 1000 ],
			],
		];
		$exp1->set_status( Experiment::STATUS_COMPLETED );
		$exp1->set_results( $old_results );
		$exp1->save();

		// Start new test.
		$exp2 = sync_experiment_to_table( 'block', $post_id );

		// Reload old experiment to verify its data is intact.
		$exp1_reloaded = Experiment::get( $exp1->get_id() );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $exp1_reloaded->get_status() );
		$this->assertEquals( 1, $exp1_reloaded->get_results()['winner'] );
	}

	public function test_multiple_completed_experiments_history() {
		$post_id = $this->create_block_experiment();

		// Complete 3 experiments on the same block.
		for ( $i = 0; $i < 3; $i++ ) {
			$exp = sync_experiment_to_table( 'block', $post_id );
			$exp->set_status( Experiment::STATUS_COMPLETED );
			$exp->set_results( [ 'winner' => $i ] );
			$exp->save();
		}

		// Start a fourth.
		sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals( 4, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	// ===================================================================
	// SECTION 6: Titles lifecycle via dual-write
	// ===================================================================

	public function test_sync_titles_experiment() {
		$post_id = $this->create_titles_experiment();

		$experiment = sync_experiment_to_table( 'titles', $post_id );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'titles', $experiment->get_test_id() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
	}

	public function test_titles_results_update_syncs() {
		$post_id = $this->create_titles_experiment();
		sync_experiment_to_table( 'titles', $post_id );

		$results = [
			'timestamp' => Utils\milliseconds(),
			'winning'   => 0,
			'winner'    => null,
			'variants'  => [
				[ 'value' => 'Original', 'size' => 100, 'hits' => 5, 'rate' => 0.05, 'p' => 0.5 ],
				[ 'value' => 'Better', 'size' => 100, 'hits' => 6, 'rate' => 0.06, 'p' => 0.5 ],
				[ 'value' => 'Best', 'size' => 100, 'hits' => 7, 'rate' => 0.07, 'p' => 0.5 ],
			],
		];
		update_ab_test_results_for_post( 'titles', $post_id, $results );

		$row = $this->get_experiment_row( $post_id, 'titles' );
		$this->assertCount( 3, $row->get_results()['variants'] );
	}

	public function test_titles_completed_syncs() {
		$post_id = $this->create_titles_experiment();
		sync_experiment_to_table( 'titles', $post_id );

		save_ab_test_results_for_post( 'titles', $post_id, [
			'winner' => 2,
			'variants' => [
				[ 'value' => 'Original', 'size' => 500 ],
				[ 'value' => 'Better', 'size' => 500 ],
				[ 'value' => 'Best', 'size' => 500 ],
			],
		] );

		$row = $this->get_experiment_row( $post_id, 'titles' );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $row->get_status() );
		$this->assertEquals( 2, $row->get_results()['winner'] );
	}

	// ===================================================================
	// SECTION 7: Featured images lifecycle via dual-write
	// ===================================================================

	public function test_sync_featured_images_experiment() {
		$post_id = $this->create_featured_images_experiment();

		$experiment = sync_experiment_to_table( 'featured_images', $post_id );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'featured_images', $experiment->get_test_id() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
	}

	public function test_featured_images_completed_syncs() {
		$post_id = $this->create_featured_images_experiment();
		sync_experiment_to_table( 'featured_images', $post_id );

		save_ab_test_results_for_post( 'featured_images', $post_id, [
			'winner' => 1,
			'variants' => [
				[ 'value' => 101, 'size' => 500 ],
				[ 'value' => 102, 'size' => 500 ],
			],
		] );

		$row = $this->get_experiment_row( $post_id, 'featured_images' );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $row->get_status() );
	}

	// ===================================================================
	// SECTION 8: Edge cases and the paused-default trap
	// ===================================================================

	public function test_missing_paused_meta_treated_as_paused() {
		// When _paused meta is absent, '' !== 'false' evaluates to true (paused).
		$now = Utils\milliseconds();
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		// Deliberately NOT setting _paused.
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEquals(
			Experiment::STATUS_PAUSED,
			$experiment->get_status(),
			'Missing _paused meta should be treated as paused'
		);
	}

	public function test_missing_ended_meta_treated_as_not_ended() {
		$now = Utils\milliseconds();
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		// Deliberately NOT setting _ended.
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		// Missing _ended defaults to 'false' via the ?: 'false' fallback.
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
	}

	public function test_started_with_future_start_time_is_draft() {
		$future = Utils\milliseconds() + 86400000 * 30;
		$post_id = $this->create_block_experiment( [
			'started'    => true,
			'start_time' => $future,
		] );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		// Started=true but start_time is in the future → draft.
		$this->assertEquals( Experiment::STATUS_DRAFT, $experiment->get_status() );
	}

	public function test_sync_with_empty_variants() {
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );
		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertNull( $experiment->get_variants_snapshot() );
	}

	public function test_sync_with_no_results_yet() {
		$post_id = $this->create_block_experiment();

		$experiment = sync_experiment_to_table( 'block', $post_id );

		$this->assertEmpty( $experiment->get_results() );
	}

	public function test_results_update_without_existing_experiment_is_noop() {
		// If there's no experiment row yet, update_ab_test_results_for_post
		// should still write meta but NOT crash on the experiment lookup.
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );

		$results = [
			'timestamp' => Utils\milliseconds(),
			'variants'  => [ [ 'value' => 'A', 'size' => 10 ] ],
		];
		// Should not throw.
		update_ab_test_results_for_post( 'block', $post_id, $results );

		// Meta should still be written.
		$meta = get_post_meta( $post_id, '_altis_ab_test_block_results', true );
		$this->assertEquals( $results, $meta );
	}

	public function test_save_completed_without_existing_experiment_is_noop() {
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );

		// Should not throw even without an experiment row.
		save_ab_test_results_for_post( 'block', $post_id, [
			'winner' => 0,
			'variants' => [],
		] );

		$meta = get_post_meta( $post_id, '_altis_ab_test_block_completed', true );
		$this->assertEquals( 0, $meta['winner'] );
	}

	// ===================================================================
	// SECTION 9: Cross-test-id isolation
	// ===================================================================

	public function test_block_and_titles_experiments_are_independent() {
		// A wp_block could theoretically have block experiments,
		// and a post could have titles experiments. They should not interfere.
		$block_id = $this->create_block_experiment();
		$post_id  = $this->create_titles_experiment();

		sync_experiment_to_table( 'block', $block_id );
		sync_experiment_to_table( 'titles', $post_id );

		// Each should have exactly 1 row for its test_id.
		$this->assertEquals( 1, $this->count_experiment_rows( $block_id, 'block' ) );
		$this->assertEquals( 1, $this->count_experiment_rows( $post_id, 'titles' ) );

		// Cross-check: no block experiments for the post, no titles for the block.
		$this->assertEquals( 0, $this->count_experiment_rows( $block_id, 'titles' ) );
		$this->assertEquals( 0, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	// ===================================================================
	// SECTION 10: Experiment::query and ordering
	// ===================================================================

	public function test_query_by_status() {
		$p1 = $this->create_block_experiment();
		$p2 = $this->create_block_experiment( [ 'paused' => 'true', 'post_title' => 'Paused Block' ] );
		$p3 = $this->create_block_experiment( [ 'ended' => 'true', 'post_title' => 'Ended Block' ] );

		sync_experiment_to_table( 'block', $p1 );
		sync_experiment_to_table( 'block', $p2 );
		sync_experiment_to_table( 'block', $p3 );

		$running = Experiment::query( [ 'status' => Experiment::STATUS_RUNNING ] )
			->get_results();
		$this->assertEquals( 1, count( $running ) );

		$paused = Experiment::query( [ 'status' => Experiment::STATUS_PAUSED ] )
			->get_results();
		$this->assertEquals( 1, count( $paused ) );

		$completed = Experiment::query( [ 'status' => Experiment::STATUS_COMPLETED ] )
			->get_results();
		$this->assertEquals( 1, count( $completed ) );
	}

	public function test_query_by_type() {
		$p1 = $this->create_block_experiment();
		$p2 = $this->create_block_experiment( [
			'xb_type'    => 'personalization',
			'post_title' => 'Personalized Block',
		] );
		update_post_meta( $p2, '_xb_personalization', true );

		sync_experiment_to_table( 'block', $p1, Experiment::TYPE_ABTEST );
		sync_experiment_to_table( 'block', $p2, Experiment::TYPE_PERSONALIZATION );

		$abtests = Experiment::query( [ 'type' => Experiment::TYPE_ABTEST ] )
			->get_results();
		$this->assertEquals( 1, count( $abtests ) );

		$personalizations = Experiment::query( [ 'type' => Experiment::TYPE_PERSONALIZATION ] )
			->get_results();
		$this->assertEquals( 1, count( $personalizations ) );
	}

	public function test_query_with_in_operator() {
		$p1 = $this->create_block_experiment();
		$p2 = $this->create_block_experiment( [ 'paused' => 'true', 'post_title' => 'Paused' ] );
		$p3 = $this->create_block_experiment( [ 'ended' => 'true', 'post_title' => 'Ended' ] );

		sync_experiment_to_table( 'block', $p1 );
		sync_experiment_to_table( 'block', $p2 );
		sync_experiment_to_table( 'block', $p3 );

		$active = Experiment::query( [
			'status' => [
				'compare' => 'IN',
				'value'   => [ Experiment::STATUS_RUNNING, Experiment::STATUS_PAUSED ],
			],
		] )->get_results();

		$this->assertEquals( 2, count( $active ) );
	}

	public function test_query_order_by() {
		$p1 = $this->create_block_experiment( [
			'post_title' => 'Older',
			'start_time' => 1000000000000,
		] );
		$p2 = $this->create_block_experiment( [
			'post_title' => 'Newer',
			'start_time' => 2000000000000,
		] );

		sync_experiment_to_table( 'block', $p1 );
		sync_experiment_to_table( 'block', $p2 );

		$desc = Experiment::query( [], [
			'per_page' => 10,
			'order_by' => [ 'start_time' => 'DESC' ],
		] )->get_results();

		$this->assertEquals( 2000000000000, $desc[0]->get_start_time() );
		$this->assertEquals( 1000000000000, $desc[1]->get_start_time() );

		$asc = Experiment::query( [], [
			'per_page' => 10,
			'order_by' => [ 'start_time' => 'ASC' ],
		] )->get_results();

		$this->assertEquals( 1000000000000, $asc[0]->get_start_time() );
	}

	public function test_query_by_subject_post_id() {
		$p1 = $this->create_block_experiment( [ 'post_title' => 'Block 1' ] );
		$p2 = $this->create_block_experiment( [ 'post_title' => 'Block 2' ] );

		sync_experiment_to_table( 'block', $p1 );
		sync_experiment_to_table( 'block', $p2 );

		$results = Experiment::query( [ 'subject_post_id' => $p1 ] )
			->get_results();

		$this->assertEquals( 1, count( $results ) );
		$this->assertEquals( $p1, $results[0]->get_subject_post_id() );
	}

	// ===================================================================
	// SECTION 11: Experiment::get_current_for_post / get_active_for_post
	// ===================================================================

	public function test_get_current_for_post_returns_running() {
		$post_id = $this->create_block_experiment();
		sync_experiment_to_table( 'block', $post_id );

		$current = Experiment::get_current_for_post( $post_id, 'block' );

		$this->assertNotNull( $current );
		$this->assertEquals( Experiment::STATUS_RUNNING, $current->get_status() );
	}

	public function test_get_current_for_post_returns_null_for_paused() {
		$post_id = $this->create_block_experiment( [ 'paused' => 'true' ] );
		sync_experiment_to_table( 'block', $post_id );

		$current = Experiment::get_current_for_post( $post_id, 'block' );

		$this->assertNull( $current, 'Paused experiments should not be returned as current' );
	}

	public function test_get_current_for_post_returns_null_for_draft() {
		$post_id = $this->create_block_experiment( [ 'started' => false, 'paused' => 'false' ] );
		sync_experiment_to_table( 'block', $post_id );

		$current = Experiment::get_current_for_post( $post_id, 'block' );

		$this->assertNull( $current, 'Draft experiments should not be returned as current' );
	}

	public function test_get_current_for_post_returns_null_for_completed() {
		$post_id = $this->create_block_experiment( [ 'ended' => 'true' ] );
		sync_experiment_to_table( 'block', $post_id );

		$current = Experiment::get_current_for_post( $post_id, 'block' );

		$this->assertNull( $current, 'Completed experiments should not be returned as current' );
	}

	public function test_get_current_for_post_returns_null_when_no_experiments() {
		$post_id = self::factory()->post->create( [ 'post_type' => 'wp_block' ] );

		$current = Experiment::get_current_for_post( $post_id, 'block' );

		$this->assertNull( $current );
	}

	public function test_get_active_for_post_returns_running() {
		$post_id = $this->create_block_experiment();
		sync_experiment_to_table( 'block', $post_id );

		$active = Experiment::get_active_for_post( $post_id, 'block' );

		$this->assertNotNull( $active );
		$this->assertEquals( Experiment::STATUS_RUNNING, $active->get_status() );
	}

	public function test_get_active_for_post_returns_paused() {
		$post_id = $this->create_block_experiment( [ 'paused' => 'true' ] );
		sync_experiment_to_table( 'block', $post_id );

		$active = Experiment::get_active_for_post( $post_id, 'block' );

		$this->assertNotNull( $active );
		$this->assertEquals( Experiment::STATUS_PAUSED, $active->get_status() );
	}

	public function test_get_active_for_post_returns_draft() {
		$post_id = $this->create_block_experiment( [ 'started' => false, 'paused' => 'false' ] );
		sync_experiment_to_table( 'block', $post_id );

		$active = Experiment::get_active_for_post( $post_id, 'block' );

		$this->assertNotNull( $active );
		$this->assertEquals( Experiment::STATUS_DRAFT, $active->get_status() );
	}

	public function test_get_active_for_post_returns_null_for_completed() {
		$post_id = $this->create_block_experiment( [ 'ended' => 'true' ] );
		sync_experiment_to_table( 'block', $post_id );

		$active = Experiment::get_active_for_post( $post_id, 'block' );

		$this->assertNull( $active, 'Completed experiments should not be returned as active' );
	}

	// ===================================================================
	// SECTION 12: to_array for REST API
	// ===================================================================

	public function test_to_array_contains_all_fields() {
		$post_id = $this->create_block_experiment();
		$experiment = sync_experiment_to_table( 'block', $post_id );

		$arr = $experiment->to_array();

		$expected_keys = [
			'id', 'subject_post_id', 'test_id', 'type', 'status',
			'title', 'goal', 'traffic_percentage',
			'variant_traffic_percentage', 'results', 'start_time',
			'end_time', 'created_at', 'updated_at',
		];

		foreach ( $expected_keys as $key ) {
			$this->assertArrayHasKey( $key, $arr, "to_array should contain '{$key}'" );
		}

		$this->assertEquals( $post_id, $arr['subject_post_id'] );
		$this->assertEquals( 'block', $arr['test_id'] );
	}

	// ===================================================================
	// SECTION 13: Migration post type mapping
	// ===================================================================

	public function test_get_post_types_for_block_returns_wp_block() {
		$types = Migration\get_post_types_for_test_id( 'block' );
		$this->assertEquals( [ 'wp_block' ], $types );
	}

	public function test_get_post_types_for_titles_returns_public_types() {
		$types = Migration\get_post_types_for_test_id( 'titles' );
		$this->assertContains( 'post', $types );
		$this->assertContains( 'page', $types );
		$this->assertNotContains( 'wp_block', $types, 'wp_block is private, should not be in titles types' );
	}

	public function test_get_post_types_for_featured_images_returns_public_types() {
		$types = Migration\get_post_types_for_test_id( 'featured_images' );
		$this->assertContains( 'post', $types );
		$this->assertContains( 'page', $types );
	}

	// ===================================================================
	// SECTION 14: Type transitions (abtest ↔ personalization ↔ standard)
	// ===================================================================

	public function test_sync_type_change_abtest_to_personalization_completes_old() {
		$post_id = $this->create_block_experiment( [ 'xb_type' => 'abtest' ] );

		// Create initial abtest experiment.
		$exp1 = sync_experiment_to_table( 'block', $post_id, Experiment::TYPE_ABTEST );
		$this->assertEquals( Experiment::TYPE_ABTEST, $exp1->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $exp1->get_status() );

		// Now sync with personalization type — should complete old and create new.
		$exp2 = sync_experiment_to_table( 'block', $post_id, Experiment::TYPE_PERSONALIZATION );

		// Reload the old experiment to check it was completed.
		$exp1_reloaded = Experiment::get( $exp1->get_id() );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $exp1_reloaded->get_status() );
		$this->assertNotEmpty( $exp1_reloaded->get_end_time(), 'Old experiment should have end_time set' );

		// New experiment should be a different row with correct type.
		$this->assertNotEquals( $exp1->get_id(), $exp2->get_id(), 'Should create a new experiment row' );
		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $exp2->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $exp2->get_status() );
		$this->assertEquals( 2, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	public function test_sync_type_change_personalization_to_abtest_completes_old() {
		$post_id = $this->create_block_experiment( [ 'xb_type' => 'personalization' ] );

		$exp1 = sync_experiment_to_table( 'block', $post_id, Experiment::TYPE_PERSONALIZATION );
		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $exp1->get_type() );

		$exp2 = sync_experiment_to_table( 'block', $post_id, Experiment::TYPE_ABTEST );

		$exp1_reloaded = Experiment::get( $exp1->get_id() );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $exp1_reloaded->get_status() );

		$this->assertNotEquals( $exp1->get_id(), $exp2->get_id() );
		$this->assertEquals( Experiment::TYPE_ABTEST, $exp2->get_type() );
		$this->assertEquals( 2, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	public function test_sync_same_type_does_not_create_new_experiment() {
		$post_id = $this->create_block_experiment( [ 'xb_type' => 'abtest' ] );

		$exp1 = sync_experiment_to_table( 'block', $post_id, Experiment::TYPE_ABTEST );
		$exp2 = sync_experiment_to_table( 'block', $post_id, Experiment::TYPE_ABTEST );

		$this->assertEquals( $exp1->get_id(), $exp2->get_id(), 'Same type should reuse experiment' );
		$this->assertEquals( 1, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	// ===================================================================
	// SECTION 15: save_variants — type transitions and downgrade
	// ===================================================================

	/**
	 * Build post_content with altis/variant blocks.
	 *
	 * @param int $count Number of variants.
	 * @return string Serialized block content.
	 */
	private function build_variant_content( int $count = 2 ) : string {
		$content = '';
		for ( $i = 0; $i < $count; $i++ ) {
			$content .= '<!-- wp:altis/variant --><p>Variant ' . $i . '</p><!-- /wp:altis/variant -->';
		}
		return $content;
	}

	public function test_save_variants_creates_single_experiment() {
		$post_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => $this->build_variant_content(),
		] );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );

		$this->assertEquals( 1, $this->count_experiment_rows( $post_id, 'block' ) );

		$experiment = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertNotNull( $experiment );
		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
	}

	public function test_save_variants_downgrade_to_standard_ends_experiment() {
		$post_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => $this->build_variant_content(),
		] );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		// Create the initial experiment.
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );
		$experiment = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertNotNull( $experiment, 'Should have an active experiment' );

		// Downgrade to standard — remove variants and change type.
		wp_update_post( [
			'ID'           => $post_id,
			'post_content' => '<!-- wp:paragraph --><p>Plain content</p><!-- /wp:paragraph -->',
		] );
		update_post_meta( $post_id, '_xb_type', 'standard' );

		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );

		// The experiment should now be completed.
		$active = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertNull( $active, 'No active experiment after downgrade' );

		$ended = get_post_meta( $post_id, '_altis_ab_test_block_ended', true );
		$this->assertEquals( 'true', $ended );
	}

	public function test_save_variants_downgrade_personalization_to_standard_no_spurious_abtest() {
		$post_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => $this->build_variant_content(),
		] );
		update_post_meta( $post_id, '_xb_type', 'personalization' );

		// Create personalization experiment.
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );
		$exp = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $exp->get_type() );

		// Downgrade to standard.
		wp_update_post( [
			'ID'           => $post_id,
			'post_content' => '<!-- wp:paragraph --><p>Plain</p><!-- /wp:paragraph -->',
		] );
		update_post_meta( $post_id, '_xb_type', 'standard' );
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );

		// Should have exactly 1 row: the completed personalization. No spurious abtest.
		$this->assertEquals( 1, $this->count_experiment_rows( $post_id, 'block' ) );

		$exp_reloaded = Experiment::get( $exp->get_id() );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $exp_reloaded->get_status() );
		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $exp_reloaded->get_type() );
	}

	public function test_save_variants_downgrade_with_no_prior_experiment_is_noop() {
		$post_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => '<!-- wp:paragraph --><p>Plain</p><!-- /wp:paragraph -->',
		] );
		update_post_meta( $post_id, '_xb_type', 'standard' );

		// Should not error or create any experiment.
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );

		$this->assertEquals( 0, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	public function test_save_variants_preserves_paused_state_on_regular_save() {
		$post_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => $this->build_variant_content(),
		] );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		// Initial save — creates running experiment.
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );
		$experiment = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );

		// Pause the experiment.
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'true' );

		// Save again without changing variants — should stay paused.
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );
		$experiment = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertEquals( Experiment::STATUS_PAUSED, $experiment->get_status() );
		$this->assertEquals( 1, $this->count_experiment_rows( $post_id, 'block' ) );
	}

	public function test_save_variants_re_upgrade_after_downgrade_starts_running() {
		$post_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => $this->build_variant_content(),
		] );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		// Create and then downgrade.
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );

		wp_update_post( [
			'ID'           => $post_id,
			'post_content' => '<!-- wp:paragraph --><p>Plain</p><!-- /wp:paragraph -->',
		] );
		update_post_meta( $post_id, '_xb_type', 'standard' );
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );

		// Re-upgrade to A/B test.
		wp_update_post( [
			'ID'           => $post_id,
			'post_content' => $this->build_variant_content(),
		] );
		update_post_meta( $post_id, '_xb_type', 'abtest' );
		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );

		$active = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertNotNull( $active, 'Should have an active experiment after re-upgrade' );
		$this->assertEquals( Experiment::STATUS_RUNNING, $active->get_status() );
	}

	public function test_save_variants_type_change_abtest_to_personalization() {
		$post_id = self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_content' => $this->build_variant_content(),
		] );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );
		$exp1 = Experiment::get_active_for_post( $post_id, 'block' );
		$this->assertEquals( Experiment::TYPE_ABTEST, $exp1->get_type() );

		// Change type to personalization.
		update_post_meta( $post_id, '_xb_type', 'personalization' );

		\Altis\Accelerate\GlobalBlocks\save_variants( get_post( $post_id ) );
		$exp2 = Experiment::get_active_for_post( $post_id, 'block' );

		// Old experiment should be completed, new one active.
		$exp1_reloaded = Experiment::get( $exp1->get_id() );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $exp1_reloaded->get_status() );

		$this->assertNotEquals( $exp1->get_id(), $exp2->get_id() );
		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $exp2->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $exp2->get_status() );
		$this->assertEquals( 2, $this->count_experiment_rows( $post_id, 'block' ) );
	}
}
