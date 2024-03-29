<?php
/**
 * Helper functions for stats and significance.
 *
 * phpcs:disable WordPress.NamingConventions.ValidHookName.UseUnderscores
 */

namespace Altis\Accelerate\Utils;

use Altis\Accelerate;
use Asset_Loader;
use WP_Error;

/**
 * Get asset manifest file path.
 *
 * @return array|null
 */
function get_asset_manifest() : ?array {
	static $manifest;

	// Local dev.
	if ( empty( $manifest ) && is_readable( dirname( __DIR__, 2 ) . '/build/asset-manifest.json' ) ) {
		$manifest = [ 'file' => dirname( __DIR__, 2 ) . '/build/asset-manifest.json' ];
	}
	// Production.
	if ( empty( $manifest ) && is_readable( dirname( __DIR__, 2 ) . '/build/production-asset-manifest.json' ) ) {
		$manifest = [ 'file' => dirname( __DIR__, 2 ) . '/build/production-asset-manifest.json' ];
	}


	if ( $manifest ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$manifest_contents = file_get_contents( $manifest['file'] );
		$manifest['data'] = json_decode( $manifest_contents, true );
	}

	return $manifest;
}

/**
 * Return asset file name based on generated manifest.json file.
 *
 * @todo remove after converting JS to typescript.
 *
 * @param string $filename The webpack entry point file name.
 * @return string|false The real URL of the asset or false if it couldn't be found.
 */
function get_asset_url( string $filename ) {
	$manifest = get_asset_manifest();
	if ( empty( $manifest ) ) {
		return;
	}

	if ( ! isset( $manifest['data'][ $filename ] ) ) {
		return false;
	}

	$path = $manifest['data'][ $filename ];

	if ( strpos( $path, 'http' ) !== false ) {
		return $path;
	}

	return plugins_url( $path, Accelerate\PLUGIN_DIR . '/build/assets' );
}

/**
 * Check if a feature is enabled or not.
 *
 * By default all features are enabled.
 *
 * Options are:
 *
 * - audiences
 * - experiments
 * - export
 * - blocks
 * - dashboard
 * - insights
 *
 * @param string $feature Feature slug.
 * @return boolean
 */
function is_feature_enabled( string $feature ) : bool {
	/**
	 * Toggle plugin feature.
	 *
	 * Note: personalisation blocks require audiences and A/B blocks require experiments.
	 *
	 * @param bool $enabled Set to true to enable feature.
	 */
	$enabled = (bool) apply_filters( "altis.analytics.feature.{$feature}", true );

	return $enabled;
}

/**
 * Queue up JS and CSS assets for the given entrypoint.
 *
 * @param string $entrypoint The webpack entrypoint key.
 * @param array $options Asset options.
 * @return void
 */
function register_assets( string $entrypoint, array $options = [], bool $enqueue = false ) {
	$manifest = get_asset_manifest();
	if ( empty( $manifest ) ) {
		return;
	}

	$handles = [
		'style' => '',
		'script' => '',
	];

	$css_path = $manifest['data']["{$entrypoint}.css"] ?? '';
	if ( $css_path && is_readable( dirname( __DIR__, 2 ) . "/build/{$css_path}" ) ) {
		$handles = Asset_Loader\register_asset(
			$manifest['file'],
			"{$entrypoint}.css",
			[
				'handle' => "altis-accelerate-{$entrypoint}",
				'dependencies' => is_admin() ? [
					'common',
					'wp-components',
				] : [],
			]
		);
	}

	$asset_handles = Asset_Loader\register_asset(
		$manifest['file'],
		"{$entrypoint}.js",
		array_merge( [
			'handle' => "altis-accelerate-{$entrypoint}",
		], $options ),
	);

	$handles = array_merge( $handles, $asset_handles );

	if ( $enqueue ) {
		if ( $handles['script'] ) {
			wp_enqueue_script( $handles['script'] );
			wp_enqueue_style( 'wp-components' );
		}
		if ( $handles['style'] ) {
			wp_enqueue_style( $handles['style'] );
		}
	}

	return $handles;
}

