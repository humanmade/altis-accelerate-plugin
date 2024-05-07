// Ensure Experiments global object is set.
window.Altis.Analytics.Experiments = window.Altis.Analytics.Experiments || {};

// Track if an AB test has been seen- only need to record the first view even if the
// component occurs multiple times on a page.
const testIsTracked = {};

/**
 * Test element base class.
 *
 * @param {object} SuperClass
 */
const Test = SuperClass => class extends SuperClass {

	storageKey = '_altis_ab_tests';

	tracked = false;

	get testId() {
		return this.getAttribute( 'test-id' );
	}

	get postId() {
		return this.getAttribute( 'post-id' );
	}

	get testIdWithPost() {
		return `${ this.testId }_${ this.postId }`;
	}

	get trafficPercentage() {
		return parseFloat( this.getAttribute( 'traffic-percentage' ) );
	}

	get variants() {
		return JSON.parse( this.getAttribute( 'variants' ) ) || [];
	}

	get variantWeights() {
		return ( JSON.parse( this.getAttribute( 'variant-weights' ) ) || [] ).map( parseFloat );
	}

	get fallback() {
		return this.getAttribute( 'fallback' );
	}

	get goal() {
		return this.getAttribute( 'goal' );
	}

	get selector() {
		return this.getAttribute( 'selector' );
	}

	get closest() {
		return this.getAttribute( 'closest' );
	}

	connectedCallback() {
		// Extract test set by URL parameters.
		const regex = new RegExp( `(utm_campaign|set_test)=test_${ this.testIdWithPost }:(\\d+)`, 'i' );
		const urlTest = unescape( window.location.search ).match( regex );
		if ( urlTest ) {
			this.addTestForUser( { [ this.testIdWithPost ]: parseInt( urlTest[ 2 ], 10 ) } );
		}

		// Initialise component.
		this.init();
	}

	init() {
		window.console && window.console.error( 'Children of Class Test must implement an init() method.' );
	}

	getTestsForUser() {
		return JSON.parse( window.localStorage.getItem( this.storageKey ) ) || {};
	}

	addTestForUser( test ) {
		window.localStorage.setItem( this.storageKey, JSON.stringify( {
			...this.getTestsForUser(),
			...test,
		} ) );
	}

	getVariantId() {
		const testId = this.testIdWithPost;
		const trafficPercentage = this.trafficPercentage;

		// Check if this user already have a variant for this test.
		const currentTests = this.getTestsForUser();
		let variantId = false;
		// Test variant can be 0 so check for not undefined and not strictly false and
		// that it's a valid index.
		if (
			typeof currentTests[ testId ] !== 'undefined' &&
			currentTests[ testId ] !== false &&
			currentTests[ testId ] < this.variants.length
		) {
			variantId = currentTests[ testId ];
		} else if ( currentTests[ testId ] === false ) {
			return variantId;
		} else {
			// Otherwise lets check the probability we should experiment on this individual.
			// That sounded weird.
			if ( Math.random() * 100 > trafficPercentage ) {
				// Exclude from this test.
				this.addTestForUser( {
					[ testId ]: false,
				} );
				return variantId;
			}
			// Add one of the variants to the cookie according to its weight.
			const target = Math.random() * 100;
			variantId = 0;
			let percent = 0;
			for ( let i = 0; i < this.variants.length; i++ ) {
				percent += parseFloat( ( this.variantWeights[ i ] || ( 100 / this.variants.length ) ) );
				if ( target < percent ) {
					variantId = i;
					break;
				}
			}
			this.addTestForUser( {
				[ testId ]: variantId,
			} );
		}

		return variantId;
	}

}

/**
 * Custom AB Test element.
 */
class ABTest extends Test(HTMLElement) {

