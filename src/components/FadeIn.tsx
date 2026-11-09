import * as React from 'react';

import { cn } from '@/lib/utils';

interface FadeInProps {
	children: React.ReactNode;
	className?: string;
	translateY?: number;
}

export function FadeIn( { children, className, translateY = 4 }: FadeInProps ) {
	const [ visible, setVisible ] = React.useState( false );
	const prefersReduced = React.useRef( false );

	React.useEffect( () => {
		prefersReduced.current = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		// Use rAF to ensure the initial hidden state paints before transitioning
		requestAnimationFrame( () => setVisible( true ) );
	}, [] );

	return (
		<div
			className={ cn( 'transition-all duration-200 ease-out', className ) }
			style={
				prefersReduced.current || visible
					? {
						opacity: 1,
						transform: 'translateY(0)',
					}
					: {
						opacity: 0,
						transform: `translateY(${ translateY }px)`,
					}
			}
		>
			{ children }
		</div>
	);
}
