import React, { act, useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartStyleControl } from '../../src/accelerate/content-explorer/ChartStyleControl';
import HeroChart from '../../src/accelerate/content-explorer/HeroChart';
import { ChartPresentation, useChartComparison, useChartPresentation } from '../../src/accelerate/content-explorer/useChartPresentation';
import { StatsResult } from '../../src/utils/admin';

const {
	apiFetchMock,
	getStatsMock,
	persistentStateMock,
	useSelectMock,
} = vi.hoisted( () => ( {
	apiFetchMock: vi.fn(),
	getStatsMock: vi.fn(),
	persistentStateMock: vi.fn(),
	useSelectMock: vi.fn(),
} ) );

vi.mock( '@wordpress/api-fetch', () => ( { default: apiFetchMock } ) );
vi.mock( '@wordpress/data', () => ( {
	createReduxStore: vi.fn( () => ( {} ) ),
	useSelect: useSelectMock,
} ) );
vi.mock( '@wordpress/i18n', () => ( {
	__: ( value: string ) => value,
	_n: ( singular: string, plural: string, count: number ) => count === 1 ? singular : plural,
} ) );
vi.mock( '../../src/data/hooks', () => ( { usePersistentState: persistentStateMock } ) );
vi.mock( '../../src/accelerate/content-explorer/TimeSeriesPlot', async () => {
	const ReactModule = await vi.importActual<typeof import( 'react' )>( 'react' );
	return {
		PRIOR_SERIES_COLOR: '#9ca3af',
		TimeSeriesPlot: ( props: {
			mode: string;
			series: Array<{ id: string, time: Date }>;
			comparison?: Array<{ id: string }>;
		} ) => {
			const [ tooltipOpen, setTooltipOpen ] = ReactModule.useState( false );
			return ReactModule.createElement(
				'div',
				{
					'data-mode': props.mode,
					'data-comparison-count': props.comparison?.length || 0,
					'data-series-ids': props.series.map( point => point.id ).join( ',' ),
					'data-series-count': props.series.length,
					'data-last-series-time': props.series.length > 0 ? props.series[ props.series.length - 1 ].time.toISOString() : '',
					'data-testid': 'plot',
				},
				ReactModule.createElement( 'button', {
					type: 'button',
					onClick: () => setTooltipOpen( true ),
				}, 'Open plot tooltip' ),
				tooltipOpen ? ReactModule.createElement( 'span', null, 'Tooltip retained' ) : null
			);
		},
	};
} );
vi.mock( '@/components/EmptyState', () => ( { EmptyState: () => null } ) );
vi.mock( '@/components/MetricTile', () => ( {
	MetricTile: ( { label, value }: { label: string, value: string } ) => React.createElement( 'span', {
		'data-metric-label': label,
	}, value ),
} ) );
vi.mock( '@/components/TileGrid', () => ( {
	TileGrid: ( { children }: { children: React.ReactNode } ) => React.createElement( 'div', null, children ),
} ) );
vi.mock( '@/components/ui/skeleton', () => ( { Skeleton: () => null } ) );
vi.mock( '@/components/ui/spinner', () => ( { Spinner: () => null } ) );

const statsResult = (): StatsResult => ( {
	by_interval: {
		'2026-07-17 00:00:00': {
			views: 5,
			visitors: 4,
		},
		'2026-07-18 00:00:00': {
			views: 8,
			visitors: 6,
		},
	},
	stats: {
		by_browser: {},
		by_country: {},
		by_device: {},
		by_os: {},
		by_referer: {},
		by_search_term: {},
		by_url: {},
		by_user: {},
		summary: {
			bounce: 1,
			returning: 0,
			search: {},
			views: 13,
			visitors: 10,
		},
	},
} );

type HookHarnessProps = {
	label: string;
	tileKey: string;
	onValue?: ( value: ChartPresentation ) => void;
};

