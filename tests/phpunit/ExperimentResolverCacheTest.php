<?php
/**
 * Regression tests for the experiment resolver's per-request cache and the
 * opt-out of SQL_CALC_FOUND_ROWS on single-row lookups.
 *
 * The `ab_tests` REST field resolves the experiment for every post in a list
 * response (get_test_mode_for_post / get_test_phase_for_post both call
 * resolve_experiment_for_test), so a post with no experiment used to re-run
 * two SQL_CALC_FOUND_ROWS lookups on every call. On GET /wp/v2/blocks
 * ?context=edit&per_page=100 that became a per-post N+1. These tests pin:
 *
 *  - a post with no experiment is queried once per request, then cached
 *  - a failed query is never cached as a definitive miss — transient DB
 *    errors must retry on the next call
 *  - a real experiment still resolves (hit path unaffected)
 *  - a completed-only row still resolves for any-status callers and is not
 *    mistaken for a definitive miss; active-only callers get null without
 *    re-querying once "no active row" is known
 *  - has_completed_experiment_for_post() requires an actual row (regression:
 *    `! empty()` on a QueryResults object is always true)
 *  - single-row lookups no longer emit SQL_CALC_FOUND_ROWS nor the
 *    SELECT FOUND_ROWS() follow-up, while paginated queries keep both;
 *    combining no_found_rows with pagination triggers _doing_it_wrong()
 *
 * @package altis-accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Experiments;
use Altis\Accelerate\Experiments\Experiment;
use WP_UnitTestCase;

class ExperimentResolverCacheTest extends WP_UnitTestCase {

	public function set_up() : void {
		parent::set_up();
		wp_set_current_user( 1 );
		Experiments\flush_experiment_resolver_cache();
	}

	public function tear_down() : void {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		// The experiments custom table is not covered by the WP transaction
		// rollback, so clear it between tests. Use DELETE (DML) not TRUNCATE.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name cannot be a placeholder.
		$wpdb->query( "DELETE FROM `{$table}`" );
		parent::tear_down();
	}

	/**
	 * Create a standard wp_block to build experiments on.
	 */
	private function make_block() : int {
		return self::factory()->post->create( [
			'post_type'   => 'wp_block',
			'post_status' => 'publish',
		] );
	}

	/**
	 * Capture every SQL statement against the experiments table while running
	 * $callback. Uses the `query` filter, so it works without SAVEQUERIES.
	 *
	 * Also captures SELECT FOUND_ROWS() statements — they don't name the table,
	 * but Foundry emits one per query unless Experiment_Query::get_results()
	 * skips it for 'no_found_rows', and the counts below must see them.
	 *
	 * @param callable $callback Work to run while capturing.
	 * @return string[] Captured SQL touching the experiments table or FOUND_ROWS().
	 */
	private function capture_experiment_sql( callable $callback ) : array {
		global $wpdb;
		$table = $wpdb->prefix . 'accelerate_experiments';
		$captured = [];

		$spy = function ( $sql ) use ( &$captured, $table ) {
			if ( strpos( $sql, $table ) !== false || stripos( $sql, 'FOUND_ROWS()' ) !== false ) {
				$captured[] = $sql;
			}
			return $sql;
		};

		add_filter( 'query', $spy );
		$callback();
		remove_filter( 'query', $spy );

		return $captured;
	}

	/**
	 * A post with no experiment must be queried once, then served from cache.
	 */
	public function test_missing_experiment_is_cached_within_request() : void {
		$block_id = $this->make_block();

		$sql = $this->capture_experiment_sql( function () use ( $block_id ) {
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id ) );

			// Repeat calls (the REST field resolves twice: mode + phase).
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id ) );
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id ) );
		} );

		// The first resolve does two lookups (active, then any-status fallback);
		// the two repeat calls must add nothing. Both lookups use no_found_rows,
		// so no FOUND_ROWS() follow-ups may appear either — the capture would
		// count them.
		$this->assertSame(
			2,
			count( $sql ),
			'Expected exactly two experiment queries for three lookups of an experiment-less post.'
		);
	}

	/**
	 * An existing active experiment still resolves.
	 */
	public function test_existing_experiment_resolves() : void {
		$block_id = $this->make_block();

		$experiment = Experiment::get_or_create_for_post( $block_id, 'block', Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_RUNNING );
		$experiment->save();
		Experiments\flush_experiment_resolver_cache();

		$resolved = Experiments\resolve_experiment_for_test( 'block', $block_id );

		$this->assertInstanceOf( Experiment::class, $resolved );
		$this->assertSame( $experiment->get_id(), $resolved->get_id() );
	}

	/**
	 * A completed-only row resolves for any-status callers and is not cached as
	 * a definitive miss; active-only callers still get null.
	 */
	public function test_completed_row_is_not_treated_as_a_miss() : void {
		$block_id = $this->make_block();

		$experiment = Experiment::get_or_create_for_post( $block_id, 'block', Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_COMPLETED );
		$experiment->save();
		Experiments\flush_experiment_resolver_cache();

		$any_status = Experiments\resolve_experiment_for_test( 'block', $block_id );
		$this->assertInstanceOf( Experiment::class, $any_status );
		$this->assertSame( Experiment::STATUS_COMPLETED, $any_status->get_status() );

		$active_only = Experiments\resolve_experiment_for_test( 'block', $block_id, true );
		$this->assertNull( $active_only );
	}

	/**
	 * Single-row lookups omit SQL_CALC_FOUND_ROWS and the SELECT FOUND_ROWS()
	 * follow-up; paginated queries keep both.
	 */
	public function test_single_row_lookup_skips_found_rows_calc() : void {
		$block_id = $this->make_block();

		$single = $this->capture_experiment_sql( function () use ( $block_id ) {
			Experiment::get_active_for_post( $block_id, 'block' );
		} );
		$this->assertNotEmpty( $single, 'Expected a query against the experiments table.' );
		// Covers both the SQL_CALC_FOUND_ROWS modifier and the FOUND_ROWS()
		// follow-up statement.
		$this->assertStringNotContainsString( 'FOUND_ROWS', implode( "\n", $single ) );

		$paginated = $this->capture_experiment_sql( function () use ( $block_id ) {
			Experiment::query(
				[ 'subject_post_id' => $block_id, 'test_id' => 'block' ],
				[ 'per_page' => 100 ]
			)->get_results();
		} );
		$paginated_sql = implode( "\n", $paginated );
		$this->assertStringContainsString( 'SQL_CALC_FOUND_ROWS', $paginated_sql );
		$this->assertStringContainsString(
			'FOUND_ROWS()',
			$paginated_sql,
			'Paginated queries must keep the SELECT FOUND_ROWS() follow-up so get_total_available() stays accurate.'
		);
	}

	/**
	 * A failed query must not be cached as a definitive miss.
	 */
	public function test_query_error_is_not_cached_as_miss() : void {
		global $wpdb;
		$block_id = $this->make_block();

		$experiment = Experiment::get_or_create_for_post( $block_id, 'block', Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_RUNNING );
		$experiment->save();
		Experiments\flush_experiment_resolver_cache();

		// Break every experiments-table query for the duration of one resolve.
		$table = $wpdb->prefix . 'accelerate_experiments';
		$breaker = function ( $sql ) use ( $table ) {
			if ( strpos( $sql, $table ) !== false ) {
				return 'SELECT * FROM `nonexistent_table_for_error_test`';
			}
			return $sql;
		};

		add_filter( 'query', $breaker );
		$suppress = $wpdb->suppress_errors( true );
		$during_error = Experiments\resolve_experiment_for_test( 'block', $block_id );
		$wpdb->suppress_errors( $suppress );
		remove_filter( 'query', $breaker );

		$this->assertNull( $during_error, 'A failed query should resolve to null.' );
		$this->assertArrayNotHasKey(
			"{$block_id}:block",
			$GLOBALS['_altis_experiment_resolver_cache'],
			'A failed query must not poison the cache with a definitive miss.'
		);

		// With the DB healthy again, the experiment must resolve.
		$recovered = Experiments\resolve_experiment_for_test( 'block', $block_id );
		$this->assertInstanceOf( Experiment::class, $recovered );
		$this->assertSame( $experiment->get_id(), $recovered->get_id() );
	}

	/**
	 * has_completed_experiment_for_post() reflects actual row existence —
	 * regression test for `! empty()` on a (always-truthy) QueryResults object.
	 */
	public function test_has_completed_experiment_requires_a_row() : void {
		$block_id = $this->make_block();

		$this->assertFalse(
			Experiments\has_completed_experiment_for_post( $block_id, 'block' ),
			'No rows exist, so no completed experiment should be reported.'
		);

		$experiment = Experiment::get_or_create_for_post( $block_id, 'block', Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_RUNNING );
		$experiment->save();

		$this->assertFalse(
			Experiments\has_completed_experiment_for_post( $block_id, 'block' ),
			'A running row is not a completed row.'
		);

		$experiment->set_status( Experiment::STATUS_COMPLETED );
		$experiment->save();

		$this->assertTrue( Experiments\has_completed_experiment_for_post( $block_id, 'block' ) );
	}

	/**
	 * Active-only lookups stop re-querying once "no active row" is known —
	 * both behind a cached completed row and on a bare miss.
	 */
	public function test_no_active_outcome_is_cached_within_request() : void {
		$block_id = $this->make_block();

		$experiment = Experiment::get_or_create_for_post( $block_id, 'block', Experiment::TYPE_ABTEST );
		$experiment->set_status( Experiment::STATUS_COMPLETED );
		$experiment->save();
		Experiments\flush_experiment_resolver_cache();

		// A cold any-status resolve learns "no active row" as a byproduct (its
		// first lookup is the active query), so active-only calls after it
		// must cost nothing at all.
		$this->assertInstanceOf( Experiment::class, Experiments\resolve_experiment_for_test( 'block', $block_id ) );

		$sql = $this->capture_experiment_sql( function () use ( $block_id ) {
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id, true ) );
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id, true ) );
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id, true ) );
		} );
		$this->assertSame(
			0,
			count( $sql ),
			'Active-only lookups after a cold any-status resolve must be free.'
		);

		// When the completed row enters the cache without a resolver lookup —
		// as sync_experiment_to_table() does after completing a test — only
		// the first active-only call may query.
		Experiments\flush_experiment_resolver_cache();
		$GLOBALS['_altis_experiment_resolver_cache'][ "{$block_id}:block" ] = $resolved_completed = Experiment::find_one( [
			'subject_post_id' => $block_id,
			'test_id'         => 'block',
		] );
		$this->assertSame( Experiment::STATUS_COMPLETED, $resolved_completed->get_status() );

		$sql = $this->capture_experiment_sql( function () use ( $block_id ) {
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id, true ) );
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id, true ) );
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $block_id, true ) );
		} );
		$this->assertSame(
			1,
			count( $sql ),
			'Only the first active-only lookup behind a sync-written completed row may query.'
		);

		// Bare active-only misses (no rows at all) are also remembered.
		$empty_block = $this->make_block();
		$sql = $this->capture_experiment_sql( function () use ( $empty_block ) {
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $empty_block, true ) );
			$this->assertNull( Experiments\resolve_experiment_for_test( 'block', $empty_block, true ) );
		} );
		$this->assertSame(
			1,
			count( $sql ),
			'A definitive active-only miss must not re-query within the request.'
		);
	}

	/**
	 * Combining no_found_rows with pagination is flagged as incorrect usage.
	 */
	public function test_no_found_rows_with_pagination_is_doing_it_wrong() : void {
		$this->setExpectedIncorrectUsage( 'Altis\Accelerate\Experiments\Experiment_Query::build_query' );

		Experiment::query(
			[ 'test_id' => 'block' ],
			[
				'per_page'      => 10,
				'page'          => 2,
				'no_found_rows' => true,
			]
		)->get_results();
	}
}