	init() {
		// Assign variant ID.
		const variantId = this.getVariantId();

		// Don't process if not part of the test.
		if ( variantId === false ) {
			this.outerHTML = this.fallback;
			return;
		}

		// Get data for event listener.
		const testId = this.testId;
		const postId = this.postId;
		const parent = this.parentNode;
		const goal = this.goal.split( ':' );
		const closest = this.closest;
		const [ eventType, selector = this.selector ] = goal;

		// Get the variant content.
		const variant = this.variants[ variantId || 0 ];

		// Replace the contents of our <ab-test> element.
		this.outerHTML = variant;

		// Call goal handler on parent.
		const goalHandler = getGoalHandler( eventType, {
			selector,
			closest,
		} );

		if ( ! eventType || ! goalHandler ) {
			return;
		}

		// Log an event for tracking test views.
		if ( ! testIsTracked[ testId ] ) {
			// Prevent spamming events.
			testIsTracked[ testId ] = true;

			window.Altis.Analytics.onReady( () => {
				window.Altis.Analytics.record( 'testView', {
					attributes: {
						eventTestId: this.testId,
						eventPostId: this.postId,
						eventVariantId: variantId,
					},
				} );
			} );
		}

		// Apply goal callback.
		goalHandler( parent, ( attributes = {}, metrics = {} ) => {
			window.Altis.Analytics.record( eventType, {
				attributes: {
					...attributes,
					eventTestId: testId,
					eventPostId: postId,
					eventVariantId: variantId,
				},
				metrics: {
					...metrics,
				},
			} );
		} );
	}

}

/**
 * Static list of goal handlers.
 */
const goalHandlers = {};

/**
 * Add an event handler for recording an analytics event.
 * The event is then used to determine the goal success.
 *
 * Callback receives the target node and a function to record
 * to record the event.
 *
 * @param {string} name Of the goal.
 * @param {Function} callback To bind an event listener.
 * @param {string[]} closest Array of allowed node types to bind listener to.
 */
const registerGoalHandler = ( name, callback, closest = [] ) => {
	goalHandlers[ name ] = {
		callback,
		closest: Array.isArray( closest ) ? closest : [ closest ],
	};
};

/**
 * Attaches an event listener to a node and passes event data to a callback when fired.
 *
 * @param {HTMLElement} node The target node to attach the event listener to.
 * @param {Function} record The function called by the event listener to record an event.
 * @param {string} on The JS dvent name to listen on.
 * @returns {?EventListener} The event listener handle if successful or undefined.
 */
const bindListener = ( node, record, on ) => node && node.addEventListener( on, event => {
	if ( typeof record !== 'function' ) {
		console.error( 'Altis Analytics goal handler is not a function', node, event );
		return;
	}
	record( event );
} );

/**
 * Get a goal handling function.
 *
 * @param {string} name The name of a registered goal, goal handler or a valid JS event.
 * @param {Object} options Optional overrides for the registered goal properties.
 * @returns {Function} Callback for recording the goal.
 */
const getGoalHandler = ( name, options = {} ) => {
	// Compile the goal configuration.
	const goal = {
		name,
		event: name,
		callback: bindListener,
		...( window.Altis.Analytics.Experiments.Goals[ name ] || {} ),
		...( goalHandlers[ name ] || {} ),
		...options,
	};

	// Return a callback that handles the goal configuration and binds event listeners.
	return ( node, record ) => {
		if ( goal.closest ) {
			node = node.closest( goal.closest );
		}

		if ( goal.selector ) {
			node.querySelectorAll( goal.selector ).forEach( child => goal.callback( child, record, goal.event ) );
			return;
		}

		goal.callback( node, record, goal.event );
	};
};

// Register built in click goal handler.
registerGoalHandler( 'click', ( element, record ) => {
	if ( ! element ) {
		return;
	}

	// Collect attributes.
	const attributes = {
		elementNode: element.nodeName || '',
		elementText: element.innerText || '',
		elementClassName: element.className || '',
		elementId: element.id || '',
		elementHref: element.href || '',
	};

	// Bind handler.
	element.addEventListener( 'click', event => {
		record( Object.assign( {}, attributes, {
			targetNode: event.target.nodeName || '',
			targetText: event.target.innerText || '',
			targetClassName: event.target.className || '',
			targetId: event.target.id || '',
			targetSrc: event.target.nodeName === 'IMG' ? event.target.src : '',
		} ) );
	} );
}, [ 'a' ] );

