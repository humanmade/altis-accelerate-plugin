/**
 * Outbound link click filter.
 *
 * Pure(-ish) function extracted so the click classification can be
 * unit-tested without the rest of the analytics bundle. Given a click
 * event and the current page's hostname/URL, returns the lowercase
 * destination host when the click should be recorded as an outbound
 * link click — or `null` to skip.
 *
 * Skipped:
 *  - clicks that another listener has already cancelled (defaultPrevented)
 *  - clicks whose target isn't an Element or doesn't sit inside an <a href>
 *  - non-left-click + modifier-clicks (cmd/ctrl/shift/alt + middle/right)
 *  - non-http(s) protocols (mailto:, tel:, javascript:, ...)
 *  - links that resolve to the current page's hostname (case-insensitive)
 *
 * Same-suffix subdomains and multisite domain aliases register as
 * outbound until an allow-list filter ships (post-phase-1 of #623).
 *
 * @param {Event} event           A bubble-phase click event.
 * @param {string} currentHostname `window.location.hostname` (case-insensitive compare).
 * @param {string} baseUrl         `window.location.href`, used to resolve relative + protocol-relative hrefs.
 * @returns {string|null} The lowercased outbound host, or null to skip.
 */
export function getOutboundHostFromClick( event, currentHostname, baseUrl ) {
	if ( event.defaultPrevented ) {
		return null;
	}
	if ( ! ( event.target instanceof Element ) ) {
		return null;
	}
	const a = event.target.closest( 'a[href]' );
	if ( ! a ) {
		return null;
	}
	if ( event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) {
		return null;
	}
	let u;
	try {
		u = new URL( a.getAttribute( 'href' ), baseUrl );
	} catch ( err ) {
		return null;
	}
	if ( ! /^https?:$/.test( u.protocol ) ) {
		return null;
	}
	const host = u.hostname.toLowerCase();
	if ( host === currentHostname.toLowerCase() ) {
		return null;
	}
	return host;
}
