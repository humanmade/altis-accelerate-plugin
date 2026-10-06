import React from 'react';

import { __ } from '@wordpress/i18n';

import { PRIOR_SERIES_COLOR } from './TimeSeriesPlot';

import { cn } from '@/lib/utils';

type Props = {
	enabled: boolean;
	onEnabledChange: ( enabled: boolean ) => void;
};

// One-segment sibling of AnimatedTabs (ChartStyleControl / resolution tabs):
// same !h-9 !rounded-lg !bg-muted !p-1 track, but with a single button that
// lifts into the raised !bg-background pill when enabled instead of sliding
// between options.
export function CompareControl( { enabled, onEnabledChange }: Props ) {
	return (
		<div className="relative inline-flex !h-9 items-center justify-center !rounded-lg !bg-muted !p-1 text-muted-foreground">
			<button
				aria-label={ __( 'Compare to prior period', 'altis' ) }
				aria-pressed={ enabled }
				className={ cn(
					// Easing matches the chart's mark animation (motion.ts `standard`),
					// so toggling the pill and the ghost bars arriving read as one
					// gesture rather than two.
					'relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-md !px-3 !py-1 !text-sm !font-medium transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] !border-0',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					// The raised pill's shadow is a colour-independent state cue —
					// don't reintroduce AnimatedTabs' `!shadow-none` here, it wins
					// on specificity and flattens the enabled state.
					enabled
						? '!bg-background !text-foreground !shadow'
						: '!bg-transparent !shadow-none !text-muted-foreground hover:!text-foreground'
				) }
				data-state={ enabled ? 'checked' : 'unchecked' }
				id="hero-chart-compare-to-prior"
				type="button"
				onClick={ () => onEnabledChange( ! enabled ) }
			>
				<span
					aria-hidden="true"
					className="size-2 !rounded-sm border"
					style={ {
						backgroundColor: enabled ? PRIOR_SERIES_COLOR : 'transparent',
						borderColor: PRIOR_SERIES_COLOR,
					} }
				/>
				{ __( 'Compare', 'altis' ) }
			</button>
		</div>
	);
}
