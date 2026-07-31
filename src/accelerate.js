import { parseQueryString } from '@aws-sdk/querystring-parser';
import merge from 'deepmerge';
import UAParser from 'ua-parser-js';

import { matchAudiences } from './audience-matcher.js';
import { createEngagementTracker } from './engaged-time';
import { getOutboundHostFromClick } from './outbound-click';
import {
	detectRobot,
	getLanguage,
	overwriteMerge,
	prepareAttributes,
	prepareMetrics,
	uuid,
} from './utils';
import './utils/polyfills';

const {
	Config,
	Consent,
	Data,
	Audiences,
} = Altis.Analytics;

if ( ! Config.AppId ) {
	/* eslint-disable quotes */
	console.warn(
		"Altis Analytics: Missing configuration."
	);
	/* eslint-enable quotes */
}

// Detect bot traffic.
const isBot = detectRobot( navigator.userAgent || '' );

/**
 * Get consent types.
 *
 * We directly read the cookies rather than use the JS API so this script
 * can load as early as possible.
 */
let hasAnonConsent = Consent.CookiePrefix && document.cookie.match( `${ Consent.CookiePrefix }_statistics-anonymous=allow` );
let hasFullConsent = Consent.CookiePrefix && document.cookie.match( `${ Consent.CookiePrefix }_statistics=allow` );

// Secondary check for force enabled consent.
hasAnonConsent = hasAnonConsent || Consent.Allowed.indexOf( 'statistics-anonymous' ) >= 0;
hasFullConsent = hasFullConsent || Consent.Allowed.indexOf( 'statistics' ) >= 0;

/**
 * Custom global attributes and metrics, extended by the
 * registerAttribute and registerMetric functions.
 */
const _attributes = {};
const _metrics = {};

/**
 * Page view session.
 */
const pageSession = uuid();

/**
 * Sub-session (visibility changes).
 */
let subSessionId = uuid();
let subSessionStart = Date.now();

/**
 * Time on page.
 */
let start = Date.now();
let elapsed = 0;

/**
 * Engaged time. Accrual engine instantiated inside startAnalytics() (so it is
 * consent-gated). Each _session.stop event flushes the time accrued since the
 * previous flush via takeDelta() — an additive metrics['engaged'] delta, so
 * the server can plain-sum stop rows (the pageView count() model). The same
 * delta increments the visitor-cumulative endpoint.Metrics.engaged used for
 * audience targeting.
 */
let engagedTracker = null;

/**
 * Scroll depth.
 */
let scrollDepthMax = 0;
let scrollDepthNow = 0;
window.addEventListener( 'scroll', () => {
	const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
	const max = Math.max( 1, scrollHeight - window.innerHeight );
	const percent = Math.min( 100, ( window.scrollY / max ) * 100 );
	scrollDepthMax = percent > scrollDepthMax ? percent : scrollDepthMax;
	scrollDepthNow = percent;
} );

/**
 * Query string parameters.
 */
const params = parseQueryString( window.location.search );
const qvParams = {};
for ( const qv in params ) {
	qvParams[ `qv_${ qv }` ] = params[ qv ] || '';
}

/**
 * Get unique session ID.
 *
 * @returns {?string} The UUID for the current session.
 */
const getSessionID = () => {
	if ( typeof window.sessionStorage === 'undefined' ) {
		return null;
	}

	// Get stored session.
	const sessionID = window.sessionStorage.getItem( '_hm_uuid' );

	if ( sessionID ) {
		return sessionID;
	}

	// Create and set a UUID.
	const newSessionID = uuid();
	window.sessionStorage.setItem( '_hm_uuid', newSessionID );
	return newSessionID;
};

/**
 * Returns current set of default and registered attributes.
 *
 * @param {Object} extra Additional attributes to log.
 * @returns {Object} Attributes data.
 */
const getAttributes = ( extra = {} ) => ( {
	date: new Date().toISOString(),
	session: getSessionID(),
	pageSession,
	url: window.location.origin + window.location.pathname,
	host: window.location.hostname,
	queryString: window.location.search,
	hash: window.location.hash,
	referer: document.referrer,
	title: document.title,
	...qvParams,
	...( Data.Attributes || {} ),
	...extra,
	...( _attributes || {} ),
} );

/**
 * Return current set of default and registered metrics.
 *
 * @param {Object} extra Additional metrics to log.
 * @returns {Object} Metrics data.
 */
