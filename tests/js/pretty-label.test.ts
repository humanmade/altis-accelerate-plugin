/**
 * Tests for the BreakdownPanel row label formatter.
 *
 * Runs under the vitest setup landing in PR #621
 * (humanmade/accelerate#621). Once that PR merges, `composer test:js`
 * picks this up automatically.
 */

import { describe, expect, it } from 'vitest';

import { prettyLabel } from '../../src/accelerate/content-explorer/BreakdownPanel/prettyLabel';

describe( 'prettyLabel', () => {
	it.each( [
		[ 'strips https + trailing slash',     'https://twitter.com/',          'twitter.com' ],
		[ 'strips http + trailing slash',      'http://example.com/',           'example.com' ],
		[ 'preserves path',                    'https://example.com/path',      'example.com/path' ],
		[ 'preserves path + query',            'https://example.com/p?q=1',     'example.com/p?q=1' ],
		[ 'strips www.',                       'https://www.google.com/',       'google.com' ],
		[ 'uppercase scheme',                  'HTTPS://Example.com/',          'Example.com' ],
		[ 'no scheme: pass through',           'twitter.com',                   'twitter.com' ],
		[ 'campaign name: pass through',       'spring-sale',                   'spring-sale' ],
		[ 'utm pair: pass through',            'google / spring-sale',          'google / spring-sale' ],
		[ '"Direct traffic" label',            'Direct traffic',                'Direct traffic' ],
		[ 'empty string',                      '',                              '' ],
	] )( '%s', ( _label, input, expected ) => {
		expect( prettyLabel( input ) ).toBe( expected );
	} );
} );
