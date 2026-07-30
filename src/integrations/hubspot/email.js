/**
 * HubSpot marketing email arrival detection.
 *
 * Links in HubSpot marketing emails carry `_hsmi` (the marketing email send
 * identifier, numeric) and `_hsenc` (an opaque recipient-identifying token).
 * Arrival from an email is the `_hsmi` value alone — `_hsenc` is never read
 * beyond existence and NEVER stored: it identifies the recipient, which would
 * cross the no-PII line. Accelerate's native UTM capture already covers the
 * generic `utm_*` params on these links; this adds the specific email
 * identity UTMs don't carry.
 */

/**
 * Extract a HubSpot email arrival from a URL query string.
 *
 * @param {string} search The URL query string (location.search).
 * @returns {?{ emailId: string }} The numeric email send ID, or null.
 */
export function getEmailArrival( search ) {
	if ( typeof search !== 'string' || search === '' ) {
		return null;
	}
	let params;
	try {
		params = new URLSearchParams( search );
	} catch ( e ) {
		return null;
	}
	const hsmi = params.get( '_hsmi' );
	// Strictly numeric — anything else is malformed or tampered.
	if ( ! hsmi || ! /^[0-9]+$/.test( hsmi ) ) {
		return null;
	}
	return { emailId: hsmi };
}
