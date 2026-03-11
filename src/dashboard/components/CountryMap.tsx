import { EqualEarth } from '@visx/geo';
import { scaleQuantize } from '@visx/scale';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { __ } from '@wordpress/i18n';

import { getCountryName } from '../data/countries';
import worldGeo from '../data/world-countries.json';

const COLORS = [
	'#f3e8ff', // purple-100
	'#d8b4fe', // purple-300
	'#c084fc', // purple-400
	'#a855f7', // purple-500
	'#9333ea', // purple-600
	'#7e22ce', // purple-700
];
const NO_DATA_COLOR = '#f3f4f6'; // gray-100
const HOVER_STROKE = '#1e3a5f';

interface Props {
	data: Record<string, number>;
	width: number;
	height: number;
}

interface TooltipState {
	code: string;
	name: string;
	value: number;
	x: number;
	y: number;
}

export default function CountryMap( { data, width, height }: Props ) {
	const containerRef = useRef<HTMLDivElement>( null );
	const [ tooltip, setTooltip ] = useState<TooltipState | null>( null );

	const maxValue = useMemo( () => {
		const values = Object.values( data );
		return values.length > 0 ? Math.max( ...values ) : 0;
	}, [ data ] );

	const colorScale = useMemo( () => scaleQuantize( {
		domain: [ 1, Math.max( maxValue, 1 ) ],
		range: COLORS,
	} ), [ maxValue ] );

	const handleMouseMove = useCallback( ( event: React.MouseEvent, code: string ) => {
		if ( ! containerRef.current ) {
			return;
		}
		const rect = containerRef.current.getBoundingClientRect();
		setTooltip( {
			code,
			name: getCountryName( code ),
			value: data[ code ] || 0,
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		} );
	}, [ data ] );

	const handleMouseLeave = useCallback( () => {
		setTooltip( null );
	}, [] );

	if ( width < 10 ) {
		return null;
	}

	return (
		<div ref={ containerRef } style={ { position: 'relative' } }>
			<svg height={ height } width={ width }>
				<EqualEarth
					data={ worldGeo.features as any[] }
					fitSize={ [ [ width, height ], worldGeo as any ] }
				>
					{ ( { features } ) => (
						<g>
							{ features.map( ( { feature, path }, i ) => {
								const code = feature.properties?.iso_a2 || '';
								const value = data[ code ] || 0;
								const fill = value > 0 ? colorScale( value ) : NO_DATA_COLOR;
								const isHovered = tooltip?.code === code;
								return (
									<path
										key={ `country-${ i }` }
										d={ path || '' }
										fill={ fill }
										stroke={ isHovered ? HOVER_STROKE : '#d1d5db' }
										strokeWidth={ isHovered ? 1.5 : 0.5 }
										onMouseEnter={ e => code && handleMouseMove( e, code ) }
										onMouseLeave={ handleMouseLeave }
										onMouseMove={ e => code && handleMouseMove( e, code ) }
									/>
								);
							} ) }
						</g>
					) }
				</EqualEarth>
			</svg>
			{ tooltip && (
				<div
					style={ {
						position: 'absolute',
						left: tooltip.x + 12,
						top: tooltip.y - 12,
						backgroundColor: 'white',
						border: '1px solid #e5e7eb',
						borderRadius: '6px',
						boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
						color: '#111827',
						fontSize: '13px',
						padding: '6px 10px',
						pointerEvents: 'none',
						whiteSpace: 'nowrap',
						zIndex: 10,
					} }
				>
					<strong>{ tooltip.name }</strong>
					<br />
					{ tooltip.value.toLocaleString() } { __( 'views', 'altis' ) }
				</div>
			) }
		</div>
	);
}
