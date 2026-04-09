<?php

namespace Altis\Accelerate\Experiments;

use Altis\Accelerate\Utils;
use WP_UnitTestCase;

class ExperimentMigrationTest extends WP_UnitTestCase {

	/**
	 * Ensure the experiments table exists before each test.
	 */
	public function set_up() {
		parent::set_up();
		Experiment::ensure_table();
	}

	/**
	 * Clean up experiment rows after each test.
	 */
	public function tear_down() {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// Use DELETE (DML) not TRUNCATE (DDL) — TRUNCATE auto-commits,
		// which breaks WP_UnitTestCase's transaction rollback.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		parent::tear_down();
	}

	/**
	 * Test that the experiments table is created correctly.
	 */
	public function test_table_creation() {
		global $wpdb;

		$table = $wpdb->prefix . 'accelerate_experiments';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->get_var(
			$wpdb->prepare( 'SHOW TABLES LIKE %s', $table )
		);

		$this->assertEquals( $table, $result, 'Experiments table should exist' );
	}

	/**
	 * Test that the table has all expected columns.
	 */
	public function test_table_schema_columns() {
		global $wpdb;

		$table = $wpdb->prefix . 'accelerate_experiments';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$columns = $wpdb->get_results( "DESCRIBE `{$table}`" );
		$column_names = array_map( function ( $col ) {
			return $col->Field;
		}, $columns );

		$expected = [
			'id',
			'subject_post_id',
			'test_id',
			'type',
			'status',
			'title',
			'goal',
			'traffic_percentage',
			'variant_traffic_percentage',
			'variants_snapshot',
			'results',
			'start_time',
			'end_time',
			'created_at',
			'updated_at',
		];

		foreach ( $expected as $col ) {
			$this->assertContains( $col, $column_names, "Column '{$col}' should exist in table" );
		}
	}

