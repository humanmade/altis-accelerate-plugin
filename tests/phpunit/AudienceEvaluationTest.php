<?php
/**
 * Audience evaluation tests.
 *
 * Verifies the SQL fragment shape produced by `build_audience_query()` for
 * every operator + field-type combination, and pins behaviour the client-side
 * matcher does NOT model (`include: 'none'`, `not has(...)` array negation,
 * numeric unknown-operator fallback). See `docs/test-coverage-audit.md` P0 #1.
 *
 * The operator truth-table fixture at `tests/fixtures/audience-operators.json`
 * is shared with the JS suite (`src/__tests__/audience-matcher.test.ts`).
 * Adding a row there does NOT auto-cover PHP — PHP is testing SQL fragment
 * generation, not runtime evaluation. The PHP truth-table test here asserts
 * that every fixture row at least produces a parseable fragment, so any new
 * operator added to the JS fixture without a corresponding PHP branch will
 * fail this suite.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Audiences;
use WP_UnitTestCase;

class AudienceEvaluationTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();

		// Register two test fields covering the (scalar, array) axes for
		// string operators. Numeric fields are auto-typed by Utils\get_field_type
		// when the path contains 'metrics'.
		Audiences\register_field( 'attributes.country', 'Country (scalar)', [
			'column' => "attributes['country']",
			'array'  => false,
		] );

		Audiences\register_field( 'attributes.visited_countries', 'Visited countries (array)', [
			'column' => "JSONExtractArrayRaw(attributes['visited_countries'])",
			'array'  => true,
		] );

		Audiences\register_field( 'metrics.sessions', 'Sessions (numeric)', [
			'column' => "metrics['sessions']",
			'array'  => false,
		] );
	}

	/**
	 * Build a single-rule audience config.
	 */
	private function audience( string $field, string $operator, $value, string $group_include = 'any', string $audience_include = 'any' ) : array {
		return [
			'include' => $audience_include,
			'groups' => [
				[
					'include' => $group_include,
					'rules' => [
						[ 'field' => $field, 'operator' => $operator, 'value' => $value ],
					],
				],
			],
		];
	}

	// -- String operators on scalar fields ---------------------------------

	public function test_eq_scalar_string_produces_equality_fragment() {
		[ $where, $params ] = Audiences\build_audience_query(
			$this->audience( 'attributes.country', '=', 'US' )
		);
		$this->assertStringContainsString( "attributes['country'] = {audience_0_0:String}", $where );
		$this->assertSame( 'US', $params['audience_0_0'] );
	}

	public function test_neq_scalar_string_produces_inequality_fragment() {
		[ $where, $params ] = Audiences\build_audience_query(
			$this->audience( 'attributes.country', '!=', 'US' )
		);
		$this->assertStringContainsString( "attributes['country'] != {audience_0_0:String}", $where );
		$this->assertSame( 'US', $params['audience_0_0'] );
	}

	public function test_contains_scalar_uses_position_greater_than_zero() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'attributes.country', '*=', 'Un' )
		);
		$this->assertStringContainsString( "position(attributes['country'], {audience_0_0:String}) > 0", $where );
	}

	public function test_not_contains_scalar_uses_position_equals_zero() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'attributes.country', '!*', 'Un' )
		);
		$this->assertStringContainsString( "position(attributes['country'], {audience_0_0:String}) = 0", $where );
	}

	public function test_starts_with_scalar_uses_position_equals_one() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'attributes.country', '^=', 'Un' )
		);
		$this->assertStringContainsString( "position(attributes['country'], {audience_0_0:String}) = 1", $where );
	}

	// -- String operators on ARRAY fields (the client-side divergence area)

	public function test_eq_array_field_uses_has_function() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'attributes.visited_countries', '=', 'US' )
		);
		$this->assertStringContainsString( 'has(', $where );
		$this->assertStringContainsString( '{audience_0_0:String}', $where );
	}

	public function test_neq_array_field_uses_not_has_function() {
		// This is the codex-flagged divergence: server says `not has(...)`,
		// client iterates values and breaks on first non-match.
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'attributes.visited_countries', '!=', 'US' )
		);
		$this->assertStringContainsString( 'not has(', $where );
	}

	public function test_contains_array_field_uses_array_string_concat() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'attributes.visited_countries', '*=', 'US' )
		);
		$this->assertStringContainsString( 'position(arrayStringConcat(', $where );
		$this->assertStringContainsString( ') > 0', $where );
	}

	public function test_starts_with_array_field_uses_array_string_concat_position_one() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'attributes.visited_countries', '^=', 'US' )
		);
		$this->assertStringContainsString( 'position(arrayStringConcat(', $where );
		$this->assertStringContainsString( ') = 1', $where );
	}

	// -- Numeric operators -------------------------------------------------

	public function test_numeric_eq_produces_uint_placeholder() {
		[ $where, $params ] = Audiences\build_audience_query(
			$this->audience( 'metrics.sessions', '=', 5 )
		);
		$this->assertStringContainsString( "metrics['sessions'] = {audience_0_0:UInt64}", $where );
		$this->assertSame( 5, $params['audience_0_0'] );
	}

	public function test_numeric_gt_produces_strict_greater_than() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'metrics.sessions', 'gt', 5 )
		);
		$this->assertStringContainsString( "metrics['sessions'] > {audience_0_0:UInt64}", $where );
	}

	public function test_numeric_gte_produces_greater_than_or_equal() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'metrics.sessions', 'gte', 5 )
		);
		$this->assertStringContainsString( ">= {audience_0_0:UInt64}", $where );
	}

	public function test_numeric_lte_produces_less_than_or_equal() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'metrics.sessions', 'lte', 5 )
		);
		$this->assertStringContainsString( "<= {audience_0_0:UInt64}", $where );
	}

	public function test_numeric_float_uses_float64_placeholder() {
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'metrics.sessions', 'gt', 1.5 )
		);
		$this->assertStringContainsString( '{audience_0_0:Float64}', $where );
	}

	// -- Unknown-operator behaviour (per branch — pinned, not endorsed) ----

	public function test_unknown_string_operator_drops_rule_silently() {
		// String branch's switch has no default — the rule generates no
		// query and falls back to the `1 = 1` placeholder. Client behaviour:
		// returns false for the rule. Different shape, same end effect for a
		// single-rule audience.
		[ $where, $params ] = Audiences\build_audience_query(
			$this->audience( 'attributes.country', 'matches_regex', 'US' )
		);
		$this->assertSame( '1 = 1', $where );
		$this->assertSame( [], $params );
	}

	public function test_unknown_numeric_operator_falls_back_to_equality() {
		// Numeric branch's switch has `default => '='`. This is the live
		// behaviour even though it might surprise readers — pinning it.
		[ $where ] = Audiences\build_audience_query(
			$this->audience( 'metrics.sessions', 'matches_regex', 5 )
		);
		$this->assertStringContainsString( "metrics['sessions'] = {audience_0_0:UInt64}", $where );
	}

	// -- include: 'none' (server supports; client does not) ----------------

	public function test_audience_include_none_uses_and_not_join() {
		$config = [
			'include' => 'any',
			'groups' => [
				[
					'include' => 'any',
					'rules' => [ [ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'US' ] ],
				],
				[
					'include' => 'any',
					'rules' => [ [ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'UK' ] ],
				],
			],
		];
		// Force the top-level include to 'none' (server semantics: NOT either group).
		$config['include'] = 'none';
		[ $where ] = Audiences\build_audience_query( $config );
		$this->assertStringContainsString( ' AND NOT ', $where );
	}

	public function test_group_include_none_uses_and_not_join_within_group() {
		$config = [
			'include' => 'any',
			'groups' => [
				[
					'include' => 'none',
					'rules' => [
						[ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'US' ],
						[ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'UK' ],
					],
				],
			],
		];
		[ $where ] = Audiences\build_audience_query( $config );
		$this->assertStringContainsString( ' AND NOT ', $where );
	}

	// -- Composition -------------------------------------------------------

	public function test_multiple_rules_in_all_group_join_with_and() {
		$config = [
			'include' => 'any',
			'groups' => [
				[
					'include' => 'all',
					'rules' => [
						[ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'US' ],
						[ 'field' => 'metrics.sessions', 'operator' => 'gte', 'value' => 5 ],
					],
				],
			],
		];
		[ $where ] = Audiences\build_audience_query( $config );
		$this->assertStringContainsString( ' AND ', $where );
	}

	public function test_multiple_groups_with_audience_any_join_with_or() {
		$config = [
			'include' => 'any',
			'groups' => [
				[ 'include' => 'any', 'rules' => [ [ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'US' ] ] ],
				[ 'include' => 'any', 'rules' => [ [ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'UK' ] ] ],
			],
		];
		[ $where ] = Audiences\build_audience_query( $config );
		$this->assertStringContainsString( ' OR ', $where );
	}

	public function test_rule_with_empty_field_is_silently_skipped() {
		$config = [
			'include' => 'any',
			'groups' => [
				[
					'include' => 'all',
					'rules' => [
						[ 'field' => '', 'operator' => '=', 'value' => 'anything' ],
						[ 'field' => 'attributes.country', 'operator' => '=', 'value' => 'US' ],
					],
				],
			],
		];
		[ $where ] = Audiences\build_audience_query( $config );
		// The empty-field rule contributes nothing; only the second rule's
		// fragment should appear.
		$this->assertStringContainsString( "attributes['country']", $where );
		$this->assertStringNotContainsString( 'anything', $where );
	}

	public function test_audience_with_no_groups_returns_pass_through() {
		[ $where, $params ] = Audiences\build_audience_query( [
			'include' => 'any',
			'groups' => [],
		] );
		$this->assertSame( '1 = 1', $where );
		$this->assertSame( [], $params );
	}

	// -- Truth-table parity ------------------------------------------------

	/**
	 * Every operator listed in the shared JS fixture must produce *some*
	 * non-passthrough SQL fragment for a scalar string field. If JS gains a
	 * new operator without a corresponding PHP branch, this test fails.
	 */
	public function test_every_operator_in_shared_fixture_has_a_php_branch() {
		$fixture_path = dirname( __DIR__ ) . '/fixtures/audience-operators.json';
		$this->assertFileExists( $fixture_path );

		$fixture = json_decode( file_get_contents( $fixture_path ), true );
		$this->assertNotEmpty( $fixture['rows'] );

		$numeric_operators = [ '=', '!=', 'gt', 'gte', 'lt', 'lte' ];
		$string_operators = [ '=', '!=', '*=', '!*', '^=' ];

		$seen = [];
		foreach ( $fixture['rows'] as $row ) {
			$op = $row['operator'];
			if ( isset( $seen[ $op ] ) ) {
				continue;
			}
			$seen[ $op ] = true;

			$is_numeric_op = in_array( $op, $numeric_operators, true );
			$field = $is_numeric_op && ! in_array( $op, $string_operators, true )
				? 'metrics.sessions'
				: 'attributes.country';
			$value = $is_numeric_op ? 1 : 'X';

			[ $where ] = Audiences\build_audience_query(
				$this->audience( $field, $op, $value )
			);

			$this->assertNotSame(
				'1 = 1',
				$where,
				"Operator '$op' from shared fixture has no PHP branch (produced pass-through)."
			);
		}
	}

	/**
	 * Engaged time must be registered as a numeric audience field on the
	 * visitor-cumulative endpoint metric (not per-event data) so audiences
	 * like "engaged time > 30000 ms" are evaluable at page load and carry
	 * cross-session memory.
	 */
	public function test_engaged_time_registered_as_numeric_endpoint_field() {
		Audiences\register_default_event_data_maps();

		$engaged = null;
		foreach ( Audiences\get_fields() as $field ) {
			if ( $field['name'] === 'endpoint.Metrics.engaged' ) {
				$engaged = $field;
				break;
			}
		}

		$this->assertNotNull( $engaged, 'endpoint.Metrics.engaged should be a registered audience field.' );
		$this->assertSame( 'number', $engaged['type'] );
		$this->assertSame( "endpoint_metrics['engaged']", $engaged['options']['column'] );
	}
}
