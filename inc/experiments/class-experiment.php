<?php
/**
 * Experiment data model.
 *
 * Provides a dedicated database table for experiment state via Foundry ORM.
 * Each A/B test or personalization gets its own row, enabling experiment
 * history, efficient querying, and clean separation from content posts.
 *
 * @package Altis\Accelerate\Experiments
 */

namespace Altis\Accelerate\Experiments;

use Foundry\Database\Model;

class Experiment extends Model {

	// Experiment types.
	const TYPE_ABTEST = 'abtest';
	const TYPE_PERSONALIZATION = 'personalization';

	// Experiment statuses.
	const STATUS_DRAFT = 'draft';
	const STATUS_RUNNING = 'running';
	const STATUS_PAUSED = 'paused';
	const STATUS_COMPLETED = 'completed';

	// Test modes.
	const MODE_EQUAL_SPLIT = 'equal-split';
	const MODE_BANDIT = 'bandit';

	// Bandit phases.
	const PHASE_BURN_IN = 'burn_in';
	const PHASE_BANDIT = 'bandit';
	const PHASE_CONFIRMATORY = 'confirmatory';
	const PHASE_DONE = 'done';

	/**
	 * Get the table name.
	 *
	 * @return string
	 */
	protected static function get_table_name() : string {
		global $wpdb;
		return $wpdb->prefix . 'accelerate_experiments';
	}

	/**
	 * Get the table schema.
	 *
	 * @return array{ fields: array<string, string>, indexes: string[] }
	 */
	protected static function get_table_schema() : array {
		return [
			'fields' => [
				'id'                   => 'bigint(20) unsigned NOT NULL AUTO_INCREMENT',
				'subject_post_id'      => 'bigint(20) unsigned NOT NULL',
				'test_id'              => 'varchar(50) NOT NULL DEFAULT ""',
				'type'                 => 'varchar(20) NOT NULL',
				'status'               => 'varchar(20) NOT NULL DEFAULT "draft"',
				'title'                => 'varchar(255) NOT NULL DEFAULT ""',
				'goal'                 => 'varchar(50) NOT NULL DEFAULT "engagement"',
				'traffic_percentage'   => 'tinyint(3) unsigned NOT NULL DEFAULT 100',
				'variant_traffic_percentage' => 'text DEFAULT NULL',
				'test_mode'             => 'varchar(20) NOT NULL DEFAULT ""',
				'test_phase'            => 'varchar(20) NOT NULL DEFAULT ""',
				'confirmatory_baseline' => 'text DEFAULT NULL',
				'variants_snapshot'    => 'longtext DEFAULT NULL',
				'results'              => 'longtext DEFAULT NULL',
				'annotations'          => 'text DEFAULT NULL',
				'start_time'           => 'bigint(20) unsigned DEFAULT NULL',
				'end_time'             => 'bigint(20) unsigned DEFAULT NULL',
				'created_at'           => 'datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
				'updated_at'           => 'datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
			],
			'indexes' => [
				'PRIMARY KEY (id)',
				'KEY idx_status (status)',
				'KEY idx_type (type)',
				'KEY idx_status_type (status, type)',
				'KEY idx_subject_post_id (subject_post_id)',
				'KEY idx_subject_status (subject_post_id, status)',
				'KEY idx_start_time (start_time)',
			],
		];
	}

	/**
	 * Override query() to return our extended query class with ORDER BY and IN() support.
	 *
	 * @param array<string, mixed> $where Where clauses.
	 * @param array{ page?: int, per_page?: int } $args Query args.
	 * @return Experiment_Query
	 */
	public static function query( array $where, array $args = [] ) : Experiment_Query {
		$config = [
			'model'  => static::class,
			'table'  => static::get_table_name(),
			'schema' => static::get_table_schema(),
		];
		return new Experiment_Query( $config, $where, $args );
	}

	// -- Field accessors --

	/**
	 * Get the WordPress post ID this experiment is attached to.
	 *
	 * For block/personalization experiments this is the wp_block post.
	 * For title/featured_image experiments this is the content post.
	 *
	 * @return int WordPress post ID.
	 */
	public function get_subject_post_id() : int {
		return (int) $this->get_field( 'subject_post_id' );
	}