const getMetrics = ( extra = {} ) => ( {
	elapsed: elapsed + ( Date.now() - start ),
	scrollDepthMax,
	scrollDepthNow,
	hour: new Date().getHours(),
	day: new Date().getDay() + 1,
	month: new Date().getMonth() + 1,
	year: new Date().getFullYear(),
	...extra,
	...( _metrics || {} ),
} );

/**
 * Storage keys for analytics data.
 */
const STORAGE_KEYS = {
	UserId: 'accelerate.uuid',
	Endpoint: 'accelerate.endpoint',
	// Legacy keys for backward compatibility migration.
	LegacyUserId: 'aws.cognito.identity-id.undefined',
	LegacyEndpoint: 'aws.pinpoint.endpoint',
};

/**
 * Analytics module.
 */
const Analytics = {
	keys: {
		UserId: STORAGE_KEYS.UserId,
	},
	/**
	 * Gets or creates the unique user ID.
	 * Includes backward compatibility migration from legacy Cognito key.
	 *
	 * @returns {?string} The user UUID.
	 */
	getUserId: () => {
		// Check for existing ID in new key.
		let id = localStorage.getItem( STORAGE_KEYS.UserId );

		// Migrate from legacy key if new key doesn't exist.
		if ( ! id ) {
			const legacyId = localStorage.getItem( STORAGE_KEYS.LegacyUserId );
			if ( legacyId ) {
				// Migrate to new key.
				id = legacyId;
				localStorage.setItem( STORAGE_KEYS.UserId, id );
				// Clean up legacy key.
				localStorage.removeItem( STORAGE_KEYS.LegacyUserId );
			}
		}

		// Create new ID if none exists.
		if ( ! id ) {
			id = uuid();
			localStorage.setItem( STORAGE_KEYS.UserId, id );
		}

		return id;
	},
	audiences: [],
	/**
	 * Sets the currently matched audiences based on client side data.
	 */
	updateAudiences: async () => {
		// Take a clone of the current audiences to check if they changed later.
		const oldAudienceIds = Analytics.audiences.slice().sort();

		// Get attributes.
		const attributes = await prepareAttributes( getAttributes() );
		// Get metrics.
		const metrics = await prepareMetrics( getMetrics() );
		// Get endpoint.
		const endpoint = Analytics.getEndpoint();

		// Aggregate data into a queryable object.
		const fieldData = {
			attributes,
			metrics,
			endpoint,
		};

		// Evaluate audience rules. The pure matcher lives in
		// `src/audience-matcher.js` so it can be unit-tested.
		const audienceIds = matchAudiences( Audiences, fieldData );

		Analytics.audiences = audienceIds;

		// Trigger an event when audiences are modified.
		if ( audienceIds.sort().toString() !== oldAudienceIds.toString() ) {
			const updateAudiencesEvent = new CustomEvent( 'altis.analytics.updateAudiences', {
				detail: audienceIds,
			} );
			window.dispatchEvent( updateAudiencesEvent );
		}
	},
	/**
	 * Overrides matched audiences.
	 *
	 * @param {Array} ids Audience IDs to override the amtched ones with.
	 */
	overrideAudiences: ids => {
		// Take a clone of the current audiences to check if they changed later.
		const oldAudienceIds = Analytics.audiences.slice().sort();
		Analytics.audiences = ids;

		// Trigger an event when audiences are modified.
		if ( ids.sort().toString() !== oldAudienceIds.toString() ) {
			const updateAudiencesEvent = new CustomEvent( 'altis.analytics.updateAudiences', {
				detail: ids,
			} );
			window.dispatchEvent( updateAudiencesEvent );
		}
	},
	/**
	 * Retrieve current matched audience IDs.
	 *
	 * @returns {Array} Audience IDs.
	 */
	getAudiences: () => {
		return Analytics.audiences;
	},
	/**
	 * Updates the Analytics endpoint data.
	 *
	 * @param {Object} endpoint The endpoint object with updates.
	 * @returns {Promise} Update Promise.
	 */
	updateEndpoint: async ( endpoint = {} ) => {
		return await Analytics.flushEvents( endpoint );
	},
	/**
	 * Retrieves the current endpoint data.
	 * Includes backward compatibility migration from legacy Pinpoint key.
	 *
	 * @returns {Object} Endpoint object.
	 */
	getEndpoint: () => {
		try {
			// Check for existing endpoint in new key.
			let endpointData = localStorage.getItem( STORAGE_KEYS.Endpoint );

			// Migrate from legacy key if new key doesn't exist.
			if ( ! endpointData ) {
				const legacyData = localStorage.getItem( STORAGE_KEYS.LegacyEndpoint );
				if ( legacyData ) {
					// Migrate to new key.
					endpointData = legacyData;
					localStorage.setItem( STORAGE_KEYS.Endpoint, endpointData );
					// Clean up legacy key.
					localStorage.removeItem( STORAGE_KEYS.LegacyEndpoint );
				}
			}

			const ParsedEndpoint = JSON.parse( endpointData );
			return ParsedEndpoint || {};
		} catch ( error ) {
			return {};
		}
	},
	/**
	 * Stores endpoint data.
	 *
	 * @param {Object} endpoint The endpoint object.
	 */
	setEndpoint: endpoint => {
		localStorage.setItem( STORAGE_KEYS.Endpoint, JSON.stringify( endpoint ) );
	},
	/**
	 * Add an analytics event listener.
	 *
	 * @param {string} event The event name.
	 * @param {Function} callback Callback to run on the event.
	 * @returns {EventListener} The event listener handle.
	 */
	on: ( event, callback ) => {
		return window.addEventListener( `altis.analytics.${ event }`, event => callback( event.detail ) );
	},
	/**
	 * Removes an event listener.
	 *
	 * @param {EventListener} listener The event listener to remove.
	 */
	off: listener => {
		window.removeEventListener( listener );
	},
	/**
	 * Merge current endpoint data with new.
	 *
	 * @param {Object} endpoint The new endpoint data to merge.
	 * @returns {Object} The updated endpoint data.
	 */
	mergeEndpointData: async ( endpoint = {} ) => {
		const Existing = Analytics.getEndpoint();
		const UAData = UAParser( navigator.userAgent );
		const EndpointData = {
			RequestId: uuid(),
			Attributes: {},
			Demographic: {
				AppVersion: Data.AppVersion || '',
				Locale: getLanguage(),
			},
			Location: {},
			Metrics: {},
		};

		// Add device attributes.
		if ( UAData.device && UAData.device.vendor ) {
			EndpointData.Attributes.DeviceMake = [ UAData.device.vendor ];
		}
		if ( UAData.device && UAData.device.model ) {
			EndpointData.Attributes.DeviceModel = [ UAData.device.model ];
		}
		if ( UAData.device && UAData.device.type ) {
			EndpointData.Attributes.DeviceType = [ UAData.device.type ];
		}

		// Add demographic data.
		if ( UAData.engine && UAData.engine.name ) {
			EndpointData.Demographic.Make = UAData.engine.name;
		}
		if ( UAData.browser && UAData.browser.name ) {
			EndpointData.Demographic.Model = UAData.browser.name;
		}
		if ( UAData.browser && UAData.browser.version ) {
			EndpointData.Demographic.ModelVersion = UAData.browser.version;
		}
		if ( UAData.os && UAData.os.name ) {
			EndpointData.Demographic.Platform = UAData.os.name;
		}
		if ( UAData.os && UAData.os.version ) {
			EndpointData.Demographic.PlatformVersion = UAData.os.version;
		}

		// Merge new endpoint data with defaults.
		endpoint = merge.all( [ EndpointData, Existing, endpoint ], {
			arrayMerge: overwriteMerge,
		} );

		// Sanitise attributes and metrics.
		if ( endpoint.User && endpoint.User.UserAttributes ) {
			endpoint.User.UserAttributes = await prepareAttributes( endpoint.User.UserAttributes, true );
		}
		endpoint.Attributes = await prepareAttributes( endpoint.Attributes, true );
		endpoint.Metrics = await prepareMetrics( endpoint.Metrics );

		// Add session and page view counts to endpoint.
		if ( ! endpoint.Attributes.lastSession ) {
			endpoint.Attributes.lastSession = [ getSessionID() ];
			endpoint.Attributes.lastPageSession = [ pageSession ];
			endpoint.Metrics.sessions = 1.0;
			endpoint.Metrics.pageViews = 1.0;
		} else {
			// Increment sessions.
			if ( endpoint.Attributes.lastSession[0] !== getSessionID() ) {
				endpoint.Attributes.lastSession = [ getSessionID() ];
				endpoint.Metrics.sessions += 1.0;
			}
			// Increment pageViews.
			if ( endpoint.Attributes.lastPageSession[0] !== pageSession ) {
				endpoint.Attributes.lastPageSession = [ pageSession ];
				endpoint.Metrics.pageViews += 1.0;
			}
		}

		// Add persistent referer tracking for external sources.
		if ( document.referrer && document.referrer.indexOf( window.location.hostname ) === -1 ) {
			if ( ! endpoint.Attributes.initialReferer ) {
				endpoint.Attributes.initialReferer = [ document.referrer ];
			}
			if ( ! endpoint.Attributes.referer ) {
				endpoint.Attributes.referer = [ document.referrer ];
			} else if ( endpoint.Attributes.referer.indexOf( document.referrer ) === -1 ) {
				endpoint.Attributes.referer.push( document.referrer );
			}
		}

		// Add persistent UTM campaign tracking.
		for ( const qv in params ) {
			const param = qv.toLowerCase();
			if ( ! param.match( /^utm_/ ) ) {
				continue;
			}
			if ( ! endpoint.Attributes[ `initial_${ param }`] ) {
				endpoint.Attributes[ `initial_${ param }` ] = [ params[ param ] ];
			}
			if ( ! endpoint.Attributes[ param ] ) {
				endpoint.Attributes[ param ] = [ params[ param ] ];
			} else if ( endpoint.Attributes[ param ].indexOf( params[ param ] ) === -1 ) {
				endpoint.Attributes[ param ].push( params[ param ] );
			}
		}

		// Strip user data if full consent not given.
		if ( ! hasFullConsent ) {
			delete endpoint.User;
		}

		// Store the endpoint data.
		Analytics.setEndpoint( endpoint );

		// Trigger endpoint update event.
		const updateEndpointEvent = new CustomEvent( 'altis.analytics.updateEndpoint', {
			detail: endpoint,
		} );
		window.dispatchEvent( updateEndpointEvent );

		// Update audience definitions.
		await Analytics.updateAudiences();

		return endpoint;
	},
	events: [],
	/**
	 * Log an event to the Analytics database.
	 *
	 * @param {string} type The event type.
	 * @param {Object} data The event data.
	 * @param {Object} endpoint Updated endpoint data.
	 * @param {boolean} queue True if event recording can be queued.
	 */
	record: async ( type, data = {}, endpoint = {}, queue = true ) => {
		// Back compat, if data or endpoint is a boolean it is expected to be the value for queue.
		if ( typeof data === 'boolean' ) {
			queue = data;
			data = {};
		}
		if ( typeof endpoint === 'boolean' ) {
			queue = endpoint;
			endpoint = {};
		}

		// Do not send events from known bots to the analytics tracker.
		if ( isBot ) {
			return;
		}

		// Merge endpoint data.
		if ( Object.entries( endpoint ).length ) {
			await Analytics.mergeEndpointData( endpoint );
		}

		// Merge in registered metrics and attributes.
		const attributes = getAttributes( data.attributes || {} );
		const metrics = getMetrics( data.metrics || {} );

		const preparedData = {
			attributes: await prepareAttributes( attributes ),
			metrics: await prepareMetrics( metrics ),
		};

		const EventId = uuid();
		const Event = {
			[ EventId ]: {
				EventType: type /* required */,
				Timestamp: new Date().toISOString(),
				AppPackageName: Data.AppPackageName || '',
				AppTitle: Data.SiteName || '',
				AppVersionCode: Data.AppVersion || '',
				Attributes: preparedData.attributes,
				Metrics: preparedData.metrics,
				Session: {
					Id: subSessionId /* required */,
					StartTimestamp: new Date( subSessionStart ).toISOString(), /* required */
				},
			},
		};

		// Track unique request ID.
		Event[ EventId ].Attributes['x-amz-request-id'] = EventId;

		// Add session stop parameters.
		if ( type === '_session.stop' ) {
			Event[ EventId ].Session.Duration = Date.now() - subSessionStart;
			Event[ EventId ].Session.StopTimestamp = new Date().toISOString();
		}

		// Store sent events.
		Analytics.events.push( Event );

		// Trigger event recorded event.
		const recordEvent = new CustomEvent( 'altis.analytics.record', {
			detail: Event[ EventId ],
		} );
		window.dispatchEvent( recordEvent );

		// Flush the events if we don't want to queue.
		if ( ! queue ) {
			Analytics.flushEvents();
			return;
		}

		if ( Analytics.timer ) {
			clearTimeout( Analytics.timer );
		}

		// Flush new events after 5 seconds.
		Analytics.timer = setTimeout( Analytics.flushEvents, 5000 );
	},
	/**
	 * Send events to the analytics endpoint.
	 *
	 * @param {Object} endpoint Optional updated endpoint data.
	 */
	flushEvents: async ( endpoint = {} ) => {
		// Ensure flushEvents isn't called too quickly when set via timeout.
		if ( Analytics.timer ) {
			clearTimeout( Analytics.timer );
		}

		// If we're not ready to log then store up events and try to record later.
		// This can happen if consent is required to start recording but not yet given for example.
		if ( ! Altis.Analytics.Ready ) {
			Analytics.timer = setTimeout( Analytics.flushEvents, 5000 );
			return;
		}

		// Snapshot events to send and clear if allowed to send.
		const eventsToDeliver = Analytics.events;
		if ( ! Altis.Analytics.Noop ) {
			Analytics.events = [];
		}

		// Events are associated with an endpoint.
		const UserId = Analytics.getUserId();

		// Update endpoint data if provided.
		if ( Object.entries( endpoint ).length ) {
			await Analytics.mergeEndpointData( endpoint );
		}

		// Build endpoint data.
		const Endpoint = Analytics.getEndpoint();

		// Reduce events to an object keyed by event ID.
		const Events = eventsToDeliver.reduce( ( carry, event ) => ( {
			...event,
			...carry,
		} ), {} );

		// Build events request object.
		const EventsRequest = {
			BatchItem: {
				[ UserId ]: {
					Endpoint,
					Events,
				},
			},
		};

		// If event delivery is enabled.
		if ( ! Altis.Analytics.Noop ) {
			navigator.sendBeacon( Config.LogEndpoint, JSON.stringify( {
				app_id: Config.AppId,
				events: EventsRequest,
			} ) );
		}
	},
};

