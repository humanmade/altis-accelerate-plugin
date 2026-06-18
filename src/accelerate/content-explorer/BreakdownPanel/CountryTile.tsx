import { Globe, List } from 'lucide-react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

// Cross-feature reuse: CountryMap and getCountryName are leaf modules from the
// Analytics page (src/dashboard). BreakdownPanel is a feature surface so this
// direct import is intentional — avoids duplicating the SVG choropleth.
import CountryMap from '../../../dashboard/components/CountryMap';
import { getCountryName } from '../../../dashboard/data/countries';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DataState } from '@/types/component-states';

interface CountryTileBodyProps {
	byCountry: Record<string, number>;
}

// Renders the map or list view depending on the toggle.
// Exported so BreakdownPanel can inline the StatTile wiring externally.
export function CountryTileBody( { byCountry }: CountryTileBodyProps ) {
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
	}, [] );

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
					<ToggleGroupItem value="map">
						<Globe className="h-4 w-4" />
					</ToggleGroupItem>
					<ToggleGroupItem value="list">
						<List className="h-4 w-4" />
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
						/>
					) }
				</div>
			) : (
				// Reuses the same HostList from index.tsx — passed in as a render prop
				// so we don't duplicate the animated list implementation.
				<CountryList items={ items } />
			) }
		</div>
	);
}

// Minimal list render matching HostList's visual silhouette (h-8 bar, bg-brand/15,
// label left-2, value right). No motion — CountryTile is a secondary view.
function CountryList( { items }: { items: { key: string; value: number; label: string }[] } ) {
	const max = Math.max( 1, ...items.map( i => i.value ) );

	return (
		<ul className="flex flex-col space-y-1.5">
			{ items.map( item => {
				const pct = item.value === 0 ? 0 : Math.max( 2, ( item.value / max ) * 100 );
				return (
					<li key={ item.key } className="flex items-center gap-3">
						<div className="relative h-8 min-w-0 flex-1">
							<div
								aria-hidden="true"
								className="absolute inset-y-0 left-0 flex items-center rounded bg-brand/15"
								style={ { width: `${ pct }%` } }
							/>
							<p
								className="!absolute !left-2 !top-1/2 !-translate-y-1/2 !m-0 !truncate !whitespace-nowrap !text-sm !text-gray-900 max-w-full pr-2"
								title={ item.label }
							>
								{ item.label }
							</p>
						</div>
						<p className="!m-0 !flex !h-8 !items-center !justify-end !text-sm !leading-none !text-gray-900 !shrink-0 tabular-nums">
							{ item.value.toLocaleString() }
						</p>
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