	/**
	 * Get the test ID identifying what is being tested on the post.
	 *
	 * Common values: 'block' (block-level A/B or personalization),
	 * 'titles' (post title test), 'featured_images' (featured image test).
	 *
	 * @return string Test identifier, e.g. 'block', 'titles', 'featured_images'.
	 */
	public function get_test_id() : string {
		return (string) $this->get_field( 'test_id' );
	}

	/**
	 * Get the experiment type.
	 *
	 * @return string 'abtest' or 'personalization'.
	 */
	public function get_type() : string {
		return (string) $this->get_field( 'type' );
	}

	/**
	 * Get the experiment status.
	 *
	 * @return string 'draft', 'running', 'paused', or 'completed'.
	 */
	public function get_status() : string {
		return (string) $this->get_field( 'status' );
	}

	/**
	 * Get the experiment title.
	 *
	 * May be empty — callers should fall back to the subject post title.
	 *
	 * @return string Experiment title, or empty string.
	 */
	public function get_title() : string {
		return (string) $this->get_field( 'title' );
	}

	/**
	 * Get the conversion goal event type.
	 *
	 * The goal determines what counts as a "conversion" for this experiment.
	 * May include a selector suffix separated by colon, e.g. 'click:.cta-button'.
	 *
	 * @return string Goal identifier, e.g. 'engagement', 'click', 'click:.cta-button'.
	 */
	public function get_goal() : string {
		return (string) $this->get_field( 'goal' );
	}

	/**
	 * Get the percentage of total site traffic allocated to this experiment.
	 *
	 * @return int Traffic percentage, 0–100.
	 */
	public function get_traffic_percentage() : int {
		return (int) $this->get_field( 'traffic_percentage' );
	}

	/**
	 * Get per-variant traffic distribution.
	 *
	 * Each float represents the percentage of experiment traffic allocated
	 * to that variant. Values sum to 100, e.g. [50.0, 50.0] for an even
	 * two-variant split. Stored as JSON in the database.
	 *
	 * @return float[] Percentage per variant, indexed by variant position.
	 */
	public function get_variant_traffic_percentage() : array {
		$raw = $this->get_field( 'variant_traffic_percentage' );
		if ( empty( $raw ) ) {
			return [];
		}
		return json_decode( $raw, true ) ?: [];
	}

	/**
	 * Get the variants snapshot captured when the experiment started.
	 *
	 * Stores the variant content/attributes at experiment start time so results
	 * remain meaningful even if the post content changes later. Each entry is
	 * the serialized block attributes or content for that variant index.
	 *
	 * @return array<int, mixed>|null Variant data indexed by position, or null if not yet captured.
	 */
	public function get_variants_snapshot() : ?array {
		$raw = $this->get_field( 'variants_snapshot' );
		if ( empty( $raw ) ) {
			return null;
		}
		return json_decode( $raw, true ) ?: null;
	}

	/**
	 * Get the experiment results.
	 *
	 * Stored as JSON in the database. Always returns a decoded array.
	 *
	 * Fields:
	 * - timestamp:  Last update time in milliseconds.
	 * - winning:    Variant index currently in the lead (null if undecided).
	 * - winner:     Variant index declared winner at >= 95% P2BB confidence (null if no winner yet).
	 * - aggs:     Raw per-variant impression/conversion counts from ClickHouse.
	 * - variants: Processed per-variant statistics used for Bayesian analysis:
	 *     - value: The variant content/value (block attributes, title string, etc.).
	 *     - size:  Total unique impressions.
	 *     - hits:  Total unique conversions.
	 *     - rate:  Conversion rate (hits / size).
	 *     - p:     Probability to be best (P2BB) from Bayesian analysis, 0–1.
	 *
	 * @return array{
	 *     timestamp?: int,
	 *     winning?: int|null,
	 *     winner?: int|null,
	 *     aggs?: array<int, array{ impressions?: int, conversions?: int }>,
	 *     variants?: array<int, array{ value?: mixed, size?: int, hits?: int, rate?: float, p?: float|null }>,
	 * }
	 */
	public function get_results() : array {
		$raw = $this->get_field( 'results' );
		if ( empty( $raw ) ) {
			return [];
		}
		return json_decode( $raw, true ) ?: [];
	}

