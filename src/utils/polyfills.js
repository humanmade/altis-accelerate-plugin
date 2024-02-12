/**
 * Polyfills CustomEvent.
 */
( function () {
	if ( typeof window.CustomEvent === 'function' ) {
		return false;
	}

	/**
	 * Creates a custom event handler.
	 *
	 * @param {string} event The event name.
	 * @param {Object} params The event options.
	 * @returns {Event} The new custom event.
	 */
	function CustomEvent( event, params ) {
		params = params || {
			bubbles: false,
			cancelable: false,
			detail: null,
		};
		const evt = document.createEvent( 'CustomEvent' );
		evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
		return evt;
	}

	window.CustomEvent = CustomEvent;
} )();

window.console = window.console || {
	/**
	 * Log placeholder function.
	 */
	log () { },
	/**
	 * Warn placeholder function.
	 */
	warn () { },
	/**
	 * Error placeholder function.
	 */
	error () { },
};
