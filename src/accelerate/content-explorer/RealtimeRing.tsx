import * as React from 'react';

const SIZE = 14;
const STROKE = 1.5;
const RADIUS = SIZE / 2 - STROKE;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
	// Restart the countdown animation when this changes.
	tick: number;
	// Seconds the ring takes to drain.
	periodSeconds?: number;
	// Active = brand color + animated; idle = muted, no animation.
	active: boolean;
	// Hover tooltip describing what the ring represents (the live refresh).
	title?: string;
}

/**
 * Small circular progress ring with a brand-colored center pulse,
 * meant to live next to the "Realtime" period chip. The ring drains
 * over `periodSeconds`, then resets when `tick` changes.
 */
export function RealtimeRing( { tick, periodSeconds = 30, active, title }: Props ) {
	return (
		<svg
			aria-hidden="true"
			className="shrink-0"
			height={ SIZE }
			viewBox={ `0 0 ${ SIZE } ${ SIZE }` }
			width={ SIZE }
		>
			{ /* Native SVG hover tooltip — labels the otherwise-opaque ring. */ }
			{ title && <title>{ title }</title> }
			{ /* Background ring. */ }
			<circle
				cx={ SIZE / 2 }
				cy={ SIZE / 2 }
				fill="none"
				r={ RADIUS }
				stroke="var(--color-border)"
				strokeWidth={ STROKE }
			/>
			{ /* Progress ring drains via stroke-dashoffset. */ }
			{ active && (
				<circle
					key={ tick }
					cx={ SIZE / 2 }
					cy={ SIZE / 2 }
					fill="none"
					r={ RADIUS }
					stroke="var(--color-brand)"
					strokeDasharray={ CIRCUMFERENCE }
					strokeLinecap="round"
					strokeWidth={ STROKE }
					style={ {
						animation: `realtime-ring-drain ${ periodSeconds }s linear forwards`,
						// CSS variable consumed by the keyframe defined in src/tailwind.css.
						['--ring-c' as string]: CIRCUMFERENCE,
					} }
					transform={ `rotate(-90 ${ SIZE / 2 } ${ SIZE / 2 })` }
				/>
			) }
			{ /* Center dot pulses while active. */ }
			<circle
				cx={ SIZE / 2 }
				cy={ SIZE / 2 }
				fill="var(--color-brand)"
				r={ STROKE }
				style={ active ? { animation: 'realtime-dot-pulse 1.5s ease-in-out infinite' } : undefined }
			/>
		</svg>
	);
}
