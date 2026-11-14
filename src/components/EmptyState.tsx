import * as React from 'react';

import { FadeIn } from './FadeIn';

import { Caption, SectionTitle } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
	icon?: React.ReactNode;
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}

export function EmptyState( { icon, title, description, action, className }: EmptyStateProps ) {
	return (
		<FadeIn className={ cn( 'flex flex-col items-center justify-center py-12 text-center', className ) }>
			{ icon && (
				<div className="mb-3 text-muted-foreground">
					{ icon }
				</div>
			) }
			<SectionTitle as="p">{ title }</SectionTitle>
			{ description && (
				<Caption className="mt-1 max-w-sm">{ description }</Caption>
			) }
			{ action && (
				<div className="mt-4">
					{ action }
				</div>
			) }
		</FadeIn>
	);
}
