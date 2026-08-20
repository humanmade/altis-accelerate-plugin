<?php
/**
 * Tests for the Blueprints model + REST API.
 *
 * @package Altis\Accelerate\Blueprints
 */

namespace Altis\Accelerate\Blueprints;

use Altis\Accelerate\Audiences;
use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTestCase;

class BlueprintTest extends WP_UnitTestCase {

	/**
	 * Ensure the blueprints table exists before each test.
	 */
	public function set_up() {
		parent::set_up();
		Blueprint::ensure_table();

		// Audience validation resolves variant audience IDs against the real
		// post type, which the skipped main bootstrap never registers here.
		// Registered directly (extended-cpts isn't loaded in the test install)
		// with the same capability setup as Audiences\register_post_type().
		register_post_type( Audiences\POST_TYPE, [
			'public'          => false,
			'capability_type' => [ 'audience', 'audiences' ],
			'map_meta_cap'    => true,
		] );

		// The main bootstrap() bails at its get_config() guard in the
		// unconfigured test install, so Blueprints\setup() — and the
		// rest_api_init hook it adds — never runs. Register the routes against
		// a fresh REST server explicitly so the REST tests exercise them
		// (mirrors how the test bootstrap calls ensure_table() directly).
		add_action( 'rest_api_init', __NAMESPACE__ . '\\register_rest_routes' );

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		do_action( 'rest_api_init', $wp_rest_server );
	}

	/**
	 * Clean up blueprint rows after each test.
	 */
	public function tear_down() {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_blueprints';
		// DELETE (DML) not TRUNCATE (DDL) — TRUNCATE auto-commits and breaks
		// WP_UnitTestCase transaction rollback.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		parent::tear_down();
	}

	/**
	 * The table is created with the expected columns.
	 */
	public function test_table_creation() {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_blueprints';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		$this->assertEquals( $table, $result, 'Blueprints table should exist' );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$columns = $wpdb->get_col( "DESCRIBE `{$table}`" );
		foreach ( [ 'id', 'title', 'type', 'status', 'goal', 'variants', 'created_at', 'updated_at' ] as $column ) {
			$this->assertContains( $column, $columns, "Column {$column} should exist" );
		}
	}

	/**
	 * Model create / read / update / delete round-trips, including JSON variants.
	 */
	public function test_model_crud() {
		$blueprint = new Blueprint();
		$blueprint->set_title( 'Regional content' );
		$blueprint->set_type( Blueprint::TYPE_PERSONALIZATION );
		$blueprint->set_status( Blueprint::STATUS_PUBLISHED );
		$blueprint->set_variants( [
			[ 'title' => 'Default', 'audience' => 0, 'fallback' => true, 'percentage' => null ],
			[ 'title' => 'UK', 'audience' => 123, 'fallback' => false, 'percentage' => null ],
		] );

		$this->assertTrue( $blueprint->save() );
		$id = $blueprint->get_id();
		$this->assertIsInt( $id );

		$fetched = Blueprint::get( $id );
		$this->assertInstanceOf( Blueprint::class, $fetched );
		$this->assertSame( 'Regional content', $fetched->get_title() );
		$this->assertSame( Blueprint::STATUS_PUBLISHED, $fetched->get_status() );

		$variants = $fetched->get_variants();
		$this->assertCount( 2, $variants );
		$this->assertTrue( $variants[0]['fallback'] );
		$this->assertSame( 123, $variants[1]['audience'] );

		// Update.
		$fetched->set_title( 'Regional content v2' );
		$this->assertTrue( $fetched->save() );
		$this->assertSame( 'Regional content v2', Blueprint::get( $id )->get_title() );

		// Delete.
		$this->assertTrue( $fetched->delete() );
		$this->assertNull( Blueprint::get( $id ) );
	}

	/**
	 * get_published() returns only published blueprints.
	 */
	public function test_get_published_filters_by_status() {
		$published = new Blueprint();
		$published->set_title( 'Live' );
		$published->set_status( Blueprint::STATUS_PUBLISHED );
		$published->set_variants( [ [ 'title' => 'Default', 'fallback' => true ] ] );
		$published->save();

		$draft = new Blueprint();
		$draft->set_title( 'WIP' );
		$draft->set_status( Blueprint::STATUS_DRAFT );
		$draft->set_variants( [ [ 'title' => 'Default', 'fallback' => true ] ] );
		$draft->save();

		$results = Blueprint::get_published();
		$this->assertCount( 1, $results );
		$this->assertSame( 'Live', $results[0]->get_title() );
	}

	/**
	 * Create an audience post to reference from blueprint variants.
	 */
	private function create_audience() : int {
		return self::factory()->post->create( [
			'post_type'   => 'audience',
			'post_status' => 'publish',
			'post_title'  => 'Test audience',
		] );
	}

