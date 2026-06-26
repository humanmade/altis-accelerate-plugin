/**
 * Display formatter for the BreakdownPanel list rows. Strips the `https?://`
 * scheme, a leading `www.`, and a single trailing slash (only when no
 * path follows) so referrer hosts read as `twitter.com` instead of
 * `https://twitter.com/`. Non-URL inputs (campaign names, the
 * "Direct traffic" label, "source / utm" pair strings) pass through
 * unchanged.
 *
 * Pure display transform — the original value should still be used as
 * the sort key so layout-animate reorder stays stable.
 */
export function prettyLabel( value: string ): string {
	if ( ! value ) {
		return value;
	}
	if ( ! /^https?:\/\//i.test( value ) ) {
		return value;
	}
	let s = value.replace( /^https?:\/\//i, '' ).replace( /^www\./i, '' );
	if ( s.endsWith( '/' ) && s.indexOf( '/' ) === s.length - 1 ) {
		s = s.slice( 0, -1 );
	}
	return s;
}
