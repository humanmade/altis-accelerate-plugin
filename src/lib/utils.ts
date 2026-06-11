// Tremor cx [v0.0.0]

import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cx( ...args: ClassValue[] ) {
	return clsx( ...args );
}

// shadcn cn function
export function cn( ...inputs: ClassValue[] ) {
	return twMerge( clsx( inputs ) );
}

export const focusRing = [
	// base
	'outline outline-offset-2 outline-0 focus-visible:outline-2',
	// outline color
	'outline-blue-500 dark:outline-blue-500',
];

export type Delta = {
	pct: number;
	direction: 1 | -1 | 0;
	hasData: boolean;
	// True when the raw delta exceeds DELTA_CAP. Consumers render
	// `>500%` instead of the actual five-/six-digit number, which
	// reads as noise (typical when prior was near-zero).
	capped: boolean;
};

const DELTA_CAP = 500;

// Prior-period delta with explicit edge-case handling. `hasData: false`
// signals "render the neutral em-dash" — keeps tile consumers from
// having to repeat null/zero/sub-1% logic. Absolute pct under 1
// collapses to neutral so noise doesn't render as 0%; above DELTA_CAP
// sets `capped: true` so the tile renders `>500%` instead of a five-
// digit number.
export function computeDelta( current: number, prior: number ): Delta {
	if ( prior === 0 ) {
		const hasData = current === 0;
		return {
			pct: 0,
			direction: 0,
			hasData,
			capped: false,
		};
	}
	const raw = ( ( current - prior ) / prior ) * 100;
	const pct = Math.round( raw );
	if ( Math.abs( pct ) < 1 ) {
		return {
			pct: 0,
			direction: 0,
			hasData: true,
			capped: false,
		};
	}
	const capped = Math.abs( pct ) > DELTA_CAP;
	return {
		pct: capped ? DELTA_CAP : Math.abs( pct ),
		direction: pct > 0 ? 1 : -1,
		hasData: true,
		capped,
	};
}
