/**
 * Vitest setup file — runs before any test module is imported.
 *
 * Some `src/` modules touch `window.Altis.Analytics` at import time
 * (side-effect bootstrap that runs in the browser bundle). We stub the
 * minimum surface here so those modules can be imported in a unit test
 * without executing the full analytics pipeline.
 */

declare global {
	interface Window {
		Altis: any;
	}
}

window.Altis = window.Altis ?? { Analytics: {} };
window.Altis.Analytics = window.Altis.Analytics ?? {};
// `onLoad` is invoked at the bottom of src/experiments.js to register custom
// elements — replace with a no-op so the import doesn't blow up in jsdom.
window.Altis.Analytics.onLoad = window.Altis.Analytics.onLoad ?? ( () => {} );

export {};