/**
 * Calculate the combined standard deviation for multiple groups of
 * averages, standard deviations and sizes.
 *
 * @param array $means Array of averages.
 * @param array $stddevs Array of standard deviations.
 * @param array $group_counts Array of sample sizes.
 * @return float
 */
function composite_stddev( array $means, array $stddevs, array $group_counts ) : float {
	// Number of groups.
	$g = count( $means );
	if ( $g !== count( $stddevs ) ) {
		trigger_error( 'inconsistent list lengths', E_USER_WARNING );
		return 0.0;
	}
	if ( $g !== count( $group_counts ) ) {
		trigger_error( 'wrong nCounts list length', E_USER_WARNING );
		return 0.0;
	}

	// Calculate total number of samples, N, and grand mean, GM.
	$n = array_sum( $group_counts ); // Total number of samples.
	if ( $n <= 1 ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		trigger_error( "Warning: only {$n} samples, SD is incalculable", E_USER_WARNING );
	}
	$gm = 0.0;
	for ( $i = 0; $i < $g; $i++ ) {
		$gm += $means[ $i ] * $group_counts[ $i ];
	}
	$gm /= $n;  // Grand mean.

	// Calculate Error Sum of Squares.
	$ess = 0.0;
	for ( $i = 0; $i < $g; $i++ ) {
		$ess += ( pow( $stddevs[ $i ], 2 ) ) * ( $group_counts[ $i ] - 1 );
	}

	// Calculate Total Group Sum of Squares.
	$tgss = 0.0;
	for ( $i = 0; $i < $g; $i++ ) {
		$tgss += ( pow( $means[ $i ] - $gm, 2 ) ) * $group_counts[ $i ];
	}

	// Calculate standard deviation as square root of grand variance.
	$result = sqrt( ( $ess + $tgss ) / ( $n - 1 ) );
	return $result;
}

/**
 * Get actual milliseconds value as integer.
 *
 * @return int Milliseconds since unix epoch.
 */
function milliseconds() : int {
	return (int) microtime( true ) * 1000;
}

/**
 * Get a point in time in milliseconds, optionally rounded to the nearest time block.
 *
 * @param string $point_in_time strtotime-safe string, eg: '-1 week'
 * @param integer $round_to Round the result to the nearest time block in seconds, eg: HOUR_IN_SECONDS.
 *
 * @return integer|null
 */
function date_in_milliseconds( string $point_in_time, int $round_to = 0 ) : ?int {
	$since_epoch = strtotime( $point_in_time );

	if ( ! $since_epoch ) {
		trigger_error( sprintf( 'Analytics: Point in time string "%s" cannot be resolved.', $point_in_time ), E_USER_WARNING );
		return null;
	}

	// Round if needed.
	if ( $round_to ) {
		$since_epoch = floor( $since_epoch / $round_to ) * $round_to;
	}

	// Convert to milliseconds.
	return $since_epoch * 1000;
}

/**
 * Takes the 'buckets' from a ClickHouse historgam aggregation and normalises
 * it to something easier to work with in JS.
 *
 * @param array $histogram The raw histogram buckets from ClickHouse.
 * @return array
 */
function normalise_histogram( array $histogram ) : array {
	$histogram = array_map( function ( array $bucket ) {
		return [
			'index' => intval( $bucket[0] ), // Index 0 is the start number, 1 is the end.
			'count' => floatval( $bucket[2] ), // Index 2 is the value / number of records in the range.
		];
	}, $histogram );
	return array_values( $histogram );
}

/**
 * Merge aggregations from ES results.
 *
 * @todo work out how to merge percentiles & percentile ranks.
 *
 * @param array $current Current aggregate results.
 * @param array $new Updated aggregate results.
 * @param string $bucket_type The type of aggregation.
 * @return array
 */
