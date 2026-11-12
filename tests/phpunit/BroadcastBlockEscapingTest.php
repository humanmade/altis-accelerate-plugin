<?php
/**
 * The broadcast block must escape its attributes when it renders.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Blocks\Broadcast;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/blocks/broadcast/register.php';

class BroadcastBlockEscapingTest extends WP_UnitTestCase {

	public function tear_down() {
		$GLOBALS['wp_query']->is_preview = false;
		parent::tear_down();
	}

	/**
	 * Render a broadcast block whose attributes try to break out of the markup.
	 *
	 * @return string The rendered block.
	 */
	private function render_with_hostile_attributes() : string {
		$block_id = self::factory()->post->create( [
			'post_type' => 'wp_block',
			'post_status' => 'publish',
			'post_content' => '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->',
		] );
		$broadcast_id = self::factory()->post->create( [
			'post_type' => 'broadcast',
			'post_status' => 'publish',
		] );
		add_post_meta( $broadcast_id, 'blocks', $block_id );

		return Broadcast\render_block( [
			'clientId' => 'abc-123" onmouseover="alert(1)',
			'className' => 'promo" onmouseover="alert(2)',
			'broadcast' => $broadcast_id,
		] );
	}

	public function test_public_render_escapes_attributes() {
		$html = $this->render_with_hostile_attributes();

		$this->assertStringContainsString( '<broadcast-block', $html );
		$this->assertStringNotContainsString( '" onmouseover="', $html );
		// The template and the element must still agree on the client ID.
		$this->assertStringContainsString( 'data-parent-id="abc-123onmouseoveralert1"', $html );
		$this->assertStringContainsString( 'client-id="abc-123onmouseoveralert1"', $html );
	}

	public function test_preview_render_escapes_attributes() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$GLOBALS['wp_query']->is_preview = true;

		$html = $this->render_with_hostile_attributes();

		$this->assertStringContainsString( 'altis-xb-preview--broadcast', $html );
		$this->assertStringNotContainsString( '" onmouseover="', $html );
		$this->assertStringContainsString( 'data-client-id="abc-123onmouseoveralert1"', $html );
	}
}