/**
 * Broadcast content block element.
 */
class BroadcastBlock extends HTMLElement {

	get clientId() {
		return this.getAttribute( 'client-id' );
	}

	get broadcastId() {
		return this.getAttribute( 'broadcast-id' );
	}

	connectedCallback() {
		// Set default styles.
		this.attachShadow( { mode: 'open' } );
		this.shadowRoot.innerHTML = `
			<style>
				:host {
					display: block;
				}
				::slotted(*) {
					margin-inline-start: 0;
					margin-inline-end: 0;
				}
			</style>
			<slot></slot>
		`;

		// Update the component content.
		this.setContent();
	}

	/**
	 * Updates the block content if needed and performs analytics tracking actions.
	 */
	setContent() {
		// Track the template we want.
		const templates = document.querySelectorAll( `template[data-parent-id="${ this.clientId }"]` );
		if ( templates.length < 1 ) {
			// eslint-disable-next-line no-console,max-len
			console.info( `Could not find blocks to render for this Broadcast [ ${ this.clientId }, ${ this.broadcastId} ].` );
			return;
		}

		// Select a random nested template
		const index = this.getTemplateToShow( templates.length );

		if ( index < 0 ) {
			// eslint-disable-next-line no-console,max-len
			console.info( `Could not choose a block to render for this Broadcast [ ${ this.clientId }, ${ this.broadcastId} ].` );
			return;
		}

		const template = templates[ index ];

		// Populate broadcast block content.
		const experience = template.content.cloneNode( true );
		this.innerHTML = '';
		this.appendChild( experience );

		// Log an event for tracking views and audience when scrolled into view.
		let tracked = false;
		const observer = new IntersectionObserver( ( entries, _observer ) => {
			entries.forEach( entry => {
				if ( entry.target !== this || ! entry.isIntersecting ) {
					return;
				}

				if ( tracked ) {
					return;
				}

				// Prevent spamming events.
				tracked = true;
				_observer.disconnect();

				window.Altis.Analytics.record( 'blockView', {
					attributes: {
						clientId: this.clientId,
						blockId: this.broadcastId,
						selected: index,
						type: 'broadcast',
					},
				} );
			} );
		}, {
			threshold: 0.75,
		} );

		// Trigger scroll handler.
		observer.observe( this );

	}

	/**
	 * Get which variation to show, based on endpoint history.
	 *
	 * @param {number} count Count of available variations.
	 *
	 * @returns {number} Get next variation to show.
	 */
	getTemplateToShow( count ) {
		const key = `altis.broadcast.${ this.broadcastId }.lastViewed`;
		let index = 0;
		const lastViewed = window.localStorage.getItem( key );

		// If we have a last viewed template, and its a valid number
		if ( lastViewed !== null && ! Number.isNaN( lastViewed ) ) {
			index = parseInt( lastViewed, 10 ) + 1;
		}

		// If we exceeded the count of available templates, reset back to the first
		if ( index > count - 1 ) {
			index = 0;
		}

		window.localStorage.setItem( key, index );
		return index;
	}

}


/**
 * Synced Pattern content block element.
 *
 * @param {object} SuperClass
 */