	/**
	 * Get experiment annotations.
	 *
	 * Annotations are arbitrary key/value metadata attached by consumers.
	 * Keys should use a namespace:key convention (e.g. 'recommendation:pattern').
	 *
	 * @return array<string, string> Annotations map, empty if none set.
	 */
	public function get_annotations() : array {
		$raw = $this->get_field( 'annotations' );
		if ( empty( $raw ) ) {
			return [];
		}
		return json_decode( $raw, true ) ?: [];
	}

	/**
	 * Set experiment annotations.
	 *
	 * @param array<string, string> $annotations Key/value annotation map.
	 */
	public function set_annotations( array $annotations ) : void {
		$this->set_field( 'annotations', wp_json_encode( $annotations ) );
	}

	/**
	 * Get when the experiment started collecting data.
	 *
	 * @return int|null Unix timestamp in milliseconds, or null if not yet started.
	 */
	public function get_start_time() : ?int {
		$val = $this->get_field( 'start_time' );
		return $val !== null ? (int) $val : null;
	}

	/**
	 * Get when the experiment stopped collecting data.
	 *
	 * Null for running experiments and always-on personalization blocks.
	 *
	 * @return int|null Unix timestamp in milliseconds, or null if still running.
	 */
	public function get_end_time() : ?int {
		$val = $this->get_field( 'end_time' );
		return $val !== null ? (int) $val : null;
	}

	/**
	 * Get when this experiment row was created.
	 *
	 * @return string MySQL datetime string, e.g. '2025-06-15 14:30:00'.
	 */
	public function get_created_at() : string {
		return (string) $this->get_field( 'created_at' );
	}

	/**
	 * Get when this experiment row was last modified.
	 *
	 * @return string MySQL datetime string, e.g. '2025-06-15 14:30:00'.
	 */
	public function get_updated_at() : string {
		return (string) $this->get_field( 'updated_at' );
	}

	// -- Field setters (delegate to parent set_field) --

	/**
	 * Set the subject post ID.
	 *
	 * @param int $post_id Post ID.
	 */
	public function set_subject_post_id( int $post_id ) : void {
		$this->set_field( 'subject_post_id', $post_id );
	}

	/**
	 * Set the test ID.
	 *
	 * @param string $test_id Test ID.
	 */
	public function set_test_id( string $test_id ) : void {
		$this->set_field( 'test_id', $test_id );
	}

	/**
	 * Set the experiment type.
	 *
	 * @param string $type 'abtest' or 'personalization'.
	 */
	public function set_type( string $type ) : void {
		$this->set_field( 'type', $type );
	}

	/**
	 * Set the experiment status.
	 *
	 * @param string $status 'draft', 'running', 'paused', or 'completed'.
	 */
	public function set_status( string $status ) : void {
		$this->set_field( 'status', $status );
	}

	/**
	 * Set the experiment title.
	 *
	 * @param string $title Experiment title.
	 */
	public function set_title( string $title ) : void {
		$this->set_field( 'title', $title );
	}

	/**
	 * Set the conversion goal.
	 *
	 * @param string $goal Goal identifier.
	 */
	public function set_goal( string $goal ) : void {
		$this->set_field( 'goal', $goal );
	}

	/**
	 * Set the overall traffic percentage allocated to this experiment.
	 *
	 * @param int $percent Percentage of total site traffic (0-100).
	 */
	public function set_traffic_percentage( int $percent ) : void {
		$this->set_field( 'traffic_percentage', max( 0, min( 100, $percent ) ) );
	}

	/**
	 * Set per-variant traffic distribution.
	 *
	 * Accepts an array of floats that should sum to 100, one per variant,
	 * e.g. [50.0, 50.0] or [34.0, 33.0, 33.0]. Stored as JSON.
	 *
	 * @param float[] $percentages Per-variant percentage values.
	 */
	public function set_variant_traffic_percentage( array $percentages ) : void {
		$this->set_field( 'variant_traffic_percentage', wp_json_encode( $percentages ) );
	}

	/**
	 * Get the test mode for this experiment.
	 *
	 * Stored directly on the experiment row. Raw value — no filter logic here.
	 *
	 * @return string 'equal-split', 'bandit', or '' if not yet set.
	 */
	public function get_test_mode() : string {
		return (string) $this->get_field( 'test_mode' );
	}

