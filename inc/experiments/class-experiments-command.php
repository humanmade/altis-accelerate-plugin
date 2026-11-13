<?php
/**
 * WP-CLI command for managing experiments.
 *
 * @package Altis\Accelerate\Experiments
 */

namespace Altis\Accelerate\Experiments;

use Foundry\Cli\Command;

class Experiments_Command extends Command {

	/**
	 * Get the CLI command name.
	 *
	 * @return string
	 */
	protected static function get_command() : string {
		return 'accelerate experiments';
	}

	/**
	 * Get the model class.
	 *
	 * @return string
	 */
	protected static function get_model() : string {
		return Experiment::class;
	}

	/**
	 * Get the item schema for CLI field validation.
	 *
	 * @return array
	 */
	protected function get_item_schema() : array {
		return [
			'id' => [
				'type' => 'integer',
			],
			'title' => [
				'type' => 'string',
			],
			'subject_post_id' => [
				'type'     => 'integer',
				'required' => true,
			],
			'test_id' => [
				'type'     => 'string',
				'required' => true,
			],
			'type' => [
				'type' => 'string',
				'enum' => [
					Experiment::TYPE_ABTEST,
					Experiment::TYPE_PERSONALIZATION,
				],
				'default' => Experiment::TYPE_ABTEST,
			],
			'status' => [
				'type' => 'string',
				'enum' => [
					Experiment::STATUS_DRAFT,
					Experiment::STATUS_RUNNING,
					Experiment::STATUS_PAUSED,
					Experiment::STATUS_COMPLETED,
				],
				'default' => Experiment::STATUS_DRAFT,
			],
			'goal' => [
				'type'    => 'string',
				'default' => 'engagement',
			],
			'traffic_percentage' => [
				'type'    => 'integer',
				'default' => 100,
			],
			'start_time' => [
				'type' => 'integer',
			],
			'end_time' => [
				'type' => 'integer',
			],
			'created_at' => [
				'type' => 'string',
			],
			'updated_at' => [
				'type' => 'string',
			],
		];
	}

	/**
	 * Prepare model data for CLI output.
	 *
	 * @param \Foundry\Database\Model $model Experiment model.
	 * @return array
	 */
	protected function prepare_model_for_output( $model ) {
		$data = $model->to_array();

		// JSON-encode complex fields for CLI display.
		if ( is_array( $data['variant_traffic_percentage'] ) ) {
			$data['variant_traffic_percentage'] = wp_json_encode( $data['variant_traffic_percentage'] );
		}
		if ( is_array( $data['results'] ) ) {
			$data['results'] = wp_json_encode( $data['results'] );
		}

		return $data;
	}

	/**
	 * Backfill the experiments table from existing post meta.
	 *
	 * ## OPTIONS
	 *
	 * [--batch-size=<number>]
	 * : Number of posts to process per batch.
	 * ---
	 * default: 100
	 * ---
	 *
	 * ## EXAMPLES
	 *
	 *     wp accelerate experiments migrate
	 *     wp accelerate experiments migrate --batch-size=50
	 *
	 * @subcommand migrate
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Named arguments.
	 */
	public function migrate( $args, $assoc_args ) {
		$batch_size = (int) ( $assoc_args['batch-size'] ?? 100 );

		\WP_CLI::log( 'Starting experiment backfill migration...' );

		$stats = Migration\backfill( $batch_size );

		\WP_CLI::success( sprintf(
			'Migration complete. Processed: %d, Created: %d, Skipped: %d, Errors: %d',
			$stats['processed'],
			$stats['created'],
			$stats['skipped'],
			$stats['errors']
		) );
	}

	/**
	 * Map CLI args to model setters.
	 *
	 * @param \Foundry\Database\Model $model     Experiment model.
	 * @param array                   $assoc_args Sanitized CLI args.
	 * @return \Foundry\Database\Model|\WP_Error
	 */
	protected function prepare_changes_for_database( $model, array $assoc_args ) {
		$setters = [
			'subject_post_id'      => 'set_subject_post_id',
			'test_id'              => 'set_test_id',
			'type'                 => 'set_type',
			'status'               => 'set_status',
			'title'                => 'set_title',
			'goal'                 => 'set_goal',
			'traffic_percentage'   => 'set_traffic_percentage',
			'start_time'           => 'set_start_time',
			'end_time'             => 'set_end_time',
		];

		foreach ( $assoc_args as $key => $value ) {
			if ( isset( $setters[ $key ] ) ) {
				$model->{ $setters[ $key ] }( $value );
			}
		}

		return $model;
	}
}
