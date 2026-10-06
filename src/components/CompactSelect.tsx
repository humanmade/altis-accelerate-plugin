import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from './ui/dropdown-menu';

export interface CompactSelectOption {
	value: string;
	label: string;
}

interface Props {
	value: string;
	onChange: ( next: string ) => void;
	options: CompactSelectOption[];
	// Required — used as the trigger's aria-label. The visible text is
	// the currently-selected option's label, which screen readers need
	// the surrounding role context for (e.g. "Group by, source / campaign").
	label: string;
	leadingIcon?: React.ReactNode;
	align?: 'start' | 'end';
	className?: string;
}

// Compact dropdown trigger matching ToggleGroup `size="sm"`'s
// silhouette (h-8 px-2). Pair this with ToggleGroup in the same row
// for visual parity — they're the two halves of the same selector
// family. See src/components/AGENTS.md for when to pick which.
export function CompactSelect( {
	value,
	onChange,
	options,
	label,
	leadingIcon,
	align = 'end',
	className,
}: Props ) {
	const current = options.find( o => o.value === value );
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={ label }
				className={ cn(
					'inline-flex items-center gap-1.5 h-8 px-2 text-sm font-medium',
					'border border-input rounded-md bg-transparent',
					'hover:bg-muted text-foreground',
					'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
					className
				) }
			>
				{ leadingIcon && <span className="inline-flex shrink-0">{ leadingIcon }</span> }
				<span className="truncate">{ current?.label ?? value }</span>
				<ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60 shrink-0" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align={ align }>
				<DropdownMenuRadioGroup value={ value } onValueChange={ onChange }>
					{ options.map( o => (
						<DropdownMenuRadioItem key={ o.value } value={ o.value }>
							{ o.label }
						</DropdownMenuRadioItem>
					) ) }
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