// Expose userland API.
Altis.Analytics.updateEndpoint = Analytics.updateEndpoint;
Altis.Analytics.getEndpoint = Analytics.getEndpoint;
Altis.Analytics.getAudiences = Analytics.getAudiences;
Altis.Analytics.overrideAudiences = Analytics.overrideAudiences;
Altis.Analytics.on = Analytics.on;
Altis.Analytics.off = Analytics.off;
Altis.Analytics.record = Analytics.record;

/**
 * Add a default attribute for all events.
 *
 * @param {string} name The attribute name.
 * @param {*} value The attribute value, can be a string, or callback or Promise that returns a string.
 */
Altis.Analytics.registerAttribute = ( name, value ) => {
	_attributes[ name ] = value;
	Analytics.updateAudiences();
};

/**
 * Add a default metric for all events.
 *
 * @param {string} name The metric name.
 * @param {*} value The metric value, can be a number, or callback or Promise that returns a number.
 */
Altis.Analytics.registerMetric = ( name, value ) => {
	_metrics[ name ] = value;
	Analytics.updateAudiences();
};

// Fire a loaded event when the global is fully set up but before we check consent to start logging.
Altis.Analytics.Loaded = true;
const loadedEvent = new CustomEvent( 'altis.analytics.loaded' );
window.dispatchEvent( loadedEvent );

