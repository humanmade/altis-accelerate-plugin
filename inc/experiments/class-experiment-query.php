<?php
/**
 * Extended Foundry Query with ORDER BY and IN/NOT IN support.
 *
 * These features are pending upstream contribution to humanmade/foundry.
 * Once merged, this subclass can be removed.
 *
 * @package Altis\Accelerate\Experiments
 */

namespace Altis\Accelerate\Experiments;

use Foundry\Database\Query;
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

		$query = sprintf(
			'SELECT SQL_CALC_FOUND_ROWS * FROM `%s` %s %s LIMIT %d, %d',
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
}
