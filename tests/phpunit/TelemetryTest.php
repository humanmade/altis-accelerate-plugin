<?php

namespace Altis\Accelerate\Telemetry;

use WP_UnitTestCase;

class TelemetryTest extends WP_UnitTestCase {

	public function tear_down() {
		parent::tear_down();
		delete_option( 'accelerate_telemetry_enabled' );
	}

	public function test_get_posthog_api_key_returns_constant() {
		$key = get_posthog_api_key();
		$this->assertEquals( POSTHOG_API_KEY, $key );
	}

	public function test_get_normalized_domain_strips_www() {
		update_option( 'siteurl', 'https://www.example.com' );
		$domain = get_normalized_domain();
		$this->assertStringNotContainsString( 'www.', $domain );
		$this->assertStringContainsString( 'example.com', $domain );
	}

	public function test_get_normalized_domain_strips_protocol() {
		update_option( 'siteurl', 'https://example.com' );
		$domain = get_normalized_domain();
		$this->assertStringNotContainsString( 'https://', $domain );
		$this->assertStringNotContainsString( 'http://', $domain );
	}

	public function test_get_normalized_domain_preserves_subdomains() {
		update_option( 'siteurl', 'https://staging.example.com' );
		$domain = get_normalized_domain();
		$this->assertEquals( 'staging.example.com', $domain );
	}

	public function test_is_localhost_detects_localhost_variants() {
		$this->assertTrue( is_localhost( 'localhost' ) );
		$this->assertTrue( is_localhost( '127.0.0.1' ) );
		$this->assertTrue( is_localhost( '::1' ) );
		$this->assertTrue( is_localhost( 'mysite.local' ) );
		$this->assertTrue( is_localhost( 'mysite.test' ) );
		$this->assertTrue( is_localhost( 'mysite.ddev.site' ) );
		$this->assertTrue( is_localhost( 'mysite.lndo.site' ) );
	}

	public function test_is_localhost_rejects_real_domains() {
		$this->assertFalse( is_localhost( 'example.com' ) );
		$this->assertFalse( is_localhost( 'staging.example.com' ) );
		$this->assertFalse( is_localhost( 'app.accelerateplugin.com' ) );
	}

	public function test_get_site_id_returns_sha256() {
		$id = get_site_id();
		$this->assertEquals( 64, strlen( $id ), 'Site ID should be a 64-char SHA-256 hash' );
		$this->assertMatchesRegularExpression( '/^[a-f0-9]{64}$/', $id );
	}

	public function test_get_site_id_is_deterministic() {
		$id1 = get_site_id();
		$id2 = get_site_id();
		$this->assertEquals( $id1, $id2 );
	}

	public function test_get_site_traits_includes_required_keys() {
		$traits = get_site_traits();
		$required = [
			'domain',
			'site_name',
			'environment',
			'multisite',
			'plugin_version',
			'wordpress_version',
			'php_version',
			'locale',
			'is_internal',
			'is_connected',
		];
		foreach ( $required as $key ) {
			$this->assertArrayHasKey( $key, $traits, "Traits should include '$key'" );
		}
	}

	public function test_is_site_opted_in_returns_null_when_never_asked() {
		delete_option( 'accelerate_telemetry_enabled' );
		// Also ensure no user meta exists.
		global $wpdb;
		$wpdb->delete( $wpdb->usermeta, [ 'meta_key' => META_OPT_IN ] );

		$result = is_site_opted_in();
		$this->assertNull( $result );
	}

	public function test_is_site_opted_in_returns_true_after_opt_in() {
		update_option( 'accelerate_telemetry_enabled', true );
		$this->assertTrue( is_site_opted_in() );
	}

	public function test_is_site_opted_in_returns_false_after_opt_out() {
		// Must create option first — WP skips update_option(key, false) when option doesn't exist.
		update_option( 'accelerate_telemetry_enabled', true );
		update_option( 'accelerate_telemetry_enabled', false );
		$this->assertFalse( is_site_opted_in() );
	}

	public function test_get_site_details_returns_expected_shape() {
		delete_option( 'accelerate_telemetry_enabled' );
		$details = get_site_details();

		$this->assertArrayHasKey( 'id', $details );
		$this->assertArrayHasKey( 'opt_in', $details );
		$this->assertFalse( $details['opt_in'] );
	}

	public function test_get_site_details_includes_traits_when_opted_in() {
		update_option( 'accelerate_telemetry_enabled', true );
		$user_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		wp_set_current_user( $user_id );

		$details = get_site_details();

		$this->assertTrue( $details['opt_in'] );
		$this->assertArrayHasKey( 'traits', $details );
		$this->assertArrayHasKey( 'domain', $details['traits'] );
	}

	public function test_initialize_returns_false_when_not_logged_in() {
		wp_set_current_user( 0 );
		$this->assertFalse( initialize() );
	}

	public function test_posthog_constants_are_defined() {
		$this->assertNotEmpty( POSTHOG_API_KEY );
		$this->assertStringStartsWith( 'phc_', POSTHOG_API_KEY );
		$this->assertEquals( 'https://eu.i.posthog.com', POSTHOG_HOST );
	}
}