function merge_aggregates( array $current, array $new, string $bucket_type = '' ) : array {
	$merged = $current;

	foreach ( $new as $key => $value ) {
		if ( is_string( $key ) ) {
			// Get bucket type.
			if ( preg_match( '/^([a-z0-9_-]+)#.*$/', $key, $matches ) ) {
				$bucket_type = $matches[1];
			}

			switch ( $key ) {
				case 'doc_count':
				case 'sum':
				case 'count':
					$merged[ $key ] = ( $current[ $key ] ?? 0 ) + $value;
					break;
				case 'value':
					if ( $bucket_type ) {
						switch ( $bucket_type ) {
							case 'cardinality':
							case 'cumulative_sum':
							case 'sum':
							case 'sum_bucket':
							case 'value_count':
								$merged[ $key ] = ( $current[ $key ] ?? 0 ) + $value;
								break;
							case 'avg':
							case 'avg_bucket':
								$merged[ $key ] = ( ( $current[ $key ] ?? 0 ) + $value ) / 2;
								break;
							case 'min':
							case 'min_bucket':
								$merged[ $key ] = min( $current[ $key ] ?? PHP_INT_MAX, $value );
								break;
							case 'max':
							case 'max_bucket':
								$merged[ $key ] = max( $current[ $key ] ?? PHP_INT_MIN, $value );
								break;
							default:
								$merged[ $key ] = $current[ $key ] ?? 0;
								break;
						}
						// Reset bucket type.
						$bucket_type = '';
					} else {
						$merged[ $key ] = ( $current[ $key ] ?? 0 ) + $value;
					}
					break;
				case 'avg':
					$merged[ $key ] = ( ( $current[ $key ] ?? 0 ) + $value ) / 2;
					break;
				case 'min':
					$merged[ $key ] = min( $current[ $key ] ?? PHP_INT_MAX, $value );
					break;
				case 'max':
					$merged[ $key ] = max( $current[ $key ] ?? PHP_INT_MIN, $value );
					break;
				case 'std_deviation':
					// Calculate composite std dev.
					if ( isset( $new['avg'], $new['count'], $current['std_deviation'], $current['avg'], $current['count'] ) ) {
						$merged[ $key ] = composite_stddev(
							[ $new['avg'], $current['avg'] ],
							[ $value, $current[ $key ] ],
							[ $new['count'], $current['count'] ]
						);
					} else {
						$merged[ $key ] = $value;
					}
					break;
				default:
					$merged[ $key ] = $value;
					break;
			}
		}

		if ( is_array( $value ) ) {
			$merged[ $key ] = merge_aggregates( $current[ $key ] ?? [], $value, $bucket_type );
		}
	}

	return $merged;
}

/**
 * Determine type of Elasticsearch field by name.
 *
 * @param string $field The full field name.
 * @return string|null $type One of 'string', 'number' or 'date'.
 */
function get_field_type( string $field ) : ?string {
	if ( empty( $field ) ) {
		return null;
	}

	$numeric_fields = [
		'session.duration',
	];

	$is_numeric_field = in_array( $field, $numeric_fields, true );
	$is_metric = stripos( $field, 'metrics' ) !== false;

	if ( $is_numeric_field || $is_metric ) {
		return 'number';
	}

	$date_fields = [
		'event_timestamp',
		'arrival_timestamp',
		'session.start_timestamp',
		'session.stop_timestamp',
		'endpoint.CreationDate',
		'endpoint.EffectiveDate',
	];

	if ( in_array( $field, $date_fields, true ) ) {
		return 'date';
	}

	return 'string';
}

/**
 * Flattens an array recursively and sets the keys for nested values
 * as a dot separated path.
 *
 * @param array $data The array to flatten.
 * @param string $prefix The current key prefix.
 * @return array
 */
