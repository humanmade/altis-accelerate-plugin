<?php
/**
 * Tests for experiment provenance — annotations['source'] convention.
 *
 * Covers:
 *  - format_experiment_for_ui() returns `source` defaulting to 'manual'.
 *  - `source` reflects an annotation explicitly set to 'ai'.
 *  - Executing add-variant with annotations merges into existing annotations
 *    rather than replacing (keep-wins and source-overwrite semantics).
 *
 * @package altis-accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Execution;
use Altis\Accelerate\Experiments;
use Altis\Accelerate\Experiments\Experiment;
use Altis\Accelerate\Experiments\REST_API;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/helpers.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/variants.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/execution.php';
require_once dirname( __DIR__, 2 ) . '/inc/experiments/rest_api/namespace.php';

class ExperimentProvenanceTest extends WP_UnitTestCase {

	public function set_up() : void {
		parent::set_up();
		wp_set_current_user( 1 );
		Experiments\flush_experiment_resolver_cache();
	}

	public function tear_down() : void {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->query( "DELETE FROM `{$table}`" );
		parent::tear_down();
	}

	/**
	 * Create a standard wp_block for building experiments on.
	 */
	protected function make_block( string $content = '<!-- wp:paragraph --><p>Original</p><!-- /wp:paragraph -->' ) : int {
		return self::factory()->post->create( [
			'post_type'    => 'wp_block',
			'post_title'   => 'Provenance Test Block',
			'post_content' => $content,
		] );
	}

	/**
	 * format_experiment_for_ui() must include `source` defaulting to 'manual'
	 * when no annotation is present.
	 */
	public function test_format_experiment_for_ui_source_defaults_to_manual() : void {
		$block_id = $this->make_block();

		Execution\execute_create_ab_test( [
			'block_id' => $block_id,
			'variants' => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>B</p><!-- /wp:paragraph -->' ],
			],
		] );

		$experiment = Experiment::get_active_for_post( $block_id, 'block' );
		$this->assertNotNull( $experiment );

		$formatted = REST_API\format_experiment_for_ui( $experiment );

		$this->assertArrayHasKey( 'source', $formatted );
		$this->assertSame( 'manual', $formatted['source'] );
		$this->assertArrayHasKey( 'annotations', $formatted );
		$this->assertIsArray( $formatted['annotations'] );
	}

	/**
	 * format_experiment_for_ui() must reflect the stored source annotation.
	 */
	public function test_format_experiment_for_ui_source_reflects_annotation() : void {
		$block_id = $this->make_block();

		Execution\execute_create_ab_test( [
			'block_id'    => $block_id,
			'annotations' => [ 'source' => 'ai' ],
			'variants'    => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>B</p><!-- /wp:paragraph -->' ],
			],
		] );

		Experiments\flush_experiment_resolver_cache();
		$experiment = Experiment::get_active_for_post( $block_id, 'block' );
		$this->assertNotNull( $experiment );

		$formatted = REST_API\format_experiment_for_ui( $experiment );

		$this->assertSame( 'ai', $formatted['source'] );
	}

	/**
	 * execute_add_variant() with annotations must merge into existing annotations
	 * rather than replacing them entirely:
	 *   - pre-existing key ('keep') must survive.
	 *   - overlapping key ('source') must take the new value.
	 */
	public function test_add_variant_annotations_merge_not_replace() : void {
		$block_id = $this->make_block();

		// Create experiment with initial annotations.
		Execution\execute_create_ab_test( [
			'block_id'    => $block_id,
			'annotations' => [ 'source' => 'ai', 'keep' => 'yes' ],
			'variants'    => [
				[ 'title' => 'Control', 'content' => '<!-- wp:paragraph --><p>A</p><!-- /wp:paragraph -->' ],
				[ 'title' => 'Variant B', 'content' => '<!-- wp:paragraph --><p>B</p><!-- /wp:paragraph -->' ],
			],
		] );

		Experiments\flush_experiment_resolver_cache();

		// Add a new variant and pass only a source override in annotations.
		$result = Execution\execute_add_variant( [
			'block_id'    => $block_id,
			'content'     => '<!-- wp:paragraph --><p>C</p><!-- /wp:paragraph -->',
			'annotations' => [ 'source' => 'autopilot' ],
		] );

		$this->assertIsArray( $result );
		$this->assertTrue( $result['success'] );

		Experiments\flush_experiment_resolver_cache();
		$experiment = Experiment::get_active_for_post( $block_id, 'block' );
		$this->assertNotNull( $experiment );

		$annotations = $experiment->get_annotations();

		// Pre-existing key must survive (merge, not replace).
		$this->assertArrayHasKey( 'keep', $annotations );
		$this->assertSame( 'yes', $annotations['keep'] );

		// Overlapping key must take the new value.
		$this->assertSame( 'autopilot', $annotations['source'] );
	}
}
