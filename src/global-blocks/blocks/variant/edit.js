import React, { useEffect } from 'react';

import { InnerBlocks } from '@wordpress/block-editor';
import {
	Button,
	Placeholder,
} from '@wordpress/components';
import { createBlock, cloneBlock } from '@wordpress/blocks';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { CloneVariantIcon, GlobalBlockIcon } from '../../utils/icons';

// TODO re-add variant validation.
// import VariantValidation from './components/Validation';

const { AudiencePicker } = window.Altis.Analytics.components;

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
	parentPost,
	selectedVariant,
	variantIndex,
	variantIndexes,
	onAddVariant,
	onCloneVariant,
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
		if ( variantIndexes.indexOf( selectedVariant ) < 0 || selectedVariant < 0 ) {
			onSelectVariant( variantIndexes[0] || 0 );
		}
	}, [ selectedVariant, variantIndexes, onSelectVariant ] );

	// If a child block is selected in some other way e.g. the outline view, show parent variant.
	useEffect( () => {
		if ( ! isVisible && isChildSelected && selectedVariant !== variantIndex ) {
			onSelectVariant( variantIndex );
		}
	}, [ isChildSelected, isVisible, variantIndex, selectedVariant, onSelectVariant ] );

	const props = {};
	if ( ! hasChildBlocks || isChildSelected ) {
		/**
		 * If we don't have any child blocks, show standard block appender paragraph.
		 *
		 * @returns {InnerBlocks.DefaultBlockAppender} Block appender component.
		 */
		props.renderAppender = () => <InnerBlocks.DefaultBlockAppender />;
	}

	return (
		<div key="blocks" className="wp-block altis-gb-variant" data-block={ `altis-variant-${ variantIndex }` } style={ { display: isVisible ? 'block' : 'none' } }>
			{ ! isGlobalBlockPost && ! hasChildBlocks && (
				<Placeholder
					icon={ GlobalBlockIcon }
					label={ __( 'Empty variant', 'altis' ) }
				/>
			) }
			<InnerBlocks { ...props } />
			{ isGlobalBlockPost && (
				<div key="options" className="wp-block altis-gb-variant-options">
					{ parentPost?.blockType === 'personalization' && (
						<>
							<AudiencePicker
								audience={ null }
								buttonLabel={ __( 'Clone variant', 'altis' ) }
								icon={ CloneVariantIcon }
								onSelect={ audience => onCloneVariant( { audience } ) }
							/>
							<AudiencePicker
								audience={ null }
								buttonLabel={ __( 'Add blank variant', 'altis' ) }
								onSelect={ audience => onAddVariant( { audience } ) }
							/>
						</>
					) }
					{ parentPost?.blockType !== 'personalization' && (
						<>
							<Button
								icon={ CloneVariantIcon }
								isSecondary
								onClick={ onCloneVariant }
							>
								{ __( 'Clone variant', 'altis' ) }
							</Button>
							<Button
								icon="plus-alt"
								isSecondary
								onClick={ onAddVariant }
							>
								{ __( 'Add blank variant', 'altis' ) }
							</Button>
						</>
					) }
				</div>
			) }
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
		const selectedVariant = select( 'core/preferences' ).get( 'altis/global-blocks', `${ blockId }:variant` ) || 0;

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
