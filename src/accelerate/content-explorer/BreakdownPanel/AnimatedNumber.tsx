import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import * as React from 'react';

interface Props {
	value: number;
	className?: string;
	durationMs?: number;
	// Optional formatter for the tweened value. Default is integer +
	// locale-aware thousand separators (e.g. `1,234`). Pass a custom
	// formatter for fractional metrics (`v => v.toFixed(1)`) or
	// percentages (`v => v.toFixed(0) + '%'`).
	format?: ( v: number ) => string;
}

const defaultFormat = ( v: number ) => Math.round( v ).toLocaleString();

/**
 * Tweens between numeric values when `value` changes. Falls back to a
 * straight render under prefers-reduced-motion.
 */
export function AnimatedNumber( { value, className, durationMs = 600, format = defaultFormat }: Props ) {
	const reduced = useReducedMotion();
	const mv = useMotionValue( value );
	const formatted = useTransform( mv, latest => format( latest ) );

	React.useEffect( () => {
		if ( reduced ) {
			mv.set( value );
			return;
		}
		const controls = animate( mv, value, {
			duration: durationMs / 1000,
			ease: [ 0.2, 0, 0, 1 ],
		} );
		return controls.stop;
	}, [ value, durationMs, reduced, mv ] );

	return <motion.span className={ className }>{ formatted }</motion.span>;
}
