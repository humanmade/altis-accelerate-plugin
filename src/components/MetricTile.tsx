import { ArrowDown, ArrowUp } from 'lucide-react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

import { Card } from '../dashboard/components/Card';
import { cn, type Delta } from '../lib/utils';

import { HelpPopover } from './HelpPopover';
import { SlotNumber } from './ui/slot-number';

export type DeltaTone = 'positive' | 'negative' | 'neutral';

interface Props {
	label: string;
	// Native title tooltip on the label, for metrics whose meaning isn't
	// self-evident (e.g. engaged time definitions).
	labelTitle?: string;
	value: string;
	hint?: string;
	delta?: Delta;
	deltaLabel?: string;
	deltaTone?: DeltaTone;
	className?: string;
}

// Shared metric tile used by the Analytics page Summary strip and the
// Content Explorer hero strip. Visual contract: !p-4 Card, 11px
// uppercase label, 4xl semibold value, optional delta arrow + hint
// underneath. `delta` and `deltaTone` are optional — when omitted the
// tile renders exactly as the original `Summary.StatTile` so existing
// callers stay pixel-identical.
export const MetricTile = React.memo( function MetricTile( {
	label,
	labelTitle,
	value,
	hint,
	delta,
	deltaLabel,
	deltaTone = 'neutral',
	className,
}: Props ) {
	const renderDelta = !! delta;
	const arrow = delta?.direction === 1
		? <ArrowUp aria-hidden="true" className="!h-3 !w-3" />
		: delta?.direction === -1
			? <ArrowDown aria-hidden="true" className="!h-3 !w-3" />
			: null;
	const deltaColor = ! delta?.hasData || delta.direction === 0
		? 'text-gray-400'
		: deltaTone === 'positive'
			? 'text-emerald-600'
			: deltaTone === 'negative'
				? 'text-rose-600'
				: 'text-gray-500';

	return (
		<Card className={ cn( '!p-4 h-full', className ) }>
			<p className="!text-[11px] !uppercase !tracking-wider !font-medium !text-gray-500 !leading-none !m-0">
				{ labelTitle ? (
					<HelpPopover help={ labelTitle } label={ label } />
				) : label }
			</p>
			<div className="!mt-2 flex flex-wrap items-baseline gap-x-2">
				<p className="!m-0 !text-4xl !font-semibold !text-gray-900 !leading-[1.1] !tracking-tight tabular-nums">
					<SlotNumber value={ value } />
				</p>
				{ renderDelta && (
					<p className={ cn( '!m-0 !text-xs !leading-none inline-flex items-center gap-1 tabular-nums', deltaColor ) }>
						{ delta?.hasData && delta.direction !== 0 ? (
							<>
								{ arrow }
								<span className="sr-only">
									{ delta.direction === 1 ? __( 'Increase of', 'altis' ) : __( 'Decrease of', 'altis' ) }
								</span>
								<span>{ delta.capped ? `>${ delta.pct }%` : `${ delta.pct }%` }</span>
							</>
						) : (
							<span aria-hidden="true">—</span>
						) }
						{ deltaLabel && (
							<span className="!text-gray-500 !font-normal">{ deltaLabel }</span>
						) }
					</p>
				) }
			</div>
			{ hint && (
				<p className="!mt-1 !mb-0 !text-xs !text-gray-500 !leading-snug">
					{ hint }
				</p>
			) }
		</Card>
	);
}, ( prev, next ) =>
	prev.value === next.value &&
	prev.label === next.label &&
	prev.labelTitle === next.labelTitle &&
	prev.hint === next.hint &&
	prev.deltaTone === next.deltaTone &&
	prev.deltaLabel === next.deltaLabel &&
	prev.delta?.direction === next.delta?.direction &&
	prev.delta?.pct === next.delta?.pct &&
	prev.delta?.hasData === next.delta?.hasData &&
	prev.delta?.capped === next.delta?.capped
);