const Global = SuperClass => class extends SuperClass {

	logEvents = true;

	get blockId() {
		console.log(this, this.getAttribute( 'block-id' ))
		return this.getAttribute( 'block-id' );
	}

	get goal() {
		return this.getAttribute( 'goal' ) || 'engagement';
	}

	get type() {
		return 'standard';
	}

	get attributes() {
		return JSON.parse( this.getAttribute( 'attributes' ) );
	}

	get metrics() {
		return JSON.parse( this.getAttribute( 'metrics' ) );
	}

	connectedCallback() {
		// Set default styles.
		this.attachShadow( { mode: 'open' } );
		this.shadowRoot.innerHTML = `
			<style>
				:host {
					display: block;
				}
				::slotted(*) {
					margin-inline-start: 0;
					margin-inline-end: 0;
				}
			</style>
			<slot></slot>
		`;

		// Optional setup prior to setContent.
		this.setup();

		// If block has a setContent method.
		this.setContent();

		if ( ! this.logEvents ) {
			return;
		}

		window.Altis.Analytics.record( 'blockLoad', {
			attributes: {
				blockId: this.blockId,
				type: this.type,
				...this.attributes,
			},
			metrics: this.metrics,
		} );

		// Log an event for tracking views and audience when scrolled into view.
		let tracked = false;
		const observer = new IntersectionObserver( ( entries, _observer ) => {
			entries.forEach( entry => {
				if ( entry.target !== this || ! entry.isIntersecting ) {
					return;
				}

				if ( tracked ) {
					return;
				}

				// Prevent spamming events.
				tracked = true;
				_observer.disconnect();

				window.Altis.Analytics.record( 'blockView', {
					attributes: {
						blockId: this.blockId,
						type: this.type,
						...this.attributes,
					},
					metrics: this.metrics,
				} );
			} );
		}, {
			threshold: 0.75,
		} );

		// Trigger scroll handler.
		observer.observe( this );

		// Get goal handler from registered goals.
		const goalHandler = getGoalHandler( this.goal );
		if ( ! goalHandler ) {
			return;
		}

		// Bind goal event handler to this component.
		let goalTracked = false;
		goalHandler( this, event => {
			if ( goalTracked ) {
				return;
			}

			// Only track once.
			goalTracked = true;

			window.Altis.Analytics.record( 'conversion', {
				attributes: {
					blockId: this.blockId,
					type: this.type,
					goal: this.goal,
					...this.attributes,
				},
				metrics: this.metrics,
			}, false );
		} );
	}

	// Optional set up before triggering.
	setup() {}

	// Callback to set content, by default renders contents via <slot></slot>.
	setContent() {}

};

class GlobalBlock extends Global(HTMLElement) {}

/**
 * Personalized content block element.
 */
class PersonalizationBlock extends Global(HTMLElement) {

	get attributes() {
		const attributes = JSON.parse( this.getAttribute( 'attributes' ) || '{}' );
		attributes.audience = this.audience || 0;
		return attributes;
	}

	get type() {
		return 'personalization';
	}

	setup() {
		// Attach a listener to update the content when audiences are changed.
		window.Altis.Analytics.on( 'updateAudiences', this.setContent.bind( this ) );
	}

	/**
	 * Updates the block content if needed and performs analytics tracking actions.
	 */
	setContent() {
		const audiences = window.Altis.Analytics.getAudiences() || [];

		// Track the audience for recording an event later.
		let audience = 0;

		// Track the template we want.
		let template;

		// Find a matching template.
		for ( let index = 0; index < audiences.length; index++ ) {
			// Find the first matching audience template.
			template = document.querySelector( `template[data-audience="${ audiences[ index ] }"][data-parent-id="${ this.blockId }"]` );
			if ( ! template ) {
				continue;
			}

			// We have a matching template, update audience and fallback value.
			audience = audiences[ index ];

			// Set goal.
			this.setAttribute( 'goal', template.dataset.goal || this.goal );
			break;
		}

		// Set fallback content if needed.
		if ( ! audience ) {
			template = document.querySelector( `template[data-fallback][data-parent-id="${ this.blockId }"]` );
			if ( ! template ) {
				return;
			}

			// Set goal.
			this.setAttribute( 'goal', template.dataset.goal || this.goal );
		}

		// Avoid resetting content if it hasn't changed.
		if ( this.audience === audience ) {
			return;
		}

		// Track the set audience to avoid unnecessary updates.
		this.audience = audience;

		// Populate experience block content.
		const experience = template.content.cloneNode( true );
		this.innerHTML = '';
		this.appendChild( experience );

		// Trigger content change event.
		window.dispatchEvent( new CustomEvent( 'altisBlockContentChanged', {
			detail: {
				target: this,
			},
		} ) );
	}

}

