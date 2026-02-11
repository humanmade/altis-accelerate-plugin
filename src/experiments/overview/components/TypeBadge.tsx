import React from 'react';

import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

interface TypeBadgeProps {
	type: string;
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
	block: {
		label: __( 'A/B Block', 'altis' ),
		className: 'bg-purple-50 text-purple-700',
	},
	personalization: {
		label: __( 'Personalization', 'altis' ),
		className: 'bg-blue-50 text-blue-700',
	},
	titles: {
		label: __( 'Title Test', 'altis' ),
		className: 'bg-orange-50 text-orange-700',
	},
	featured_images: {
		label: __( 'Image Test', 'altis' ),
		className: 'bg-teal-50 text-teal-700',
	},
};

export function TypeBadge( { type }: TypeBadgeProps ) {
	const config = TYPE_CONFIG[ type ] || {
		label: type,
		className: 'bg-muted text-muted-foreground',
	};

	return (
		<span
			className={ cn(
				'inline-flex items-center !rounded-full !px-2.5 !py-0.5 !text-xs !font-medium',
				config.className
			) }
		>
			{ config.label }
		</span>
	);
}
