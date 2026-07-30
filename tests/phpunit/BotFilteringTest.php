<?php

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use Altis\Accelerate\API\Remote;
use Altis\Accelerate\Blocks;
use Altis\Accelerate\Utils;
use WP_REST_Request;
use WP_UnitTestCase;

// remote.php is only pulled in by API\setup(); load it directly so the test
// does not depend on bootstrap ordering.
require_once dirname( __DIR__, 2 ) . '/inc/api/remote.php';

/**
 * Query-time bot filtering regression tests (issue #567).
 *
 * These are SQL-generation tests, not data tests: they capture the SQL passed
 * to Utils\query() via the `altis.analytics.clickhouse.request_args` filter
 * and short-circuit the HTTP request with `pre_http_request`, so no ClickHouse
 * instance is needed. This proves the bot-exclusion predicate is present (or
 * absent) in every query a function issues — including the secondary queries
 * inside multi-query functions — which an endpoint smoke check cannot.
 *
 * The predicate reads the materialized `is_bot` column, which existing
 * installations do not have until the schema migration has run — so query-time
 * filtering sits behind the `bot_filtering` feature toggle, DEFAULT OFF, and
 * when off no `is_bot` reference may reach SQL at all (it would error on a
 * schema without the column). The off-state tests assert exactly that.
 *
 * The stored-state test at the end is the exception: it evaluates the is_bot
 * materialization expression against literal maps on a live ClickHouse (pure
 * SELECT, no inserts) and skips itself when ClickHouse is unreachable.
 */
class BotFilteringTest extends WP_UnitTestCase {

	const PREDICATE = 'is_bot != true';

	/**
	 * SQL strings captured from Utils\query() during the test.
	 *
	 * @var string[]
	 */
	private $captured_sql = [];

	/**
	 * Whether to short-circuit ClickHouse HTTP requests for this test.
	 *
	 * @var bool
	 */
	private $mock_http = false;

	public function set_up() {
		parent::set_up();
		wp_cache_flush();
		$this->captured_sql = [];
		$this->mock_http = false;

		add_filter( 'altis.analytics.clickhouse.request_args', function ( $request_args, $query ) {
			$this->captured_sql[] = $query;
			return $request_args;
		}, 10, 2 );

		add_filter( 'pre_http_request', function ( $preempt, $parsed_args, $url ) {
			if ( ! $this->mock_http || strpos( $url, 'default_format=' ) === false ) {
				return $preempt;
			}
			// The `totals` return mode uses the full JSON format; everything
			// else streams JSONEachRow, where an empty body means zero rows.
			$body = strpos( $url, 'default_format=JSONEachRow' ) === false
				? '{"data":[],"totals":null}'
				: '';
			return [
				'headers' => [],
				'body' => $body,
				'response' => [
					'code' => 200,
					'message' => 'OK',
				],
				'cookies' => [],
				'filename' => null,
			];
		}, 10, 3 );
	}

	/**
	 * Enable the query-time bot filtering feature toggle (default off).
	 */
	private function enable_bot_filtering() {
		add_filter( 'altis.analytics.feature.bot_filtering', '__return_true' );
	}

	/**
	 * Captured queries against the raw analytics table (any name variant),
	 * excluding rollup-table queries which structurally cannot take the
	 * predicate.
	 *
	 * @return string[]
	 */
	private function raw_table_queries() : array {
		return array_values( array_filter( $this->captured_sql, function ( $sql ) {
			return ! preg_match( '/FROM\s+\S*analytics_(hourly|daily)/i', $sql );
		} ) );
	}

	// -------------------------------------------------------------------------
	// Helper gating: feature toggle (default off) x exclude_bots filter.
	// -------------------------------------------------------------------------

	public function test_clause_is_empty_by_default() {
		$this->assertSame( '', Utils\bot_exclusion_clause() );
	}

	public function test_clause_emits_predicate_when_feature_enabled() {
		$this->enable_bot_filtering();
		$this->assertSame( ' AND ' . self::PREDICATE, Utils\bot_exclusion_clause() );
	}

	public function test_clause_is_empty_when_exclude_bots_filter_off() {
		$this->enable_bot_filtering();
		add_filter( 'altis.analytics.exclude_bots', '__return_false' );
		$this->assertSame( '', Utils\bot_exclusion_clause() );
	}

	// -------------------------------------------------------------------------
	// get_graph_data: filtered windows run TWO raw-table queries (main graph +
	// engaged time) and both must carry the predicate when the feature is on.
	// -------------------------------------------------------------------------

	private function run_graph_data() {
		$this->mock_http = true;
		$filter = new API\Filter();
		$filter->path = '/bot-filter-test/';
		API\get_graph_data( strtotime( '-6 days' ), time(), 'P1D', $filter );
	}

	public function test_graph_data_raw_queries_include_predicate_when_enabled() {
		$this->enable_bot_filtering();
		$this->run_graph_data();
		$raw = $this->raw_table_queries();
		$this->assertCount( 2, $raw, 'Expected the main graph query and the engaged-time sub-query.' );
		foreach ( $raw as $sql ) {
			$this->assertStringContainsString( self::PREDICATE, $sql );
		}
	}

	public function test_graph_data_has_no_is_bot_reference_by_default() {
		$this->run_graph_data();
		$this->assertNotEmpty( $this->captured_sql );
		foreach ( $this->captured_sql as $sql ) {
			$this->assertStringNotContainsString( 'is_bot', $sql );
		}
	}