	/**
	 * Set the test mode.
	 *
	 * @param string $mode 'equal-split' or 'bandit'.
	 */
	public function set_test_mode( string $mode ) : void {
		$this->set_field( 'test_mode', $mode );
	}

	/**
	 * Get the bandit phase for this experiment.
	 *
	 * Stored directly on the experiment row.
	 *
	 * @return string One of '', 'burn_in', 'bandit', 'confirmatory', 'done'.
	 */
	public function get_test_phase() : string {
		return (string) $this->get_field( 'test_phase' );
	}

	/**
	 * Set the bandit phase.
	 *
	 * @param string $phase One of 'burn_in', 'bandit', 'confirmatory', 'done'.
	 */
	public function set_test_phase( string $phase ) : void {
		$this->set_field( 'test_phase', $phase );
	}

	/**
	 * Get the per-variant conversion baseline captured at confirmatory phase entry.
	 *
	 * Stored as JSON. Values are reindexed integers (conversions per variant position).
	 *
	 * @return int[] Indexed array of integers, or [] if not yet set.
	 */
	public function get_confirmatory_baseline() : array {
		$raw = $this->get_field( 'confirmatory_baseline' );
		if ( empty( $raw ) ) {
			return [];
		}
		$decoded = json_decode( $raw, true );
		if ( ! is_array( $decoded ) ) {
			return [];
		}
		return array_map( 'intval', array_values( $decoded ) );
	}

	/**
	 * Set the per-variant conversion baseline for confirmatory phase entry.
	 *
	 * @param int[] $baseline Indexed array of integers (conversions per variant).
	 */
	public function set_confirmatory_baseline( array $baseline ) : void {
		$baseline = array_values( array_map( 'intval', $baseline ) );
		$this->set_field( 'confirmatory_baseline', wp_json_encode( $baseline ) );
	}

	/**
	 * Set the variants snapshot (stored as JSON).
	 *
	 * @param array<int, mixed>|null $snapshot Variant data or null.
	 */
	public function set_variants_snapshot( ?array $snapshot ) : void {
		$this->set_field( 'variants_snapshot', $snapshot ? wp_json_encode( $snapshot ) : null );
	}

	/**
	 * Set the experiment results (stored as JSON).
	 *
	 * @see get_results() for the full shape documentation.
	 *
	 * @param array{
	 *     timestamp?: int,
	 *     winning?: int|null,
	 *     winner?: int|null,
	 *     aggs?: array<int, array{ impressions?: int, conversions?: int }>,
	 *     variants?: array<int, array{ value?: mixed, size?: int, hits?: int, rate?: float, p?: float|null }>,
	 * } $results Results data.
	 */
	public function set_results( array $results ) : void {
		$this->set_field( 'results', wp_json_encode( $results ) );
	}

	/**
	 * Set the start time.
	 *
	 * @param int|null $time Timestamp in milliseconds.
	 */
	public function set_start_time( ?int $time ) : void {
		$this->set_field( 'start_time', $time );
	}

	/**
	 * Set the end time.
	 *
	 * @param int|null $time Timestamp in milliseconds, or null for always-on.
	 */
	public function set_end_time( ?int $time ) : void {
		$this->set_field( 'end_time', $time );
	}

	// -- Helpers --

	/**
	 * Find the newest experiment row matching a where clause.
	 *
	 * Owns the single-row lookup shape — per_page 1, newest first,
	 * no_found_rows — so every lookup helper stays on the cheap query path.
	 * Unlike the get_* wrappers, the error case is distinguishable from
	 * "no row exists", which callers need before caching a definitive miss.
	 *
	 * @param array $where Foundry where clause.
	 * @return static|\WP_Error|null Newest match, null when none exist, or
	 *                               WP_Error when the query failed.
	 */
	public static function find_one( array $where ) {
		$results = static::query(
			$where,
			[
				'per_page'      => 1,
				'order_by'      => [ 'created_at' => 'DESC' ],
				'no_found_rows' => true,
			]
		)->get_results();

		if ( is_wp_error( $results ) ) {
			return $results;
		}

		return count( $results ) > 0 ? $results[0] : null;
	}

