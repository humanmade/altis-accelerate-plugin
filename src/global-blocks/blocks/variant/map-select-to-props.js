/**
 * Map block editor state to the variant edit component props.
 *
 * @param {Function} select The registry select function.
 * @param {object} ownProps The component props.
 * @returns {object} The props to pass to the component.
 */
export const mapSelectToProps = ( select, ownProps ) => {
	const { clientId } = ownProps;
	const { getBlockOrder, getBlocks, getSelectedBlock, getBlock, getBlockIndex, getBlockRootClientId, getSettings } = select( 'core/block-editor' );
	const { getEditedEntityRecord } = select( 'core' );
	const { getCurrentPost } = select( 'core/editor' );
	const post = getCurrentPost();
	const parentClientId = getBlockRootClientId( clientId );
	const parentBlock = parentClientId ? getBlock( parentClientId ) : null;
	const settings = getSettings();
	const isPreviewMode = !! ( settings.isPreviewMode ?? settings.__unstableIsPreviewMode );
	const blockId = post && post.type === 'wp_block' ? post.id : parentBlock?.attributes?.ref;
	const childBlocks = getBlocks( parentClientId );
	const variants = ( childBlocks || [] ).filter( block => block.name === 'altis/variant' );
	const parentPost = blockId ? getEditedEntityRecord( 'postType', 'wp_block', blockId ) : false;
	const selectedVariantBlockIndex = isPreviewMode ? 0 : select( 'core/preferences' ).get( 'altis/global-blocks', `${ blockId }:variant` ) || 0;

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
		isPreviewMode,
		isVisible: variants[ isPreviewMode ? 0 : selectedVariant ]?.clientId === clientId,
		parentClientId,
		parentPost,
		selectedVariant,
		selectedVariantBlockIndex,
		variantIndex: getBlockIndex( clientId ),
		variants,
	};
};