	public function test_graph_data_has_no_is_bot_reference_when_exclude_bots_off() {
		$this->enable_bot_filtering();
		add_filter( 'altis.analytics.exclude_bots', '__return_false' );
		$this->run_graph_data();
		$this->assertNotEmpty( $this->captured_sql );
		foreach ( $this->captured_sql as $sql ) {
			$this->assertStringNotContainsString( 'is_bot', $sql );
		}
	}

	// -------------------------------------------------------------------------
	// get_top_data: single query, predicate only when the feature is on.
	// -------------------------------------------------------------------------

	public function test_top_data_includes_predicate_when_enabled() {
		$this->enable_bot_filtering();
		$this->mock_http = true;
		API\get_top_data( strtotime( '-6 days' ), time() );
		$this->assertNotEmpty( $this->captured_sql );
		$this->assertStringContainsString( self::PREDICATE, $this->captured_sql[0] );
	}

	public function test_top_data_has_no_is_bot_reference_by_default() {
		$this->mock_http = true;
		API\get_top_data( strtotime( '-6 days' ), time() );
		$this->assertNotEmpty( $this->captured_sql );
		$this->assertStringNotContainsString( 'is_bot', $this->captured_sql[0] );
	}

	// -------------------------------------------------------------------------
	// get_remote_stats: three independent queries in one function. The
	// analytics_daily totals query has no is_bot column and must NOT get the
	// predicate; top pages and top referrers must (when the feature is on).
	// -------------------------------------------------------------------------

	public function test_remote_stats_per_call_site_when_enabled() {
		$this->enable_bot_filtering();
		$this->mock_http = true;
		$request = new WP_REST_Request( 'GET', '/accelerate/v1/stats' );
		$request->set_param( 'period', '7days' );
		Remote\get_remote_stats( $request );

		$this->assertCount( 3, $this->captured_sql, 'Expected totals, top pages, and top referrers queries.' );

		$rollup = array_values( array_filter( $this->captured_sql, function ( $sql ) {
			return strpos( $sql, 'analytics_daily' ) !== false;
		} ) );
		$this->assertCount( 1, $rollup );
		$this->assertStringNotContainsString( 'is_bot', $rollup[0] );

		$raw = $this->raw_table_queries();
		$this->assertCount( 2, $raw );
		foreach ( $raw as $sql ) {
			$this->assertStringContainsString( self::PREDICATE, $sql );
		}
	}

	public function test_remote_stats_has_no_is_bot_reference_by_default() {
		$this->mock_http = true;
		$request = new WP_REST_Request( 'GET', '/accelerate/v1/stats' );
		$request->set_param( 'period', '7days' );
		Remote\get_remote_stats( $request );

		$this->assertCount( 3, $this->captured_sql );
		foreach ( $this->captured_sql as $sql ) {
			$this->assertStringNotContainsString( 'is_bot', $sql );
		}
	}

	// -------------------------------------------------------------------------
	// Cache keys must vary with the effective bot-filter state: a result
	// cached while the toggle was off must not be served (for up to the TTL)
	// after the toggle flips on. Blocks\get_views() caches its result and is
	// the cheapest amended path to exercise the off -> on transition.
	// -------------------------------------------------------------------------

	public function test_cache_misses_when_bot_filtering_toggles_on() {
		$this->mock_http = true;

		// Populate the cache with the toggle off.
		Blocks\get_views( '123' );
		$this->assertCount( 1, $this->captured_sql );
		$this->assertStringNotContainsString( 'is_bot', $this->captured_sql[0] );

		// Sanity: a repeat call with unchanged state is a cache hit.
		Blocks\get_views( '123' );
		$this->assertCount( 1, $this->captured_sql, 'Second call with unchanged state should be served from cache.' );

		// Flip the toggle on: must be a cache miss and a fresh filtered query.
		$this->enable_bot_filtering();
		Blocks\get_views( '123' );
		$this->assertCount( 2, $this->captured_sql, 'Enabling bot filtering must not serve the unfiltered cached result.' );
		$this->assertStringContainsString( self::PREDICATE, $this->captured_sql[1] );
	}

	// -------------------------------------------------------------------------
	// Stored-state semantics of the is_bot materialization expression
	// (attributes['isBot'] = 'true', see .setup/create-analytics-table.sql),
	// evaluated on a live ClickHouse with literal maps (pure SELECT — no table
	// access, no inserts). The client only ever writes isBot='true' or omits
	// the key entirely; 'false' is defensive coverage for any future non-JS
	// write path.
	// -------------------------------------------------------------------------

	public function test_is_bot_expression_semantics_for_all_stored_states() {
		$result = Utils\query(
			"SELECT
				(map('isBot', 'true')['isBot'] = 'true') as bot_flagged,
				(map('other', 'x')['isBot'] = 'true') as absent_flagged,
				(map('isBot', 'false')['isBot'] = 'true') as false_flagged",
			[],
			'object'
		);

		if ( is_wp_error( $result ) || ! is_object( $result ) ) {
			$this->markTestSkipped( 'ClickHouse not reachable for live is_bot expression semantics check.' );
		}

		$this->assertSame( 1, (int) $result->bot_flagged, 'Rows tagged isBot=true must materialize is_bot=true (excluded by the predicate).' );
		$this->assertSame( 0, (int) $result->absent_flagged, 'Rows without the isBot key (all non-bot and pre-tagging rows) must be kept.' );
		$this->assertSame( 0, (int) $result->false_flagged, 'A literal false value must be kept.' );
	}
}
