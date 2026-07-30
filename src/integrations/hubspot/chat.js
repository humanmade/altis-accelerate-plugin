/**
 * HubSpot Conversations (chat widget) engagement capture.
 *
 * The widget exposes `window.HubSpotConversations.on( event, cb )`, but loads
 * lazily — possibly after us. HubSpot's documented readiness contract is the
 * `window.hsConversationsOnReady` array: callbacks pushed there run once the
 * SDK initializes (immediately if it already has). Creating the array when
 * absent is safe and a permanent no-op on pages that never load the widget.
 *
 * `conversationStarted` fires when the visitor sends their FIRST message —
 * a real engagement signal, not just opening the widget. Only the interaction
 * type is captured; conversation IDs and message content never are.
 */

/**
 * Register chat lifecycle handlers with the Conversations SDK.
 *
 * @param {Function} onInteraction Called with 'started' | 'closed'.
 * @param {Window} win Window object (injectable for tests).
 * @returns {void}
 */
export function wireChat( onInteraction, win = window ) {
	const register = () => {
		const conversations = win.HubSpotConversations;
		if ( ! conversations || typeof conversations.on !== 'function' ) {
			return;
		}
		conversations.on( 'conversationStarted', () => onInteraction( 'started' ) );
		conversations.on( 'conversationClosed', () => onInteraction( 'closed' ) );
	};

	if ( win.HubSpotConversations ) {
		register();
		return;
	}

	win.hsConversationsOnReady = win.hsConversationsOnReady || [];
	win.hsConversationsOnReady.push( register );
}
