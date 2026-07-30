import { describe, expect, it } from 'vitest';

import { getLift } from '../../../src/utils/index';

/**
 * Characterisation tests for `getLift`.
 *
 * NOTE on the formula: the implementation divides by `Math.abs(current) || 1`
 * (i.e. the *current* value), NOT by `previous`. This is unusual — the textbook
 * "percent change" formula uses the baseline (previous) as the denominator.
 * These tests PIN the current behaviour so a future refactor can't silently
 * change it. See docs/test-coverage-audit.md → P0 #3.
 */
describe( 'getLift', () => {
	it( 'returns 0 when both values are 0 (avoids NaN)', () => {
		expect( getLift( 0, 0 ) ).toBe( 0 );
	} );

	it( 'returns -100 when current is 0 and previous is non-zero', () => {
		expect( getLift( 0, 50 ) ).toBe( -100 );
		expect( getLift( 0, -50 ) ).toBe( -100 );
	} );

	it( 'pins the current-as-denominator formula on a positive increase', () => {
		// current=120, previous=100 → (120-100)/120 * 100 = 16.666…
		// (Textbook lift would be 20%.)
		expect( getLift( 120, 100 ) ).toBeCloseTo( 16.6667, 3 );
	} );

	it( 'pins the formula on a decrease', () => {
		// current=80, previous=100 → (80-100)/80 * 100 = -25
		// (Textbook lift would be -20%.)
		expect( getLift( 80, 100 ) ).toBe( -25 );
	} );

	it( 'uses abs(current) in the denominator so negative currents do not flip sign', () => {
		// current=-50, previous=100 → (-50-100) / abs(-50) * 100 = -300
		expect( getLift( -50, 100 ) ).toBe( -300 );
	} );

	it( 'handles very small previous values without dividing by zero', () => {
		// previous=0.0001, current=1 → (1 - 0.0001) / 1 * 100 ≈ 99.99
		expect( getLift( 1, 0.0001 ) ).toBeCloseTo( 99.99, 2 );
	} );

	it( 'handles same value', () => {
		expect( getLift( 100, 100 ) ).toBe( 0 );
		expect( getLift( -100, -100 ) ).toBe( 0 );
	} );
} );
