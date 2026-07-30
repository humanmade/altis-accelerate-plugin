import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BRAND_COLOR, formatTooltipDate, PRIOR_BAR_COLOR, PRIOR_SERIES_COLOR, TimeSeriesPlot, TimeSeriesPoint } from '../../src/accelerate/content-explorer/TimeSeriesPlot';
import { periods } from '../../src/data/periods';

const { reducedMotion } = vi.hoisted( () => ( {
	reducedMotion: { value: false },
} ) );

vi.mock( '@wordpress/i18n', () => ( {
	__: ( value: string ) => value,
	_n: ( singular: string, plural: string, count: number ) => count === 1 ? singular : plural,
} ) );

vi.mock( 'motion/react', async () => {
	const ReactModule = await vi.importActual<typeof import( 'react' )>( 'react' );
	const makeMotionElement = ( tag: 'circle' | 'rect' ) => ReactModule.forwardRef<SVGElement, any>( (
		{ animate = {}, exit, initial, transition, ...props },
		ref
	) => {
		const {
			scale: _scale,
			scaleY: _scaleY,
			...geometry
		} = animate;
		return ReactModule.createElement( tag, {
			...props,
			...geometry,
			ref,
			'data-exit': JSON.stringify( exit ),
			'data-initial': JSON.stringify( initial ),
			'data-transition-duration': transition?.duration,
		} );
	} );
	return {
		AnimatePresence: ( { children }: { children: React.ReactNode } ) => children,
		motion: {
			circle: makeMotionElement( 'circle' ),
			rect: makeMotionElement( 'rect' ),
		},
		useReducedMotion: () => reducedMotion.value,
	};
} );

const realtimePeriod = periods.find( period => period.value === 'PT30M' )!;
const dailyPeriod = periods.find( period => period.value === 'P7D' )!;
const baseNow = Date.UTC( 2026, 6, 18, 12, 30 );
const baseSeries: TimeSeriesPoint[] = [
	{
		id: 'bucket-a',
		time: new Date( baseNow - 20 * 60 * 1000 ),
		value: 5,
	},
	{
		id: 'bucket-b',
		time: new Date( baseNow - 10 * 60 * 1000 ),
		value: 10,
	},
	{
		id: 'bucket-c',
		time: new Date( baseNow - 5 * 60 * 1000 ),
		value: 7,
	},
];

type PlotProps = React.ComponentProps<typeof TimeSeriesPlot>;

const plotProps = ( overrides: Partial<PlotProps> = {} ): PlotProps => ( {
	displayNow: baseNow,
	interval: 'PT1M',
	isRealtime: true,
	mode: 'line',
	period: realtimePeriod,
	series: baseSeries,
	width: 600,
	...overrides,
} );
const plotElement = ( overrides: Partial<PlotProps> = {} ) => React.createElement( TimeSeriesPlot, plotProps( overrides ) );

function geometry( element: Element ) {
	return [ 'x', 'y', 'width', 'height' ].map( name => `${ name }=${ element.getAttribute( name ) }` ).join( ';' );
}

