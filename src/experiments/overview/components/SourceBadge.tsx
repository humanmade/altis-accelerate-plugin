import React from 'react';

import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

interface SourceBadgeProps {
	source?: string;
	status?: string;
	title?: string;
}

/**
 * Provenance and activity badges for an experiment. The two are ORTHOGONAL —
 * both can show at once:
 *
 *  - AI        = provenance ("AI-generated"). Static purple pill. Shows whenever
 *                source ∈ {ai, autopilot} OR the title is prefixed "AI:".
 *                Permanent — independent of run state.
 *  - Autopilot = activity ("running in an autonomous optimization loop").
 *                Pulsing purple dot. Shows ONLY when source==='autopilot' AND
 *                status==='running'. Disappears when the loop stops; the AI
 *                provenance pill remains.
 */
export function SourceBadge( { source, status, title }: SourceBadgeProps ) {
	const isAi = source === 'ai' || source === 'autopilot' || /^ai:/i.test( title ?? '' );
	const isLooping = source === 'autopilot' && status === 'running';

	if ( ! isAi && ! isLooping ) {
		return null;
	}

	return (
		<>
			{ isAi && (
				<span
					aria-label={ __( 'AI-generated experiment', 'altis' ) }
					className={ cn(
						'inline-flex items-center !rounded-full !px-2.5 !py-0.5 !text-xs !font-medium',
						'bg-brand/10 text-brand'
					) }
				>
					{ __( 'AI', 'altis' ) }
				</span>
			) }
			{ isAi && isLooping && ' ' }
			{ isLooping && (
				<span
					aria-label={ __( 'On autopilot — actively looping', 'altis' ) }
					className={ cn(
						'inline-flex items-center gap-1 !rounded-full !px-2.5 !py-0.5 !text-xs !font-medium',
						'bg-brand/10 text-brand'
					) }
				>
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
					{ __( 'Autopilot', 'altis' ) }
				</span>
			) }
		</>
	);
}
