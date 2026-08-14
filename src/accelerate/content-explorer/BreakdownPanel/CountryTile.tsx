import { Globe, List } from 'lucide-react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

// Cross-feature reuse: CountryMap and getCountryName are leaf modules from the
// Analytics page (src/dashboard). BreakdownPanel is a feature surface so this
// direct import is intentional — avoids duplicating the SVG choropleth.
import CountryMap from '../../../dashboard/components/CountryMap';
import { getCountryName } from '../../../dashboard/data/countries';

import { RowLabel, ValueCell } from './RowCell';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DataState } from '@/types/component-states';

interface CountryTileBodyProps {
	byCountry: Record<string, number>;
	// Server period total for the row % share (#672) — passed down rather than
	// recomputed from byCountry so it matches the other tiles' denominator.
	total?: number;
	// Click-to-drill (#669) by country code. When absent rows stay inert.
	onSelect?: ( code: string ) => void;
}

// Renders the map or list view depending on the toggle.
// Exported so BreakdownPanel can inline the StatTile wiring externally.
export function CountryTileBody( { byCountry, total, onSelect }: CountryTileBodyProps ) {
	const [ view, setView ] = React.useState<'map' | 'list'>( 'map' );

	const containerRef = React.useRef<HTMLDivElement>( null );
	const [ width, setWidth ] = React.useState( 0 );

	React.useEffect( () => {
		const el = containerRef.current;
		if ( ! el ) {
			return;
		}
		const update = () => setWidth( el.offsetWidth );
		update();
		const observer = new ResizeObserver( update );
		observer.observe( el );
		return () => observer.disconnect();
	}, [ view ] );

	// Top-10 countries sorted descending, shaped for HostList items.
	const items = React.useMemo(
		() =>
			Object.entries( byCountry )
				.map( ( [ code, value ] ) => ( {
					key: code,
					value,
					label: getCountryName( code ),
				} ) )
				.sort( ( a, b ) => b.value - a.value )
				.slice( 0, 10 ),
		[ byCountry ]
	);

	return (
		<div>
			{ /* Toggle sits at the top of the body area */ }
			<div className="mb-3 flex justify-end">
				<ToggleGroup
					size="sm"
					type="single"
					value={ view }
					onValueChange={ v => v && setView( v as 'map' | 'list' ) }
				>
					<ToggleGroupItem
						aria-label={ __( 'Show page views by country on a map', 'altis' ) }
						value="map"
					>
						<Globe aria-hidden="true" className="h-4 w-4" />
					</ToggleGroupItem>
					<ToggleGroupItem
						aria-label={ __( 'Show page views by country as a list', 'altis' ) }
						value="list"
					>
						<List aria-hidden="true" className="h-4 w-4" />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>
			{ view === 'map' ? (
				<div ref={ containerRef }>
					{ width > 0 && (
						<CountryMap
							data={ byCountry }
							height={ Math.round( width * 0.5 ) }
							width={ width }
							onSelect={ onSelect }
						/>
					) }
				</div>
			) : (
				<CountryList items={ items } total={ total } onSelect={ onSelect } />
			) }
		</div>
	);
}

// Minimal list render matching HostList's visual silhouette (h-8 bar, bg-brand/15,
// label left-2, value right). No motion — CountryTile is a secondary view. Shares
// the RowLabel / ValueCell helpers with HostList so the hover-% (#672) and the
// drill-button affordance (#669) stay identical across both list flavors.
function CountryList( {
	items,
	total,
	onSelect,
}: {
	items: { key: string; value: number; label: string }[];
	total?: number;
	onSelect?: ( code: string ) => void;
} ) {
	const max = Math.max( 1, ...items.map( i => i.value ) );

	return (
		<ul className="flex flex-col space-y-1.5 group/tray">
			{ items.map( item => {
				const pct = item.value === 0 ? 0 : Math.max( 2, ( item.value / max ) * 100 );
				const inner = (
					<>
						<span className="relative block h-8 min-w-0 flex-1">
							<span
								aria-hidden="true"
								className="absolute inset-y-0 left-0 flex items-center rounded bg-brand/15"
								style={ { width: `${ pct }%` } }
							/>
							<RowLabel label={ item.label } value={ item.key } />
						</span>
						<ValueCell total={ total } value={ item.value }>
							<span className="!m-0 !flex !h-8 !items-center !justify-end !text-sm !leading-none !text-gray-900 tabular-nums">
								{ item.value.toLocaleString() }
							</span>
						</ValueCell>
					</>
				);
				return (
					<li key={ item.key } className="group">
						{ onSelect ? (
							<button
								className="flex w-full items-center gap-3 rounded text-left cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
								type="button"
								onClick={ () => onSelect( item.key ) }
							>
								{ inner }
							</button>
						) : (
							<div className="flex items-center gap-3">
								{ inner }
							</div>
						) }
					</li>
				);
			} ) }
		</ul>
	);
}

// Derived state helper — same signature as deriveListState in index.tsx.
export function deriveCountryState( base: 'loading' | 'loaded' | 'empty' | 'error', count: number ): DataState {
	if ( base === 'error' || base === 'loading' ) {
		return base;
	}
	return count > 0 ? 'loaded' : 'empty';
}