/**
 * Custom AB Test Block element.
 */
class ABTestBlock extends Global(Test(HTMLElement)) {

	logEvents = false;

	get attributes() {
		const attributes = JSON.parse( this.getAttribute( 'attributes' ) || '{}' );
		attributes.eventTestId = 'block';
		attributes.eventPostId = this.blockId;
		attributes.eventVariantId = this.getVariantId();
		return attributes;
	}

	get type() {
		return 'abtest';
 	}

	get paused() {
		return this.hasAttribute( 'paused' );
	}

	get testId() {
		return 'block';
	}

	get postId() {
		return this.blockId;
	}

	get variants() {
		return document.querySelectorAll( `template[data-parent-id="${ this.blockId }"]` );
	}

	get variantWeights() {
		return Array.from( this.variants ).map( variant => parseFloat( variant.dataset.weight || ( 100 / this.variants.length ) ) );
	}

	get winner() {
		if ( this.hasAttribute( 'winner' ) ) {
			return this.variants[ parseInt( this.getAttribute( 'winner' ), 10 ) ] || false;
		}
		return false;
	}

	setup() {
		// Extract test set by URL parameters.
		const regex = new RegExp( `(utm_campaign|set_test)=test_${ this.testIdWithPost }:(\\d+)`, 'i' );
		const urlTest = unescape( window.location.search ).match( regex );
		if ( urlTest ) {
			this.addTestForUser( { [ this.testIdWithPost ]: parseInt( urlTest[ 2 ], 10 ) } );
		}
	}

	setContent() {
		// Show winning variant if we have one.
		if ( this.winner !== false ) {
			this.innerHTML = '';
			this.appendChild( this.winner.content.cloneNode( true ) );
			return;
		}

		// Show default variant if test is paused.
		if ( this.paused ) {
			this.innerHTML = '';
			this.appendChild( this.variants[0].content.cloneNode( true ) );
			return;
		}

		// Assign variant ID.
		const variantId = this.getVariantId();

		// Get the variant template we want.
		const template = this.variants[ variantId || 0 ];
		if ( ! template ) {
			return;
		}

		// Populate experience block content.
		const experience = template.content.cloneNode( true );
		this.innerHTML = '';
		this.appendChild( experience );

		// Dispatch the altisblockcontentchanged event.
		window.dispatchEvent( new CustomEvent( 'altisBlockContentChanged', {
			detail: {
				target: this,
			},
		} ) );

		// If variant ID is false then this viewer is not part of the test so don't log events.
		if ( variantId === false ) {
			return;
		}

		// Get data for event listener.
		this.setAttribute( 'goal', template.dataset.goal || this.goal || 'engagement' );
		this.logEvents = true;

	}

}

// Expose experiments API functions.
window.Altis.Analytics.Experiments.registerGoal = registerGoalHandler; // Back compat.
window.Altis.Analytics.Experiments.registerGoalHandler = registerGoalHandler;

// Define custom elements when analytics has loaded.
window.Altis.Analytics.onLoad( () => {
	window.customElements.define( 'global-block', GlobalBlock );
	window.customElements.define( 'ab-test', ABTest );
	window.customElements.define( 'ab-test-block', ABTestBlock );
	window.customElements.define( 'personalization-block', PersonalizationBlock );
	window.customElements.define( 'broadcast-block', BroadcastBlock );
} );

// Fire a ready event once userland API has been exported.
const readyEvent = new CustomEvent( 'altis.experiments.ready' );
window.dispatchEvent( readyEvent );
