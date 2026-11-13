<?php
/**
 * REST responses only carry analytics and content the current user may see.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Blocks;
use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\Experiments\REST_API as Experiments_API;
use Altis\Accelerate\GlobalBlocks\Connections;
use Altis\Accelerate\GlobalBlocks\REST_API\Relationships;
use WP_REST_Request;
use WP_UnitTestCase;

class RestReadAccessTest extends WP_UnitTestCase {

	/**
	 * Switch to a new user with the given role.
	 *
	 * @param string $role The role name.
	 * @return int The user ID.
	 */
	private function act_as( string $role ) : int {
		$user_id = self::factory()->user->create( [ 'role' => $role ] );
		wp_set_current_user( $user_id );
		return $user_id;
	}

	public function test_visitor_counts_need_analytics_access() {
		$this->act_as( 'subscriber' );
		$this->assertFalse( Audiences\REST_API\check_read_permission(), 'Audience estimate' );
		$this->assertFalse( Blocks\REST_API\check_views_permission(), 'Block views' );

		$this->act_as( 'contributor' );
		$this->assertTrue( Audiences\REST_API\check_read_permission(), 'Audience estimate' );
		$this->assertTrue( Blocks\REST_API\check_views_permission(), 'Block views' );
	}

	public function test_audience_list_hides_estimates_without_analytics_access() {
		// The audiences feature is not bootstrapped in the test environment, and
		// other tests leave a bare stand-in for the post type behind.
		require_once dirname( __DIR__, 2 ) . '/lib/johnbillion/extended-cpts/extended-cpts.php';
		if ( post_type_exists( Audiences\POST_TYPE ) ) {
			unregister_post_type( Audiences\POST_TYPE );
		}
		Audiences\register_post_type();
		add_action( 'rest_api_init', 'Altis\\Accelerate\\Audiences\\REST_API\\init' );
		$GLOBALS['wp_rest_server'] = null;

		$this->act_as( 'administrator' );
		$audience_id = self::factory()->post->create( [
			'post_type' => Audiences\POST_TYPE,
			'post_status' => 'publish',
		] );
		$saved = Audiences\save_audience( $audience_id, [
			'include' => 'all',
			'groups' => [
				[
					'include' => 'any',
					'rules' => [
						[
							'field' => 'endpoint.Location.Country',
							'operator' => '=',
							'value' => 'GB',
						],
					],
				],
			],
		] );
		$this->assertTrue( $saved );

		$request = new WP_REST_Request( 'GET', '/accelerate/v1/audiences/' . $audience_id );
		$this->assertNotNull( rest_do_request( $request )->get_data()['estimate'] );

		$this->act_as( 'subscriber' );
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertNull( $response->get_data()['estimate'] );
	}

	public function test_top_content_only_lists_its_own_post_types() {
		self::factory()->post->create( [
			'post_type' => Audiences\POST_TYPE,
			'post_status' => 'publish',
			'post_content' => 'Not top content.',
		] );

		$filter = new API\Filter();
		$filter->type = Audiences\POST_TYPE;
		$data = API\get_top_data( time() - HOUR_IN_SECONDS, time(), $filter );

		$this->assertSame( [], $data['posts'] );
	}

	public function test_top_content_leaves_out_password_protected_content() {
		$open_id = self::factory()->post->create( [ 'post_content' => 'Open copy.' ] );
		$locked_id = self::factory()->post->create( [
			'post_content' => 'Locked copy.',
			'post_password' => 'hunter2',
		] );

		$filter = new API\Filter();
		$filter->include = [ $open_id, $locked_id ];
		$data = API\get_top_data( time() - HOUR_IN_SECONDS, time(), $filter );
		$content = wp_list_pluck( $data['posts'], 'rawContent', 'id' );

		$this->assertSame( 'Open copy.', $content[ $open_id ] );
		$this->assertSame( '', $content[ $locked_id ] );
	}

	public function test_experiments_hide_posts_the_user_cannot_read() {
		$admin_id = $this->act_as( 'administrator' );
		$post_id = self::factory()->post->create( [
			'post_title' => 'Unannounced plan',
			'post_status' => 'private',
			'post_author' => $admin_id,
		] );

		// Experiments keep their own copy of the post title and its variants.
		$experiment = new Experiment();
		$experiment->set_subject_post_id( $post_id );
		$experiment->set_test_id( 'titles' );
		$experiment->set_type( Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_RUNNING );
		$experiment->set_title( 'Unannounced plan' );
		$experiment->set_variants_snapshot( [ 'Unannounced plan', 'Unannounced plan, reworded' ] );
		$experiment->save();

		$request = new WP_REST_Request( 'GET', '/accelerate/v1/experiments/' . $experiment->get_id() );
		$request->set_param( 'id', $experiment->get_id() );

		$this->assertSame( 'Unannounced plan', Experiments_API\format_experiment_for_ui( $experiment )['title'] );
		$this->assertSame( 'Unannounced plan', Experiments_API\get_experiment( $request )->get_data()['subject_post_title'] );

		$this->act_as( 'contributor' );
		$this->assertStringNotContainsString( 'Unannounced plan', wp_json_encode( Experiments_API\format_experiment_for_ui( $experiment ) ) );
		$single = Experiments_API\get_experiment( $request );
		$this->assertWPError( $single );
		$this->assertSame( 'rest_forbidden', $single->get_error_code() );

		$list_request = new WP_REST_Request( 'GET', '/accelerate/v1/experiments' );
		$list_request->set_param( 'search', 'Unannounced plan' );
		$list_request->set_param( 'page', 1 );
		$list_request->set_param( 'per_page', 20 );
		$list = Experiments_API\get_experiments( $list_request );
		$this->assertSame( [], $list->get_data(), 'Searching a private title must not reveal a matching row.' );
		$this->assertSame( 0, (int) $list->get_headers()['X-WP-Total'] );

		// Deleting the post must not open up the copies the experiment keeps.
		wp_delete_post( $post_id, true );
		$this->assertStringNotContainsString( 'Unannounced plan', wp_json_encode( Experiments_API\format_experiment_for_ui( $experiment ) ) );
		$this->assertWPError( Experiments_API\get_experiment( $request ) );

		$this->act_as( 'editor' );
		$this->assertSame( 'Unannounced plan', Experiments_API\format_experiment_for_ui( $experiment )['title'] );
	}

	public function test_block_relationships_leave_out_private_posts_of_others() {
		// The global blocks feature is not bootstrapped in the test environment.
		Connections\bootstrap();
		Connections\register_relationship_taxonomy();

		$admin_id = $this->act_as( 'administrator' );
		$block_id = self::factory()->post->create( [
			'post_type' => 'wp_block',
			'post_status' => 'publish',
			'post_content' => '<!-- wp:paragraph --><p>Shared</p><!-- /wp:paragraph -->',
		] );
		$content = sprintf( '<!-- wp:block {"ref":%d} /-->', $block_id );
		$ids = [];
		foreach ( [ 'publish', 'private' ] as $status ) {
			$ids[ $status ] = self::factory()->post->create( [
				'post_status' => $status,
				'post_author' => $admin_id,
			] );
			wp_update_post( [
				'ID' => $ids[ $status ],
				'post_content' => $content,
			] );
		}

		$endpoint = new Relationships\REST_Endpoint();
		$request = new WP_REST_Request( 'GET', '/altis-global-blocks/v1/relationships' );
		$request->set_param( 'block_id', $block_id );
		$request->set_param( 'page', 1 );

		$listed = wp_list_pluck( $endpoint->get_items( $request )->get_data(), 'id' );
		$this->assertEqualsCanonicalizing( array_values( $ids ), $listed );

		$this->act_as( 'contributor' );
		$listed = wp_list_pluck( $endpoint->get_items( $request )->get_data(), 'id' );
		$this->assertSame( [ $ids['publish'] ], $listed );
	}
}
