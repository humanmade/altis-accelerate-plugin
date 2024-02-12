import React, { useState } from 'react';
import ContentLoader from 'react-content-loader';

type Props = {
	alt?: string,
	className?: string,
	src: string,
	width?: number,
	height?: number,
};

const loaderProps = {
	speed: 2,
	foregroundColor: "#f5f6f8",
	backgroundColor: "#fff",
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
		<>
			<ContentLoader
				{ ...loaderProps }
				height={ props.height }
				style={ { display: isLoaded ? 'none' : 'block' } }
				width={ props.width }
			>
				<rect height={ props.height } rx="5" ry="5" width={ props.width } x={ 0 } y={ 0 } />
			</ContentLoader>
			<img
				alt={ props.alt }
				style={ style }
				onLoad={ () => {
					setIsLoaded( true );
				} }
				{ ...props }
			/>
		</>
	);
};