	/**
	 * Find the currently running experiment for a post and test ID.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $test_id Test ID.
	 * @return static|null
	 */
	public static function get_current_for_post( int $post_id, string $test_id ) : ?self {
		$found = static::find_one( [
			'subject_post_id' => $post_id,
			'test_id'         => $test_id,
			'status'          => self::STATUS_RUNNING,
		] );

		return is_wp_error( $found ) ? null : $found;
	}

	/**
	 * Find the active (non-completed) experiment for a post and test ID,
	 * distinguishing "none exists" (null) from a failed query (WP_Error).
	 *
	 * Returns the most recent draft, running, or paused experiment.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $test_id Test ID.
	 * @return static|\WP_Error|null
	 */
	public static function find_active_for_post( int $post_id, string $test_id ) {
		return static::find_one( [
			'subject_post_id' => $post_id,
			'test_id'         => $test_id,
			'status'          => [
				'compare' => 'IN',
				'value'   => [ self::STATUS_DRAFT, self::STATUS_RUNNING, self::STATUS_PAUSED ],
			],
		] );
	}

	/**
	 * Find the active (non-completed) experiment for a post and test ID.
	 *
	 * Returns the most recent draft, running, or paused experiment.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $test_id Test ID.
	 * @return static|null
	 */
	public static function get_active_for_post( int $post_id, string $test_id ) : ?self {
		$found = static::find_active_for_post( $post_id, $test_id );

		return is_wp_error( $found ) ? null : $found;
	}

	/**
	 * Find or create an experiment for a post and test ID.
	 *
	 * Returns the active non-completed experiment if one exists,
	 * otherwise creates a new one.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $test_id Test ID.
	 * @param string $type    Experiment type.
	 * @return static
	 */
	public static function get_or_create_for_post( int $post_id, string $test_id, string $type = self::TYPE_ABTEST ) : self {
		$existing = static::get_active_for_post( $post_id, $test_id );
		if ( $existing ) {
			return $existing;
		}

		$experiment = new static();
		$experiment->set_subject_post_id( $post_id );
		$experiment->set_test_id( $test_id );
		$experiment->set_type( $type );

		return $experiment;
	}

	/**
	 * Convert the experiment to an array for REST API responses.
	 *
	 * @return array{
	 *     id: int|null,
	 *     subject_post_id: int,
	 *     test_id: string,
	 *     type: 'abtest'|'personalization',
	 *     status: 'draft'|'running'|'paused'|'completed',
	 *     title: string,
	 *     goal: string,
	 *     traffic_percentage: int,
	 *     variant_traffic_percentage: float[],
	 *     test_mode: string,
	 *     test_phase: string,
	 *     confirmatory_baseline: int[],
	 *     results: array{ timestamp?: int, winning?: int|null, winner?: int|null, aggs?: array<int, array{ impressions?: int, conversions?: int }>, variants?: array<int, array{ value?: mixed, size?: int, hits?: int, rate?: float, p?: float|null }> },
	 *     annotations: array<string, string>,
	 *     start_time: int|null,
	 *     end_time: int|null,
	 *     created_at: string,
	 *     updated_at: string,
	 * }
	 */
	public function to_array() : array {
		return [
			'id'                   => $this->get_id(),
			'subject_post_id'      => $this->get_subject_post_id(),
			'test_id'              => $this->get_test_id(),
			'type'                 => $this->get_type(),
			'status'               => $this->get_status(),
			'title'                => $this->get_title(),
			'goal'                 => $this->get_goal(),
			'traffic_percentage'   => $this->get_traffic_percentage(),
			'variant_traffic_percentage' => $this->get_variant_traffic_percentage(),
			'test_mode'            => $this->get_test_mode(),
			'test_phase'           => $this->get_test_phase(),
			'confirmatory_baseline' => $this->get_confirmatory_baseline(),
			'results'              => $this->get_results(),
			'annotations'          => $this->get_annotations(),
			'start_time'           => $this->get_start_time(),
			'end_time'             => $this->get_end_time(),
			'created_at'           => $this->get_created_at(),
			'updated_at'           => $this->get_updated_at(),
		];
	}
}