describe( 'TimeSeriesPlot', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll( () => {
		( globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean } ).IS_REACT_ACT_ENVIRONMENT = true;
	} );

	beforeEach( () => {
		vi.useFakeTimers();
		reducedMotion.value = false;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( async () => {
		await act( async () => root.unmount() );
		container.remove();
		vi.useRealTimers();
	} );

	it( 'always renders the line and area with a linear curve', async () => {
		await act( async () => root.render( plotElement() ) );
		const linearLine = container.querySelector( `path[stroke="${ BRAND_COLOR }"]` )?.getAttribute( 'd' );
		const linearArea = container.querySelector( 'path[fill^="url("]' )?.getAttribute( 'd' );
		expect( linearLine ).toContain( 'L' );
		expect( linearLine ).not.toContain( 'C' );
		expect( linearArea ).toContain( 'L' );
		expect( linearArea ).not.toContain( 'C' );
	} );

	it( 'keeps a non-round maximum bar at or below the top axis tick', async () => {
		await act( async () => root.render( plotElement( {
			isRealtime: false,
			mode: 'bar',
			period: dailyPeriod,
			series: [
				{
					id: 'low',
					time: new Date( baseNow - 2 * 24 * 60 * 60 * 1000 ),
					value: 3,
				},
				{
					id: 'non-round-max',
					time: new Date( baseNow - 24 * 60 * 60 * 1000 ),
					value: 8.5,
				},
				{
					id: 'mid',
					time: new Date( baseNow ),
					value: 5,
				},
			],
		} ) ) );
		const maxBarTop = Number( container.querySelector( '[data-bucket-id="non-round-max"]' )?.getAttribute( 'y' ) );
		const topAxisTick = Math.min( ...Array.from( container.querySelectorAll( '.visx-axis-left .visx-axis-tick' ) ).map( tick => {
			return Number( tick.getAttribute( 'transform' )?.match( /,([^)]*)\)/ )?.[ 1 ] );
		} ) );

		expect( maxBarTop ).toBeGreaterThanOrEqual( topAxisTick );
	} );

	it( 'renders visible ghost bars for index-aligned comparison points and retains their dates', async () => {
		const comparison: TimeSeriesPoint[] = [
			{
				id: 'prior-a',
				time: new Date( baseNow - 10 * 24 * 60 * 60 * 1000 ),
				value: 9,
			},
			{
				id: 'prior-b',
				time: new Date( baseNow - 9 * 24 * 60 * 60 * 1000 ),
				value: 12,
			},
		];
		await act( async () => root.render( plotElement( {
			comparison,
			isRealtime: false,
			mode: 'bar',
			period: dailyPeriod,
		} ) ) );
		const comparisonBars = container.querySelectorAll( '[data-comparison-bucket-id]' );
		const comparisonA = comparisonBars[ 0 ];
		const currentA = container.querySelector( '[data-bucket-id="bucket-a"]' )!;

		expect( comparisonBars ).toHaveLength( 2 );
		expect( comparisonA.getAttribute( 'fill' ) ).toBe( PRIOR_BAR_COLOR );
		expect( comparisonA.getAttribute( 'fill-opacity' ) ).toBe( '0.85' );
		expect( Number( comparisonA.getAttribute( 'x' ) ) ).toBeLessThan( Number( currentA.getAttribute( 'x' ) ) );
		expect( Number( comparisonA.getAttribute( 'width' ) ) ).toBeGreaterThan( Number( currentA.getAttribute( 'width' ) ) );
		expect( comparisonA.getAttribute( 'data-prior-time' ) ).toBe( comparison[ 0 ].time.toISOString() );
		expect( container.querySelector( '[data-comparison-bucket-id="bucket-c"]' ) ).toBeNull();
	} );

	it( 'extends the y-domain for a larger comparison value', async () => {
		await act( async () => root.render( plotElement( {
			comparison: [ {
				id: 'prior-max',
				time: new Date( baseNow - 24 * 60 * 60 * 1000 ),
				value: 80,
			} ],
			isRealtime: false,
			mode: 'bar',
			period: dailyPeriod,
		} ) ) );
		const comparisonTop = Number( container.querySelector( '[data-comparison-bucket-id="bucket-a"]' )?.getAttribute( 'y' ) );
		const topAxisTick = Math.min( ...Array.from( container.querySelectorAll( '.visx-axis-left .visx-axis-tick' ) ).map( tick => {
			return Number( tick.getAttribute( 'transform' )?.match( /,([^)]*)\)/ )?.[ 1 ] );
		} ) );

		expect( comparisonTop ).toBeGreaterThanOrEqual( topAxisTick );
	} );

	it( 'renders no comparison marks when comparison is absent', async () => {
		await act( async () => root.render( plotElement( { mode: 'bar' } ) ) );
		expect( container.querySelector( '[data-comparison-bucket-id], [data-comparison-line]' ) ).toBeNull();
	} );

	it( 'uses the shared prior gray for the comparison line (not brand purple)', async () => {
		await act( async () => root.render( plotElement( {
			comparison: [ {
				id: 'prior-a',
				time: new Date( baseNow - 7 * 24 * 60 * 60 * 1000 ),
				value: 3,
			}, {
				id: 'prior-b',
				time: new Date( baseNow - 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000 ),
				value: 4,
			} ],
			mode: 'line',
		} ) ) );
		const priorLine = container.querySelector( '[data-comparison-line="true"]' );
		expect( priorLine ).not.toBeNull();
		expect( priorLine?.getAttribute( 'stroke' ) ).toBe( PRIOR_SERIES_COLOR );
		// Current series stays brand purple.
		expect( container.querySelector( `path[stroke="${ BRAND_COLOR }"]` ) ).not.toBeNull();
	} );

	it( 'shows current, prior, and percent change in the comparison tooltip', async () => {
		const comparison: TimeSeriesPoint[] = [ {
			id: 'prior-a',
			time: new Date( baseNow - 7 * 24 * 60 * 60 * 1000 ),
			value: 10,
		} ];
		await act( async () => root.render( plotElement( {
			comparison,
			mode: 'bar',
		} ) ) );
		const hitArea = container.querySelector( '[data-tooltip-hit-area="true"]' )!;
		const currentA = container.querySelector( '[data-bucket-id="bucket-a"]' )!;
		const currentCenter = 70 + Number( currentA.getAttribute( 'x' ) ) + Number( currentA.getAttribute( 'width' ) ) / 2;

		await act( async () => hitArea.dispatchEvent( new MouseEvent( 'mousemove', {
			bubbles: true,
			clientX: currentCenter,
			clientY: 100,
		} ) ) );
		expect( container.querySelector( '[data-testid="tooltip-current-value"]' )?.textContent ).toBe( '5' );
		expect( container.querySelector( '[data-testid="tooltip-prior-value"]' )?.textContent ).toBe( '10' );
		expect( container.querySelector( '[data-testid="tooltip-change"]' )?.textContent ).toContain( '-50%' );
		expect( container.querySelector( `.HeroChart__tooltip time[datetime="${ comparison[ 0 ].time.toISOString() }"]` ) ).not.toBeNull();
	} );

	it( 'uses the realtime chart clock for bar labels', async () => {
		await act( async () => root.render( plotElement( {
			displayNow: baseNow,
			mode: 'bar',
			series: baseSeries,
		} ) ) );

		expect( container.textContent ).toContain( '5m ago' );
		expect( container.textContent ).not.toContain( 'Now' );
	} );

	it( 'keeps stable band geometry off the realtime clock and tweens poll snapshots on mounted ids', async () => {
		await act( async () => root.render( plotElement( { mode: 'bar' } ) ) );
		const originalA = container.querySelector( '[data-bucket-id="bucket-a"]' )!;
		const originalB = container.querySelector( '[data-bucket-id="bucket-b"]' )!;
		const originalGeometry = [ geometry( originalA ), geometry( originalB ) ];

		await act( async () => root.render( plotElement( {
			displayNow: baseNow + 60 * 1000,
			mode: 'bar',
		} ) ) );
		expect( [
			geometry( container.querySelector( '[data-bucket-id="bucket-a"]' )! ),
			geometry( container.querySelector( '[data-bucket-id="bucket-b"]' )! ),
		] ).toEqual( originalGeometry );

		const nextSeries = baseSeries.map( point => ( point.id === 'bucket-a' ? {
			...point,
			value: 8,
		} : point ) );
		await act( async () => {
			root.render( plotElement( {
				displayNow: baseNow + 60 * 1000,
				mode: 'bar',
				series: nextSeries,
			} ) );
			vi.runAllTimers();
		} );
		const updatedA = container.querySelector( '[data-bucket-id="bucket-a"]' )!;
		const updatedB = container.querySelector( '[data-bucket-id="bucket-b"]' )!;
		expect( updatedA ).toBe( originalA );
		expect( updatedB ).toBe( originalB );
		expect( geometry( updatedA ) ).not.toBe( originalGeometry[ 0 ] );
		expect( updatedB.getAttribute( 'data-transition-duration' ) ).toBe( '0.2' );
	} );

	it( 'moves realtime line geometry when displayNow advances', async () => {
		await act( async () => root.render( plotElement() ) );
		const first = container.querySelector( `path[stroke="${ BRAND_COLOR }"]` )?.getAttribute( 'd' );
		await act( async () => root.render( plotElement( {
			displayNow: baseNow + 60 * 1000,
		} ) ) );
		const second = container.querySelector( `path[stroke="${ BRAND_COLOR }"]` )?.getAttribute( 'd' );
		expect( second ).not.toBe( first );
	} );

	it( 'uses unique gradient and clip ids with actual local references', async () => {
		await act( async () => root.render( React.createElement(
			React.Fragment,
			null,
			plotElement(),
			plotElement()
		) ) );
		const svgs = Array.from( container.querySelectorAll( 'svg[data-chart-mode]' ) );
		expect( svgs ).toHaveLength( 2 );
		const ids = svgs.flatMap( svg => Array.from( svg.querySelectorAll( 'linearGradient[id], clipPath[id]' ) ).map( node => node.id ) );
		expect( new Set( ids ).size ).toBe( 4 );
		svgs.forEach( svg => {
			const areaRef = svg.querySelector( 'path[fill^="url("]' )?.getAttribute( 'fill' ) ?? '';
			const clipRef = svg.querySelector( 'g[clip-path^="url("]' )?.getAttribute( 'clip-path' ) ?? '';
			[ areaRef, clipRef ].forEach( ref => {
				const id = ref.match( /^url\(#(.+)\)$/ )?.[ 1 ];
				expect( id ).toBeTruthy();
				expect( svg.querySelector( `[id="${ id }"]` ) ).not.toBeNull();
			} );
		} );
	} );

	it( 'targets bars only inside their bands and dismisses tooltips at gaps, edges, and touch end', async () => {
		await act( async () => root.render( plotElement( { mode: 'bar' } ) ) );
		const hitArea = container.querySelector( '[data-tooltip-hit-area="true"]' )!;
		const firstBar = container.querySelector( '[data-bucket-id="bucket-a"]' )!;
		const secondBar = container.querySelector( '[data-bucket-id="bucket-b"]' )!;
		const firstCenter = 70 + Number( firstBar.getAttribute( 'x' ) ) + Number( firstBar.getAttribute( 'width' ) ) / 2;
		const gapCenter = 70 + ( Number( firstBar.getAttribute( 'x' ) ) + Number( firstBar.getAttribute( 'width' ) ) + Number( secondBar.getAttribute( 'x' ) ) ) / 2;

		await act( async () => hitArea.dispatchEvent( new MouseEvent( 'mousemove', {
			bubbles: true,
			clientX: firstCenter,
			clientY: 100,
		} ) ) );
		expect( container.querySelector( '[data-testid="tooltip-current-value"]' )?.textContent ).toBe( '5' );

		await act( async () => hitArea.dispatchEvent( new MouseEvent( 'mousemove', {
			bubbles: true,
			clientX: gapCenter,
			clientY: 100,
		} ) ) );
		expect( container.querySelector( '[data-testid="tooltip-current-value"]' ) ).toBeNull();

		await act( async () => hitArea.dispatchEvent( new MouseEvent( 'mousemove', {
			bubbles: true,
			clientX: 69,
			clientY: 100,
		} ) ) );
		expect( container.querySelector( '.HeroChart__tooltip' ) ).toBeNull();

		await act( async () => hitArea.dispatchEvent( new MouseEvent( 'mousemove', {
			bubbles: true,
			clientX: firstCenter,
			clientY: 100,
		} ) ) );
		await act( async () => hitArea.dispatchEvent( new Event( 'touchend', { bubbles: true } ) ) );
		expect( container.querySelector( '.HeroChart__tooltip' ) ).toBeNull();
	} );

	it( 'reconciles open bar tooltips with changed and expired poll buckets', async () => {
		await act( async () => root.render( plotElement( { mode: 'bar' } ) ) );
		const hitArea = container.querySelector( '[data-tooltip-hit-area="true"]' )!;
		const firstBar = container.querySelector( '[data-bucket-id="bucket-a"]' )!;
		const firstCenter = 70 + Number( firstBar.getAttribute( 'x' ) ) + Number( firstBar.getAttribute( 'width' ) ) / 2;

		await act( async () => hitArea.dispatchEvent( new MouseEvent( 'mousemove', {
			bubbles: true,
			clientX: firstCenter,
			clientY: 100,
		} ) ) );
		expect( container.querySelector( '[data-testid="tooltip-current-value"]' )?.textContent ).toBe( '5' );

		const changedSeries = baseSeries.map( point => point.id === 'bucket-a' ? {
			...point,
			value: 9,
		} : point );
		await act( async () => root.render( plotElement( {
			mode: 'bar',
			series: changedSeries,
		} ) ) );
		expect( container.querySelector( '[data-testid="tooltip-current-value"]' )?.textContent ).toBe( '9' );

		await act( async () => root.render( plotElement( {
			mode: 'bar',
			series: changedSeries.filter( point => point.id !== 'bucket-a' ),
		} ) ) );
		expect( container.querySelector( '.HeroChart__tooltip' ) ).toBeNull();
	} );

	it( 'handles zero, constant, single-point, sparse, entity ids, and zero-width series without NaN', async () => {
		const edgeSeries: TimeSeriesPoint[] = [
			{
				id: 'Tom &amp; Jerry',
				time: new Date( baseNow - 60_000 ),
				value: 0,
			},
			{
				id: 'sparse-latest',
				time: new Date( baseNow ),
				value: 0,
			},
		];
		await act( async () => root.render( plotElement( {
			mode: 'bar',
			series: edgeSeries,
			width: 0,
		} ) ) );
		expect( container.innerHTML ).not.toContain( 'NaN' );
		expect( container.querySelector( '[data-bucket-id="Tom &amp; Jerry"]' )?.getAttribute( 'height' ) ).toBe( '0' );

		await act( async () => root.render( plotElement( {
			isRealtime: false,
			period: dailyPeriod,
			series: [ {
				id: 'only',
				time: new Date( baseNow ),
				value: 7,
			} ],
		} ) ) );
		expect( container.innerHTML ).not.toContain( 'NaN' );
		expect( container.querySelector( `path[stroke="${ BRAND_COLOR }"]` )?.getAttribute( 'd' ) ).toBeTruthy();
	} );

	it( 'asserts missing, duplicate, and negative bucket invariants', async () => {
		const consoleError = vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		await expect( act( async () => root.render( plotElement( {
			series: [ {
				id: '',
				time: new Date( baseNow ),
				value: 1,
			} ],
		} ) ) ) ).rejects.toThrow( 'stable id' );
		root = createRoot( container );
		await expect( act( async () => root.render( plotElement( {
			series: [
				{
					id: 'same',
					time: new Date( baseNow ),
					value: 1,
				},
				{
					id: 'same',
					time: new Date( baseNow + 1 ),
					value: 2,
				},
			],
		} ) ) ) ).rejects.toThrow( 'duplicate point id' );
		root = createRoot( container );
		await expect( act( async () => root.render( plotElement( {
			series: [ {
				id: 'negative',
				time: new Date( baseNow ),
				value: -1,
			} ],
		} ) ) ) ).rejects.toThrow( 'non-negative' );
		consoleError.mockRestore();
	} );

	it( 'uses zero-duration bar updates under reduced motion while retaining enter and exit states', async () => {
		reducedMotion.value = true;
		await act( async () => root.render( plotElement( { mode: 'bar' } ) ) );
		const bar = container.querySelector( '[data-bucket-id="bucket-a"]' )!;
		expect( bar.getAttribute( 'data-transition-duration' ) ).toBe( '0' );
		expect( bar.getAttribute( 'data-initial' ) ).toBe( 'false' );
		expect( bar.getAttribute( 'data-exit' ) ).toBe( JSON.stringify( { opacity: 0 } ) );

		reducedMotion.value = false;
		await act( async () => root.render( plotElement( { mode: 'bar' } ) ) );
		const animatedBar = container.querySelector( '[data-bucket-id="bucket-a"]' )!;
		expect( animatedBar.getAttribute( 'data-initial' ) ).toContain( 'scaleY' );
		expect( animatedBar.getAttribute( 'data-exit' ) ).toContain( 'scaleY' );
	} );

	it.each( [
		[ 'midnight', new Date( Date.UTC( 2026, 6, 18, 0, 5 ) ), '12:05AM' ],
		[ 'noon', new Date( Date.UTC( 2026, 6, 18, 12, 0 ) ), '12:00PM' ],
		[ 'afternoon', new Date( Date.UTC( 2026, 6, 18, 13, 5 ) ), '1:05PM' ],
	] )( 'formats realtime tooltip time at %s', ( _label, date, expected ) => {
		expect( formatTooltipDate( date, 'PT1M', realtimePeriod ) ).toBe( expected );
	} );

	it( 'formats multi-hour tooltip ranges across midnight', () => {
		expect( formatTooltipDate( new Date( Date.UTC( 2026, 6, 18, 23 ) ), 'PT2H', dailyPeriod ) ).toBe( '23:00 — 01:00' );
	} );

} );
