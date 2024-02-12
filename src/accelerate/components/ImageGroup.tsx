import { useSelect } from '@wordpress/data';
import React from 'react';
import { Post } from '../../utils/admin';
import Image from './Image';

type Props = {
	blocks: number[],
	className?: string,
	width?: number,
	height?: number,
};

export default function ImageGroup ( props: Props ) {
	const {
		blocks: blockIds,
		className,
		width,
		height
	} = props;

	const blocks = useSelect<Post[]>( select => {
		return select( 'accelerate' ).getPosts( {
			type: 'wp_block',
			include: blockIds,
		}, false );
	}, [ blockIds ] );

	return (
		<div
			className={
				`record-thumbnail-group-wrap ${blockIds.length > 1 ? "record-thumbnail-group-wrap--multiple" : ""}`
			}
		>
			{ blocks.slice( 0, 2 ).reverse().map( block => (
				<Image
					key={ block.id }
					alt={ block.title }
					className={ className }
					height={ height }
					src={ block.thumbnail }
					width={ width }
				/>
			) ) }
		</div>
	);
};
