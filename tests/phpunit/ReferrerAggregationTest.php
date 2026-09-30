<?php
/**
 * Regression coverage for the normalized by_referer aggregation and drill.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use WP_UnitTestCase;

class ReferrerAggregationTest extends WP_UnitTestCase {

	/**
	 * ClickHouse query bodies intercepted by the test transport.
	 *
	 * @var string[]
	 */
	protected $queries = [];

	public function set_up() : void {
		parent::set_up();
		wp_cache_flush();

		// The default aggregations register on `init`, so whether they're
		// present here depends on hook timing we don't control from a test.
		// Register them explicitly when missing — `register_term_aggregation`
		// keys by short name, so a second call just re-sets the same entries.
		$fields = API\get_dimension_field_map();
		if ( ! array_key_exists( 'referer', $fields ) ) {
			API\register_default_aggregations();
		}

		add_filter( 'pre_http_request', [ $this, 'mock_clickhouse' ], 10, 3 );
	}

	public function tear_down() : void {
		remove_filter( 'pre_http_request', [ $this, 'mock_clickhouse' ], 10 );
		parent::tear_down();
	}

	/**
	 * Return the aggregation result shape ClickHouse returns for a batched query.
	 *
	 * @return array<string, mixed>
	 */
	public function mock_clickhouse( $pre, $args, $url ) {
		$this->queries[] = $args['body'];

		return [
			'headers'  => [],
			'body'     => wp_json_encode( [
				'agg0' => [
					[
						'key'   => 'google.com',
						'value' => 24984,
					],
				],
			] ),
			'response' => [ 'code' => 200, 'message' => 'OK' ],
			'cookies'  => [],
			'filename' => null,
		];
	}

	public function test_referrer_aggregation_and_drill_share_the_normalized_host_expression() {
		$host_expression = "replaceRegexpOne(domain(referer), '^www\\\\.', '')";
		$fields          = API\get_dimension_field_map();

		$this->assertSame( $host_expression, $fields['referer'] );

		$filter              = new API\Filter();
		$filter->dimensions  = [ 'referer' => 'google.com' ];
		$query_params        = [];
		$dimension_predicates = API\apply_dimension_filters( $filter, $query_params );

		$this->assertSame( [ "{$host_expression} = {dim_0:String}" ], $dimension_predicates );
		$this->assertSame( [ 'dim_0' => 'google.com' ], $query_params );

		$result = API\get_aggregations( time() - MINUTE_IN_SECONDS, time(), null, [ 'by_referer' ] );

		$this->assertSame( [ 'by_referer' => [ 'google.com' => 24984 ] ], $result );
		$this->assertNotEmpty( $this->queries );
		$this->assertStringContainsString( $host_expression, $this->queries[0] );
	}
}
