import React, { act, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { alignPriorSeriesByIndex, assembleSegmentKeys, attachSegmentSeries, toTimeSeriesPoints, useIntervalSegments, usePriorIntervalSegments, usePriorStats, useRealtimeCurrentSummary } from '../../src/accelerate/content-explorer/HeroChart';
import { Duration, Filter, IntervalSegmentsResult, OTHER_SEGMENT_KEY, StatsResult } from '../../src/utils/admin';

const { apiFetchMock } = vi.hoisted( () => ( {
	apiFetchMock: vi.fn(),
} ) );

vi.mock( '@wordpress/api-fetch', () => ( { default: apiFetchMock } ) );
vi.mock( '@wordpress/data', () => ( {
	createReduxStore: vi.fn( () => ( {} ) ),
	useSelect: vi.fn(),
} ) );
vi.mock( '@wordpress/i18n', () => ( {
	__: ( value: string ) => value,
	_n: ( singular: string, plural: string, count: number ) => count === 1 ? singular : plural,
} ) );
vi.mock( 'motion/react', () => ( {
	motion: {},
	useReducedMotion: () => false,
} ) );
vi.mock( '../../src/data/hooks', () => ( { usePersistentState: vi.fn() } ) );
vi.mock( '../../src/dashboard/components/Card', () => ( { Card: ( { children }: { children: React.ReactNode } ) => children } ) );
vi.mock( '@/components/EmptyState', () => ( { EmptyState: () => null } ) );
vi.mock( '@/components/MetricTile', () => ( { MetricTile: () => null } ) );
vi.mock( '@/components/TileGrid', () => ( { TileGrid: () => null } ) );
vi.mock( '@/components/ui/animated-tabs', () => ( { AnimatedTabs: () => null } ) );
vi.mock( '@/components/ui/skeleton', () => ( { Skeleton: () => null } ) );
vi.mock( '@/components/ui/spinner', () => ( { Spinner: () => null } ) );
vi.mock( '@/components/ui/switch', () => ( { Switch: () => null } ) );
vi.mock( '@/lib/utils', () => ( { computeDelta: vi.fn() } ) );
vi.mock( '../../src/accelerate/content-explorer/ChartStyleControl', () => ( { ChartStyleControl: () => null } ) );
vi.mock( '../../src/accelerate/content-explorer/useChartPresentation', () => ( {
	useChartPresentation: () => [ 'bar', vi.fn() ],
	useChartComparison: () => [ false, vi.fn() ],
} ) );

type Deferred<T> = {
	promise: Promise<T>;
	resolve: ( value: T ) => void;
	reject: ( reason?: unknown ) => void;
};

const deferred = <T, >(): Deferred<T> => {
	let resolve!: ( value: T ) => void;
	let reject!: ( reason?: unknown ) => void;
	const promise = new Promise<T>( ( resolvePromise, rejectPromise ) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	} );
	return {
		promise,
		resolve,
		reject,
	};
};

const statsResult = ( views: number ): StatsResult => ( {
	by_interval: {
		'2025-06-10 12:00:00': {
			views,
			visitors: views,
		},
	},
	stats: {
		summary: {
			views,
			visitors: views,
			search: {},
			bounce: 0,
			returning: 0,
		},
		by_browser: {},
		by_country: {},
		by_device: {},
		by_os: {},
		by_referer: {},
		by_user: {},
		by_url: {},
		by_search_term: {},
	},
} );

type PriorHarnessProps = {
	period: Duration;
	rawInterval: string;
	filter: Filter;
	tick: number;
	onValue: ( value: StatsResult | null ) => void;
};

function PriorHarness( { period, rawInterval, filter, tick, onValue }: PriorHarnessProps ) {
	const value = usePriorStats( period, rawInterval, filter, tick );
	useEffect( () => {
		onValue( value );
	}, [ onValue, value ] );
	return null;
}

const priorElement = ( props: PriorHarnessProps ) => React.createElement( PriorHarness, props );

type RealtimeHarnessProps = {
	filter: Filter;
	filterKey: string;
};

function RealtimeHarness( { filter, filterKey }: RealtimeHarnessProps ) {
	useRealtimeCurrentSummary( true, 'P7D', filter, 0, filterKey, true );
	usePriorStats( 'PT30M', 'P7D', filter, 0 );
	return null;
}

