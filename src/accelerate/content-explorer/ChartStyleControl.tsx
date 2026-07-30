import { ChartColumn, ChartLine } from 'lucide-react';
import React from 'react';

import { __ } from '@wordpress/i18n';

import { ChartPresentation } from './useChartPresentation';

import { AnimatedTabs } from '@/components/ui/animated-tabs';

type Props = {
	value: ChartPresentation;
	onValueChange: ( value: ChartPresentation ) => void;
};

const OPTIONS: Array<{ value: ChartPresentation; label: React.ReactNode }> = [
	{
		value: 'line',
		label: (
			<span className="inline-flex items-center gap-1.5">
				<ChartLine aria-hidden="true" size={ 16 } />
				{ __( 'Line chart', 'altis' ) }
			</span>
		),
	},
	{
		value: 'bar',
		label: (
			<span className="inline-flex items-center gap-1.5">
				<ChartColumn aria-hidden="true" size={ 16 } />
				{ __( 'Bar chart', 'altis' ) }
			</span>
		),
	},
];

export function ChartStyleControl( { value, onValueChange }: Props ) {
	return (
		<AnimatedTabs
			options={ OPTIONS }
			value={ value }
			onValueChange={ onValueChange }
		/>
	);
}
