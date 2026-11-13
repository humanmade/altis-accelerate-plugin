import { __ } from '@wordpress/i18n';

import { DIRECT_SEGMENT_KEY, OTHER_SEGMENT_KEY } from '../../../utils/admin';

/**
 * Display formatter for BreakdownPanel rows.
 * Strips `https?://`, a leading `www.`, and a single trailing slash (only
 * when no path follows) so referrer hosts read as `twitter.com` instead of
 * `https://www.twitter.com/`. Bare host keys from the referrer aggregation
 * (already domain-only) still drop a leading `www.`. Non-host inputs
 * (campaign names, "Direct traffic", "source / utm" pairs) pass through
 * unchanged — the www. strip only runs on URL-like or host-like values.
 *
 * Pure display transform — the original value should still be used as
 * the sort key so layout-animate reorder stays stable.
 */
export function prettyLabel( value: string ): string {
	if ( value === DIRECT_SEGMENT_KEY ) {
		return __( 'Direct traffic', 'altis' );
	}
	if ( value === OTHER_SEGMENT_KEY ) {
		return __( 'Other', 'altis' );
	}
	if ( ! value ) {
		return value;
	}
	if ( /^https?:\/\//i.test( value ) ) {
		let s = value.replace( /^https?:\/\//i, '' ).replace( /^www\./i, '' );
		if ( s.endsWith( '/' ) && s.indexOf( '/' ) === s.length - 1 ) {
			s = s.slice( 0, -1 );
		}
		return s;
	}
	// Bare host keys (referrer aggregation uses domain() without a scheme).
	if ( /^www\./i.test( value ) && ! /\s/.test( value ) ) {
		return value.replace( /^www\./i, '' );
	}
	return value;
}
