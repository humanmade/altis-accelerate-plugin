import * as React from 'react';

import { cn } from '@/lib/utils';

interface Props {
	className?: string;
}

/**
 * Altis triangle mark. Stroke is `currentColor` so consumers control
 * tone via `text-*` classes; default ships as the dark grey that
 * matches assets/altis-mark-bw.svg. Inlined so it can pick up
 * className-driven sizing without an HTTP round-trip for a 200-byte
 * glyph.
 */
export function AltisMark( { className }: Props ) {
	return (
		<svg
			aria-hidden="true"
			className={ cn( 'shrink-0 text-[#464646]', className ) }
			fill="none"
			viewBox="0 0 699 551"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M643.977 510.767H93.4014L507.286 76.6426L643.977 510.767Z"
				stroke="currentColor"
				strokeWidth="80"
			/>
		</svg>
	);
}
