/**
 * Outbound click filter tests.
 *
 * Pins the contract of `getOutboundHostFromClick` — the pure function
 * that decides whether a click should be recorded as an outbound link
 * click and what host to attribute it to.
 *
 * Runs under the vitest setup landing in PR #621
 * (humanmade/accelerate#621). Once that PR merges, `composer test:js`
 * picks this up automatically.
 */

import { describe, expect, it } from 'vitest';

import { getOutboundHostFromClick } from '../../src/outbound-click.js';

const SITE_HOST = 'my-site.test';
const SITE_URL = `https://${ SITE_HOST }/`;

/**
 * Build a synthetic anchor + click event the way the listener will
 * see it during real browser bubble-phase propagation. jsdom (the
 * vitest environment) provides Element / MouseEvent.
 */
function clickFor( href: string | null, modifier: Partial<MouseEventInit> = {} ): MouseEvent {
	const a = document.createElement( 'a' );
	if ( href !== null ) {
		a.setAttribute( 'href', href );
	}
	const evt = new MouseEvent( 'click', {
		bubbles: true,
		cancelable: true,
		button: 0,
		...modifier,
	} );
	// MouseEvent.target is set by dispatchEvent; for unit tests we set
	// it manually since we never enter the DOM. Defining the property
	// rather than dispatching avoids the browser's default action.
	Object.defineProperty( evt, 'target', {
		value: a,
		configurable: true,
	} );
	return evt;
}

describe( 'getOutboundHostFromClick — fires for external links', () => {
	it.each( [
		[ 'plain external https',          'https://twitter.com/elonmusk',          'twitter.com' ],
		[ 'external with path + querystring', 'https://example.com/path?utm=x',     'example.com' ],
		[ 'host case is normalised',       'https://Twitter.COM/elon',              'twitter.com' ],
		[ 'protocol-relative resolves to host', '//example.com/path',                'example.com' ],
		[ 'plain external http',           'http://insecure.example/whatever',      'insecure.example' ],
		[ 'port is stripped (uses hostname not host)', 'https://example.com:8443/x', 'example.com' ],
		[ 'subdomain treated as outbound', 'https://blog.my-site.test/post',        'blog.my-site.test' ],
	] )( '%s', ( _label, href, expected ) => {
		expect( getOutboundHostFromClick( clickFor( href ), SITE_HOST, SITE_URL ) ).toBe( expected );
	} );
} );

/* eslint-disable no-script-url -- testing the javascript: bail path */
describe( 'getOutboundHostFromClick — skips internal + non-link clicks', () => {
	it.each( [
		[ 'absolute internal',             `${ SITE_URL }about` ],
		[ 'absolute internal uppercase',   'https://MY-SITE.test/about' ],
		[ 'relative path',                 '/posts/hello' ],
		[ 'same-host fragment only',       '#anchor' ],
		[ 'mailto',                        'mailto:hi@example.com' ],
		[ 'tel',                           'tel:+1234567' ],
		[ 'javascript: pseudo-protocol',   'javascript:void(0)' ],
		[ 'ftp non-http(s)',               'ftp://example.com/file' ],
	] )( '%s -> null', ( _label, href ) => {
		expect( getOutboundHostFromClick( clickFor( href ), SITE_HOST, SITE_URL ) ).toBeNull();
	} );

	it( 'malformed href -> null (no throw)', () => {
		const evt = clickFor( 'http://[not-a-valid-url' );
		expect( () => getOutboundHostFromClick( evt, SITE_HOST, SITE_URL ) ).not.toThrow();
		expect( getOutboundHostFromClick( evt, SITE_HOST, SITE_URL ) ).toBeNull();
	} );
} );

describe( 'getOutboundHostFromClick — modifier and button guards', () => {
	const ext = 'https://twitter.com/x';
	it.each( [
		[ 'middle-click (button=1)',       { button: 1 } ],
		[ 'right-click (button=2)',        { button: 2 } ],
		[ 'cmd / meta-click',              { metaKey: true } ],
		[ 'ctrl-click',                    { ctrlKey: true } ],
		[ 'shift-click',                   { shiftKey: true } ],
		[ 'alt-click',                     { altKey: true } ],
	] )( '%s -> null', ( _label, modifier ) => {
		expect( getOutboundHostFromClick( clickFor( ext, modifier ), SITE_HOST, SITE_URL ) ).toBeNull();
	} );
} );

describe( 'getOutboundHostFromClick — propagation guards', () => {
	it( 'defaultPrevented click -> null (an earlier handler cancelled it)', () => {
		const evt = clickFor( 'https://twitter.com/x' );
		evt.preventDefault();
		expect( getOutboundHostFromClick( evt, SITE_HOST, SITE_URL ) ).toBeNull();
	} );

	it( 'target is not an Element (synthetic event from a script) -> null', () => {
		const evt = new MouseEvent( 'click', {
			bubbles: true,
			button: 0,
		} );
		Object.defineProperty( evt, 'target', { value: { not: 'an element' } } );
		expect( getOutboundHostFromClick( evt, SITE_HOST, SITE_URL ) ).toBeNull();
	} );

	it( 'click on a non-anchor descendant inside an outbound <a> -> fires', () => {
		const a = document.createElement( 'a' );
		a.setAttribute( 'href', 'https://twitter.com/x' );
		const span = document.createElement( 'span' );
		a.appendChild( span );
		const evt = new MouseEvent( 'click', {
			bubbles: true,
			button: 0,
		} );
		Object.defineProperty( evt, 'target', { value: span } );
		expect( getOutboundHostFromClick( evt, SITE_HOST, SITE_URL ) ).toBe( 'twitter.com' );
	} );

	it( 'click on an element with no surrounding <a href> -> null', () => {
		const span = document.createElement( 'span' );
		const evt = new MouseEvent( 'click', {
			bubbles: true,
			button: 0,
		} );
		Object.defineProperty( evt, 'target', { value: span } );
		expect( getOutboundHostFromClick( evt, SITE_HOST, SITE_URL ) ).toBeNull();
	} );
} );