function HookHarness( { label, tileKey, onValue }: HookHarnessProps ) {
	const [ value, setValue ] = useChartPresentation( tileKey );
	useEffect( () => onValue?.( value ), [ onValue, value ] );
	return React.createElement(
		'div',
		{
			'data-presentation': value,
			'data-testid': label,
		},
		React.createElement( 'button', {
			type: 'button',
			onClick: () => setValue( 'bar' ),
		}, `Set ${ label } bars` ),
		React.createElement( 'button', {
			type: 'button',
			onClick: () => setValue( 'pie' as ChartPresentation ),
		}, `Set ${ label } invalid` )
	);
}

function ComparisonHookHarness( { label, tileKey }: Omit<HookHarnessProps, 'onValue'> ) {
	const [ value, setValue ] = useChartComparison( tileKey );
	return React.createElement(
		'div',
		{
			'data-comparison': value,
			'data-testid': label,
		},
		React.createElement( 'button', {
			type: 'button',
			onClick: () => setValue( ! value ),
		}, `Toggle ${ label } comparison` )
	);
}

function ControlHarness() {
	const [ value, setValue ] = useState<ChartPresentation>( 'bar' );
	return React.createElement( ChartStyleControl, {
		value,
		onValueChange: setValue,
	} );
}

describe( 'chart presentation', () => {
	let container: HTMLDivElement;
	let root: Root;
	let currentStats: StatsResult | undefined;

	beforeAll( () => {
		( globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean } ).IS_REACT_ACT_ENVIRONMENT = true;
		class ResizeObserverMock {
			observe() {}
			disconnect() {}
		}
		( globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver } ).ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
	} );

	beforeEach( () => {
		window.localStorage.clear();
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		currentStats = statsResult();
		apiFetchMock.mockReset();
		apiFetchMock.mockResolvedValue( statsResult() );
		getStatsMock.mockReset();
		getStatsMock.mockImplementation( () => currentStats );
		persistentStateMock.mockReset();
		persistentStateMock.mockImplementation( <T, >( _key: string, defaultValue: T ) => React.useState( defaultValue ) );
		useSelectMock.mockReset();
		useSelectMock.mockImplementation( ( selector: ( select: () => {
			getStats: typeof getStatsMock;
			getIsLoadingStats: () => boolean;
			getStatsError: () => null;
		} ) => unknown, deps: React.DependencyList = [] ) => {
			// This test double intentionally applies the caller's dependency list
			// to mirror useSelect's selector invalidation semantics.
			/* eslint-disable react-hooks/exhaustive-deps */
			return React.useMemo( () => selector( () => ( {
				getStats: getStatsMock,
				getIsLoadingStats: () => false,
				getStatsError: () => null,
			} ) ), deps );
			/* eslint-enable react-hooks/exhaustive-deps */
		} );
	} );

	afterEach( async () => {
		await act( async () => root.unmount() );
		container.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
	} );

	it( 'defaults to bar, accepts line, and rejects invalid stored values', async () => {
		window.localStorage.setItem( 'altis-state-line-chart-style', JSON.stringify( 'line' ) );
		window.localStorage.setItem( 'altis-state-invalid-chart-style', JSON.stringify( 'pie' ) );
		await act( async () => root.render( React.createElement(
			React.Fragment,
			null,
			React.createElement( HookHarness, {
				label: 'default',
				tileKey: 'default',
			} ),
			React.createElement( HookHarness, {
				label: 'invalid',
				tileKey: 'invalid',
			} ),
			React.createElement( HookHarness, {
				label: 'line',
				tileKey: 'line',
			} )
		) ) );
		expect( container.querySelector( '[data-testid="default"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
		expect( container.querySelector( '[data-testid="invalid"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
		expect( container.querySelector( '[data-testid="line"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'line' );
	} );

	it( 'persists strings per tile, synchronizes matching instances, and rejects invalid writes', async () => {
		await act( async () => root.render( React.createElement(
			React.Fragment,
			null,
			React.createElement( HookHarness, {
				label: 'first',
				tileKey: 'shared',
			} ),
			React.createElement( HookHarness, {
				label: 'second',
				tileKey: 'shared',
			} ),
			React.createElement( HookHarness, {
				label: 'other',
				tileKey: 'other',
			} )
		) ) );
		const buttons = Array.from( container.querySelectorAll( 'button' ) );
		await act( async () => ( buttons.find( button => button.textContent === 'Set first bars' ) as HTMLButtonElement ).click() );
		expect( container.querySelector( '[data-testid="first"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
		expect( container.querySelector( '[data-testid="second"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
		expect( container.querySelector( '[data-testid="other"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
		expect( window.localStorage.getItem( 'altis-state-shared-chart-style' ) ).toBe( '"bar"' );

		await act( async () => ( buttons.find( button => button.textContent === 'Set first invalid' ) as HTMLButtonElement ).click() );
		expect( container.querySelector( '[data-testid="first"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
		expect( window.localStorage.getItem( 'altis-state-shared-chart-style' ) ).toBe( '"bar"' );
	} );

	it( 'defaults comparison off and persists it per tile', async () => {
		await act( async () => root.render( React.createElement(
			React.Fragment,
			null,
			React.createElement( ComparisonHookHarness, {
				label: 'first',
				tileKey: 'shared',
			} ),
			React.createElement( ComparisonHookHarness, {
				label: 'second',
				tileKey: 'shared',
			} ),
			React.createElement( ComparisonHookHarness, {
				label: 'other',
				tileKey: 'other',
			} )
		) ) );
		expect( container.querySelector( '[data-testid="first"]' )?.getAttribute( 'data-comparison' ) ).toBe( 'false' );
		await act( async () => ( Array.from( container.querySelectorAll( 'button' ) ).find( button => button.textContent === 'Toggle first comparison' ) as HTMLButtonElement ).click() );
		expect( container.querySelector( '[data-testid="first"]' )?.getAttribute( 'data-comparison' ) ).toBe( 'true' );
		expect( container.querySelector( '[data-testid="second"]' )?.getAttribute( 'data-comparison' ) ).toBe( 'true' );
		expect( container.querySelector( '[data-testid="other"]' )?.getAttribute( 'data-comparison' ) ).toBe( 'false' );
		expect( window.localStorage.getItem( 'altis-state-shared-compare-to-prior' ) ).toBe( 'true' );
	} );

	it( 'falls back safely when storage is unavailable while keeping in-memory selection', async () => {
		vi.spyOn( Storage.prototype, 'getItem' ).mockImplementation( () => {
			throw new Error( 'blocked' );
		} );
		vi.spyOn( Storage.prototype, 'setItem' ).mockImplementation( () => {
			throw new Error( 'blocked' );
		} );
		await act( async () => root.render( React.createElement( HookHarness, {
			label: 'blocked',
			tileKey: 'blocked',
		} ) ) );
		expect( container.querySelector( '[data-testid="blocked"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
		await act( async () => ( container.querySelector( 'button' ) as HTMLButtonElement ).click() );
		expect( container.querySelector( '[data-testid="blocked"]' )?.getAttribute( 'data-presentation' ) ).toBe( 'bar' );
	} );

	it( 'reuses AnimatedTabs with labelled line and bar chart icons', async () => {
		await act( async () => root.render( React.createElement( ControlHarness ) ) );
		const control = container.firstElementChild!;
		const buttons = Array.from( control.querySelectorAll( 'button' ) );
		expect( control.className ).toContain( '!h-9' );
		expect( control.className ).toContain( '!rounded-lg' );
		expect( buttons.map( button => button.textContent ) ).toEqual( [ 'Line chart', 'Bar chart' ] );
		expect( buttons.every( button => button.querySelector( 'svg' ) ) ).toBe( true );
		expect( buttons[ 1 ].className ).toContain( '!text-foreground' );

		await act( async () => buttons[ 0 ].click() );
		expect( buttons[ 0 ].className ).toContain( '!text-foreground' );
	} );

	it( 'switches HeroChart presentation without refetching or resetting resolution, retained data, or tooltip state', async () => {
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'P7D',
			realtimeTick: 0,
		} ) ) );
		const openTooltip = Array.from( container.querySelectorAll( 'button' ) ).find( button => button.textContent === 'Open plot tooltip' ) as HTMLButtonElement;
		await act( async () => openTooltip.click() );
		expect( container.textContent ).toContain( 'Tooltip retained' );

		currentStats = undefined;
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'P7D',
			realtimeTick: 1,
		} ) ) );
		const plot = container.querySelector( '[data-testid="plot"]' )!;
		expect( plot.getAttribute( 'data-series-count' ) ).toBe( '2' );
		const resolution = Array.from( container.querySelectorAll( 'button' ) ).find( button => button.textContent === 'Daily' )?.textContent;
		const statsCallsBeforeSwitch = getStatsMock.mock.calls.length;
		const fetchCallsBeforeSwitch = apiFetchMock.mock.calls.length;

		const line = Array.from( container.querySelectorAll( 'button' ) ).find( button => button.textContent === 'Line chart' ) as HTMLButtonElement;
		await act( async () => line.click() );
		expect( plot.getAttribute( 'data-mode' ) ).toBe( 'line' );
		expect( plot.getAttribute( 'data-series-count' ) ).toBe( '2' );
		expect( Array.from( container.querySelectorAll( 'button' ) ).find( button => button.textContent === 'Daily' )?.textContent ).toBe( resolution );
		expect( container.textContent ).toContain( 'Tooltip retained' );
		expect( getStatsMock ).toHaveBeenCalledTimes( statsCallsBeforeSwitch );
		expect( apiFetchMock ).toHaveBeenCalledTimes( fetchCallsBeforeSwitch );
	} );

	it( 'anchors the newest realtime line point to wall-clock now without changing bars', async () => {
		vi.useFakeTimers();
		const now = new Date( '2026-07-18T12:00:00Z' );
		vi.setSystemTime( now );
		currentStats = {
			...statsResult(),
			by_interval: {
				'2026-07-18 11:58:00': {
					views: 4,
					visitors: 3,
				},
				'2026-07-18 11:59:00': {
					views: 6,
					visitors: 4,
				},
			},
		};
		window.localStorage.setItem( 'altis-state-hero-chart-style', JSON.stringify( 'line' ) );
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'PT30M',
		} ) ) );
		expect( container.querySelector( '[data-testid="plot"]' )?.getAttribute( 'data-last-series-time' ) ).toBe( now.toISOString() );
		const nextNow = new Date( '2026-07-18T12:00:01Z' );
		vi.setSystemTime( nextNow );
		await act( async () => vi.advanceTimersByTime( 120 ) );
		const updatedTime = Date.parse( container.querySelector( '[data-testid="plot"]' )?.getAttribute( 'data-last-series-time' ) || '' );
		expect( updatedTime ).toBeGreaterThan( now.getTime() );
		expect( updatedTime ).toBeLessThanOrEqual( Date.now() );

		window.localStorage.clear();
		await act( async () => root.render( React.createElement( HeroChart, {
			key: 'bar',
			period: 'PT30M',
		} ) ) );
		expect( container.querySelector( '[data-testid="plot"]' )?.getAttribute( 'data-last-series-time' ) ).toBe( '2026-07-18T11:59:00.000Z' );
	} );

	it( 'passes a comparison series to HeroChart only when the persisted toggle is enabled', async () => {
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'P7D',
			realtimeTick: 0,
		} ) ) );
		const plot = container.querySelector( '[data-testid="plot"]' )!;
		expect( plot.getAttribute( 'data-comparison-count' ) ).toBe( '0' );

		const toggle = container.querySelector( '#hero-chart-compare-to-prior' ) as HTMLButtonElement;
		await act( async () => toggle.click() );
		expect( plot.getAttribute( 'data-comparison-count' ) ).toBe( '2' );
		expect( window.localStorage.getItem( 'altis-state-hero-compare-to-prior' ) ).toBe( 'true' );
	} );

	it( 'uses the loaded chart summary while realtime current-window data is pending', async () => {
		apiFetchMock.mockReturnValue( new Promise( () => {} ) );
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'PT30M',
			realtimeTick: 0,
		} ) ) );

		const metric = ( label: string ) => Array.from( container.querySelectorAll( '[data-metric-label]' ) )
			.find( element => element.getAttribute( 'data-metric-label' ) === label )?.textContent;
		expect( metric( 'Unique visitors' ) ).toBe( '10' );
		expect( metric( 'Page views' ) ).toBe( '13' );
	} );

	it( 'recomputes the current bucket cutoff after a non-realtime refetch', async () => {
		vi.useFakeTimers();
		vi.setSystemTime( new Date( '2026-07-18T11:55:00Z' ) );
		currentStats = {
			...statsResult(),
			by_interval: {
				'2026-07-18 11:00:00': {
					views: 4,
					visitors: 3,
				},
				'2026-07-18 12:00:00': {
					views: 0,
					visitors: 0,
				},
			},
		};
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'TODAY',
		} ) ) );
		expect( container.querySelector( '[data-testid="plot"]' )?.getAttribute( 'data-series-ids' ) ).toBe( '2026-07-18 11:00:00' );

		vi.setSystemTime( new Date( '2026-07-18T12:05:00Z' ) );
		currentStats = {
			...currentStats,
			by_interval: {
				...currentStats.by_interval,
				'2026-07-18 12:00:00': {
					views: 6,
					visitors: 4,
				},
			},
		};
		await act( async () => root.render( React.createElement( HeroChart, {
			filter: { path: '/news/' },
			period: 'TODAY',
		} ) ) );
		expect( container.querySelector( '[data-testid="plot"]' )?.getAttribute( 'data-series-ids' ) ).toBe( '2026-07-18 11:00:00,2026-07-18 12:00:00' );
	} );

	it( 'omits the comparison control when the period has no prior window', async () => {
		window.localStorage.setItem( 'altis-state-hero-compare-to-prior', 'true' );
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'P90D',
		} ) ) );

		// P90D has no comparable prior window (retention is 90 days), so the
		// control is absent rather than rendered disabled — a dimmed toggle
		// reads as "off" and invites the question of why it won't turn on.
		expect( container.querySelector( '#hero-chart-compare-to-prior' ) ).toBeNull();
		expect( window.localStorage.getItem( 'altis-state-hero-compare-to-prior' ) ).toBe( 'true' );

		// Returning to a period that has a prior window brings the control
		// back, still switched on — the preference was preserved, not reset.
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'P7D',
		} ) ) );
		const restored = container.querySelector( '#hero-chart-compare-to-prior' ) as HTMLButtonElement;
		expect( restored ).not.toBeNull();
		expect( restored.getAttribute( 'data-state' ) ).toBe( 'checked' );
	} );

	it.each( [
		[ 'an empty prior response', stats => Promise.resolve( {
			...stats,
			by_interval: {},
		} ) ],
		[ 'a rejected prior response', () => Promise.reject( new Error( 'Unavailable' ) ) ],
	] )( 'shows prior data unavailable for %s', async ( _scenario, priorResponse ) => {
		apiFetchMock.mockImplementation( () => priorResponse( statsResult() ) );
		await act( async () => root.render( React.createElement( HeroChart, {
			period: 'P7D',
		} ) ) );
		await act( async () => Promise.resolve() );

		const toggle = container.querySelector( '#hero-chart-compare-to-prior' ) as HTMLButtonElement;
		await act( async () => toggle.click() );
		expect( container.textContent ).toContain( 'Prior data unavailable' );
	} );
} );
