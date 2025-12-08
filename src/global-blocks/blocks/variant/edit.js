import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { createBlock, cloneBlock } from '@wordpress/blocks';
import {
	Placeholder,
} from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { GlobalBlockIcon } from '../../utils/icons';

// TODO re-add variant validation.
// import VariantValidation from './components/Validation';

/**
 * Personalized content variant edit mode component.
 *
 * @param {React.ComponentProps} props The component props.
 * @returns {React.ReactNode} The variant edit mode component.
 */
const Edit = ( {
	hasChildBlocks,
	isChildSelected,
	isGlobalBlockPost,
	isSelected,
	isVisible,
	selectedVariant,
	selectedVariantBlockIndex,
	variantIndex,
	variantIndexes,
	onSelect,
	onSelectVariant,
} ) => {
	// Select the block parent if a variant is directly selected.
	useEffect( () => {
		if ( isSelected ) {
			onSelect();
		}
	}, [ isSelected, onSelect ] );

	// Ensure a variant is always visible.
	useEffect( () => {
		if ( variantIndexes.indexOf( selectedVariantBlockIndex ) < 0 || selectedVariantBlockIndex < 0 ) {
			onSelectVariant( variantIndexes[0] || 0 );
		}
	}, [ selectedVariantBlockIndex, variantIndexes, onSelectVariant ] );

	// If a child block is selected in some other way e.g. the outline view, show parent variant.
	useEffect( () => {
		if ( ! isVisible && isChildSelected && selectedVariantBlockIndex !== variantIndex ) {
			onSelectVariant( variantIndex );
		}
	}, [ isChildSelected, isVisible, variantIndex, selectedVariantBlockIndex, onSelectVariant ] );

	const props = {};

	const blockProps = useBlockProps( {
		className: 'accelerate-block-variant',
	} );

	const { children, ...innerBlocksProps } = useInnerBlocksProps( {
		...blockProps,
		...props,
	} );

	return (
		<div { ...innerBlocksProps } style={ { display: isVisible ? 'block' : 'none' } }>
			{ ! isGlobalBlockPost && ! hasChildBlocks && (
				<Placeholder
					icon={ GlobalBlockIcon }
					label={ __( 'Empty variant', 'altis' ) }
				/>
			) }
			{ children }
		</div>
	);
};

export default compose(
	withSelect( ( select, ownProps ) => {
		const { clientId } = ownProps;
		const { getBlockOrder, getBlocks, getSelectedBlock, getBlock, getBlockIndex, getBlockRootClientId } = select( 'core/block-editor' );
		const { getEditedEntityRecord } = select( 'core' );
		const { getCurrentPost } = select( 'core/editor' );
		const post = getCurrentPost();
		const parentClientId = getBlockRootClientId( clientId );
		const parentBlock = parentClientId ? getBlock( parentClientId ) : null;
		const blockId = post && post.type === 'wp_block' ? post.id : parentBlock.attributes.ref;
		const childBlocks = getBlocks( parentClientId );
		const variants = ( childBlocks || [] ).filter( block => block.name === 'altis/variant' );
		const parentPost = getEditedEntityRecord( 'postType', 'wp_block', blockId );
		const selectedVariantBlockIndex = select( 'core/preferences' ).get( 'altis/global-blocks', `${ blockId }:variant` ) || 0;

		// Convert WordPress block index back to array index for visibility logic
		const selectedVariantArrayIndex = variants.findIndex( v => {
			const blockIndex = getBlockIndex( v.clientId );
			return blockIndex === selectedVariantBlockIndex;
		} );
		const selectedVariant = selectedVariantArrayIndex >= 0 ? selectedVariantArrayIndex : 0;

		let block = getSelectedBlock();
		while ( block && block.name !== 'altis/variant' ) {
			block = getBlock( getBlockRootClientId( block.clientId ) );
		}

		const variantIndexes = variants.map( variant => getBlockIndex( variant.clientId ) );
		const isChildSelected = block && block.name === 'altis/variant' && block.clientId === clientId;

		return {
			blocks: getBlocks( clientId ),
			hasChildBlocks: getBlockOrder( clientId ).length > 0,
			variantIndexes,
			isChildSelected,
			isGlobalBlockPost: post && post.type === 'wp_block',
			isVisible: variants[ selectedVariant ]?.clientId === clientId,
			parentClientId,
			parentPost,
			selectedVariant,
			selectedVariantBlockIndex,
			variantIndex: getBlockIndex( clientId ),
			variants,
		};
	} ),
	withDispatch( ( dispatch, ownProps, registry ) => {
		const { clientId, variants, parentPost } = ownProps;
		const { getBlockRootClientId, getBlock, getBlockIndex } = registry.select( 'core/block-editor' );
		const { selectBlock, insertBlock, removeBlock } = dispatch( 'core/block-editor' );
		const { set: setPreference } = dispatch( 'core/preferences' );

		// Get parent block client ID.
		const block = getBlock( clientId );
		const rootClientId = getBlockRootClientId( clientId );

		return {
			/**
			 * Function to select the first block in the variant.
			 *
			 * @returns {object} Redux action object.
			 */
			onSelect: () => selectBlock( rootClientId ),
			onAddVariant: ( attributes = {} ) => {
				const newVariant = createBlock( 'altis/variant', attributes );
				insertBlock( newVariant, variants.length, rootClientId || '' );
				setPreference( 'altis/global-blocks', `${ parentPost.id }:variant`, getBlockIndex( newVariant.clientId ) );
				selectBlock( newVariant.clientId );
			},
			onCloneVariant: ( attributes = {} ) => {
				const newVariant = cloneBlock( block, {
					title: null,
					fallback: false,
					audience: null,
					...attributes,
				} );
				insertBlock( newVariant, variants.length, rootClientId || '' );
				setPreference( 'altis/global-blocks', `${ parentPost.id }:variant`, getBlockIndex( newVariant.clientId ) );
				selectBlock( newVariant.clientId );
			},
			onRemoveVariant: () => removeBlock( clientId ),
			onSelectVariant: ( variantId = 0 ) => {
				setPreference( 'altis/global-blocks', `${ parentPost.id }:variant`, variantId );
			},
		};
	} )
)( Edit );
