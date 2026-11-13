/**
 * Tests for the TileGrid class-resolution table.
 *
 * tileGridClasses maps (variant, tile count) → Tailwind grid classes.
 * The policy under test: panel grids promote the first child to a
 * 2-column hero only when the count is odd (keeping every row
 * full-width), metric grids never resize tiles, and out-of-range
 * counts clamp to the nearest defined layout.
 */

import { describe, expect, it } from 'vitest';

import { tileGridClasses } from '../../src/components/TileGrid';

const HERO_SPAN = '[&>*:first-child]:col-span-2';

describe( 'tileGridClasses', () => {
	it( 'promotes a hero on odd panel counts only', () => {
		expect( tileGridClasses( 'panel', 3 ) ).toContain( HERO_SPAN );
		expect( tileGridClasses( 'panel', 5 ) ).toContain( HERO_SPAN );
		expect( tileGridClasses( 'panel', 7 ) ).toContain( HERO_SPAN );

		expect( tileGridClasses( 'panel', 2 ) ).not.toContain( HERO_SPAN );
		expect( tileGridClasses( 'panel', 4 ) ).not.toContain( HERO_SPAN );
		expect( tileGridClasses( 'panel', 6 ) ).not.toContain( HERO_SPAN );
		expect( tileGridClasses( 'panel', 8 ) ).not.toContain( HERO_SPAN );
	} );

	it( 'demotes the 3-panel hero at the wide tier, where 3 fit one row', () => {
		expect( tileGridClasses( 'panel', 3 ) ).toContain( '[&>*:first-child]:col-span-1' );
		// 5 and 7 keep the hero at every tier — no demotion class.
		expect( tileGridClasses( 'panel', 5 ) ).not.toContain( 'col-span-1' );
		expect( tileGridClasses( 'panel', 7 ) ).not.toContain( 'col-span-1' );
	} );

	it( 'never resizes metric tiles', () => {
		for ( let count = 1; count <= 8; count++ ) {
			expect( tileGridClasses( 'metric', count ) ).not.toContain( 'col-span' );
		}
	} );

	it( 'keeps the 5-KPI strip on one row; balances 6+ into short last rows (7 → 4+3)', () => {
		// 5 metric tiles is the canonical KPI strip (visitors, views, engaged,
		// pages/visit, bounce) and stays on a single row above mobile.
		expect( tileGridClasses( 'metric', 5 ) ).toContain( '@3xl:grid-cols-5' );
		expect( tileGridClasses( 'metric', 7 ) ).toContain( '@4xl:grid-cols-4' );
	} );

	it( 'clamps out-of-range counts to the nearest defined layout', () => {
		expect( tileGridClasses( 'panel', 0 ) ).toBe( tileGridClasses( 'panel', 1 ) );
		expect( tileGridClasses( 'panel', 12 ) ).toBe( tileGridClasses( 'panel', 8 ) );
		expect( tileGridClasses( 'metric', 12 ) ).toBe( tileGridClasses( 'metric', 8 ) );
	} );

	it( 'always defines base (mobile) columns', () => {
		for ( let count = 1; count <= 8; count++ ) {
			expect( tileGridClasses( 'panel', count ) ).toMatch( /(^| )grid-cols-\d/ );
			expect( tileGridClasses( 'metric', count ) ).toMatch( /(^| )grid-cols-\d/ );
		}
	} );
} );
