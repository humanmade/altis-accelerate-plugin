<?php
/**
 * Blueprint data model.
 *
 * A Blueprint is a reusable, admin-authored preset for a personalization (or,
 * later, A/B) synced pattern: an ordered list of variants, each bound to an
 * audience. Applying a blueprint in the editor converts the selected blocks
 * into a personalized synced pattern with these variants pre-wired.
 *
 * Stored in a dedicated database table via the Foundry ORM — consistent with
 * the experiments data layer (see {@see \Altis\Accelerate\Experiments\Experiment})
 * and out of the wp_posts table.
 *
 * @package Altis\Accelerate\Blueprints
 */

namespace Altis\Accelerate\Blueprints;

use Foundry\Database\Model;

class Blueprint extends Model {

	// Blueprint types — mirror the personalization/A-B subtypes of a synced pattern.
	const TYPE_PERSONALIZATION = 'personalization';
	const TYPE_ABTEST = 'abtest';

	// Blueprint statuses. Only `published` blueprints appear in the editor menu.
	const STATUS_DRAFT = 'draft';
	const STATUS_PUBLISHED = 'published';

	/**
	 * Get the table name.
	 *
	 * @return string
	 */
	protected static function get_table_name() : string {
		global $wpdb;
		return $wpdb->prefix . 'accelerate_blueprints';
	}

	/**
	 * Get the table schema.
	 *
	 * @return array{ fields: array<string, string>, indexes: string[] }
	 */
	protected static function get_table_schema() : array {
		return [
			'fields' => [
				'id'         => 'bigint(20) unsigned NOT NULL AUTO_INCREMENT',
				'title'      => 'varchar(255) NOT NULL DEFAULT ""',
				'type'       => 'varchar(20) NOT NULL DEFAULT "personalization"',
				'status'     => 'varchar(20) NOT NULL DEFAULT "draft"',
				'goal'       => 'varchar(50) NOT NULL DEFAULT "engagement"',
				'variants'   => 'longtext DEFAULT NULL',
				'created_at' => 'datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
				'updated_at' => 'datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
			],
			'indexes' => [
				'PRIMARY KEY (id)',
				'KEY idx_status (status)',
				'KEY idx_type (type)',
			],
		];
	}

	// -- Field accessors --

	/**
	 * Get the blueprint title.
	 *
	 * @return string
	 */
	public function get_title() : string {
		return (string) $this->get_field( 'title' );
	}

	/**
	 * Set the blueprint title.
	 *
	 * @param string $title Title.
	 */
	public function set_title( string $title ) : void {
		$this->set_field( 'title', $title );
	}

	/**
	 * Get the blueprint type.
	 *
	 * @return string 'personalization' or 'abtest'.
	 */
	public function get_type() : string {
		return (string) ( $this->get_field( 'type' ) ?: self::TYPE_PERSONALIZATION );
	}

	/**
	 * Set the blueprint type.
	 *
	 * @param string $type Type.
	 */
	public function set_type( string $type ) : void {
		$type = in_array( $type, [ self::TYPE_PERSONALIZATION, self::TYPE_ABTEST ], true )
			? $type
			: self::TYPE_PERSONALIZATION;
		$this->set_field( 'type', $type );
	}

	/**
	 * Get the blueprint status.
	 *
	 * @return string 'draft' or 'published'.
	 */
	public function get_status() : string {
		return (string) ( $this->get_field( 'status' ) ?: self::STATUS_DRAFT );
	}

	/**
	 * Set the blueprint status.
	 *
	 * @param string $status Status.
	 */
	public function set_status( string $status ) : void {
		$status = in_array( $status, [ self::STATUS_DRAFT, self::STATUS_PUBLISHED ], true )
			? $status
			: self::STATUS_DRAFT;
		$this->set_field( 'status', $status );
	}

	/**
	 * Get the conversion goal.
	 *
	 * @return string Goal identifier, e.g. 'engagement'.
	 */
	public function get_goal() : string {
		return (string) ( $this->get_field( 'goal' ) ?: 'engagement' );
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
	 * Get the blueprint variants.
	 *
	 * Each entry describes one variant of the resulting synced pattern:
	 * - title:      Display label for the variant.
	 * - audience:   Audience post ID this variant targets (0/null for the fallback).
	 * - fallback:   Whether this is the control/default variant (always index 0).
	 * - percentage: Optional per-variant traffic weight (A/B only).
	 *
	 * Stored as JSON. Index 0 is always the fallback.
	 *
	 * @return array<int, array{ title: string, audience: int, fallback: bool, percentage: int|null }>
	 */
	public function get_variants() : array {
		$raw = $this->get_field( 'variants' );
		if ( empty( $raw ) ) {
			return [];
		}
		$decoded = json_decode( $raw, true );
		return is_array( $decoded ) ? $decoded : [];
	}

	/**
	 * Set the blueprint variants (stored as JSON).
	 *
	 * @param array<int, array<string, mixed>> $variants Variant definitions.
	 */
	public function set_variants( array $variants ) : void {
		$this->set_field( 'variants', wp_json_encode( array_values( $variants ) ) );
	}

	/**
	 * Get the created timestamp.
	 *
	 * @return string MySQL datetime string.
	 */
	public function get_created_at() : string {
		return (string) $this->get_field( 'created_at' );
	}

	/**
	 * Get the updated timestamp.
	 *
	 * @return string MySQL datetime string.
	 */
	public function get_updated_at() : string {
		return (string) $this->get_field( 'updated_at' );
	}

	// -- Helpers --

	/**
	 * Get all published blueprints, newest first.
	 *
	 * Used by the editor to populate the block options ("…") menu.
	 *
	 * @param string $type Optional type filter ('personalization' | 'abtest').
	 * @return self[]
	 */
	public static function get_published( string $type = '' ) : array {
		$where = [ 'status' => self::STATUS_PUBLISHED ];
		if ( $type !== '' ) {
			$where['type'] = $type;
		}

		$results = static::query(
			$where,
			[
				'per_page' => 100,
				'order_by' => [ 'updated_at' => 'DESC' ],
			]
		)->get_results();

		if ( is_wp_error( $results ) ) {
			return [];
		}

		return $results->as_array();
	}

	/**
	 * Convert the blueprint to an array for REST API responses.
	 *
	 * @return array{
	 *     id: int|null,
	 *     title: string,
	 *     type: string,
	 *     status: string,
	 *     goal: string,
	 *     variants: array<int, array<string, mixed>>,
	 *     created_at: string,
	 *     updated_at: string,
	 * }
	 */
	public function to_array() : array {
		return [
			'id'         => $this->get_id(),
			'title'      => $this->get_title(),
			'type'       => $this->get_type(),
			'status'     => $this->get_status(),
			'goal'       => $this->get_goal(),
			'variants'   => $this->get_variants(),
			'created_at' => $this->get_created_at(),
			'updated_at' => $this->get_updated_at(),
		];
	}
}
