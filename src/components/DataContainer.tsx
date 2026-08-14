import * as React from 'react';

import { __ } from '@wordpress/i18n';

import type { DataState } from '../types/component-states';

import { EmptyState } from './EmptyState';
import { FadeIn } from './FadeIn';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataContainerProps {
	state: DataState;
	children: React.ReactNode;
	skeleton: React.ReactNode;
	empty?: React.ReactNode;
	errorMessage?: string;
	onRetry?: () => void;
	minHeight?: number;
	className?: string;
}

export function DataContainer( {
	state,
	children,
	skeleton,
	empty,
	errorMessage,
	onRetry,
	minHeight,
	className,
}: DataContainerProps ) {
	return (
		<div
			className={ cn( className ) }
			style={ minHeight ? { minHeight } : undefined }
		>
			{ state === 'loading' && skeleton }
			{ state === 'loaded' && (
				<FadeIn>{ children }</FadeIn>
			) }
			{ state === 'empty' && (
				empty || (
					<EmptyState
						title={ __( 'No data yet', 'altis' ) }
					/>
				)
			) }
			{ state === 'error' && (
				<EmptyState
					action={ onRetry && (
						<Button variant="outline" onClick={ onRetry }>
							{ __( 'Try again', 'altis' ) }
						</Button>
					) }
					title={ errorMessage || __( 'Something went wrong', 'altis' ) }
				/>
			) }
		</div>
	);
}
