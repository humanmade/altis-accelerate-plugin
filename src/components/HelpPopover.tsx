import { CircleHelp } from 'lucide-react';
import * as React from 'react';

import { __, sprintf } from '@wordpress/i18n';

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface HelpPopoverProps {
	label: string;
	help: string;
	className?: string;
}

/**
 * Inline metric help that remains available to keyboard and touch users.
 */
export function HelpPopover( { label, help, className }: HelpPopoverProps ) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					aria-label={ sprintf( __( 'More information about %s', 'altis' ), label ) }
					className={ cn(
						'inline-flex max-w-full items-center gap-1 rounded-sm !border-0 !bg-transparent !p-0 !font-inherit !text-inherit cursor-help',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						className
					) }
					type="button"
				>
					<span className="truncate">{ label }</span>
					<CircleHelp aria-hidden="true" className="size-3 shrink-0" />
				</button>
			</PopoverTrigger>
			<PopoverContent aria-label={ sprintf( __( 'About %s', 'altis' ), label ) } className="w-72 p-3">
				<p className="!m-0 !text-sm !leading-relaxed">{ help }</p>
			</PopoverContent>
		</Popover>
	);
}
