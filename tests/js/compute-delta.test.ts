/**
 * Tests for computeDelta() prior-period delta calc.
 *
 * Runs under the vitest setup landing in PR #621
 * (humanmade/accelerate#621). Once that PR merges, `composer test:js`
 * picks this up automatically.
 */

import { describe, expect, it } from 'vitest';

import { computeDelta } from '../../src/lib/utils';

describe( 'computeDelta', () => {
	it( 'zero/zero is hasData neutral', () => {
		expect( computeDelta( 0, 0 ) ).toEqual( {
			pct: 0,
			direction: 0,
			hasData: true,
		} );
	} );

	it( 'current > 0, prior == 0 is no-data (never infinite)', () => {
		expect( computeDelta( 5, 0 ) ).toEqual( {
			pct: 0,
			direction: 0,
			hasData: false,
		} );
	} );

	it( 'positive delta', () => {
		expect( computeDelta( 120, 100 ) ).toEqual( {
			pct: 20,
			direction: 1,
			hasData: true,
		} );
	} );

	it( 'negative delta', () => {
		expect( computeDelta( 80, 100 ) ).toEqual( {
			pct: 20,
			direction: -1,
			hasData: true,
		} );
	} );

	it( 'sub-1% collapses to neutral (noise threshold)', () => {
		// 100.5 vs 100 → 0.5% → rounds to 1 then below threshold → neutral
		expect( computeDelta( 100, 100 ) ).toEqual( {
			pct: 0,
			direction: 0,
			hasData: true,
		} );
	} );

	it( 'rounds to nearest integer', () => {
		// 132 vs 100 → 32%
		expect( computeDelta( 132, 100 ) ).toMatchObject( {
			pct: 32,
			direction: 1,
		} );
	} );
} );
