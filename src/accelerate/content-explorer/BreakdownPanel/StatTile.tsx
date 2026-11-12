import * as React from 'react';

// Cross-import the same Card component the Analytics page uses so the two
// surfaces are visually identical.
import { Card } from '../../../dashboard/components/Card';

import { DataContainer } from '@/components/DataContainer';
import { AnimatedTabs, TabOption } from '@/components/ui/animated-tabs';
import type { DataState } from '@/types/component-states';

export interface StatTileTab<T extends string> {
	value: T;
	label: string;
	state: DataState;
	body: React.ReactNode;
	skeleton: React.ReactNode;
	empty?: React.ReactNode;
	errorMessage?: string;
	onRetry?: () => void;
}

interface SimpleProps {
	title: React.ReactNode;
	state: DataState;
	body: React.ReactNode;
	skeleton: React.ReactNode;
	empty?: React.ReactNode;
	errorMessage?: string;
	onRetry?: () => void;
	className?: string;
	bodyClassName?: string;
	// Optional control rendered in the header's top-right (e.g. a
	// dropdown for switching dimension). Shrinks on narrow widths
	// while the title truncates.
	action?: React.ReactNode;
}

interface TabbedProps<T extends string> {
	title: React.ReactNode;
	tabs: StatTileTab<T>[];
	value: T;
	onValueChange: ( v: T ) => void;
	className?: string;
	bodyClassName?: string;
}

function isTabbed<T extends string>( props: SimpleProps | TabbedProps<T> ): props is TabbedProps<T> {
	return 'tabs' in props && Array.isArray( props.tabs );
}

export function StatTile<T extends string = string>( props: SimpleProps | TabbedProps<T> ) {
	const { title, className, bodyClassName } = props;

	if ( isTabbed( props ) ) {
		const active = props.tabs.find( t => t.value === props.value ) ?? props.tabs[ 0 ];
		const tabOptions: TabOption<T>[] = props.tabs.map( t => ( {
			value: t.value,
			label: t.label,
		} ) );

		return (
			<Card className={ className }>
				<div className="mb-4 flex min-h-8 items-center justify-between gap-3">
					<h3 className="!m-0 !text-sm !font-medium !text-muted-foreground">{ title }</h3>
					<AnimatedTabs
						className="motion-reduce:transition-none"
						options={ tabOptions }
						value={ props.value }
						onValueChange={ props.onValueChange }
					/>
				</div>
				<DataContainer
					className={ bodyClassName }
					empty={ active.empty }
					errorMessage={ active.errorMessage }
					skeleton={ active.skeleton }
					state={ active.state }
					onRetry={ active.onRetry }
				>
					{ active.body }
				</DataContainer>
			</Card>
		);
	}

	return (
		<Card className={ className }>
			<div className="mb-4 flex min-h-8 items-center justify-between gap-3">
				<h3 className="!m-0 min-w-0 flex-1 truncate !text-sm !font-medium !text-muted-foreground">{ title }</h3>
				{ props.action && <div className="shrink-0">{ props.action }</div> }
			</div>
			<DataContainer
				className={ bodyClassName }
				empty={ props.empty }
				errorMessage={ props.errorMessage }
				skeleton={ props.skeleton }
				state={ props.state }
				onRetry={ props.onRetry }
			>
				{ props.body }
			</DataContainer>
		</Card>
	);
}
