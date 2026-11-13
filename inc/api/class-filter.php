<?php
/**
 * Altis Accelerate analytics data filter.
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\API;

/**
 * Filter container object.
 */
class Filter {
	/**
	 * A URL path to filter on.
	 *
	 * @var string
	 */
	public $path;

	/**
	 * Search term.
	 *
	 * @var string
	 */
	public $search;

	/**
	 * Post type.
	 *
	 * @var string
	 */
	public $type;

	/**
	 * User / author ID.
	 *
	 * @var int
	 */
	public $user;

	/**
	 * Current page.
	 *
	 * @var int
	 */
	public $page = 1;

	/**
	 * Restrict to specific post IDs.
	 *
	 * @var int[]
	 */
	public $include = [];

	/**
	 * Audience query.
	 *
	 * @var array
	 */
	public $audience;

	/**
	 * Dimension filters: whitelisted dimension key => string value.
	 *
	 * Each entry filters events where the dimension's ClickHouse field
	 * expression equals the given value (event-level "filter to this value").
	 * Keys are validated against the server-side whitelist
	 * (see get_dimension_field_map()); unknown keys are ignored.
	 *
	 * @var array
	 */
	public $dimensions = [];
}
