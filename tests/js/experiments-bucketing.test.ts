/**
 * Characterisation tests for the variant-bucketing helpers extracted from
 * `src/experiments.js`. These pin TODAY's behaviour. They are not bug fixes.
 *
 * Behaviours under test (and surprises worth knowing about):
 *   - Weight sum > 100 → variants past the 100 boundary are unreachable.
 *   - Weight sum < 100 → the uncovered tail biases toward index 0 (the
 *     loop's default), not "drops" users. This is the *current* control bias.
 *   - Missing/zero weight at index i falls back to an even share. A single
 *     non-zero weight surrounded by zeros expands those zeros to even shares,
 *     which may not be the intent of the caller — pinned so we notice.
 *   - shouldExcludeFromTest uses strict `>`, so a roll exactly equal to the
 *     traffic % is still INCLUDED.
 *
 * See docs/test-coverage-audit.md → P0 #2.
 *
 * `window.Altis.Analytics` is stubbed in `tests/js/setup.ts` so the
 * side-effect-heavy `src/experiments.js` import works under jsdom.
 */

import { describe, expect, it } from 'vitest';

import { pickVariantIndex, shouldExcludeFromTest } from '../../src/experiments.js';

describe( 'shouldExcludeFromTest', () => {
	it( 'includes the user when the roll lands strictly under the traffic %', () => {
		// random=0.49 → 49 < 50 → included
		expect( shouldExcludeFromTest( 50, 0.49 ) ).toBe( false );
	} );

	it( 'excludes the user when the roll lands above the traffic %', () => {
		expect( shouldExcludeFromTest( 50, 0.51 ) ).toBe( true );
	} );

	it( 'includes the user when the roll equals the traffic % exactly (strict >)', () => {
		// 0.5 * 100 = 50; condition is `> 50`, so 50 itself is NOT excluded.
		expect( shouldExcludeFromTest( 50, 0.5 ) ).toBe( false );
	} );

	it( '100% traffic includes everyone (no roll can be > 100)', () => {
		expect( shouldExcludeFromTest( 100, 0.999999 ) ).toBe( false );
	} );

	it( '0% traffic still includes a roll of exactly 0 (strict >)', () => {
		// Edge case worth documenting: 0% does not exclude a random()=0 roll.
		expect( shouldExcludeFromTest( 0, 0 ) ).toBe( false );
		expect( shouldExcludeFromTest( 0, 0.0001 ) ).toBe( true );
	} );
} );

describe( 'pickVariantIndex', () => {
	describe( 'even weights, sum to 100', () => {
		it( 'picks the first variant for a low target', () => {
			expect( pickVariantIndex( [ 50, 50 ], 2, 0 ) ).toBe( 0 );
			expect( pickVariantIndex( [ 50, 50 ], 2, 49.999 ) ).toBe( 0 );
		} );

		it( 'picks the second variant for a high target', () => {
			expect( pickVariantIndex( [ 50, 50 ], 2, 50 ) ).toBe( 1 );
			expect( pickVariantIndex( [ 50, 50 ], 2, 99.999 ) ).toBe( 1 );
		} );

		it( 'three even variants split at 33.33 boundaries', () => {
			expect( pickVariantIndex( [ 33.33, 33.33, 33.34 ], 3, 10 ) ).toBe( 0 );
			expect( pickVariantIndex( [ 33.33, 33.33, 33.34 ], 3, 40 ) ).toBe( 1 );
			expect( pickVariantIndex( [ 33.33, 33.33, 33.34 ], 3, 70 ) ).toBe( 2 );
		} );
	} );

	describe( 'uneven weights', () => {
		it( 'allocates by cumulative weight', () => {
			// [10, 90] — variant 0 owns 0-10, variant 1 owns 10-100.
			expect( pickVariantIndex( [ 10, 90 ], 2, 5 ) ).toBe( 0 );
			expect( pickVariantIndex( [ 10, 90 ], 2, 50 ) ).toBe( 1 );
		} );

		it( 'a zero-weight variant is reachable via the even-share fallback', () => {
			// Surprise: a literal `0` weight falls back to 100/count.
			// [0, 100] with count=2 → fallback makes index 0's share 50, not 0.
			// This pins TODAY's behaviour. Filing this as a follow-up is fine.
			expect( pickVariantIndex( [ 0, 100 ], 2, 25 ) ).toBe( 0 );
			expect( pickVariantIndex( [ 0, 100 ], 2, 75 ) ).toBe( 1 );
		} );
	} );

	describe( 'malformed weights', () => {
		it( 'weight sum > 100 leaves later variants unreachable (real bug, pinned)', () => {
			// [60, 60, 60] → cumulative 60, 120, 180. Variant 2 is never picked
			// because target ∈ [0, 100) can never land past 120.
			expect( pickVariantIndex( [ 60, 60, 60 ], 3, 30 ) ).toBe( 0 );
			expect( pickVariantIndex( [ 60, 60, 60 ], 3, 80 ) ).toBe( 1 );
			expect( pickVariantIndex( [ 60, 60, 60 ], 3, 99.999 ) ).toBe( 1 );
			// Variant 2 unreachable regardless of target ∈ [0, 100).
		} );

		it( 'weight sum < 100 biases the uncovered tail toward index 0 (control)', () => {
			// [30, 30] cumulative 30, 60. Targets ≥ 60 fall through the loop
			// without `variantId` being reassigned → returns the default 0.
			expect( pickVariantIndex( [ 30, 30 ], 2, 70 ) ).toBe( 0 );
			expect( pickVariantIndex( [ 30, 30 ], 2, 95 ) ).toBe( 0 );
		} );

		it( 'missing weights array falls back entirely to even shares', () => {
			// `weights[i] || 100/count` — undefined falls back.
			expect( pickVariantIndex( [], 2, 25 ) ).toBe( 0 );
			expect( pickVariantIndex( [], 2, 75 ) ).toBe( 1 );
		} );
	} );

} );
