import { describe, expect, it } from 'vitest';

import { formatEngaged } from '../../src/accelerate/content-explorer/BreakdownPanel/formatEngaged';

describe( 'formatEngaged', () => {
	it.each( [
		[ 'zero',                    0,       '0s' ],
		[ 'whole seconds under 60',  45,      '45s' ],
		[ 'exactly 59s',             59,      '59s' ],
		[ 'exactly 60s',             60,      '1m 0s' ],
		[ 'minutes + seconds',       134,     '2m 14s' ],
		[ 'rounds half-up',          14.5,    '15s' ],
		[ 'rounds down',             14.4,    '14s' ],
		[ 'rounds into next minute', 59.6,    '1m 0s' ],
		[ 'just under an hour',      3599,    '59m 59s' ],
		[ 'exactly an hour',         3600,    '1h 0m' ],
		[ 'hours drop seconds',      26_799,  '7h 26m' ],
		[ 'just under a day',        86_399,  '23h 59m' ],
		[ 'exactly a day',           86_400,  '1d 0h' ],
		[ 'days drop minutes',       313_839, '3d 15h' ],
	] )( '%s', ( _label, input, expected ) => {
		expect( formatEngaged( input ) ).toBe( expected );
	} );
} );
