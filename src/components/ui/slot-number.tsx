import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import * as React from 'react';

const DIGITS = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ];
const DIGIT_RE = /^\d$/;
const DURATION = 0.22;
const EASE: [ number, number, number, number ] = [ 0.2, 0, 0.2, 1 ];
const STAGGER_MS = 20;

interface DigitColumnProps {
	char: string;
	delay: number;
}

/**
 * A single digit slot — a clipped column of 0-9 that scrolls to the
 * correct position when `char` changes. Direction (up/down) falls out
 * naturally from the relative position of old vs new digit values.
 */
function DigitColumn( { char, delay }: DigitColumnProps ) {
	const reduced = useReducedMotion();
	const digit = parseInt( char, 10 );
	const mv = useMotionValue( -digit );
	const y = useTransform( mv, v => `${ v }em` );

	React.useEffect( () => {
		if ( reduced ) {
			mv.set( -digit );
			return;
		}
		const controls = animate( mv, -digit, {
			duration: DURATION,
			ease: EASE,
			delay: delay / 1000,
		} );
		return controls.stop;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ char ] );

	return (
		<span style={ {
			display: 'inline-block',
			overflow: 'hidden',
			height: '1em',
			verticalAlign: 'bottom',
		} }>
			<motion.span style={ {
				display: 'block',
				y,
			} }>
				{ DIGITS.map( d => (
					<span key={ d } style={ {
						display: 'block',
						height: '1em',
						lineHeight: 1,
					} }>
						{ d }
					</span>
				) ) }
			</motion.span>
		</span>
	);
}

interface Props {
	value: string;
	/**
	 * Kept for API compatibility — the column approach determines scroll
	 * direction automatically from digit values, so this prop is unused.
	 */
	direction?: 'up' | 'down';
	className?: string;
}

/**
 * Slot-machine digit animation for refreshing numeric strings.
 *
 * Each digit scrolls independently to its new value (right-to-left
 * stagger, 20 ms per position). Non-digit characters (commas, dots,
 * k, M, %) render statically. When the formatted string changes length
 * (e.g. "999" → "1,000") the entire value cross-fades instead.
 *
 * Respects `prefers-reduced-motion` — falls back to an instant update.
 */
export function SlotNumber( { value, className }: Props ) {
	const reduced = useReducedMotion();

	const prevRef = React.useRef<string>( value );
	const prevValue = prevRef.current;

	React.useEffect( () => {
		prevRef.current = value;
	} );

	if ( reduced ) {
		return <span className={ className }>{ value }</span>;
	}

	const chars = value.split( '' );
	const prevChars = prevValue.split( '' );

	// Cross-fade the whole string when length changes — digit column
	// positions would misalign if we tried to animate char-by-char.
	if ( chars.length !== prevChars.length ) {
		return (
			<AnimatePresence initial={ false } mode="popLayout">
				<motion.span
					key={ value }
					animate={ { opacity: 1 } }
					className={ className }
					exit={ { opacity: 0 } }
					initial={ { opacity: 0 } }
					style={ { display: 'inline-block' } }
					transition={ { duration: 0.15 } }
				>
					{ value }
				</motion.span>
			</AnimatePresence>
		);
	}

	return (
		<span className={ className } style={ {
			display: 'inline-flex',
			alignItems: 'baseline',
		} }>
			{ chars.map( ( char, i ) => {
				if ( ! DIGIT_RE.test( char ) ) {
					return <span key={ i }>{ char }</span>;
				}
				// Stagger from right (units) to left (most significant)
				const distFromRight = chars.length - 1 - i;
				return (
					<DigitColumn
						key={ i }
						char={ char }
						delay={ distFromRight * STAGGER_MS }
					/>
				);
			} ) }
		</span>
	);
}