const realtimeElement = ( props: RealtimeHarnessProps ) => React.createElement( RealtimeHarness, props );

function SegmentsHarness( { enabled }: { enabled: boolean } ) {
	useIntervalSegments( 'P7D', 'P1D', {}, 0, enabled );
	usePriorIntervalSegments( 'P7D', 'P1D', {}, 0, enabled );
	return null;
}

describe( 'HeroChart stats hooks', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll( () => {
		( globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean } ).IS_REACT_ACT_ENVIRONMENT = true;
	} );

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		apiFetchMock.mockReset();
	} );

	afterEach( async () => {
		await act( async () => root.unmount() );
		container.remove();
	} );

	it( 'omits future current buckets while retaining past zero buckets', () => {
		const byInterval: StatsResult['by_interval'] = {
			'2026-07-18 09:00:00': {
				views: 4,
				visitors: 3,
			},
			'2026-07-18 10:00:00': {
				views: 0,
				visitors: 0,
			},
			'2026-07-18 11:00:00': {
				views: 2,
				visitors: 1,
			},
			'2026-07-18 13:00:00': {
				views: 0,
				visitors: 0,
			},
			'2026-07-18 14:00:00': {
				views: 0,
				visitors: 0,
			},
		};
		const wallNow = Date.UTC( 2026, 6, 18, 12, 30 );
		const current = toTimeSeriesPoints( byInterval, wallNow );

		expect( current.map( point => point.id ) ).toEqual( [
			'2026-07-18 09:00:00',
			'2026-07-18 10:00:00',
			'2026-07-18 11:00:00',
		] );
		expect( current.map( point => point.value ) ).toEqual( [ 4, 0, 2 ] );
		expect( toTimeSeriesPoints( byInterval ) ).toHaveLength( 5 );
	} );

	it( 'attaches segment maps by bucket id and zeros missing keys', () => {
		const points = toTimeSeriesPoints( {
			'2026-07-18 10:00:00': {
				views: 10,
				visitors: 5,
			},
			'2026-07-18 11:00:00': {
				views: 4,
				visitors: 2,
			},
		} );
		const segments: IntervalSegmentsResult = {
			dimension: 'referer',
			keys: [ '__direct__', 'google.com', '__other__' ],
			by_interval: {
				'2026-07-18 10:00:00': {
					__direct__: 6,
					'google.com': 3,
					__other__: 1,
				},
				// 11:00 missing — should zero-fill.
			},
		};
		const withSegs = attachSegmentSeries( points, segments );
		expect( withSegs[ 0 ].segments ).toEqual( {
			__direct__: 6,
			'google.com': 3,
			__other__: 1,
		} );
		expect( withSegs[ 1 ].segments ).toEqual( {
			__direct__: 0,
			'google.com': 0,
			__other__: 0,
		} );
		expect( attachSegmentSeries( points, null ) ).toEqual( points );
	} );

	it( 'attachSegmentSeries can force current keys and fold prior-only hosts into Other', () => {
		const points = toTimeSeriesPoints( {
			'2026-07-18 10:00:00': {
				views: 10,
				visitors: 5,
			},
		} );
		const priorSegments: IntervalSegmentsResult = {
			dimension: 'referer',
			keys: [ 'facebook.com', 'bing.com' ],
			by_interval: {
				'2026-07-18 10:00:00': {
					'facebook.com': 4,
					'bing.com': 2,
					'reddit.com': 3,
				},
			},
		};
		const withSegs = attachSegmentSeries( points, priorSegments, {
			keys: [ '__direct__', 'google.com', '__other__' ],
		} );
		expect( withSegs[ 0 ].segments ).toEqual( {
			__direct__: 0,
			'google.com': 0,
			// facebook + bing + reddit all fold into Other (none match forced keys).
			__other__: 9,
		} );
	} );

	it( 'preserves prior-only traffic when current keys do not include Other', () => {
		const points = toTimeSeriesPoints( {
			'2026-07-18 10:00:00': {
				views: 10,
				visitors: 5,
			},
		} );
		const priorSegments: IntervalSegmentsResult = {
			dimension: 'referer',
			keys: [ 'reddit.com' ],
			by_interval: {
				'2026-07-18 10:00:00': {
					'reddit.com': 10,
				},
			},
		};
		const withSegs = attachSegmentSeries( points, priorSegments, {
			keys: [ '__direct__' ],
		} );

		expect( withSegs[ 0 ].segments ).toEqual( {
			__direct__: 0,
			__other__: 10,
		} );
		expect( Object.values( withSegs[ 0 ].segments || {} ).reduce( ( sum, value ) => sum + value, 0 ) ).toBe( withSegs[ 0 ].value );
	} );

	it( 'folds a prior-only segment into the stable Other key before exceeding the palette', () => {
		const points = toTimeSeriesPoints( {
			'2026-07-18 10:00:00': {
				views: 10,
				visitors: 5,
			},
		} );
		const keys = [ '__direct__', 'google.com', 'facebook.com' ];
		const prior = attachSegmentSeries( points, {
			dimension: 'referer',
			keys: [ 'reddit.com' ],
			by_interval: {
				'2026-07-18 10:00:00': {
					'reddit.com': 10,
				},
			},
		}, { keys } );

		const plotKeys = assembleSegmentKeys( keys, prior );
		expect( plotKeys ).toEqual( [ '__direct__', 'google.com', OTHER_SEGMENT_KEY ] );
		expect( plotKeys ).toHaveLength( 3 );
	} );

	it( 'does not fetch current or prior segments while segments are disabled', async () => {
		await act( async () => root.render( React.createElement( SegmentsHarness, { enabled: false } ) ) );
		expect( apiFetchMock ).not.toHaveBeenCalled();

		apiFetchMock.mockReturnValue( new Promise( () => {} ) );
		await act( async () => root.render( React.createElement( SegmentsHarness, { enabled: true } ) ) );
		expect( apiFetchMock ).toHaveBeenCalledTimes( 2 );
		expect( apiFetchMock.mock.calls.every( call => ( call[ 0 ].path as string ).startsWith( '/accelerate/v1/stats/segments?' ) ) ).toBe( true );
	} );

	it( 'orders bucket series chronologically before aligning prior buckets by index', () => {
		const current = toTimeSeriesPoints( {
			'2026-07-18 12:00:00': {
				views: 3,
				visitors: 3,
			},
			'2026-07-18 10:00:00': {
				views: 1,
				visitors: 1,
			},
			'2026-07-18 11:00:00': {
				views: 2,
				visitors: 2,
			},
		} );
		const prior = toTimeSeriesPoints( {
			'2026-07-11 11:00:00': {
				views: 20,
				visitors: 20,
			},
			'2026-07-11 12:00:00': {
				views: 30,
				visitors: 30,
			},
			'2026-07-11 10:00:00': {
				views: 10,
				visitors: 10,
			},
		} );
		const alignedPrior = alignPriorSeriesByIndex( current, prior );

		expect( current.map( point => point.id ) ).toEqual( [
			'2026-07-18 10:00:00',
			'2026-07-18 11:00:00',
			'2026-07-18 12:00:00',
		] );
		expect( alignedPrior.map( point => point.id ) ).toEqual( [
			'2026-07-11 10:00:00',
			'2026-07-11 11:00:00',
			'2026-07-11 12:00:00',
		] );
		expect( alignedPrior.map( point => point.time.getUTCHours() ) ).toEqual(
			current.map( point => point.time.getUTCHours() )
		);
	} );

	it( 'forwards filters, refetches on dependency changes, and retains the full result', async () => {
		apiFetchMock.mockResolvedValue( statsResult( 7 ) );
		const values: Array<StatsResult | null> = [];
		const onValue = ( value: StatsResult | null ) => values.push( value );
		const filter = { path: '/news/' };

		await act( async () => root.render( priorElement( {
			filter,
			onValue,
			period: 'P7D',
			rawInterval: 'P7D',
			tick: 0,
		} ) ) );
		expect( apiFetchMock ).toHaveBeenCalledTimes( 1 );
		expect( apiFetchMock.mock.calls[0][0].path ).toContain( 'filter%5Bpath%5D=%2Fnews%2F' );
		expect( values.at( -1 ) ).toEqual( statsResult( 7 ) );

		await act( async () => root.render( priorElement( {
			filter,
			onValue,
			period: 'P7D',
			rawInterval: 'P1D',
			tick: 0,
		} ) ) );
		await act( async () => root.render( priorElement( {
			filter,
			onValue,
			period: 'P14D',
			rawInterval: 'P1D',
			tick: 0,
		} ) ) );
		await act( async () => root.render( priorElement( {
			filter,
			onValue,
			period: 'P14D',
			rawInterval: 'P1D',
			tick: 1,
		} ) ) );
		expect( apiFetchMock ).toHaveBeenCalledTimes( 4 );
	} );

	it( 'rejects a late older response after a filter change', async () => {
		const first = deferred<StatsResult>();
		const second = deferred<StatsResult>();
		apiFetchMock
			.mockReturnValueOnce( first.promise )
			.mockReturnValueOnce( second.promise );
		const values: Array<StatsResult | null> = [];
		const onValue = ( value: StatsResult | null ) => values.push( value );
		const firstFilter = { path: '/first/' };
		const secondFilter = { path: '/second/' };

		await act( async () => root.render( priorElement( {
			filter: firstFilter,
			onValue,
			period: 'P7D',
			rawInterval: 'P1D',
			tick: 0,
		} ) ) );
		await act( async () => root.render( priorElement( {
			filter: secondFilter,
			onValue,
			period: 'P7D',
			rawInterval: 'P1D',
			tick: 0,
		} ) ) );
		expect( values.at( -1 ) ).toBeNull();

		await act( async () => first.resolve( statsResult( 1 ) ) );
		expect( values.at( -1 ) ).toBeNull();

		await act( async () => second.resolve( statsResult( 2 ) ) );
		expect( values.at( -1 ) ).toEqual( statsResult( 2 ) );
	} );

	it( 'stays neutral while loading and after API rejection', async () => {
		const request = deferred<StatsResult>();
		apiFetchMock.mockReturnValue( request.promise );
		const values: Array<StatsResult | null> = [];
		const onValue = ( value: StatsResult | null ) => values.push( value );
		const filter = { path: '/news/' };

		await act( async () => root.render( priorElement( {
			filter,
			onValue,
			period: 'P7D',
			rawInterval: 'P1D',
			tick: 0,
		} ) ) );
		expect( values.at( -1 ) ).toBeNull();

		await act( async () => request.reject( new Error( 'API unavailable' ) ) );
		expect( values.at( -1 ) ).toBeNull();
	} );

	it( 'uses the same clamped interval and filter encoding for realtime current and prior requests', async () => {
		apiFetchMock.mockReturnValue( new Promise( () => {} ) );
		const filter = {
			path: '/news/',
			dimensions: { country: 'TH' },
		};

		await act( async () => root.render( realtimeElement( {
			filter,
			filterKey: JSON.stringify( filter ),
		} ) ) );
		expect( apiFetchMock ).toHaveBeenCalledTimes( 2 );
		const paths = apiFetchMock.mock.calls.map( call => call[0].path as string );
		const filterParams = paths.map( path => Array.from( new URL( path, 'https://example.com' ).searchParams.entries() )
			.filter( ( [ key ] ) => key.startsWith( 'filter' ) ) );

		expect( paths[0] ).toContain( 'interval=P1D' );
		expect( paths[1] ).toContain( 'interval=P1D' );
		expect( filterParams[0] ).toEqual( filterParams[1] );
	} );

	it( 'keeps the prior value visible during a realtime tick refetch (no flash to neutral)', async () => {
		const second = deferred<StatsResult>();
		apiFetchMock
			.mockResolvedValueOnce( statsResult( 7 ) )
			.mockReturnValueOnce( second.promise );
		const values: Array<StatsResult | null> = [];
		const onValue = ( value: StatsResult | null ) => values.push( value );
		const filter = { path: '/news/' };

		await act( async () => root.render( priorElement( {
			filter,
			onValue,
			period: 'PT30M',
			rawInterval: 'P1D',
			tick: 0,
		} ) ) );
		expect( values.at( -1 ) ).toEqual( statsResult( 7 ) );

		// Tick-only change: a refetch is issued, but the last delta must stay
		// visible while it's in flight — never flash to neutral on a poll tick.
		await act( async () => root.render( priorElement( {
			filter,
			onValue,
			period: 'PT30M',
			rawInterval: 'P1D',
			tick: 1,
		} ) ) );
		expect( apiFetchMock ).toHaveBeenCalledTimes( 2 );
		expect( values.at( -1 ) ).toEqual( statsResult( 7 ) );

		// The fresh response lands and updates the value.
		await act( async () => second.resolve( statsResult( 9 ) ) );
		expect( values.at( -1 ) ).toEqual( statsResult( 9 ) );
	} );
} );