/**
 * Start recording default events and trigger onReady event.
 */
function startAnalytics() {
	// Avoid re-running everything.
	if ( Altis.Analytics.Ready ) {
		return;
	}

	// Set initial endpoint data.
	Analytics.mergeEndpointData( Data.Endpoint || {} );

	// Fire a ready event once userland API has been exported.
	Altis.Analytics.Ready = true;
	const readyEvent = new CustomEvent( 'altis.analytics.ready' );
	window.dispatchEvent( readyEvent );

	// Track sessions.
	document.addEventListener( 'visibilitychange', () => {
		if ( document.visibilityState !== 'visible' ) {
			// On hide increment elapsed time.
			elapsed += Date.now() - start;
			// Flush engaged time accrued since the last stop as an additive
			// delta, and fold it into the visitor's cumulative endpoint total.
			// takeDelta() is idempotent against the tracker's own
			// visibilitychange finalisation, so ordering doesn't matter.
			const engagedDelta = engagedTracker ? engagedTracker.takeDelta() : 0;
			// Fire session stop event - don't queue.
			if ( engagedDelta > 0 ) {
				const engagedTotal = ( Number( Analytics.getEndpoint()?.Metrics?.engaged ) || 0 ) + engagedDelta;
				Analytics.record( '_session.stop', { metrics: { engaged: engagedDelta } }, { Metrics: { engaged: engagedTotal } }, false );
			} else {
				Analytics.record( '_session.stop', false );
			}
		} else {
			// On show reset start time.
			start = Date.now();
			// Reset subSessions.
			subSessionId = uuid();
			subSessionStart = Date.now();
			// Fire session start event.
			Analytics.record( '_session.start' );
		}
	} );

	/**
	 * Record the default page view.
	 */
	const recordPageView = () => {
		// Session start.
		Analytics.record( '_session.start' );
		// Record page view event & create/update endpoint immediately.
		Analytics.record( 'pageView', false );
	};

	if ( document.readyState === 'interactive' || document.readyState === 'complete' || document.readyState === 'loaded' ) {
		recordPageView();
	} else {
		window.addEventListener( 'DOMContentLoaded', recordPageView );
	}

	// Outbound link click tracking. Opt-in via the Accelerate Settings page
	// or programmatically:
	//   add_filter( 'altis.analytics.feature.outbound_tracking', '__return_true' );
	// Filter logic lives in src/outbound-click.js so it can be unit-tested
	// without bootstrapping the whole analytics pipeline.
	if ( Altis.Analytics.OutboundTracking ) {
		document.addEventListener( 'click', e => {
			const host = getOutboundHostFromClick( e, window.location.hostname, window.location.href );
			if ( ! host ) {
				return;
			}
			Analytics.record(
				'linkClick',
				{ attributes: { outbound_host: host } },
				{},
				false
			);
		} );
	}

	// Engaged time tracking. Always on (consent-gated by startAnalytics).
	// Accrued time is flushed as an additive delta on each _session.stop —
	// no separate event type, no sampling, summable like pageView counts.
	let lastMousemoveAt = 0;
	engagedTracker = createEngagementTracker();

	const activityEvents = [ 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'touchmove' ];
	activityEvents.forEach( evt => {
		document.addEventListener( evt, () => engagedTracker?.onActivity(), {
			capture: true,
			passive: true,
		} );
	} );
	document.addEventListener( 'mousemove', () => {
		const t = Date.now();
		if ( t - lastMousemoveAt > 1000 ) {
			lastMousemoveAt = t;
			engagedTracker?.onActivity();
		}
	}, {
		capture: true,
		passive: true,
	} );

	document.addEventListener( 'visibilitychange', () => {
		engagedTracker?.onVisibilityChange( document.visibilityState );
	} );
	// On bfcache restore, re-arm (don't stop) so engaged time resumes like
	// elapsed does; the next activity event reopens the window.
	window.addEventListener( 'pageshow', e => {
		if ( e.persisted ) {
			engagedTracker?.onVisibilityChange( 'visible' );
		}
	} );

	// Symmetric teardown when consent is revoked: stop accrual, clear the sweep
	// timer, and drop the reference so no further events carry an engaged value.
	document.addEventListener( 'wp_listen_for_consent_change', function ( e ) {
		const detail = e.detail || {};
		if ( engagedTracker && ( detail['statistics'] === 'deny' || detail['statistics-anonymous'] === 'deny' ) ) {
			engagedTracker.stop();
			engagedTracker = null;
		}
	} );
}

// Check Altis Consent feature is in use.
if ( Consent.Enabled ) {
	// Check cookie directly for an early match.
	if ( hasAnonConsent || hasFullConsent ) {
		startAnalytics();
	} else {
		// Otherwise listen for a consent change.
		const consentChangeListener = document.addEventListener( 'wp_listen_for_consent_change', function ( e ) {
			if ( e.detail['statistics-anonymous'] && e.detail['statistics-anonymous'] === 'allow' ) {
				hasAnonConsent = true;
			}
			if ( e.detail.statistics && e.detail.statistics === 'allow' ) {
				hasFullConsent = true;
			}
			if ( hasAnonConsent || hasFullConsent ) {
				document.removeEventListener(  'wp_listen_for_consent_change', consentChangeListener );
				startAnalytics();
			}
		} );
	}
} else {
	startAnalytics();
}
