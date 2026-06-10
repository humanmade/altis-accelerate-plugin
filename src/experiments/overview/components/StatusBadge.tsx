import React from 'react';

import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
	status: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
	running: {
		label: __( 'Running', 'altis' ),
		className: 'bg-green-100 text-green-800',
	},
	paused: {
		label: __( 'Paused', 'altis' ),
		className: 'bg-amber-100 text-amber-800',
	},
	completed: {
		label: __( 'Completed', 'altis' ),
		className: 'bg-muted text-muted-foreground',
	},
	draft: {
		label: __( 'Draft', 'altis' ),
		className: 'border border-border text-muted-foreground',
	},
};

export function StatusBadge( { status }: StatusBadgeProps ) {
	const config = STATUS_CONFIG[ status ] || STATUS_CONFIG.draft;

	return (
		<span
			aria-label={ `${ __( 'Status:', 'altis' ) } ${ config.label }` }
			className={ cn(
				'inline-flex items-center !rounded-full !px-2.5 !py-0.5 !text-xs !font-medium',
				config.className
			) }
		>
			{ config.label }
		</span>
	);
}
