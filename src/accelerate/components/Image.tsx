import React, { useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Props for the Image component.
 *
 * @remarks
 * This interface extends all standard HTML img element attributes while providing
 * specific prop definitions for common use cases.
 *
 * @example
 * ```tsx
 * <Image
 *   src="/path/to/image.jpg"
 *   alt="Description of image"
 *   width={800}
 *   height={600}
 *   className="custom-image-class"
 * />
 * ```
 */
type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
	alt?: string,
	className?: string,
	src: string,
	width?: number,
	height?: number,
};

export default function Image( props: Props ) {
	const [ isLoaded, setIsLoaded ] = useState( false );
	const style: { [ k: string ] : string } = {
		visibility: isLoaded ? 'visible' : 'hidden',
	};
	if ( ! isLoaded ) {
		style.position = 'absolute';
	}

	return (
		<span className={ props.className }>
			<Skeleton
				style={ {
					width: props.width,
					height: props.height,
					display: isLoaded ? 'none' : 'block',
					// Inline fallback for contexts outside .tailwind scope
					backgroundColor: '#f0f0f0',
					borderRadius: '0.375rem',
				} }
			/>
			<img
				alt={ props.alt }
				style={ style }
				onLoad={ () => {
					setIsLoaded( true );
				} }
				{ ...props }
			/>
		</span>
	);
}
