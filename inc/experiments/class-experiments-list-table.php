<?php
/**
 * Experiments admin list table.
 *
 * @package Altis\Accelerate\Experiments
 */

namespace Altis\Accelerate\Experiments;

use Foundry\Admin\List_Table;
use Foundry\Admin\WithActions;
use Foundry\Database\Model;

class Experiments_List_Table extends List_Table {
	use WithActions;

	/**
	 * Get the model class.
	 *
	 * @return string
	 */
	protected static function get_model() : string {
		return Experiment::class;
	}

	/**
	 * Get the column schema.
	 *
	 * @return array
	 */
	protected function get_item_schema() : array {
		return [
			'cb' => [
				'foundry:accessibility-text' => function ( $item ) {
					return sprintf( 'Select experiment "%s"', $item['title'] );
				},
			],
			'title' => [
				'title' => __( 'Title', 'altis' ),
			],
			'type' => [
				'title' => __( 'Type', 'altis' ),
			],
			'status' => [
				'title' => __( 'Status', 'altis' ),
			],
			'post' => [
				'title' => __( 'Post', 'altis' ),
			],
			'goal' => [
				'title' => __( 'Goal', 'altis' ),
			],
			'traffic_percentage' => [
				'title' => __( 'Traffic', 'altis' ),
			],
			'created_at' => [
				'title' => __( 'Created', 'altis' ),
			],
		];
	}

	/**
	 * Prepare a model for display output.
	 *
	 * @param Model $model Experiment model.
	 * @return array
	 */
	protected function prepare_model_for_output( $model ) {
		$title = $model->get_title();
		if ( empty( $title ) ) {
			$title = $model->get_test_id();
		}

		$type_map = [
			Experiment::TYPE_ABTEST          => __( 'A/B Test', 'altis' ),
			Experiment::TYPE_PERSONALIZATION => __( 'Personalization', 'altis' ),
		];

		$status = $model->get_status();
		$status_colors = [
			Experiment::STATUS_RUNNING   => '#00a32a',
			Experiment::STATUS_DRAFT     => '#787c82',
			Experiment::STATUS_PAUSED    => '#dba617',
			Experiment::STATUS_COMPLETED => '#2271b1',
		];
		$color = $status_colors[ $status ] ?? '#787c82';
		$status_html = sprintf(
			'<span class="accelerate-status-dot" style="background-color:%s;"></span> %s',
			esc_attr( $color ),
			esc_html( ucfirst( $status ) )
		);

		$post_id = $model->get_subject_post_id();
		$post_title = get_the_title( $post_id );
		if ( $post_title ) {
			$edit_link = get_edit_post_link( $post_id );
			if ( $edit_link ) {
				$post_html = sprintf( '<a href="%s">%s</a>', esc_url( $edit_link ), esc_html( $post_title ) );
			} else {
				$post_html = esc_html( $post_title );
			}
		} else {
			$post_html = sprintf( '<em>%s</em>', esc_html__( '(deleted)', 'altis' ) );
		}

		return [
			'title'              => esc_html( $title ),
			'type'               => esc_html( $type_map[ $model->get_type() ] ?? $model->get_type() ),
			'status'             => $status_html,
			'post'               => $post_html,
			'goal'               => esc_html( $model->get_goal() ),
			'traffic_percentage' => esc_html( $model->get_traffic_percentage() . '%' ),
			'created_at'         => esc_html( mysql2date( get_option( 'date_format' ), $model->get_created_at() ) ),
		];
	}

	/**
	 * Prepare row actions for a model.
	 *
	 * @param Model $model Experiment model.
	 * @return array
	 */
	protected function prepare_actions_for_output( $model ) {
		$actions = [];

		$post_id = $model->get_subject_post_id();
		$edit_link = get_edit_post_link( $post_id );
		if ( $edit_link ) {
			$actions['edit_post'] = sprintf(
				'<a href="%s">%s</a>',
				esc_url( $edit_link ),
				esc_html__( 'Edit Post', 'altis' )
			);
		}

		$view_link = get_permalink( $post_id );
		if ( $view_link ) {
			$actions['view_post'] = sprintf(
				'<a href="%s">%s</a>',
				esc_url( $view_link ),
				esc_html__( 'View Post', 'altis' )
			);
		}

		$automatic = $this->prepare_automatic_actions_for_output( $model );

		return array_merge( $actions, $automatic );
	}

	/**
	 * Get actions supported by this list table.
	 *
	 * @return array
	 */
	protected function get_actions() : array {
		return [
			'delete' => [
				'callback'            => [ $this, 'delete_item' ],
				'permission_callback' => function ( ?Model $item ) {
					return current_user_can( 'manage_options' );
				},
				'label'               => __( 'Delete', 'altis' ),
				'full_label'          => function ( Model $item ) {
					return sprintf( __( 'Delete experiment #%d', 'altis' ), $item->get_id() );
				},
				'multiple'            => true,
				'multiple_label'      => __( 'Delete', 'altis' ),
			],
		];
	}

	/**
	 * Prepare items with default ordering and post cache priming.
	 */
	public function prepare_items() {
		$model = static::get_model();
		$per_page = $this->get_items_per_page( 'edit_' . $model . '_per_page' );
		$this->query = $model::query( [], [
			'page'     => $this->get_pagenum(),
			'per_page' => $per_page,
			'order_by' => [ 'created_at' => 'DESC' ],
		] );

		$this->items = $this->query->get_results();

		// Prime the post cache for all subject posts.
		$post_ids = [];
		foreach ( $this->items as $item ) {
			$post_ids[] = $item->get_subject_post_id();
		}
		if ( ! empty( $post_ids ) ) {
			_prime_post_caches( array_unique( $post_ids ) );
		}

		$this->set_pagination_args( [
			'total_items' => $this->items->get_total_available(),
			'per_page'    => $per_page,
		] );
	}

	/**
	 * Get the primary column name.
	 *
	 * @return string
	 */
	protected function get_primary_column_name() {
		return 'title';
	}
}
