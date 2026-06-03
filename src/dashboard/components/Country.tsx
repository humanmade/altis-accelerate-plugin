import { Globe, List } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { __ } from '@wordpress/i18n';

import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { BlockFillProps, StatsResult } from '../../utils/admin';
import { getCountryName } from '../data/countries';

import BarList from './BarList';
import { Card } from './Card';
import CountryMap from './CountryMap';

interface Props {
	data?: StatsResult,
	onAddRule?: BlockFillProps['onAddRule'],
}

export default function Country( props: Props ) {
	const { data, onAddRule } = props;
	const [ view, setView ] = useState<string>( 'map' );
	const [ containerEl, setContainerEl ] = useState<HTMLDivElement | null>( null );
	const [ width, setWidth ] = useState( 0 );

	const containerRef = useCallback( ( node: HTMLDivElement | null ) => {
		setContainerEl( node );
	}, [] );

	useEffect( () => {
		if ( ! containerEl ) {
			return;
		}
		const updateWidth = () => setWidth( containerEl.offsetWidth );
		updateWidth();
		const observer = new ResizeObserver( updateWidth );
		observer.observe( containerEl );
		return () => observer.disconnect();
	}, [ containerEl ] );

	if ( ! data || ! data.stats || ! data.stats.by_country ) {
		return null;
	}

	const countryData = data.stats.by_country;
	const mapHeight = Math.round( width * 0.5 );

	const topCountries = Object.entries( countryData )
		.sort( ( [ , a ], [ , b ] ) => b - a )
		.slice( 0, 5 )
		.map( ( [ code, value ] ) => ( {
			name: getCountryName( code ),
			value,
		} ) );

	return (
		<Card>
			<div className="flex items-center justify-between">
				<h3 className="font-bold text-gray-900 sm:text-sm">
					{ __( 'Country', 'altis' ) }
				</h3>
				<ToggleGroup
					size="sm"
					type="single"
					value={ view }
					onValueChange={ v => v && setView( v ) }
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
				<div ref={ containerRef } className="mt-4">
					{ width > 0 && (
						<CountryMap
							data={ countryData }
							height={ mapHeight }
							width={ width }
							onSelect={ onAddRule ? code => onAddRule( {
								field: 'endpoint.Location.Country',
								value: code,
								type: 'string',
								operator: '=',
							} ) : undefined }
						/>
					) }
				</div>
			) : (
				<BarList
					className="mt-6"
					data={ topCountries }
					sortOrder="none"
				/>
			) }
		</Card>
	);
}
