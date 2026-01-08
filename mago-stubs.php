<?php

/**
 * Analyzer stubs for WP helper functions used across the project.
 *
 * This file is loaded by static analyzers (or via composer autoload-dev) to
 * provide extra type information. Keep stubs minimal and in the global
 * namespace.
 */

/**
 * Check whether a variable is a WP_Error instance.
 *
 * @param mixed $thing
 *
 * @psalm-assert-if-true \WP_Error $thing
 * @phpstan-assert-if-true WP_Error $thing
 */
function is_wp_error( $thing ) : bool {
	return false;
}

/**
 * Kills WordPress execution and displays HTML page with an error message.
 *
 * This function complements the `die()` PHP function. The difference is that
 * HTML will be displayed to the user. It is recommended to use this function
 * only when the execution should not continue any further. It is not recommended
 * to call this function very often, and try to handle as many errors as possible
 * silently or more gracefully.
 *
 * As a shorthand, the desired HTTP response code may be passed as an integer to
 * the `$title` parameter (the default title would apply) or the `$args` parameter.
 *
 * @since 2.0.4
 * @since 4.1.0 The `$title` and `$args` parameters were changed to optionally accept
 *              an integer to be used as the response code.
 * @since 5.1.0 The `$link_url`, `$link_text`, and `$exit` arguments were added.
 * @since 5.3.0 The `$charset` argument was added.
 * @since 5.5.0 The `$text_direction` argument has a priority over get_language_attributes()
 *              in the default handler.
 *
 * @global WP_Query $wp_query WordPress Query object.
 *
 * @param string|WP_Error  $message Optional. Error message. If this is a WP_Error object,
 *                                  and not an Ajax or XML-RPC request, the error's messages are used.
 *                                  Default empty string.
 * @param string|int       $title   Optional. Error title. If `$message` is a `WP_Error` object,
 *                                  error data with the key 'title' may be used to specify the title.
 *                                  If `$title` is an integer, then it is treated as the response code.
 *                                  Default empty string.
 * @param string|array|int $args {
 *     Optional. Arguments to control behavior. If `$args` is an integer, then it is treated
 *     as the response code. Default empty array.
 *
 *     @type int    $response       The HTTP response code. Default 200 for Ajax requests, 500 otherwise.
 *     @type string $link_url       A URL to include a link to. Only works in combination with $link_text.
 *                                  Default empty string.
 *     @type string $link_text      A label for the link to include. Only works in combination with $link_url.
 *                                  Default empty string.
 *     @type bool   $back_link      Whether to include a link to go back. Default false.
 *     @type string $text_direction The text direction. This is only useful internally, when WordPress is still
 *                                  loading and the site's locale is not set up yet. Accepts 'rtl' and 'ltr'.
 *                                  Default is the value of is_rtl().
 *     @type string $charset        Character set of the HTML output. Default 'utf-8'.
 *     @type string $code           Error code to use. Default is 'wp_die', or the main error code if $message
 *                                  is a WP_Error.
 *     @type bool   $exit           Whether to exit the process after completion. Default true.
 * }
 *
 * @return never Returns no value. Execution is halted.
 */
function wp_die( $message = '', $title = '', $args = null ) {
	exit(1);
}


/**
 * Remove slashes from a string or array of strings.
 *
 * @template T of array|string
 *
 * @param T $value
 *
 * @return T
 *
 * @psalm-template T of array|string
 * @psalm-param T $value
 * @psalm-return T
 *
 * @phpstan-template T of array|string
 * @phpstan-param T $value
 * @phpstan-return T
 */
function wp_unslash( $value ) {
	return $value;
}


/**
 * Get term by field.
 *
 * This stub provides conditional return types based on the `$output` parameter
 * so static analyzers can infer the precise return type.
 *
 * @param string          $field
 * @param string|int      $value
 * @param string          $taxonomy
 * @param 'OBJECT'|'ARRAY_A'|'ARRAY_N' $output
 * @param string          $filter
 *
 * @psalm-param 'OBJECT'|'ARRAY_A'|'ARRAY_N' $output
 * @psalm-return ($output is 'OBJECT' ? \WP_Term|false : ($output is 'ARRAY_A' ? array<string,mixed>|false : ($output is 'ARRAY_N' ? list<mixed>|false : \WP_Term|array|false)))
 *
 */
function get_term_by( $field, $value, $taxonomy = '', $output = 'OBJECT', $filter = 'raw' ) {
	return false;
}

/**
 * @return ($single is true ? string|false : array|false)
 */
function get_post_meta( int $post_id, string $key = '', bool $single = false ) {
	return null;
}

/**
 * @return ($single is true ? string|false : array|false)
 */
function get_term_meta( int $term_id, string $key = '', bool $single = false ) {
	return null;
}
/**
 * @return ($output is 'OBJECT' ? \WP_Post|null : ($output is 'ARRAY_A' ? array<string,mixed>|null : ($output is 'ARRAY_N' ? list<mixed>|null : \WP_Post|array|null)))
 */
function get_post( int $post_id, string $output = 'OBJECT', string $filter = 'raw' ) {
	return null;
}
