<?php
/**
 * Tests for the accelerate/get-site-context ability.
 *
 * Covers:
 *   - Default response has no blocks (null), has patterns array, has site.accelerate_version.
 *   - blocks:"styled" returns only blocks that have registered style variations.
 *   - blocks:"all" returns the full block list (including blocks without styles).
 *   - Deprecated include_blocks:true alias returns the full list.
 *   - Deprecated include_blocks:false/absent behaves like blocks:"none".
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Discovery;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/discovery.php';

class SiteContextTest extends WP_UnitTestCase {

	// -------------------------------------------------------------------------
	// Default call (no input) — no blocks key (null), patterns array present,
	// site.accelerate_version present.
	// -------------------------------------------------------------------------

	public function test_default_response_shape() {
		$result = Discovery\execute_get_site_context( [] );

		$this->assertIsArray( $result );

		// blocks should be null (not fetched) by default.
		$this->assertArrayHasKey( 'blocks', $result );
		$this->assertNull( $result['blocks'], 'Default call must return blocks:null (omit registry).' );

		// patterns must be an array (may be empty in test env).
		$this->assertArrayHasKey( 'patterns', $result );
		$this->assertIsArray( $result['patterns'], 'patterns must be an array.' );

		// site.accelerate_version must be present.
		$this->assertArrayHasKey( 'site', $result );
		$this->assertArrayHasKey( 'accelerate_version', $result['site'], 'site must include accelerate_version.' );
		$this->assertNotEmpty( $result['site']['accelerate_version'] );
	}

	// -------------------------------------------------------------------------
	// patterns key lists published wp_block posts as {id, title}.
	// -------------------------------------------------------------------------

	public function test_patterns_lists_published_wp_block_posts() {
		$id1 = self::factory()->post->create( [
			'post_type'   => 'wp_block',
			'post_status' => 'publish',
			'post_title'  => 'Pattern Alpha',
		] );
		$id2 = self::factory()->post->create( [
			'post_type'   => 'wp_block',
			'post_status' => 'publish',
			'post_title'  => 'Pattern Beta',
		] );
		// A draft should be excluded.
		self::factory()->post->create( [
			'post_type'   => 'wp_block',
			'post_status' => 'draft',
			'post_title'  => 'Draft Pattern',
		] );

		$result = Discovery\execute_get_site_context( [] );

		$this->assertIsArray( $result['patterns'] );

		$ids = array_column( $result['patterns'], 'id' );
		$this->assertContains( $id1, $ids, 'Published pattern Alpha must appear.' );
		$this->assertContains( $id2, $ids, 'Published pattern Beta must appear.' );

		// Each entry must have id and title only.
		foreach ( $result['patterns'] as $pattern ) {
			$this->assertArrayHasKey( 'id', $pattern );
			$this->assertArrayHasKey( 'title', $pattern );
		}

		// Draft must not appear.
		$titles = array_column( $result['patterns'], 'title' );
		$this->assertNotContains( 'Draft Pattern', $titles, 'Draft patterns must not appear.' );
	}

	// -------------------------------------------------------------------------
	// blocks:"styled" returns only blocks that have style variations.
	// -------------------------------------------------------------------------

	public function test_blocks_styled_returns_only_styled_blocks() {
		// Register a test style on a known core block.
		register_block_style( 'core/button', [
			'name'  => 'test-outline',
			'label' => 'Test Outline',
		] );

		$result = Discovery\execute_get_site_context( [ 'blocks' => 'styled' ] );

		$this->assertIsArray( $result['blocks'], 'blocks:"styled" must return an array.' );

		foreach ( $result['blocks'] as $block ) {
			$this->assertArrayHasKey( 'styles', $block, 'Every block returned by "styled" must have a styles key.' );
			$this->assertNotEmpty( $block['styles'], 'Every block returned by "styled" must have at least one style.' );
		}

		// The registered style on core/button means it must appear.
		$names = array_column( $result['blocks'], 'name' );
		$this->assertContains( 'core/button', $names, 'core/button with a registered style must appear in "styled" mode.' );

		unregister_block_style( 'core/button', 'test-outline' );
	}

	// -------------------------------------------------------------------------
	// blocks:"all" returns a non-null array that includes blocks without styles.
	// -------------------------------------------------------------------------

	public function test_blocks_all_returns_full_registry() {
		$result_all  = Discovery\execute_get_site_context( [ 'blocks' => 'all' ] );
		$result_styled = Discovery\execute_get_site_context( [ 'blocks' => 'styled' ] );

		$this->assertIsArray( $result_all['blocks'], 'blocks:"all" must return an array.' );
		$this->assertIsArray( $result_styled['blocks'], 'blocks:"styled" must return an array.' );

		// "all" must return at least as many blocks as "styled".
		$this->assertGreaterThanOrEqual(
			count( $result_styled['blocks'] ),
			count( $result_all['blocks'] ),
			'"all" must return at least as many entries as "styled".'
		);

		// "all" must include blocks without a styles key.
		$blocks_without_styles = array_filter( $result_all['blocks'], function ( $b ) {
			return empty( $b['styles'] );
		} );
		$this->assertNotEmpty(
			$blocks_without_styles,
			'"all" must include blocks that have no style variations.'
		);
	}

	// -------------------------------------------------------------------------
	// Deprecated alias: include_blocks:true behaves like blocks:"all".
	// -------------------------------------------------------------------------

	public function test_include_blocks_true_alias_returns_full_list() {
		$result_alias = Discovery\execute_get_site_context( [ 'include_blocks' => true ] );
		$result_all   = Discovery\execute_get_site_context( [ 'blocks' => 'all' ] );

		$this->assertIsArray( $result_alias['blocks'], 'include_blocks:true must return an array.' );
		$this->assertSame(
			count( $result_all['blocks'] ),
			count( $result_alias['blocks'] ),
			'include_blocks:true must return the same number of blocks as blocks:"all".'
		);
	}

	// -------------------------------------------------------------------------
	// Deprecated alias: include_blocks:false / absent behaves like blocks:"none".
	// -------------------------------------------------------------------------

	public function test_include_blocks_false_alias_returns_null_blocks() {
		$result = Discovery\execute_get_site_context( [ 'include_blocks' => false ] );
		$this->assertNull( $result['blocks'], 'include_blocks:false must yield blocks:null.' );
	}

	// -------------------------------------------------------------------------
	// blocks:"none" (explicit) — same as default.
	// -------------------------------------------------------------------------

	public function test_blocks_none_explicit_returns_null() {
		$result = Discovery\execute_get_site_context( [ 'blocks' => 'none' ] );
		$this->assertNull( $result['blocks'], 'blocks:"none" must return null.' );
	}
}