function flatten_array( array $data, string $prefix = '' ) : array {
	$flattened = [];
	$prefix = ! empty( $prefix ) ? "{$prefix}." : '';

	foreach ( $data as $key => $value ) {
		if ( is_array( $value ) ) {
			// For non associative arrays we need to combine the values into one.
			if ( count( $value ) === count( array_filter( array_keys( $value ), 'is_int' ) ) ) {
				$flattened[ "{$prefix}{$key}" ] = implode( ';', $value );
			} else {
				$flattened = array_merge( $flattened, flatten_array( $value, "{$prefix}{$key}" ) );
			}
		} else {
			$flattened[ "{$prefix}{$key}" ] = $value;
		}
	}

	return $flattened;
}

/**
 * Parse an Accept header.
 *
 * @param string $value Raw header value from the user.
 * @return array Parsed Accept header to pass to find_best_match()
 */
function parse_accept_header( string $value ) : array {
	$types = array_map( 'trim', explode( ',', $value ) );
	$prioritized = [];
	foreach ( $types as $type ) {
		$params = [
			'q' => 1,
		];
		if ( strpos( $type, ';' ) !== false ) {
			list( $type, $param_str ) = explode( ';', $type, 2 );
			$param_parts = array_map( 'trim', explode( ';', $param_str ) );
			foreach ( $param_parts as $part ) {
				if ( strpos( $part, '=' ) !== false ) {
					list( $key, $value ) = explode( '=', $part, 2 );
				} else {
					$key = $part;
					$value = true;
				}
				$params[ $key ] = $value;
			}
		}

		list( $type, $subtype ) = explode( '/', $type, 2 );

		// Build a regex matcher.
		$regex = ( $type === '*' ) ? '([^/]+)' : preg_quote( $type, '#' );
		$regex .= '/';
		$regex .= ( $subtype === '*' ) ? '([^/]+)' : preg_quote( $subtype, '#' );
		$regex = '#^' . $regex . '$#i';
		$prioritized[] = compact( 'type', 'subtype', 'regex', 'params' );
	}

	usort( $prioritized, function ( $a, $b ) {
		return $b['params']['q'] <=> $a['params']['q'];
	} );

	return $prioritized;
}

/**
 * Find the best matching type from available types.
 *
 * @param array $parsed Parsed Accept header from parse_accept_header()
 * @param string[] $available Available MIME types that could be served.
 * @return string|null Best matching MIME type if available, or null if none match.
 */
function find_best_accept_header_match( array $parsed, array $available ) : ?string {
	$scores = [];
	foreach ( $available as $type ) {
		// Loop through $parsed and find the first match.
		// Note: presorted by q, so first match is highest score.
		foreach ( $parsed as $acceptable ) {
			if ( preg_match( $acceptable['regex'], $type ) ) {
				$scores[ $type ] = $acceptable['params']['q'];
				break;
			}
		}
	}
	if ( empty( $scores ) ) {
		return null;
	}

	// Sort to highest score.
	arsort( $scores );

	// Return highest score.
	return array_keys( $scores )[0];
}

/**
 * Sort data by conversion rate.
 *
 * @param array $list The array of analytics data by block id.
 * @param string $orderby The parameter to sort by.
 * @param string $order The order to sort by. Accepted values are 'asc' or 'desc'.
 *
 * @return array The sorted array.
 */
function sort_by( array $list, string $orderby, string $order = 'desc' ) : array {
	$order = strtolower( $order );

	// If an invalid value was passed to $order, default to 'desc'.
	if ( ! in_array( $order, [ 'asc', 'desc' ], true ) ) {
		$order = 'desc';
	}

	$sort_order = ( $order === 'desc' ) ? SORT_DESC : SORT_ASC;
	$orderby = array_column( $list, $orderby );

	array_multisort( $orderby, $sort_order, $list );

	return $list;
}

/**
 * Return a list of country names indexed by their respective code, according to ISO 3166.
 *
 * @return array Array of country names indexed by their respective code.
 */