	/**
	 * REST create forces index 0 to be the fallback with no audience.
	 */
	public function test_rest_create_normalizes_fallback() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$audience = $this->create_audience();

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'    => 'Geo',
			'type'     => 'personalization',
			'status'   => 'published',
			'variants' => [
				// Sent as a non-fallback with an audience — must be normalized.
				[ 'title' => 'Wrong', 'audience' => $audience, 'fallback' => false ],
				[ 'title' => 'UK', 'audience' => $audience, 'fallback' => false ],
			],
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 201, $response->get_status() );

		$data = $response->get_data();
		$this->assertTrue( $data['variants'][0]['fallback'], 'Index 0 must be the fallback' );
		$this->assertSame( 0, $data['variants'][0]['audience'], 'Fallback must not target an audience' );
		$this->assertSame( $audience, $data['variants'][1]['audience'] );
	}

	/**
	 * Fallback flags on later variants are dropped — only index 0 is ever the
	 * fallback, so the apply flow never has to silently discard duplicates.
	 */
	public function test_rest_create_drops_extra_fallbacks() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$audience = $this->create_audience();

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'    => 'Geo',
			'status'   => 'published',
			'variants' => [
				[ 'title' => 'Default', 'fallback' => true ],
				[ 'title' => 'UK', 'audience' => $audience, 'fallback' => true ],
			],
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 201, $response->get_status() );

		$data = $response->get_data();
		$this->assertFalse( $data['variants'][1]['fallback'], 'Only index 0 may be the fallback' );
		$this->assertSame( $audience, $data['variants'][1]['audience'], 'Audience must survive normalization' );
	}

	/**
	 * Publishing requires a title.
	 */
	public function test_rest_publish_requires_title() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$audience = $this->create_audience();

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'    => '',
			'status'   => 'published',
			'variants' => [
				[ 'title' => 'Default', 'fallback' => true ],
				[ 'title' => 'UK', 'audience' => $audience ],
			],
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'accelerate.blueprints.missing_title', $response->get_data()['code'] );
	}

	/**
	 * Publishing requires a default plus at least one audience variant.
	 */
	public function test_rest_publish_requires_two_variants() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'    => 'Geo',
			'status'   => 'published',
			'variants' => [
				[ 'title' => 'Default', 'fallback' => true ],
			],
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'accelerate.blueprints.missing_variants', $response->get_data()['code'] );
	}

	/**
	 * Publishing requires every non-fallback variant to have an audience.
	 */
	public function test_rest_publish_requires_variant_audiences() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'    => 'Geo',
			'status'   => 'published',
			'variants' => [
				[ 'title' => 'Default', 'fallback' => true ],
				[ 'title' => 'UK', 'audience' => 0 ],
			],
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'accelerate.blueprints.missing_audience', $response->get_data()['code'] );
	}

	/**
	 * Audience references must resolve to an existing audience post — for
	 * drafts too, not just published blueprints.
	 */
	public function test_rest_rejects_nonexistent_audience() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'    => 'Geo',
			'status'   => 'draft',
			'variants' => [
				[ 'title' => 'Default', 'fallback' => true ],
				[ 'title' => 'UK', 'audience' => 999999 ],
			],
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'accelerate.blueprints.invalid_audience', $response->get_data()['code'] );
	}

	/**
	 * A post of another type is not a valid audience reference.
	 */
	public function test_rest_rejects_wrong_post_type_audience() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$post = self::factory()->post->create( [ 'post_status' => 'publish' ] );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'    => 'Geo',
			'status'   => 'published',
			'variants' => [
				[ 'title' => 'Default', 'fallback' => true ],
				[ 'title' => 'UK', 'audience' => $post ],
			],
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'accelerate.blueprints.invalid_audience', $response->get_data()['code'] );
	}

	/**
	 * Incomplete drafts save fine — completeness is only enforced to publish.
	 */
	public function test_rest_draft_allows_partial_data() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title'  => '',
			'status' => 'draft',
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 201, $response->get_status() );
	}

	/**
	 * The abtest type is reserved but not accepted over REST yet.
	 */
	public function test_rest_rejects_abtest_type() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [
			'title' => 'AB',
			'type'  => 'abtest',
		] );

		$response = rest_do_request( $request );
		$this->assertSame( 400, $response->get_status() );
	}

	/**
	 * REST mutating routes require the edit_posts capability.
	 */
	public function test_rest_create_requires_permission() {
		wp_set_current_user( 0 );

		$request = new WP_REST_Request( 'POST', '/accelerate/v1/blueprints' );
		$request->set_body_params( [ 'title' => 'Nope' ] );

		$response = rest_do_request( $request );
		$this->assertSame( 401, $response->get_status() );
	}

	/**
	 * REST list returns created blueprints.
	 */
	public function test_rest_list() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$blueprint = new Blueprint();
		$blueprint->set_title( 'Listed' );
		$blueprint->set_status( Blueprint::STATUS_PUBLISHED );
		$blueprint->set_variants( [ [ 'title' => 'Default', 'fallback' => true ] ] );
		$blueprint->save();

		$response = rest_do_request( new WP_REST_Request( 'GET', '/accelerate/v1/blueprints' ) );
		$this->assertSame( 200, $response->get_status() );

		$data = $response->get_data();
		$this->assertIsArray( $data );
		$this->assertCount( 1, $data );
		$this->assertSame( 'Listed', $data[0]['title'] );
	}
}
