import React, { useState } from 'react';
import ContentLoader from 'react-content-loader';

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

const loaderProps = {
	speed: 2,
	foregroundColor: '#f5f6f8',
	backgroundColor: '#fff',
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
			<ContentLoader
				{ ...loaderProps }
				height={ props.height }
				style={ { display: isLoaded ? 'none' : 'block' } }
				width={ props.width }
			>
				<rect height={ props.height } rx="0" ry="0" width={ props.width } x={ 0 } y={ 0 } />
			</ContentLoader>
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
