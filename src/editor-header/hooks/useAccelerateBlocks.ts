import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';

export interface AccelerateBlock {
	clientId: string;
	blockType: 'standard' | 'abtest' | 'personalization' | 'broadcast';
	variantCount: number;
	blockName: string;
	goal?: string;
}

/**
 * Recursively find all Accelerate blocks in the editor.
 * Detects core/block (synced patterns) and altis/broadcast blocks.
 */
export const useAccelerateBlocks = (): AccelerateBlock[] => {
	return useSelect( select => {
		const { getBlocks, getBlockName, getBlockAttributes } = select( blockEditorStore );
		const coreSelect = select( 'core' );
		const accelerateBlocks: AccelerateBlock[] = [];

		const scanBlocks = ( blocks: any[] ) => {
			for ( const block of blocks ) {
				const name = getBlockName( block.clientId );

				if ( name === 'core/block' ) {
					const attrs = getBlockAttributes( block.clientId );
					const ref = attrs?.ref;

					if ( ref ) {
						// Fetch the wp_block entity to get blockType
						const pattern = coreSelect.getEntityRecord( 'postType', 'wp_block', ref );
						const blockType = pattern?.blockType || 'standard';

						// Get block name from pattern title (can be string or object with rendered property)
						const titleValue = pattern?.title;
						const blockName = typeof titleValue === 'string'
							? titleValue
							: ( titleValue?.rendered || titleValue?.raw || 'Untitled' );

						// Count variants by checking the raw content
						let variantCount = 0;
						if ( pattern?.content?.raw ) {
							const matches = pattern.content.raw.match( /<!-- wp:altis\/variant/g );
							variantCount = matches ? matches.length : 0;
						}

						accelerateBlocks.push( {
							clientId: block.clientId,
							blockType: blockType as AccelerateBlock['blockType'],
							variantCount,
							blockName,
							goal: pattern?.goal,
						} );
					}
				} else if ( name === 'altis/broadcast' ) {
					const attrs = getBlockAttributes( block.clientId );
					const blockName = attrs?.title || 'Broadcast';
					const variantCount = block.innerBlocks?.length || 0;

					accelerateBlocks.push( {
						clientId: block.clientId,
						blockType: 'broadcast',
						variantCount,
						blockName,
					} );
				}

				// Recursively scan inner blocks
				if ( block.innerBlocks?.length ) {
					scanBlocks( block.innerBlocks );
				}
			}
		};

		const rootBlocks = getBlocks();
		scanBlocks( rootBlocks );

		return accelerateBlocks;
	}, [] );
};