function get_countries() : array {
	return [
		// 'A1' => 'Anonymous Proxy',
		// 'A2' => 'Satellite Provider',
		// 'O1' => 'Other Country',
		'AF' => 'Afghanistan',
		'AX' => 'Aland Islands',
		'AL' => 'Albania',
		'DZ' => 'Algeria',
		'AS' => 'American Samoa',
		'AD' => 'Andorra',
		'AO' => 'Angola',
		'AI' => 'Anguilla',
		'AQ' => 'Antarctica',
		'AG' => 'Antigua and Barbuda',
		'AR' => 'Argentina',
		'AM' => 'Armenia',
		'AW' => 'Aruba',
		'AP' => 'Asia/Pacific Region',
		'AU' => 'Australia',
		'AT' => 'Austria',
		'AZ' => 'Azerbaijan',
		'BS' => 'Bahamas',
		'BH' => 'Bahrain',
		'BD' => 'Bangladesh',
		'BB' => 'Barbados',
		'BY' => 'Belarus',
		'BE' => 'Belgium',
		'BZ' => 'Belize',
		'BJ' => 'Benin',
		'BM' => 'Bermuda',
		'BT' => 'Bhutan',
		'BO' => 'Bolivia',
		'BQ' => 'Bonaire, Saint Eustatius and Saba',
		'BA' => 'Bosnia and Herzegovina',
		'BW' => 'Botswana',
		'BV' => 'Bouvet Island',
		'BR' => 'Brazil',
		'IO' => 'British Indian Ocean Territory',
		'BN' => 'Brunei Darussalam',
		'BG' => 'Bulgaria',
		'BF' => 'Burkina Faso',
		'BI' => 'Burundi',
		'KH' => 'Cambodia',
		'CM' => 'Cameroon',
		'CA' => 'Canada',
		'CV' => 'Cape Verde',
		'KY' => 'Cayman Islands',
		'CF' => 'Central African Republic',
		'TD' => 'Chad',
		'CL' => 'Chile',
		'CN' => 'China',
		'CX' => 'Christmas Island',
		'CC' => 'Cocos (Keeling) Islands',
		'CO' => 'Colombia',
		'KM' => 'Comoros',
		'CD' => 'Congo, The Democratic Republic of the',
		'CG' => 'Congo',
		'CK' => 'Cook Islands',
		'CR' => 'Costa Rica',
		'CI' => 'Cote d\'Ivoire',
		'HR' => 'Croatia',
		'CU' => 'Cuba',
		'CW' => 'Curacao',
		'CY' => 'Cyprus',
		'CZ' => 'Czech Republic',
		'DK' => 'Denmark',
		'DJ' => 'Djibouti',
		'DM' => 'Dominica',
		'DO' => 'Dominican Republic',
		'EC' => 'Ecuador',
		'EG' => 'Egypt',
		'SV' => 'El Salvador',
		'GQ' => 'Equatorial Guinea',
		'ER' => 'Eritrea',
		'EE' => 'Estonia',
		'ET' => 'Ethiopia',
		'EU' => 'Europe',
		'FK' => 'Falkland Islands (Malvinas)',
		'FO' => 'Faroe Islands',
		'FJ' => 'Fiji',
		'FI' => 'Finland',
		'FR' => 'France',
		'GF' => 'French Guiana',
		'PF' => 'French Polynesia',
		'TF' => 'French Southern Territories',
		'GA' => 'Gabon',
		'GM' => 'Gambia',
		'GE' => 'Georgia',
		'DE' => 'Germany',
		'GH' => 'Ghana',
		'GI' => 'Gibraltar',
		'GR' => 'Greece',
		'GL' => 'Greenland',
		'GD' => 'Grenada',
		'GP' => 'Guadeloupe',
		'GU' => 'Guam',
		'GT' => 'Guatemala',
		'GG' => 'Guernsey',
		'GW' => 'Guinea-Bissau',
		'GN' => 'Guinea',
		'GY' => 'Guyana',
		'HT' => 'Haiti',
		'HM' => 'Heard Island and McDonald Islands',
		'VA' => 'Holy See (Vatican City State)',
		'HN' => 'Honduras',
		'HK' => 'Hong Kong',
		'HU' => 'Hungary',
		'IS' => 'Iceland',
		'IN' => 'India',
		'ID' => 'Indonesia',
		'IR' => 'Iran, Islamic Republic of',
		'IQ' => 'Iraq',
		'IE' => 'Ireland',
		'IM' => 'Isle of Man',
		'IL' => 'Israel',
		'IT' => 'Italy',
		'JM' => 'Jamaica',
		'JP' => 'Japan',
		'JE' => 'Jersey',
		'JO' => 'Jordan',
		'KZ' => 'Kazakhstan',
		'KE' => 'Kenya',
		'KI' => 'Kiribati',
		'KP' => 'Korea, Democratic People\'s Republic of',
		'KR' => 'Korea, Republic of',
		'KW' => 'Kuwait',
		'KG' => 'Kyrgyzstan',
		'LA' => 'Lao People\'s Democratic Republic',
		'LV' => 'Latvia',
		'LB' => 'Lebanon',
		'LS' => 'Lesotho',
		'LR' => 'Liberia',
		'LY' => 'Libyan Arab Jamahiriya',
		'LI' => 'Liechtenstein',
		'LT' => 'Lithuania',
		'LU' => 'Luxembourg',
		'MO' => 'Macao',
		'MK' => 'Macedonia',
		'MG' => 'Madagascar',
		'MW' => 'Malawi',
		'MY' => 'Malaysia',
		'MV' => 'Maldives',
		'ML' => 'Mali',
		'MT' => 'Malta',
		'MH' => 'Marshall Islands',
		'MQ' => 'Martinique',
		'MR' => 'Mauritania',
		'MU' => 'Mauritius',
		'YT' => 'Mayotte',
		'MX' => 'Mexico',
		'FM' => 'Micronesia, Federated States of',
		'MD' => 'Moldova, Republic of',
		'MC' => 'Monaco',
		'MN' => 'Mongolia',
		'ME' => 'Montenegro',
		'MS' => 'Montserrat',
		'MA' => 'Morocco',
		'MZ' => 'Mozambique',
		'MM' => 'Myanmar',
		'NA' => 'Namibia',
		'NR' => 'Nauru',
		'NP' => 'Nepal',
		'NL' => 'Netherlands',
		'NC' => 'New Caledonia',
		'NZ' => 'New Zealand',
		'NI' => 'Nicaragua',
		'NE' => 'Niger',
		'NG' => 'Nigeria',
		'NU' => 'Niue',
		'NF' => 'Norfolk Island',
		'MP' => 'Northern Mariana Islands',
		'NO' => 'Norway',
		'OM' => 'Oman',
		'PK' => 'Pakistan',
		'PW' => 'Palau',
		'PS' => 'Palestinian Territory',
		'PA' => 'Panama',
		'PG' => 'Papua New Guinea',
		'PY' => 'Paraguay',
		'PE' => 'Peru',
		'PH' => 'Philippines',
		'PN' => 'Pitcairn',
		'PL' => 'Poland',
		'PT' => 'Portugal',
		'PR' => 'Puerto Rico',
		'QA' => 'Qatar',
		'RE' => 'Reunion',
		'RO' => 'Romania',
		'RU' => 'Russian Federation',
		'RW' => 'Rwanda',
		'BL' => 'Saint Barthelemy',
		'SH' => 'Saint Helena',
		'KN' => 'Saint Kitts and Nevis',
		'LC' => 'Saint Lucia',
		'MF' => 'Saint Martin',
		'PM' => 'Saint Pierre and Miquelon',
		'VC' => 'Saint Vincent and the Grenadines',
		'WS' => 'Samoa',
		'SM' => 'San Marino',
		'ST' => 'Sao Tome and Principe',
		'SA' => 'Saudi Arabia',
		'SN' => 'Senegal',
		'RS' => 'Serbia',
		'SC' => 'Seychelles',
		'SL' => 'Sierra Leone',
		'SG' => 'Singapore',
		'SX' => 'Sint Maarten',
		'SK' => 'Slovakia',
		'SI' => 'Slovenia',
		'SB' => 'Solomon Islands',
		'SO' => 'Somalia',
		'ZA' => 'South Africa',
		'GS' => 'South Georgia and the South Sandwich Islands',
		'SS' => 'South Sudan',
		'ES' => 'Spain',
		'LK' => 'Sri Lanka',
		'SD' => 'Sudan',
		'SR' => 'Suriname',
		'SJ' => 'Svalbard and Jan Mayen',
		'SZ' => 'Swaziland',
		'SE' => 'Sweden',
		'CH' => 'Switzerland',
		'SY' => 'Syrian Arab Republic',
		'TW' => 'Taiwan',
		'TJ' => 'Tajikistan',
		'TZ' => 'Tanzania, United Republic of',
		'TH' => 'Thailand',
		'TL' => 'Timor-Leste',
		'TG' => 'Togo',
		'TK' => 'Tokelau',
		'TO' => 'Tonga',
		'TT' => 'Trinidad and Tobago',
		'TN' => 'Tunisia',
		'TR' => 'Turkey',
		'TM' => 'Turkmenistan',
		'TC' => 'Turks and Caicos Islands',
		'TV' => 'Tuvalu',
		'UG' => 'Uganda',
		'UA' => 'Ukraine',
		'AE' => 'United Arab Emirates',
		'GB' => 'United Kingdom',
		'UM' => 'United States Minor Outlying Islands',
		'US' => 'United States',
		'UY' => 'Uruguay',
		'UZ' => 'Uzbekistan',
		'VU' => 'Vanuatu',
		'VE' => 'Venezuela',
		'VN' => 'Vietnam',
		'VG' => 'Virgin Islands, British',
		'VI' => 'Virgin Islands, U.S.',
		'WF' => 'Wallis and Futuna',
		'EH' => 'Western Sahara',
		'YE' => 'Yemen',
		'ZM' => 'Zambia',
		'ZW' => 'Zimbabwe',
	];
}

