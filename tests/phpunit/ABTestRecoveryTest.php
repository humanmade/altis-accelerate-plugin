<?php
/**
 * Recoverable A/B-test creation tests.
 *
 * @package altis-accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Abilities\Recovery;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\Experiments\Experiment;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/ab-test-recovery.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';

class ABTestRecoveryTest extends WP_UnitTestCase {

	/** @var int */
	private $admin_id;

	public function set_up() : void {
		parent::set_up();
		Experiment::ensure_table();
		$this->admin_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		wp_set_current_user( $this->admin_id );
		Experiments\flush_experiment_resolver_cache();
	}

	public function tear_down() : void {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		Experiments\flush_experiment_resolver_cache();
		wp_set_current_user( 0 );
		parent::tear_down();
	}

	private function make_block( string $content = '<!-- wp:paragraph --><p>Original</p><!-- /wp:paragraph -->' ) : int {
		return self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_author'  => $this->admin_id,
			'post_title'   => 'Recoverable block',
			'post_content' => $content,
		] );
	}

	private function input( int $block_id, string $request_id = 'recovery-test-1' ) : array {
		$content = (string) get_post_field( 'post_content', $block_id );
		return [
			'block_id'              => $block_id,
			'expected_content_hash' => Recovery\content_hash( $content ),
			'request_id'            => $request_id,
			'variants'              => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>Control</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Challenger', 'content' => '<!-- wp:paragraph --><p>Challenger</p><!-- /wp:paragraph -->' ],
			],
		];
	}

	private function count_rows( int $block_id ) : int {
		$rows = Experiment::query(
			[ 'subject_post_id' => $block_id, 'test_id' => 'block' ],
			[ 'per_page' => 100 ]
		)->get_results();
		return is_wp_error( $rows ) ? 0 : count( $rows );
	}

	public function test_empty_variant_is_rejected_without_mutation() : void {
		$block_id = $this->make_block();
		$original = (string) get_post_field( 'post_content', $block_id );
		$input = $this->input( $block_id );
		$input['variants'][1]['content'] = '  ';

		$result = Execution\execute_create_ab_test( $input );

		$this->assertWPError( $result );
		$this->assertSame( 'invalid_variant', $result->get_error_code() );
		$this->assertSame( $original, get_post_field( 'post_content', $block_id ) );
		$this->assertSame( 0, $this->count_rows( $block_id ) );
	}

	public function test_object_permission_is_checked_before_creation() : void {
		$block_id = $this->make_block();
		$author_id = self::factory()->user->create( [ 'role' => 'author' ] );
		wp_set_current_user( $author_id );

		$result = Execution\execute_create_ab_test( $this->input( $block_id ) );

		$this->assertWPError( $result );
		$this->assertSame( 'forbidden_block', $result->get_error_code() );
		$this->assertSame( 0, $this->count_rows( $block_id ) );
	}

	public function test_stale_original_hash_is_rejected_before_receipt_or_write() : void {
		$block_id = $this->make_block();
		$input = $this->input( $block_id );
		$input['expected_content_hash'] = str_repeat( 'a', 64 );

		$result = Execution\execute_create_ab_test( $input );

		$this->assertWPError( $result );
		$this->assertSame( 'stale_block_state', $result->get_error_code() );
		$this->assertSame( 0, $this->count_rows( $block_id ) );
		$this->assertEmpty( get_post_meta( $block_id, Recovery\receipt_meta_key( $block_id, $input['request_id'] ), false ) );
	}

	public function test_personalization_and_active_experiment_states_are_rejected_before_write() : void {
		$personalized_block = $this->make_block();
		update_post_meta( $personalized_block, '_xb_type', 'personalization' );
		update_post_meta( $personalized_block, '_xb_personalization', true );

		$personalization_result = Execution\execute_create_ab_test( $this->input( $personalized_block, 'personalization-state' ) );
		$this->assertWPError( $personalization_result );
		$this->assertSame( 'unsupported_block_state', $personalization_result->get_error_code() );

		$active_block = $this->make_block();
		$active_input = $this->input( $active_block, 'first-active-test' );
		unset( $active_input['expected_content_hash'], $active_input['request_id'] );
		$this->assertNotWPError( Execution\execute_create_ab_test( $active_input ) );

		$active_result = Execution\execute_create_ab_test( $this->input( $active_block, 'active-state' ) );
		$this->assertWPError( $active_result );
		$this->assertSame( 'unsupported_block_state', $active_result->get_error_code() );
	}

	public function test_duplicate_request_reconciles_timeout_after_write_without_new_row() : void {
		$block_id = $this->make_block();
		$input = $this->input( $block_id, 'timeout-after-write' );

		$first = Execution\execute_create_ab_test( $input );
		$second = Execution\execute_create_ab_test( $input );

		$this->assertNotWPError( $first );
		$this->assertNotWPError( $second );
		$this->assertSame( $first['experiment_id'], $second['experiment_id'] );
		$this->assertSame( 1, $this->count_rows( $block_id ) );
		$this->assertSame( $first['current_content_hash'], $second['current_content_hash'] );
	}

	public function test_restore_rejects_a_concurrent_content_edit() : void {
		$block_id = $this->make_block();
		$created = Execution\execute_create_ab_test( $this->input( $block_id, 'concurrent-edit' ) );
		$this->assertNotWPError( $created );

		wp_update_post( [
			'ID'           => $block_id,
			'post_content' => wp_slash( '<!-- wp:paragraph --><p>New editor content</p><!-- /wp:paragraph -->' ),
		] );

		$result = Execution\execute_restore_ab_test( [
			'block_id'              => $block_id,
			'request_id'            => 'concurrent-edit',
			'expected_current_hash' => $created['current_content_hash'],
		] );

		$this->assertWPError( $result );
		$this->assertSame( 'stale_block_state', $result->get_error_code() );
		$this->assertStringContainsString( 'New editor content', (string) get_post_field( 'post_content', $block_id ) );
		$this->assertSame( 1, $this->count_rows( $block_id ) );
	}

	public function test_restore_reinstates_content_and_tracked_meta_without_ghost_history() : void {
		$block_id = $this->make_block();
		$original_content = (string) get_post_field( 'post_content', $block_id );
		update_post_meta( $block_id, '_xb_type', 'standard' );
		update_post_meta( $block_id, '_xb_goal', 'original-goal' );
		update_post_meta( $block_id, '_altis_ab_test_block_ended', 'true' );
		update_post_meta( $block_id, '_altis_ab_test_block_results', [ 'winner' => 0 ] );
		add_post_meta( $block_id, '_xb_hypothesis', 'first original note' );
		add_post_meta( $block_id, '_xb_hypothesis', 'second original note' );

		$historical = new Experiment();
		$historical->set_subject_post_id( $block_id );
		$historical->set_test_id( 'block' );
		$historical->set_type( Experiment::TYPE_ABTEST );
		$historical->set_status( Experiment::STATUS_COMPLETED );
		$historical->save();
		$this->assertSame( 1, $this->count_rows( $block_id ) );

		$created = Execution\execute_create_ab_test( $this->input( $block_id, 'complete-restore' ) );
		$this->assertNotWPError( $created );
		$this->assertSame( 2, $this->count_rows( $block_id ) );

		$restored = Execution\execute_restore_ab_test( [
			'block_id'              => $block_id,
			'request_id'            => 'complete-restore',
			'expected_current_hash' => $created['current_content_hash'],
		] );
		$this->assertNotWPError( $restored );
		$this->assertTrue( $restored['restored'] );
		$this->assertSame( $original_content, get_post_field( 'post_content', $block_id ) );
		$this->assertSame( 'standard', get_post_meta( $block_id, '_xb_type', true ) );
		$this->assertSame( 'original-goal', get_post_meta( $block_id, '_xb_goal', true ) );
		$this->assertSame( 'true', get_post_meta( $block_id, '_altis_ab_test_block_ended', true ) );
		$this->assertSame( [ 'winner' => 0 ], get_post_meta( $block_id, '_altis_ab_test_block_results', true ) );
		$this->assertSame( [ 'first original note', 'second original note' ], get_post_meta( $block_id, '_xb_hypothesis', false ) );
		$this->assertSame( 1, $this->count_rows( $block_id ), 'The recovery must delete only the newly created experiment row.' );

		$again = Execution\execute_restore_ab_test( [
			'block_id'              => $block_id,
			'request_id'            => 'complete-restore',
			'expected_current_hash' => $created['current_content_hash'],
		] );
		$this->assertNotWPError( $again );
		$this->assertSame( $restored, $again );
	}
}
