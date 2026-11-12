<?php
/**
 * One capability gates the analytics data, and sites can take it away per role.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities;
use Altis\Accelerate\API;
use Altis\Accelerate\Audiences;
use Altis\Accelerate\Blocks;
use Altis\Accelerate\Experiments;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';

class AnalyticsCapabilityTest extends WP_UnitTestCase {

	public function tear_down() {
		get_role( 'author' )->remove_cap( ANALYTICS_CAPABILITY );
		parent::tear_down();
	}

	/**
	 * Run every analytics data check as a new user with the given role.
	 *
	 * @param string $role The role name.
	 * @param bool|null $user_grant Grant or deny the capability on the user itself.
	 * @return bool[] The result of each check.
	 */
	private function analytics_checks_as( string $role, ?bool $user_grant = null ) : array {
		$user = self::factory()->user->create_and_get( [ 'role' => $role ] );
		if ( $user_grant !== null ) {
			$user->add_cap( ANALYTICS_CAPABILITY, $user_grant );
		}
		wp_set_current_user( $user->ID );

		return [
			'analytics routes' => API\check_analytics_permission(),
			'analytics abilities' => Abilities\can_view_analytics(),
			'audience estimates' => Audiences\REST_API\check_read_permission(),
			'block views' => Blocks\REST_API\check_views_permission(),
		];
	}

	public function test_anyone_who_can_edit_posts_has_it_by_default() {
		$this->assertSame( [ true ], array_values( array_unique( $this->analytics_checks_as( 'contributor' ) ) ) );
		$this->assertSame( [ false ], array_values( array_unique( $this->analytics_checks_as( 'subscriber' ) ) ) );
	}

	public function test_a_role_can_be_denied_without_losing_experiments() {
		get_role( 'author' )->add_cap( ANALYTICS_CAPABILITY, false );

		$this->assertSame( [ false ], array_values( array_unique( $this->analytics_checks_as( 'author' ) ) ) );
		$this->assertTrue( Experiments\REST_API\can_view_experiments() );

		// Other roles are unaffected.
		$this->assertSame( [ true ], array_values( array_unique( $this->analytics_checks_as( 'editor' ) ) ) );
	}

	public function test_audience_field_data_needs_it_as_well_as_audience_access() {
		// The audiences feature is not bootstrapped in the test environment, and
		// other tests leave a bare stand-in for the post type behind.
		require_once dirname( __DIR__, 2 ) . '/lib/johnbillion/extended-cpts/extended-cpts.php';
		if ( post_type_exists( Audiences\POST_TYPE ) ) {
			unregister_post_type( Audiences\POST_TYPE );
		}
		Audiences\register_post_type();
		add_filter( 'user_has_cap', 'Altis\\Accelerate\\Audiences\\maybe_grant_caps', 1 );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$this->assertTrue( Audiences\REST_API\check_field_data_permission() );

		// An editor can still edit audiences, but not pull visitor data for them.
		$denied = self::factory()->user->create_and_get( [ 'role' => 'editor' ] );
		$denied->add_cap( ANALYTICS_CAPABILITY, false );
		wp_set_current_user( $denied->ID );
		$this->assertTrue( Audiences\REST_API\check_edit_permission() );
		$this->assertFalse( Audiences\REST_API\check_field_data_permission() );

		// The capability alone is not enough either.
		$this->analytics_checks_as( 'subscriber', true );
		$this->assertFalse( Audiences\REST_API\check_field_data_permission() );
	}

	public function test_it_can_be_granted_on_its_own() {
		$this->assertSame( [ true ], array_values( array_unique( $this->analytics_checks_as( 'subscriber', true ) ) ) );
	}
}
