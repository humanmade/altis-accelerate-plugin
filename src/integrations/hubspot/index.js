/**
 * HubSpot signals bundle.
 *
 * Built as its own webpack entry and only enqueued (with its inline config)
 * when the HubSpot integration setting is enabled — pages on sites with it
 * disabled never ship a byte of this. Everything goes through the public
 * `Altis.Analytics` API: listener registration happens inside `onReady()`
 * (which only fires after consent-gated startAnalytics), `record()` inherits
 * Noop suppression, and `updateEndpoint()` re-evaluates audiences after each
 * merge, so in-page personalization reacts immediately to new signals.
 *
 * Handlers are defensive throughout — a malformed payload or an unexpected
 * widget API must never throw into the host page.
 */

import { wireChat } from './chat';
import { getEmailArrival } from './email';
import { getFormSubmission } from './forms';

const SESSION_GUARD_PREFIX = 'altis.hubspot.emailArrival.';

/**
 * Resolve an asset ID to its synced name, falling back to the raw ID when no
 * directory entry exists (no token configured, or asset created since the
 * last sync).
 *
 * @param {Object} directory ID → name map.
 * @param {string} id Asset ID.
 * @returns {string}
 */
export function resolveName( directory, id ) {
	if ( directory && typeof directory === 'object' && typeof directory[ id ] === 'string' && directory[ id ] !== '' ) {
		return directory[ id ];
	}
	return id;
}

/**
 * Build the deduplicated next value for an endpoint attribute list.
 *
 * Endpoint attribute arrays are overwritten (not concatenated) by the
 * tracker's merge, so accumulation is: read current, append if absent, write
 * the full array back — the same pattern the tracker itself uses for
 * referers and UTM params.
 *
 * @param {?Array} current Current attribute value from the endpoint.
 * @param {string[]} values Values to ensure are present.
 * @returns {?string[]} The new full array, or null when nothing changed.
 */
export function appendedList( current, values ) {
	const list = Array.isArray( current ) ? current.slice() : [];
	let changed = false;
	for ( const value of values ) {
		if ( ! list.includes( value ) ) {
			list.push( value );
			changed = true;
		}
	}
	return changed ? list : null;
}

/**
 * Append values to endpoint attribute lists and persist via the tracker.
 *
 * @param {Object} analytics The Altis.Analytics API object.
 * @param {Object} updates Map of attribute name → values to append.
 * @returns {void}
 */
function appendEndpointLists( analytics, updates ) {
	const endpoint = analytics.getEndpoint() || {};
	const attributes = endpoint.Attributes || {};
	const next = {};
	let changed = false;

	for ( const [ attribute, values ] of Object.entries( updates ) ) {
		const list = appendedList( attributes[ attribute ], values );
		if ( list ) {
			next[ attribute ] = list;
			changed = true;
		}
	}

	if ( ! changed ) {
		return;
	}

	// updateEndpoint merges, persists, and re-evaluates audiences.
	analytics.updateEndpoint( { Attributes: next } );
}

/**
 * Wire all configured HubSpot signal listeners.
 *
 * Exported for tests; auto-invoked at the bottom of the module in the page.
 *
 * @param {Window} win Window object (injectable for tests).
 * @returns {void}
 */
export function bootstrap( win = window ) {
	const analytics = win.Altis?.Analytics;
	const config = analytics?.Integrations?.HubSpot;
	if ( ! analytics || ! config ) {
		return;
	}

	const signals = config.Signals || {};

	// Form submissions — one message listener covers both embed generations.
	if ( signals.forms ) {
		win.addEventListener( 'message', event => {
			try {
				const submission = getFormSubmission( event.data );
				if ( ! submission ) {
					return;
				}
				const formName = resolveName( config.FormDirectory, submission.formId );
				analytics.record( 'formSubmission', {
					attributes: {
						formId: submission.formId,
						formName: formName,
						formProvider: 'hubspot',
					},
				} );
				appendEndpointLists( analytics, {
					hubspot_forms_submitted: [ formName ],
					hubspot_forms_submitted_ids: [ submission.formId ],
				} );
			} catch ( e ) {
				// Never throw into the page.
			}
		} );
	}

	// Email arrival — landing URL carries _hsmi. Guarded once per email per
	// browser session so SPA-style navigation can't re-record the arrival.
	if ( signals.email ) {
		try {
			const arrival = getEmailArrival( win.location.search );
			if ( arrival && ! win.sessionStorage.getItem( SESSION_GUARD_PREFIX + arrival.emailId ) ) {
				win.sessionStorage.setItem( SESSION_GUARD_PREFIX + arrival.emailId, '1' );
				const emailName = resolveName( config.EmailDirectory, arrival.emailId );
				analytics.record( 'emailArrival', {
					attributes: {
						emailId: arrival.emailId,
						emailName: emailName,
						emailProvider: 'hubspot',
					},
				} );
				appendEndpointLists( analytics, {
					hubspot_emails_arrived: [ emailName ],
					hubspot_emails_arrived_ids: [ arrival.emailId ],
				} );
			}
		} catch ( e ) {
			// sessionStorage can throw under blocked-storage policies — the
			// signal is best-effort.
		}
	}

	// Chat engagement — registers with the Conversations SDK whenever it
	// loads; permanent no-op on pages without the widget.
	if ( signals.chat ) {
		wireChat( interactionType => {
			try {
				analytics.record( 'chatInteraction', {
					attributes: {
						interactionType: interactionType,
						chatProvider: 'hubspot',
					},
				} );
				if ( interactionType === 'started' ) {
					appendEndpointLists( analytics, {
						hubspot_chat_engaged: [ 'started' ],
					} );
				}
			} catch ( e ) {
				// Never throw into the page.
			}
		}, win );
	}
}

// Consent-gated: Ready only becomes true inside startAnalytics().
if ( typeof window !== 'undefined' && window.Altis?.Analytics?.onReady ) {
	window.Altis.Analytics.onReady( () => bootstrap( window ) );
}
