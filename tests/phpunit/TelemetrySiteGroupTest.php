<?php
/**
 * Tests for the shared 'site' group key and message enrichment added in issue #661.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate;

use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/telemetry/namespace.php';

class TelemetrySiteGroupTest extends WP_UnitTestCase {

	/**
	 * Remove all filters added during a test.
	 */
	protected array $filter_callbacks = [];

	public function tear_down() {
		foreach ( $this->filter_callbacks as [ $hook, $cb ] ) {
			remove_filter( $hook, $cb );
		}
		$this->filter_callbacks = [];
		delete_option( 'accelerate_dashboard_site_id' );
		parent::tear_down();
	}

	/**
	 * Reimplementation of the website's exact algorithm — used to assert parity.
	 */
	private function website_site_group_key( string $url ) : string {
		$host = parse_url( $url, PHP_URL_HOST );
		if ( ! $host ) {
			$host = $url;
		}
		$host = preg_replace( '#^www\.#', '', strtolower( $host ) );
		return hash( 'sha256', $host );
	}

	/**
	 * Set the site URL for the duration of the current test.
	 */
	private function set_site_url( string $url ) : void {
		update_option( 'siteurl', $url );
		update_option( 'home', $url );
	}

	// =========================================================================
	// 1. Parity across URL shapes
	// =========================================================================

	public function test_parity_bare_domain() {
		$url = 'https://example.com';
		$this->set_site_url( $url );
		$this->assertSame(
			$this->website_site_group_key( $url ),
			Telemetry\get_site_group_key()
		);
	}

	public function test_parity_www_mixed_case() {
		$url = 'https://www.Example.com/';
		$this->set_site_url( $url );
		$this->assertSame(
			$this->website_site_group_key( $url ),
			Telemetry\get_site_group_key()
		);
	}

	public function test_parity_staging_subdomain() {
		$url = 'https://staging.example.com';
		$this->set_site_url( $url );
		$this->assertSame(
			$this->website_site_group_key( $url ),
			Telemetry\get_site_group_key()
		);
	}

	public function test_parity_subdir_path_dropped() {
		// Plugin hashes host only (no path); website does the same.
		$url = 'https://example.com/subsite';
		$this->set_site_url( $url );
		$plugin_key = Telemetry\get_site_group_key();
		// Path must be dropped — result equals hash('sha256', 'example.com').
		$this->assertSame( hash( 'sha256', 'example.com' ), $plugin_key );
		// Also confirm parity with the website algorithm on the same URL.
		$this->assertSame( $this->website_site_group_key( $url ), $plugin_key );
	}

	public function test_parity_localhost() {
		$url = 'http://localhost';
		$this->set_site_url( $url );
		$plugin_key = Telemetry\get_site_group_key();
		// Localhost hashes as 'localhost' — no fun-id substitution in the group key.
		$this->assertSame( hash( 'sha256', 'localhost' ), $plugin_key );
		$this->assertSame( $this->website_site_group_key( $url ), $plugin_key );
	}

	// =========================================================================
	// 2. Known vector
	// =========================================================================

	public function test_known_vector_www_stripped() {
		$this->set_site_url( 'https://www.example.com' );
		$this->assertSame(
			hash( 'sha256', 'example.com' ),
			Telemetry\get_site_group_key()
		);
	}

	// =========================================================================
	// 3. enrich_message_with_site_group sets $groups['site']
	// =========================================================================

	public function test_enrich_sets_site_group() {
		$this->set_site_url( 'https://example.com' );
		$result = Telemetry\enrich_message_with_site_group( [ 'event' => 'x' ] );
		$this->assertSame(
			Telemetry\get_site_group_key(),
			$result['properties']['$groups']['site']
		);
	}

	// =========================================================================
	// 4. Merge preservation — caller-provided groups survive
	// =========================================================================

	public function test_enrich_preserves_existing_groups() {
		$this->set_site_url( 'https://example.com' );
		$input = [
			'event'      => 'x',
			'properties' => [
				'$groups' => [ 'other' => 'keep' ],
			],
		];
		$result = Telemetry\enrich_message_with_site_group( $input );
		$this->assertSame( 'keep', $result['properties']['$groups']['other'] );
		$this->assertSame( Telemetry\get_site_group_key(), $result['properties']['$groups']['site'] );
	}

	// =========================================================================
	// 5. dashboard_site_id present
	// =========================================================================

	public function test_dashboard_site_id_added_when_present() {
		update_option( 'accelerate_dashboard_site_id', 4242 );
		$result = Telemetry\enrich_message_with_site_group( [ 'event' => 'x' ] );
		$this->assertSame( 4242, $result['properties']['dashboard_site_id'] );
	}

	public function test_site_traits_includes_dashboard_site_id_when_present() {
		update_option( 'accelerate_dashboard_site_id', 4242 );
		$traits = Telemetry\get_site_traits();
		$this->assertArrayHasKey( 'dashboard_site_id', $traits );
		$this->assertSame( 4242, $traits['dashboard_site_id'] );
	}

	// =========================================================================
	// 6. dashboard_site_id absent
	// =========================================================================

	public function test_dashboard_site_id_absent_from_enriched_message() {
		delete_option( 'accelerate_dashboard_site_id' );
		$result = Telemetry\enrich_message_with_site_group( [ 'event' => 'x' ] );
		$this->assertArrayNotHasKey( 'dashboard_site_id', $result['properties'] );
	}

	public function test_site_traits_omits_dashboard_site_id_when_absent() {
		delete_option( 'accelerate_dashboard_site_id' );
		$traits = Telemetry\get_site_traits();
		$this->assertArrayNotHasKey( 'dashboard_site_id', $traits );
	}
}
