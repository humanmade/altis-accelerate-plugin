/**
 * HubSpot form submission classifier.
 *
 * Both HubSpot embed generations (legacy v2 `js.hsforms.net/forms/embed/v2.js`
 * including leadin popups, and the modern `embed/{portalId}.js` loader) post
 * the same window message on successful submission:
 *
 *   { type: 'hsFormCallback', eventName: 'onFormSubmitted', id: '<form guid>' }
 *
 * so one classifier covers both. `onFormSubmit` (no trailing "ted") fires
 * BEFORE submission completes and is deliberately ignored — we only record
 * confirmed submissions. Pure function so fixtures cover hostile payloads.
 */

/**
 * Classify a window message payload as a HubSpot form submission.
 *
 * @param {*} data The `message` event's data property.
 * @returns {?{ formId: string }} The submitted form's GUID, or null.
 */
export function getFormSubmission( data ) {
	if ( ! data || typeof data !== 'object' ) {
		return null;
	}
	if ( data.type !== 'hsFormCallback' || data.eventName !== 'onFormSubmitted' ) {
		return null;
	}
	const formId = data.id ?? data.data?.formGuid;
	if ( typeof formId !== 'string' || formId === '' ) {
		return null;
	}
	return { formId };
}
