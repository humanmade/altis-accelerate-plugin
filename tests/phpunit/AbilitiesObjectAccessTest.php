<?php
/**
 * Abilities check the current user's access to the item they act on.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Discovery;
use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Abilities\Query;
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Experiments\Experiment;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/lib/johnbillion/extended-cpts/extended-cpts.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/discovery.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/query.php';

class AbilitiesObjectAccessTest extends WP_UnitTestCase {

	/**
	 * A synced pattern owned by an administrator.
	 *
	 * @var int
	 */
	private $block_id;

	/**
	 * An audience owned by an administrator.
	 *
	 * @var int
	 */
	private $audience_id;

	public function set_up() {
		parent::set_up();

		// The audiences feature is not bootstrapped in the test environment, and
		// other tests leave a bare stand-in for the post type behind.
		if ( post_type_exists( Audiences\POST_TYPE ) ) {
			unregister_post_type( Audiences\POST_TYPE );
		}
		Audiences\register_post_type();
		add_filter( 'user_has_cap', 'Altis\\Accelerate\\Audiences\\maybe_grant_caps', 1 );

		$admin_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		$this->block_id = self::factory()->post->create( [
			'post_type' => 'wp_block',
			'post_status' => 'publish',
			'post_author' => $admin_id,
			'post_content' => '<!-- wp:altis/variant {"title":"Control","fallback":true} --><!-- wp:paragraph --><p>Control</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->'
				. '<!-- wp:altis/variant {"title":"B"} --><!-- wp:paragraph --><p>B</p><!-- /wp:paragraph --><!-- /wp:altis/variant -->',
		] );
		$this->audience_id = self::factory()->post->create( [
			'post_type' => Audiences\POST_TYPE,
			'post_status' => 'publish',
			'post_author' => $admin_id,
			'post_title' => 'Original audience',
		] );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'contributor' ] ) );
	}

	/**
	 * @dataProvider data_block_write_abilities
	 */
	public function test_block_write_abilities_need_edit_access_to_the_block( string $handler, array $input ) {
		$before = get_post( $this->block_id )->post_content;

		$result = call_user_func( 'Altis\\Accelerate\\Abilities\\Execution\\' . $handler, array_merge( [ 'block_id' => $this->block_id ], $input ) );

		$this->assertWPError( $result );
		$this->assertSame( 'forbidden_block', $result->get_error_code() );
		$this->assertSame( $before, get_post( $this->block_id )->post_content );
		$this->assertSame( '', get_post_meta( $this->block_id, '_xb_goal', true ) );
		$this->assertSame( '', get_post_meta( $this->block_id, '_xb_traffic_percentage', true ) );
	}

	public function data_block_write_abilities() : array {
		$paragraph = '<!-- wp:paragraph --><p>New</p><!-- /wp:paragraph -->';
		return [
			'add variant' => [ 'execute_add_variant', [ 'content' => $paragraph ] ],
			'update variant' => [ 'execute_update_variant', [ 'variant_index' => 1, 'content' => $paragraph ] ],
			'remove variant' => [ 'execute_remove_variant', [ 'variant_index' => 1 ] ],
			'personalization rule' => [ 'execute_create_personalization_rule', [ 'audience_id' => 1, 'personalized_content' => $paragraph, 'fallback_content' => $paragraph ] ],
			'block goal' => [ 'execute_set_block_goal', [ 'goal' => 'click' ] ],
			'traffic percentage' => [ 'execute_set_traffic_percentage', [ 'percentage' => 50 ] ],
		];
	}

	public function test_reading_variants_only_needs_read_access_to_the_block() {
		$result = Execution\execute_get_variants( [ 'block_id' => $this->block_id ] );
		$this->assertIsArray( $result );

		wp_update_post( [
			'ID' => $this->block_id,
			'post_status' => 'private',
		] );
		$result = Execution\execute_get_variants( [ 'block_id' => $this->block_id ] );
		$this->assertWPError( $result );
		$this->assertSame( 'forbidden_block', $result->get_error_code() );
	}

	public function test_experiment_results_need_read_access_to_the_subject() {
		wp_update_post( [
			'ID' => $this->block_id,
			'post_status' => 'private',
		] );
		$experiment = new Experiment();
		$experiment->set_subject_post_id( $this->block_id );
		$experiment->set_test_id( 'block' );
		$experiment->set_type( Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_RUNNING );
		$experiment->save();

		$by_experiment = Execution\execute_get_experiment_results( [ 'experiment_id' => $experiment->get_id() ] );
		$this->assertWPError( $by_experiment );
		$this->assertSame( 'forbidden_experiment', $by_experiment->get_error_code() );

		$by_block = Execution\execute_get_experiment_results( [ 'block_id' => $this->block_id ] );
		$this->assertWPError( $by_block );
		$this->assertSame( 'forbidden_block', $by_block->get_error_code() );

		// The experiment list keeps the row but not the title copied from the subject.
		$experiment->set_title( 'Unannounced plan' );
		$experiment->save();
		$listed = Discovery\execute_list_experiments( [ 'subject_post_id' => $this->block_id ] )['experiments'];
		$this->assertCount( 1, $listed );
		$this->assertStringNotContainsString( 'Unannounced plan', wp_json_encode( $listed ) );
	}

	public function test_audience_abilities_need_audience_capabilities() {
		$rules = [ 'include' => 'all', 'groups' => [] ];

		$result = Execution\execute_update_audience( [ 'audience_id' => $this->audience_id, 'title' => 'Renamed', 'rules' => $rules ] );
		$this->assertWPError( $result );
		$this->assertSame( 'forbidden_audience', $result->get_error_code() );
		$this->assertSame( 'Original audience', get_post( $this->audience_id )->post_title );
		$this->assertSame( '', get_post_meta( $this->audience_id, 'audience', true ) );

		$result = Execution\execute_create_audience( [ 'title' => 'Made by a contributor', 'rules' => $rules ] );
		$this->assertWPError( $result );
		$this->assertSame( 'forbidden_audience', $result->get_error_code() );
		$this->assertEmpty( get_posts( [ 'post_type' => Audiences\POST_TYPE, 'title' => 'Made by a contributor', 'post_status' => 'any' ] ) );

		// An editor can publish pages, so can do both.
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$this->assertIsArray( Execution\execute_update_audience( [ 'audience_id' => $this->audience_id, 'title' => 'Renamed' ] ) );
		$this->assertIsArray( Execution\execute_create_audience( [ 'title' => 'Made by an editor', 'rules' => $rules ] ) );
	}

	public function test_content_search_stays_within_public_content() {
		self::factory()->post->create( [ 'post_title' => 'Findable open post' ] );
		self::factory()->post->create( [ 'post_title' => 'Findable locked post', 'post_password' => 'hunter2' ] );

		$titles = wp_list_pluck( Query\execute_search_content( [ 'query' => 'Findable' ] )['results'], 'title' );
		$this->assertSame( [ 'Findable open post' ], $titles );

		$result = Query\execute_search_content( [ 'query' => 'Original', 'post_type' => Audiences\POST_TYPE ] );
		$this->assertWPError( $result );
		$this->assertSame( 'invalid_post_type', $result->get_error_code() );
	}
}
