import { dispatch } from '@wordpress/data';
import { Block, createBlock, getBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

import BlockSelector from "../../../accelerate/components/BlockSelector";

export default function Edit(props: Block) : JSX.Element {

	function onChangeSelectedBlocks(blocks: number[]) {
		const { clientId } = props;
		const { replaceBlock } = dispatch( 'core/block-editor' );

		if ( blocks.length > 0 ) {
			const hasCoreBlock = typeof getBlockType( 'core/block' ) !== 'undefined';
			let block = null;
			if ( ! hasCoreBlock ) {
				block = createBlock( 'altis/static-global', { ref: blocks[0] } )
			} else {
				block = createBlock( 'core/block', { ref: blocks[0] } )
			}
			replaceBlock( clientId, block );
		}
	}
	return (
		<div style={ { maxHeight: '500px', overflow: 'auto', fontSize: '13px' } }>
			<BlockSelector placeholder={ __( 'Search Synced Patterns', 'altis' ) } value={ [] } onChange={ onChangeSelectedBlocks } />
		</div>
	)
}
