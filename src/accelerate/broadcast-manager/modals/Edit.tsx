import React from "react";
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import BlockSelector from "../../components/BlockSelector";
import { usePost } from '../../../data/hooks';
import { Post, trackEvent } from '../../../utils/admin';

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
	const [ blocks, setBlocks ] = useState<number[]>( item.blocks || [] );

	const onSaveBlocks = function ( blocks: number[] ) {
		setBlocks( blocks );
		trackEvent( listId, 'Action', { action: 'update', type: post.type, blocks: blocks.length } );

		onUpdatePost( {
			id: post.id,
			blocks,
		} );
	};

	return (
		<BlockSelector
			label={ __( 'Select blocks', 'altis' ) }
			value={ blocks }
			onChange={ onSaveBlocks }
		/>
	);
}
