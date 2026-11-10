import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { clampIntervalForFilter, resolvePriorPeriod, resolvePriorStatsArgs } from '../../src/data';
import { Filter } from '../../src/utils/admin';

const FROZEN_NOW = new Date( '2025-06-10T14:23:00Z' );

describe( 'resolvePriorStatsArgs', () => {
	beforeAll( () => {
		vi.useFakeTimers();
		vi.setSystemTime( FROZEN_NOW );
	} );
	afterAll( () => {
		vi.useRealTimers();
	} );

	it( 'preserves a filtered request and clamps P7D to P1D', () => {
		const filter: Filter = {
			path: '/news/',
			dimensions: { country: 'TH' },
		};
		const args = resolvePriorStatsArgs( 'P7D', 'P7D', filter );

		expect( args ).not.toBeNull();
		expect( args!.filter ).toBe( filter );
		expect( args!.interval ).toBe( 'P1D' );
	} );

	it( 'omits filter for an unfiltered request', () => {
		const args = resolvePriorStatsArgs( 'P7D', 'P7D' );

		expect( args ).not.toBeNull();
		expect( args ).not.toHaveProperty( 'filter' );
		expect( args!.interval ).toBe( 'P7D' );
	} );

	it( 'preserves the exact prior-period ISO boundaries', () => {
		const prior = resolvePriorPeriod( 'P14D' );
		const args = resolvePriorStatsArgs( 'P14D', 'P1D' );

		expect( prior ).not.toBeNull();
		expect( args ).not.toBeNull();
		expect( args!.start ).toBe( prior!.start.toISOString() );
		expect( args!.end ).toBe( prior!.end.toISOString() );
	} );

	it( 'returns null when the period has no prior window', () => {
		expect( resolvePriorStatsArgs( 'P90D', 'P7D', { path: '/news/' } ) ).toBeNull();
	} );

	it( 'uses the same effective interval as the current request', () => {
		const filter: Filter = { path: '/news/' };
		const rawInterval = 'P7D';
		const currentInterval = clampIntervalForFilter( rawInterval, true );
		const priorArgs = resolvePriorStatsArgs( 'P7D', rawInterval, filter );

		expect( priorArgs ).not.toBeNull();
		expect( priorArgs!.interval ).toBe( currentInterval );
	} );
} );
