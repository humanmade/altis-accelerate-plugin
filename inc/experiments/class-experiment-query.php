<?php
/**
 * Extended Foundry Query with ORDER BY, IN/NOT IN, and no_found_rows support.
 *
 * These features are pending upstream contribution to humanmade/foundry.
 * This subclass can only be removed once ALL of them — including the
 * 'no_found_rows' arg and the get_results() override — have merged upstream.
 * Removing it earlier is silent: the base Query ignores unknown args, so
 * SQL_CALC_FOUND_ROWS and the SELECT FOUND_ROWS() follow-up would return on
 * every single-row lookup with no error (the N+1 this subclass prevents).
 *
 * @package Altis\Accelerate\Experiments
 */

namespace Altis\Accelerate\Experiments;

use Foundry\Database\Query;
use Foundry\Database\QueryResults;
use WP_Error;

class Experiment_Query extends Query {

	/**
	 * Build the ORDER BY clause from args.
	 *
	 * Reads from $this->args['order_by']. Only columns defined in
	 * the schema are allowed; invalid columns are silently skipped.
	 *
	 * @return string SQL ORDER BY clause or empty string.
	 */
	protected function build_order_by() : string {
		$order_by = $this->args['order_by'] ?? [];

		if ( empty( $order_by ) ) {
			return '';
		}

		$fields = $this->config['schema']['fields'];
		$clauses = [];

		foreach ( $order_by as $column => $direction ) {
			// Special: status priority ordering (running=0, paused=1, completed=2, draft=3).
			if ( $column === '__status_priority' ) {
				$clauses[] = "CASE `status` WHEN 'running' THEN 0 WHEN 'paused' THEN 1 WHEN 'completed' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END ASC";
				continue;
			}

			if ( ! isset( $fields[ $column ] ) ) {
				continue;
			}

			$direction = strtoupper( $direction ) === 'DESC' ? 'DESC' : 'ASC';
			$clauses[] = sprintf( '`%s` %s', $column, $direction );
		}

		if ( empty( $clauses ) ) {
			return '';
		}

		return 'ORDER BY ' . implode( ', ', $clauses );
	}

	/**
	 * Build WHERE clause for a single field, with IN/NOT IN support.
	 *
	 * @param string $field  Column name.
	 * @param mixed  $clause Where clause value or array{ compare: string, value: mixed }.
	 * @return array{ 0: string, 1: mixed[] }|WP_Error
	 */
	protected function build_where_for_field_where_clause( string $field, $clause ) {
		$where_item = is_array( $clause ) ? $clause : [ 'compare' => '=', 'value' => $clause ];

		// Handle IN / NOT IN.
		if ( isset( $where_item['compare'] ) && in_array( strtoupper( $where_item['compare'] ), [ 'IN', 'NOT IN' ], true ) ) {
			$values = (array) $where_item['value'];
			if ( empty( $values ) ) {
				return [ '1=0', [] ];
			}

			$placeholders = $this->repeat_placeholders( $values );
			$where = sprintf(
				'`%s` %s (%s)',
				$field,
				strtoupper( $where_item['compare'] ),
				$placeholders
			);

			return [ $where, array_values( $values ) ];
		}

		// Fall back to parent for all other operators.
		return parent::build_where_for_field_where_clause( $field, $clause );
	}

	/**
	 * Build the full query with ORDER BY support.
	 *
	 * @return string|WP_Error
	 */
	protected function build_query() {
		/** @var \wpdb $wpdb */
		global $wpdb;

		$args = $this->args;

		$where = $this->build_where( $this->where );
		if ( is_wp_error( $where ) ) {
			return $where;
		}

		list( $where_string, $where_values ) = $where;
		$where_statement = empty( $where_string ) ? '' : 'WHERE ' . $where_string;

		$order_by_statement = $this->build_order_by();

		$page = $args['page'] ?? 1;
		$per_page = $args['per_page'] ?? 10;

		$offset = ( $page - 1 ) * $per_page;
		$limit = $per_page;

		// SQL_CALC_FOUND_ROWS lets get_total_available() report the unpaginated
		// total, but it forces MySQL to count every matching row. Callers that
		// only need the returned rows (single-row existence lookups) can pass
		// 'no_found_rows' => true to skip that cost; get_total_available() then
		// reports only the LIMIT-bounded returned-row count.
		$found_rows = empty( $args['no_found_rows'] ) ? 'SQL_CALC_FOUND_ROWS ' : '';

		if ( ! empty( $args['no_found_rows'] ) && $page > 1 ) {
			_doing_it_wrong(
				__METHOD__,
				esc_html__( "'no_found_rows' skips the total count, so get_total_available() reports only the current page — do not combine it with pagination.", 'altis' ),
				'Accelerate'
			);
		}

		$query = sprintf(
			'SELECT %s* FROM `%s` %s %s LIMIT %d, %d',
			$found_rows,
			$this->config['table'],
			$where_statement,
			$order_by_statement,
			$offset,
			$limit
		);
		$values = array_merge(
			$where_values
		);

		$prepared = empty( $values ) ? $query : $wpdb->prepare( $query, $values );
		if ( ! $prepared ) {
			return new WP_Error( 'prepare-failed', 'Preparing values failed.' );
		}
		return $prepared;
	}

	/**
	 * Fetch the results for the query.
	 *
	 * The parent always follows the main query with SELECT FOUND_ROWS(), but
	 * with 'no_found_rows' the main query omits SQL_CALC_FOUND_ROWS, so that
	 * follow-up would cost a round-trip only to return the LIMIT-bounded
	 * returned-row count. Skip it and count the results directly.
	 *
	 * Mirrors the body of Foundry\Database\Query::get_results() minus the
	 * FOUND_ROWS() follow-up. If upstream get_results() changes (hydration,
	 * error handling, QueryResults signature), update this copy to match.
	 *
	 * @return WP_Error|QueryResults
	 */
	public function get_results() {
		if ( empty( $this->args['no_found_rows'] ) ) {
			return parent::get_results();
		}

		/** @var \wpdb $wpdb */
		global $wpdb;

		$query = $this->build_query();
		if ( is_wp_error( $query ) ) {
			return $query;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- Prepared in build_query().
		$results = $wpdb->get_results( $query );
		$this->executed = true;

		if ( $wpdb->last_error ) {
			return new WP_Error( 'foundry.database.query.could_not_execute', $wpdb->last_error );
		}

		return new QueryResults( $this->config, $results, count( $results ) );
	}
}