	/**
	 * Test creating an experiment from post meta for a running A/B test.
	 */
	public function test_create_experiment_from_meta_running_abtest() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Test Block',
		] );

		$now = Utils\milliseconds();
		$variants = [ 'Control', 'Variant A' ];

		// Set up meta as if the test is running.
		update_post_meta( $post_id, '_altis_ab_test_block_variants', $variants );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 ); // 1 day ago.
		update_post_meta( $post_id, '_altis_ab_test_block_end_time', $now + 86400000 * 89 ); // 89 days from now.
		update_post_meta( $post_id, '_altis_ab_test_block_traffic_percentage', 80 );
		update_post_meta( $post_id, '_altis_ab_test_block_variant_traffic_percentage', [ 50, 50 ] );
		update_post_meta( $post_id, '_xb_type', 'abtest' );
		update_post_meta( $post_id, '_xb_goal', 'click_any_link' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertNotInstanceOf( 'WP_Error', $experiment, 'Should not return WP_Error' );
		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertNotNull( $experiment->get_id(), 'Should have an ID after saving' );
		$this->assertEquals( $post_id, $experiment->get_subject_post_id() );
		$this->assertEquals( 'block', $experiment->get_test_id() );
		$this->assertEquals( Experiment::TYPE_ABTEST, $experiment->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
		$this->assertEquals( 'Test Block', $experiment->get_title() );
		$this->assertEquals( 'click_any_link', $experiment->get_goal() );
		$this->assertEquals( 80, $experiment->get_traffic_percentage() );
		$this->assertEquals( [ 50, 50 ], $experiment->get_variant_traffic_percentage() );
		$this->assertEquals( $variants, $experiment->get_variants_snapshot() );
	}

	/**
	 * Test creating an experiment from meta for a completed test.
	 */
	public function test_create_experiment_from_meta_completed() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Completed Test',
		] );

		$completed_results = [
			'timestamp' => Utils\milliseconds(),
			'winner'    => 1,
			'variants'  => [
				[ 'value' => 'Control', 'size' => 500, 'hits' => 25, 'rate' => 0.05, 'p' => 0.15 ],
				[ 'value' => 'Winner',  'size' => 500, 'hits' => 50, 'rate' => 0.10, 'p' => 0.85 ],
			],
		];

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'Control', 'Winner' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'true' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'true' );
		update_post_meta( $post_id, '_altis_ab_test_block_completed', $completed_results );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( Experiment::STATUS_COMPLETED, $experiment->get_status() );
		$results = $experiment->get_results();
		$this->assertEquals( 1, $results['winner'] );
		$this->assertCount( 2, $results['variants'] );
	}

	/**
	 * Test creating an experiment from meta for a paused test.
	 */
	public function test_create_experiment_from_meta_paused() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Paused Test',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'true' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( Experiment::STATUS_PAUSED, $experiment->get_status() );
	}

	/**
	 * Test creating an experiment from meta for a personalization.
	 */
	public function test_create_experiment_from_meta_personalization() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Personalized Block',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'Default', 'Targeted' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $post_id, '_xb_personalization', true );
		update_post_meta( $post_id, '_xb_type', 'personalization' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( Experiment::TYPE_PERSONALIZATION, $experiment->get_type() );
		$this->assertEquals( Experiment::STATUS_RUNNING, $experiment->get_status() );
	}

	/**
	 * Test creating an experiment from meta for a draft (not yet started).
	 */
	public function test_create_experiment_from_meta_draft() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Draft Test',
		] );

		$future = Utils\milliseconds() + 86400000 * 7; // 7 days from now.

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', false );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $future );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( Experiment::STATUS_DRAFT, $experiment->get_status() );
	}

	/**
	 * Test that create_experiment_from_meta stores the current experiment ID.
	 */
	public function test_create_experiment_stores_current_id() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'ID Storage Test',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$stored_id = get_post_meta( $post_id, '_current_experiment_id', true );
		$this->assertEquals( $experiment->get_id(), (int) $stored_id );
	}

	/**
	 * Test that completed experiments do NOT store current_experiment_id.
	 */
	public function test_completed_experiment_does_not_store_current_id() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Completed No ID Test',
		] );

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'true' );
		update_post_meta( $post_id, '_altis_ab_test_block_completed', [
			'timestamp' => Utils\milliseconds(),
			'winner' => 0,
		] );

		Migration\create_experiment_from_meta( $post_id, 'block' );

		$stored_id = get_post_meta( $post_id, '_current_experiment_id', true );
		$this->assertEmpty( $stored_id, 'Completed experiments should not set _current_experiment_id' );
	}

	/**
	 * Test that create_experiment_from_meta returns WP_Error for invalid post.
	 */
	public function test_create_experiment_from_meta_invalid_post() {
		$result = Migration\create_experiment_from_meta( 999999, 'block' );
		$this->assertInstanceOf( 'WP_Error', $result );
	}


	/**
	 * Test backfill_test_id processes a batch correctly.
	 */
	public function test_backfill_test_id_batch() {
		// Create 3 posts with block experiment meta.
		$post_ids = [];
		$now = Utils\milliseconds();

		for ( $i = 0; $i < 3; $i++ ) {
			$post_id = self::factory()->post->create( [
				'post_type'  => 'wp_block',
				'post_title' => "Block {$i}",
			] );
			$post_ids[] = $post_id;

			update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
			update_post_meta( $post_id, '_altis_ab_test_block_started', true );
			update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
			update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
			update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
			update_post_meta( $post_id, '_xb_type', 'abtest' );
		}

		$stats = Migration\backfill_test_id( 'block', 1, 100 );

		$this->assertEquals( 3, $stats['processed'] );
		$this->assertEquals( 3, $stats['created'] );
		$this->assertEquals( 0, $stats['skipped'] );
		$this->assertEquals( 0, $stats['errors'] );

		// Verify all experiments exist in the table.
		foreach ( $post_ids as $post_id ) {
			$results = Experiment::query(
				[ 'subject_post_id' => $post_id, 'test_id' => 'block' ],
				[ 'per_page' => 1 ]
			)->get_results();

			$this->assertFalse( is_wp_error( $results ) );
			$this->assertCount( 1, $results, "Experiment row should exist for post {$post_id}" );
		}
	}

	/**
	 * Test backfill skips posts that already have experiment rows.
	 */
	public function test_backfill_skips_existing() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Already Migrated',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		// Run backfill once.
		$stats1 = Migration\backfill_test_id( 'block', 1, 100 );
		$this->assertEquals( 1, $stats1['created'] );

		// Run again — should skip.
		$stats2 = Migration\backfill_test_id( 'block', 1, 100 );
		$this->assertEquals( 1, $stats2['processed'] );
		$this->assertEquals( 0, $stats2['created'] );
		$this->assertEquals( 1, $stats2['skipped'] );
	}

	/**
	 * Test full backfill across multiple test IDs.
	 */
	public function test_full_backfill() {
		$now = Utils\milliseconds();

		// Create a block experiment.
		$block_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Block Experiment',
		] );
		update_post_meta( $block_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $block_id, '_altis_ab_test_block_started', true );
		update_post_meta( $block_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $block_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $block_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $block_id, '_xb_type', 'abtest' );

		// Create a titles experiment.
		$page_id = self::factory()->post->create( [
			'post_type'  => 'post',
			'post_title' => 'Title AB Test Post',
		] );
		update_post_meta( $page_id, '_altis_ab_test_titles_variants', [ 'Title A', 'Title B' ] );
		update_post_meta( $page_id, '_altis_ab_test_titles_started', true );
		update_post_meta( $page_id, '_altis_ab_test_titles_paused', 'false' );
		update_post_meta( $page_id, '_altis_ab_test_titles_ended', 'false' );
		update_post_meta( $page_id, '_altis_ab_test_titles_start_time', $now - 86400000 );

		$stats = Migration\backfill();

		$this->assertEquals( 2, $stats['created'], 'Should create 2 experiments (1 block + 1 titles)' );
		$this->assertEquals( 0, $stats['errors'] );
	}

	/**
	 * Test that titles experiments are assigned the correct test_id.
	 */
	public function test_migration_titles_test_id() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'post',
			'post_title' => 'Titles Experiment Post',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_titles_variants', [ 'Title A', 'Title B' ] );
		update_post_meta( $post_id, '_altis_ab_test_titles_started', true );
		update_post_meta( $post_id, '_altis_ab_test_titles_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_titles_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_titles_start_time', $now - 86400000 );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'titles' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'titles', $experiment->get_test_id() );
		$this->assertEquals( $post_id, $experiment->get_subject_post_id() );
	}

	/**
	 * Test that featured_images experiments are assigned the correct test_id.
	 */
	public function test_migration_featured_images_test_id() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'post',
			'post_title' => 'Featured Images Experiment',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_featured_images_variants', [ 10, 20 ] );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_started', true );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_featured_images_start_time', $now - 86400000 );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'featured_images' );

		$this->assertInstanceOf( Experiment::class, $experiment );
		$this->assertEquals( 'featured_images', $experiment->get_test_id() );
	}

	/**
	 * Test that migration preserves results data with all fields.
	 */
	public function test_migration_preserves_results() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Results Test',
		] );

		$results = [
			'timestamp' => Utils\milliseconds(),
			'winning'   => 1,
			'winner'    => null,
			'aggs'      => [
				[ 'impressions' => 500, 'conversions' => 25 ],
				[ 'impressions' => 500, 'conversions' => 45 ],
			],
			'variants'  => [
				[ 'value' => 'A', 'size' => 500, 'hits' => 25, 'rate' => 0.05, 'p' => 0.15 ],
				[ 'value' => 'B', 'size' => 500, 'hits' => 45, 'rate' => 0.09, 'p' => 0.85 ],
			],
		];

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $post_id, '_altis_ab_test_block_results', $results );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );
		$stored_results = $experiment->get_results();

		$this->assertEquals( $results['winning'], $stored_results['winning'] );
		$this->assertNull( $stored_results['winner'] );
		$this->assertCount( 2, $stored_results['variants'] );
		$this->assertEquals( 500, $stored_results['variants'][0]['size'] );
		$this->assertEquals( 45, $stored_results['variants'][1]['hits'] );
	}

	/**
	 * Test that migration uses completed results over current results when available.
	 */
	public function test_migration_prefers_completed_results() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Prefer Completed Results',
		] );

		$current_results = [
			'timestamp' => Utils\milliseconds() - 3600000,
			'winner'    => null,
			'variants'  => [
				[ 'value' => 'A', 'size' => 100 ],
			],
		];

		$completed_results = [
			'timestamp' => Utils\milliseconds(),
			'winner'    => 1,
			'variants'  => [
				[ 'value' => 'A', 'size' => 500, 'hits' => 25 ],
				[ 'value' => 'B', 'size' => 500, 'hits' => 50 ],
			],
		];

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'true' );
		update_post_meta( $post_id, '_altis_ab_test_block_results', $current_results );
		update_post_meta( $post_id, '_altis_ab_test_block_completed', $completed_results );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );
		$stored_results = $experiment->get_results();

		$this->assertEquals( 1, $stored_results['winner'], 'Should use completed results (has winner)' );
		$this->assertCount( 2, $stored_results['variants'] );
		$this->assertEquals( 500, $stored_results['variants'][0]['size'], 'Should use completed results (larger sample)' );
	}

	/**
	 * Test backfill with empty database (no experiment meta at all).
	 */
	public function test_backfill_empty_database() {
		$stats = Migration\backfill();

		$this->assertEquals( 0, $stats['processed'] );
		$this->assertEquals( 0, $stats['created'] );
		$this->assertEquals( 0, $stats['errors'] );
	}

	/**
	 * Test that migration handles start/end times correctly.
	 */
	public function test_migration_preserves_timestamps() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Timestamp Test',
		] );

		$start = 1700000000000; // Fixed timestamp in ms.
		$end   = 1700086400000; // +1 day.

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $start );
		update_post_meta( $post_id, '_altis_ab_test_block_end_time', $end );
		update_post_meta( $post_id, '_xb_type', 'abtest' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( $start, $experiment->get_start_time() );
		$this->assertEquals( $end, $experiment->get_end_time() );
	}

	/**
	 * Test that migration handles default goal correctly.
	 */
	public function test_migration_default_goal() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Default Goal Test',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $post_id, '_xb_type', 'abtest' );
		// No _xb_goal or _goal meta set.

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( 'engagement', $experiment->get_goal(), 'Should default to engagement goal' );
	}

	/**
	 * Test migration uses _goal meta as fallback when _xb_goal is not set.
	 */
	public function test_migration_goal_fallback() {
		$post_id = self::factory()->post->create( [
			'post_type'  => 'wp_block',
			'post_title' => 'Goal Fallback Test',
		] );

		$now = Utils\milliseconds();

		update_post_meta( $post_id, '_altis_ab_test_block_variants', [ 'A', 'B' ] );
		update_post_meta( $post_id, '_altis_ab_test_block_started', true );
		update_post_meta( $post_id, '_altis_ab_test_block_paused', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_ended', 'false' );
		update_post_meta( $post_id, '_altis_ab_test_block_start_time', $now - 86400000 );
		update_post_meta( $post_id, '_xb_type', 'abtest' );
		update_post_meta( $post_id, '_goal', 'submit_form' );

		$experiment = Migration\create_experiment_from_meta( $post_id, 'block' );

		$this->assertEquals( 'submit_form', $experiment->get_goal() );
	}
}
