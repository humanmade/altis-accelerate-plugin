import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { createBlock, cloneBlock } from '@wordpress/blocks';
import {
	Placeholder,
} from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { AccelerateBlockIcon } from '../../utils/icons';

import { mapSelectToProps } from './map-select-to-props';

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
	isPreviewMode,
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
		if ( ! isPreviewMode && isSelected ) {
			onSelect();
		}
	}, [ isPreviewMode, isSelected, onSelect ] );

	// Ensure a variant is always visible.
	useEffect( () => {
		if ( isPreviewMode ) {
			return;
		}
		if ( variantIndexes.indexOf( selectedVariantBlockIndex ) < 0 || selectedVariantBlockIndex < 0 ) {
			onSelectVariant( variantIndexes[0] || 0 );
		}
	}, [ isPreviewMode, selectedVariantBlockIndex, variantIndexes, onSelectVariant ] );

	// If a child block is selected in some other way e.g. the outline view, show parent variant.
	useEffect( () => {
		if ( ! isPreviewMode && ! isVisible && isChildSelected && selectedVariantBlockIndex !== variantIndex ) {
			onSelectVariant( variantIndex );
		}
	}, [ isPreviewMode, isChildSelected, isVisible, variantIndex, selectedVariantBlockIndex, onSelectVariant ] );

	const props = {};

	const blockProps = useBlockProps( {
		className: 'accelerate-block-variant',
	} );

	const { children, ...innerBlocksProps } = useInnerBlocksProps( {
		...blockProps,
		...props,
	} );

	return (
		// marginTop: 0 fixes gap issue when hidden variants affect block-gap (#456)
		<div { ...innerBlocksProps } style={ {
			display: isVisible ? 'block' : 'none',
			marginTop: 0,
		} }>
			{ ! isGlobalBlockPost && ! hasChildBlocks && (
				<Placeholder
					icon={ AccelerateBlockIcon }
					label={ __( 'Empty variant', 'altis' ) }
				/>
			) }
			{ children }
		</div>
	);
};

export default compose(
	withSelect( mapSelectToProps ),
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
