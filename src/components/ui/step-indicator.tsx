import React from 'react';

import { cn } from '@/lib/utils';

interface StepIndicatorProps {
	percent: number;
	isLoading?: boolean;
	className?: string;
}

const BAR_COUNT = 10;
const FILL_COLOR = 'var(--color-brand)';
const EMPTY_COLOR = '#e5e5e5';

function StepIndicator( { percent, isLoading = false, className }: StepIndicatorProps ) {
	const filledCount = Math.round( percent / 10 );

	return (
		<div className={ cn( className ) }>
			<div
				style={ {
					display: 'flex',
					alignItems: 'flex-end',
					gap: '3px',
				} }
			>
				{ Array.from( { length: BAR_COUNT }, ( _, i ) => {
					const isFilled = ! isLoading && i < filledCount;
					const opacity = isFilled && filledCount > 0
						? 0.1 + ( ( i + 1 ) / filledCount ) * 0.9
						: 1;

					return (
						<div
							key={ i }
							className={ cn( isLoading && 'animate-pulse' ) }
							style={ {
								width: '4px',
								height: '20px',
								borderRadius: '9999px',
								backgroundColor: isFilled ? FILL_COLOR : EMPTY_COLOR,
								opacity: isFilled ? opacity : 1,
							} }
						/>
					);
				} ) }
			</div>
			<div
				style={ {
					fontSize: '11px',
					lineHeight: '16px',
					marginTop: '2px',
					color: '#1d2327',
				} }
			>
				{ isLoading ? '\u2026' : `${ percent }%` }
			</div>
		</div>
	);
}

export { StepIndicator };