/**
 * Get a letter of the alphabet corresponding to the passed zero based index.
 *
 * @param integer $index Letter of the alphabet to get.
 * @return string
 */
function get_letter( int $index ) : string {
	for ( $out = ''; $index >= 0; $index = intval( $index / 26 ) - 1 ) {
		$out = chr( $index % 26 + 0x41 ) . $out;
	}
	return $out;
}

/**
 * Make an HTTP request to ClickHouse.
 *
 * @param string $query SQL statement, if $body is present it will be encoded into the request URL.
 * @param array $params Array of query parameters to add to the query string, will be automatically prefixed with `param_` for interpolation of values.
 * @param string $return Optional return type. Can be 'array', 'object' or 'raw', default 'array'.
 * @param string|null $body Optional query body. For use with queries like INSERT with JsonEachRow format.
 * @return null|\stdClass|\stdClass[]|WP_Error
 */
function query( string $query, array $params = [], string $return = 'array', ?string $body = null ) {
	$config = [
		'host' => defined( 'ALTIS_CLICKHOUSE_HOST' ) ? ALTIS_CLICKHOUSE_HOST : 'clickhouse',
		'port' => defined( 'ALTIS_CLICKHOUSE_PORT' ) ? ALTIS_CLICKHOUSE_PORT : 8123,
		'user' => defined( 'ALTIS_CLICKHOUSE_USER' ) ? ALTIS_CLICKHOUSE_USER : 'default',
		'pass' => defined( 'ALTIS_CLICKHOUSE_PASS' ) ? ALTIS_CLICKHOUSE_PASS : '',
		'db' => defined( 'ALTIS_CLICKHOUSE_DB' ) ? ALTIS_CLICKHOUSE_DB : 'default',
	];

	/**
	 * Filter the default Clickhouse connection configuration.
	 */
	$config = apply_filters( 'altis.analytics.clickhouse_config', $config );

	$clickhouse_url = sprintf( '%s://%s:%s',
		strpos( $config['port'], '443' ) !== false ? 'https' : 'http',
		$config['host'],
		$config['port']
	);

	// Build request args.
	$request_args = [
		'body' => $query,
		'timeout' => 20,
		'headers' => [
			'X-Clickhouse-User' => $config['user'],
			'X-Clickhouse-Key' => $config['pass'],
			'X-Clickhouse-Database' => $config['db'],
			'X-Clickhouse-Format' => 'JSONEachRow',
			'X-Clickhouse-Timezone' => 'UTC',
			'Accept-Encoding' => 'gzip',
		],
	];

	// Append $query as the URL `query` parameter if $body is present and overwite request arg.
	if ( ! empty( $body ) ) {
		$clickhouse_url = sprintf( '%s?query=%s',
			$clickhouse_url,
			urlencode( $query )
		);

		$request_args['body'] = $body;
	}

	// Add query parameters.
	if ( ! empty( $params ) ) {
		$prepared = [];
		foreach ( $params as $key => $value ) {
			$value = is_array( $value )
				? str_replace( '"', "'", json_encode( $value ) ) // Arrays must be JSON encoded with single quotes.
				: $value;
			$prepared[ 'param_' . urlencode( $key ) ] = urlencode( $value );
		}
		$clickhouse_url = add_query_arg( $prepared, $clickhouse_url );
	}

	// Enable compression.
	$clickhouse_url = add_query_arg( [
		'enable_http_compression' => 1,
	], $clickhouse_url );

	/**
	 * Filter the args used to control the request type.
	 */
	$request_args = apply_filters( 'altis.analytics.clickhouse.request_args', $request_args, $query, $params, $body );

	$response = wp_remote_post(
		$clickhouse_url,
		$request_args
	);

	if ( ! headers_sent() && defined( 'ALTIS_ACCELERATE_CLICKHOUSE_DEBUG' ) && ALTIS_ACCELERATE_CLICKHOUSE_DEBUG ) {
		header( sprintf( 'X-Clickhouse-Query-Params: %s', wp_json_encode( $prepared ) ), false );
		header( sprintf( 'X-Clickhouse-Query-SQL: %s', wp_json_encode( preg_replace( '/\s+/', ' ', $request_args['body'] ?? 'empty' ) ) ), false );
	}

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	if ( wp_remote_retrieve_response_code( $response ) > 299 ) {
		return new WP_Error( 'clickhouse_query_error', wp_remote_retrieve_body( $response ) );
	}


	// Map rows of JSON to objects.
	$result = wp_remote_retrieve_body( $response );
	if ( $return === 'raw' ) {
		return $result;
	}

	$result = explode( "\n", $result );
	$result = array_filter( $result );
	$result = array_map( 'json_decode', $result );

	// For single or zero results assume this is just a row of aggregate values and return it.
	if ( $return === 'object' ) {
		return reset( $result );
	}

	// Return array.
	return $result;
}

/**
 * Get a unique cache key from a set of arguments.
 *
 * @param string $prefix The cache key prefix.
 * @param mixed ...$args List of arguments to generate a cache key from.
 * @return string
 */
function get_cache_key( string $prefix, ...$args ) : string {
	return sprintf( '%s:%s', $prefix, hash( 'sha1', serialize( $args ) ) );
}

/**
 * Return plugin version.
 *
 * @return string
 */
function get_plugin_version() : string {
	// Only show version if this is embedded in the accelerate plugin.
	if ( defined( 'Altis\\Accelerate\\VERSION' ) ) {
		return \Altis\Accelerate\VERSION;
	}
	return '';
}
