<?php
/**
 * Advanced Custom Fields integration helpers.
 *
 * @package Altis\Accelerate\Integrations\ACF
 */

namespace Altis\Accelerate\Integrations\ACF;

const RECOMMENDED_MIN_VERSION = '6.8.5';

/**
 * Bootstrap the ACF integration.
 *
 * @return void
 */
function bootstrap() : void {
}

/**
 * Check whether ACF is active.
 *
 * @return bool True when ACF is active.
 */
function is_active() : bool {
	return class_exists( 'ACF' ) && defined( 'ACF_VERSION' );
}

/**
 * Check whether ACF Pro is active.
 *
 * @return bool True when ACF Pro is active.
 */
function is_pro() : bool {
	if ( function_exists( 'acf_is_pro' ) ) {
		return (bool) acf_is_pro();
	}

	return defined( 'ACF_PRO' ) && ACF_PRO;
}

/**
 * Check whether ACF block APIs are available.
 *
 * @return bool True when ACF block APIs are available.
 */
function supports_blocks() : bool {
	return is_active() && function_exists( 'acf_register_block_type' );
}

/**
 * Get the installed ACF version.
 *
 * @return string|null Installed ACF version, or null when inactive.
 */
function get_version() : ?string {
	return defined( 'ACF_VERSION' ) ? ACF_VERSION : null;
}

/**
 * Check whether the installed ACF version meets the recommended floor.
 *
 * @return bool True when ACF is active and meets the recommended version.
 */
function meets_recommended_version() : bool {
	$version = get_version();
	if ( ! is_active() || ! $version ) {
		return false;
	}

	return version_compare( $version, RECOMMENDED_MIN_VERSION, '>=' );
}

/**
 * Get the ACF integration status.
 *
 * @return array ACF status details.
 */
function get_status() : array {
	return [
		'active'                  => is_active(),
		'pro'                     => is_pro(),
		'version'                 => get_version(),
		'blocks'                  => supports_blocks(),
		'meetsRecommendedVersion' => meets_recommended_version(),
	];
}

/**
 * Check whether a parsed block is an ACF block.
 *
 * @param mixed $block Parsed block array.
 * @return bool True when the block is an ACF block.
 */
function is_acf_block( $block ) : bool {
	if ( ! is_array( $block ) || empty( $block['blockName'] ) || ! is_string( $block['blockName'] ) ) {
		return false;
	}

	return strpos( $block['blockName'], 'acf/' ) === 0;
}

/**
 * Find all ACF blocks in a parsed block tree.
 *
 * @param array $blocks Parsed blocks.
 * @return array Flat list of ACF blocks.
 */
function find_acf_blocks( array $blocks ) : array {
	$acf_blocks = [];

	foreach ( $blocks as $block ) {
		if ( is_acf_block( $block ) ) {
			$acf_blocks[] = $block;
		}

		if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
			$acf_blocks = array_merge( $acf_blocks, find_acf_blocks( $block['innerBlocks'] ) );
		}
	}

	return $acf_blocks;
}

/**
 * Read a public setting value from an array or object.
 *
 * @param mixed $source Array or object to inspect.
 * @param array $keys   Setting keys to check.
 * @return mixed|null Setting value, or null when absent.
 */
function get_setting_value( $source, array $keys ) {
	if ( is_object( $source ) ) {
		$source = get_object_vars( $source );
	}

	if ( ! is_array( $source ) ) {
		return null;
	}

	foreach ( $keys as $key ) {
		if ( array_key_exists( $key, $source ) ) {
			return $source[ $key ];
		}
	}

	return null;
}

/**
 * Check whether an ACF block type uses post meta storage.
 *
 * @param string $block_name Block name.
 * @return bool True when the block is configured with usePostMeta.
 */
function block_uses_post_meta( string $block_name ) : bool {
	$uses_post_meta = false;
	$found = false;

	if ( function_exists( 'acf_get_block_type' ) ) {
		$acf_type = acf_get_block_type( $block_name );
		$value = get_setting_value( $acf_type, [ 'usePostMeta', 'use_post_meta' ] );

		if ( $value !== null ) {
			$uses_post_meta = (bool) $value;
			$found = true;
		}
	}

	if ( ! $found && class_exists( 'WP_Block_Type_Registry' ) ) {
		$type = \WP_Block_Type_Registry::get_instance()->get_registered( $block_name );

		if ( $type ) {
			$acf_settings = get_setting_value( $type, [ 'acf' ] );
			$value = get_setting_value( $acf_settings, [ 'usePostMeta', 'use_post_meta' ] );

			if ( $value !== null ) {
				$uses_post_meta = (bool) $value;
				$found = true;
			}

			if ( ! $found ) {
				$settings = get_setting_value( $type, [ 'settings' ] );
				$acf_settings = get_setting_value( $settings, [ 'acf' ] );
				$value = get_setting_value( $acf_settings, [ 'usePostMeta', 'use_post_meta' ] );

				if ( $value !== null ) {
					$uses_post_meta = (bool) $value;
					$found = true;
				}
			}

			if ( ! $found ) {
				$value = get_setting_value( $type, [ 'use_post_meta', 'usePostMeta' ] );

				if ( $value !== null ) {
					$uses_post_meta = (bool) $value;
				}
			}
		}
	}

	/**
	 * Filter whether an ACF block type uses post meta storage.
	 *
	 * @param bool   $uses_post_meta Whether the block uses post meta.
	 * @param string $block_name     Block name.
	 */
	return (bool) apply_filters( 'altis.accelerate.acf.block_uses_post_meta', $uses_post_meta, $block_name );
}

/**
 * Find unsupported ACF blocks using post meta storage.
 *
 * @param array $blocks Parsed blocks.
 * @return array Flat list of unsupported ACF blocks.
 */
function find_unsupported_post_meta_blocks( array $blocks ) : array {
	$unsupported = [];

	foreach ( find_acf_blocks( $blocks ) as $block ) {
		if ( block_uses_post_meta( $block['blockName'] ) ) {
			$unsupported[] = $block;
		}
	}

	return $unsupported;
}

/**
 * Validate markup for unsupported ACF blocks.
 *
 * @param string $markup Block markup.
 * @return \WP_Error|null Error when unsupported ACF blocks are present, otherwise null.
 */
function validate_content_markup( string $markup ) : ?\WP_Error {
	$unsupported = find_unsupported_post_meta_blocks( parse_blocks( $markup ) );

	if ( empty( $unsupported ) ) {
		return null;
	}

	$block_names = array_values( array_unique( array_map( function ( array $block ) : string {
		return $block['blockName'];
	}, $unsupported ) ) );

	return new \WP_Error(
		'altis.accelerate.acf.unsupported_post_meta_block',
		sprintf(
			/* translators: %s: comma-separated list of unsupported ACF block names. */
			__( 'ACF blocks using usePostMeta are not supported in Accelerate-managed content: %s.', 'altis' ),
			implode( ', ', $block_names )
		),
		[
			'blocks' => $block_names,
		]
	);
}
