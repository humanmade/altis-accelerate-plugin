import * as React from 'react';

import { SlotNumber } from '@/components/ui/slot-number';

interface Props {
	value: number;
	className?: string;
	/** Kept for backwards compatibility — SlotNumber uses a fixed per-digit duration. */
	durationMs?: number;
	format?: ( v: number ) => string;
}

const defaultFormat = ( v: number ) => Math.round( v ).toLocaleString();

/**
 * Displays a numeric value with slot-machine digit animation when the
 * value changes. Delegates to SlotNumber for the animation itself.
 */
export function AnimatedNumber( { value, className, format = defaultFormat }: Props ) {
	return <SlotNumber className={ className } value={ format( value ) } />;
}
