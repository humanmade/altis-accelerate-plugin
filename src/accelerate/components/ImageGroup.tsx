import React from 'react';

import { useSelect } from '@wordpress/data';

import { Post } from '../../utils/admin';

import StandaloneBlockPreview from './StandaloneBlockPreview';

type Props = {
	blocks: number[],
	className?: string,
	width?: number,
	height?: number,
};

export default function ImageGroup( props: Props ) {
	const {
		blocks: blockIds,
		className,
		width,
		height,
	} = props;

	const blocks = useSelect<Post[]>( select => {
		return select( 'accelerate' ).getPosts( {
			type: 'wp_block',
			include: blockIds,
		}, false );
	}, [ blockIds ] );

	const displayBlocks = blocks.slice( 0, 2 ).reverse();
	const isMultiple = blockIds.length > 1;

	return (
		<div
			className={
				`record-thumbnail-group-wrap ${ isMultiple ? 'record-thumbnail-group-wrap--multiple' : '' }`
			}
		>
			{ blockIds.length > 2 && (
				<span className="record-thumbnail-extra-variant-count">+{ blockIds.length - 2 }</span>
			) }
			{ displayBlocks.map( ( block, index ) => {
				// For stacked effect: first in reversed array is back, second is front
				const stackClass = isMultiple
					? `stacked-preview stacked-preview--${ index === 0 ? 'back' : 'front' }`
					: '';

				// Use native BlockPreview for blocks with content
				if ( block.rawContent ) {
					return (
						<StandaloneBlockPreview
							key={ block.id }
							className={ `${ className || '' } ${ stackClass }`.trim() }
							content={ block.rawContent }
							height={ height }
							width={ width }
						/>
					);
				}

				// Blocks without rawContent show as empty placeholder
				// (External thumbnail API is deprecated/broken)
				return (
					<div key={ block.id } className={ `record-thumbnail__empty ${ stackClass }`.trim() } style={ {
						width,
						height,
					} } />
				);
			} ) }
		</div>
	);
}
