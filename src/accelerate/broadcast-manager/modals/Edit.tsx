import React from 'react';

import { __ } from '@wordpress/i18n';

import { usePost } from '../../../data/hooks';
import { Post, trackEvent } from '../../../utils/admin';
import BlockSelector from '../../components/BlockSelector';

type Props = {
	listId: string,
	item: Post,
};

/**
 * Create a Broadcast modal component.
 *
 * @param {Object} props Props.
 *
 * @return {React.element} Modal component.
 */
export default function Edit( props: Props ) {
	const {
		listId,
		item,
	} = props;

	const { post, onUpdatePost } = usePost( item.id );

	// Read blocks from Redux store, fall back to item prop if not available
	// The post in Redux may not have blocks if fetched from different endpoint
	const blocks = post?.blocks ?? item.blocks ?? [];

	const onSaveBlocks = function ( newBlocks: number[] ) {
		trackEvent( listId, 'Action', {
			action: 'update',
			type: post?.type || item.type,
			blocks: newBlocks.length,
		} );

		onUpdatePost( {
			id: item.id,
			blocks: newBlocks,
		} );
	};

	return (
		<div className="accelerate-broadcast-modal__edit">
			<BlockSelector
				label={ __( 'Select blocks', 'altis' ) }
				value={ blocks }
				onChange={ onSaveBlocks }
			/>
		</div>
	);
}
