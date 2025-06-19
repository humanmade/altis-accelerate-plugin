import React, { useEffect, useRef } from 'react';

import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { createBlock } from '@wordpress/blocks';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	BlockControls,
	InspectorControls,
} from '@wordpress/block-editor';
import {
	Button,
	DropdownMenu,
	Panel,
	PanelBody,
	Placeholder,
	Toolbar,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { __, _n, sprintf } from '@wordpress/i18n';

import { Controls } from './components/Controls';
import Title from '../variant/components/Title';
import { AdvancedControls } from './components/AdvancedControls';
import { GlobalBlockIcon, MenuIcon } from '../../utils/icons';

const blockTypes = {
	standard: __( 'Synced Pattern', 'altis' ),
	abtest: __( 'A/B Test', 'altis' ),
	personalization: __( 'Personalized', 'altis' ),
};

export const withGlobalBlockSettings = ( settings, name ) => {
	if ( name !== 'core/block' && name !== 'altis/variant' ) {
		return settings;
	}

	// Use Accelerate Icon.
	settings.icon = GlobalBlockIcon;

	// Add alignment support.
	settings.supports = settings.supports || {};
	settings.supports.align = true;

	return settings;
};

// Global Block post context.
// - Toolbar & controls.
// - Block insert validation.

// Other editor context.
// - Global Block
// - Global Block Child
//   - Block insert validation.
// - Standard Block
// - Variant(s) not within Global Block
//   - Prompt for which one?

// Variant context.
// - Variant Child
//   - Inspector Controls
//     - ABTest
//     - Personalized

// TODO - split this HoC based on above structure.
export const withAccelerateControls = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const {
			attributes,
			name: blockName,
			clientId,
			isSelected,
			setAttributes,
		} = props;

		const {
			ref = null,
		} = attributes;

		const [
			currentBlock,
			isGlobalBlockPost,
			isFirstBlock,
			hasChildBlocks,
			postId,
			postTitle,
			postBlockType,
			rootBlock,
		] = useSelect( select => {
			const { getCurrentPost, getEditedPostAttribute } = select( 'core/editor' );
			const { getBlock, getBlockIndex, getBlockRootClientId, getBlockCount } = select( 'core/block-editor' );
			const post = getCurrentPost();
			const rootClientId = getBlockRootClientId( clientId );
			const blockIndex = getBlockIndex( clientId );
			return [
				getBlock( clientId ),
				post.type === 'wp_block',
				blockIndex === 0 && rootClientId === '',
				getBlockCount( clientId ) > 0,
				post.id,
				getEditedPostAttribute( 'title' ),
				getEditedPostAttribute( 'blockType' ),
				getBlock( rootClientId ),
				rootClientId,
			];
		}, [ clientId ] );

		const [
			isThisOrChildSelected,
			parentGlobalBlock,
		] = useSelect( select => {
			const { getBlock, getSelectedBlock, getBlockRootClientId } = select( 'core/block-editor' );
			let block = isSelected ? getBlock( clientId ) : getSelectedBlock();
			while ( block && block?.name !== 'core/block' ) {
				block = getBlock( getBlockRootClientId( block.clientId ) );
			}
			return [
				block?.name === 'core/block' && block?.clientId === clientId,
				block?.name === 'core/block' ? block : null,
			];
		}, [ clientId, isSelected ] );

		const blockPost = useSelect( select => {
			if ( ! parentGlobalBlock ) {
				return null;
			}
			return select( 'core' ).getEditedEntityRecord( 'postType', 'wp_block', parentGlobalBlock?.attributes?.ref );
		}, [ parentGlobalBlock ] );

		const { clearSelectedBlock, selectBlock, replaceBlock } = useDispatch( 'core/block-editor' );

		// Get the block post, child blocks and variants.
		const block = useSelect( select => {
			if ( blockName !== 'core/block' || ! ref ) {
				return null;
			}
			return select( 'core' ).getEditedEntityRecord( 'postType', 'wp_block', ref );
		}, [ ref, blockName ] );
		const childBlocks = useSelect( select => {
			if ( ! isGlobalBlockPost && ( blockName !== 'core/block' || ! ref ) ) {
				return [];
			}
			return select( 'core/block-editor' ).getBlocks( isGlobalBlockPost ? '' : clientId );
		}, [ blockName, clientId, isGlobalBlockPost ] );
		const variants = childBlocks.filter( b => b.name === 'altis/variant' );

		const [
			parentVariant,
			parentVariantIndex,
		] = useSelect( select => {
			const { getBlock, getSelectedBlock, getBlockIndex, getBlockRootClientId } = select( 'core/block-editor' );
			let block = isSelected ? getBlock( clientId ) : getSelectedBlock();
			while ( block && block?.name !== 'altis/variant' ) {
				block = getBlock( getBlockRootClientId( block.clientId ) );
			}
			return [
				block?.name === 'altis/variant' ? block : null,
				block?.name === 'altis/variant' ? getBlockIndex( block.clientId ) : null,
			];
		}, [ clientId, isSelected ] );

		// Preferences.
		const selectedVariant = useSelect( select => {
			if ( ! blockPost?.id && ! block?.id && ! isGlobalBlockPost ) {
				return 0;
			}
			const id = blockPost?.id || block?.id || postId;
			return [
				select( 'core/preferences' ).get( 'altis/global-blocks', `${ id }:variant` ) || 0,
			];
		}, [ blockPost?.id, block?.id, isGlobalBlockPost, postId ] );

		// Inherit alignment from first child block / first variant child.
		useEffect( () => {
			if ( blockName !== 'core/block' || ! childBlocks.length > 0 || attributes.align ) {
				return;
			}
			if ( childBlocks[0].name === 'altis/variant' && childBlocks[0]?.innerBlocks[0]?.attributes?.align ) {
				setAttributes( { align: childBlocks[0].innerBlocks[0].attributes.align } );
			}
			if ( childBlocks[0].attributes.align ) {
				setAttributes( { align: childBlocks[0].attributes.align } );
			}
		}, [ attributes.align, blockName, childBlocks, setAttributes ] );

		// Add class name to hide / show elements in the current toolbar.
		useEffect( () => {
			if ( blockName !== 'core/block' ) {
				return;
			}
			if ( isSelected ) {
				document.body.classList.add( 'is-global-block-selected' );
			} else {
				document.body.classList.remove( 'is-global-block-selected' );
			}
		}, [ blockName, isSelected ] );

		// Make a reference for the controls dropdown so we can open it from other buttons / events.
		const dropdown = useRef( null );

		// Return early on direct global block edit page.
		if ( isGlobalBlockPost && ! parentGlobalBlock ) {
			const output = [
				<BlockEdit key="edit" { ...props } />,
			];
			if ( isFirstBlock ) {
				output.unshift(
					<div
						key="controls"
						className="wp-block altis-gb-controls"
						onClick={ event => {
							// Close the dropdown when clicking this container, but not
							// when clicking the dropdown contents.
							if (
								dropdown.current &&
								dropdown.current.classList.contains( 'is-opened' ) &&
								! event.target.closest( '.altis-gb-dropdown' )
							) {
								dropdown.current.click();
							}
						} }
					>
						<Toolbar>
							<ToolbarGroup style={ { borderRightWidth: '1px' } }>
								<ToolbarButton
									icon={ GlobalBlockIcon }
									onClick={ event => {
										event.stopImmediatePropagation();
										dropdown.current.click()
									} }
								/>
							</ToolbarGroup>
							<ToolbarGroup>
								<DropdownMenu
									focusOnMount={ false }
									icon={ MenuIcon }
									label={ __( 'Synced Pattern Controls', 'altis' ) }
									toggleProps={ {
										ref: dropdown,
										children: (
											<div className="altis-gb-label">
												<strong className="altis-gb-type">
													{ blockTypes[ postBlockType || 'standard' ] }
													{ ' ' }
													{ postBlockType !== 'standard' ? <small>{ sprintf( _n( '%d Variant', '%d Variants', variants.length, 'altis' ), variants.length ) }</small> : '' }
												</strong>
												{ ' ' }
												<span className="altis-gb-title">
													{ postTitle }
													{ postBlockType !== 'standard' && variants.length > 0 && (
														<>
															{ ' - ' }
															<Title
																index={ selectedVariant }
																type={ postBlockType }
																variant={ variants[ selectedVariant ]?.attributes || { fallback: true } }
															/>
														</>
													) }
												</span>
											</div>
										)
									} }
									onToggle={ willOpen => willOpen && clearSelectedBlock() }
								>
									{ ( { onClose } ) => (
										<Controls
											id={ postId }
										/>
									) }
								</DropdownMenu>
							</ToolbarGroup>
						</Toolbar>
					</div>
				);
			}
			if ( parentVariant && postBlockType !== 'standard' ) {
				output.push(
					<InspectorControls key="variant">
						<Panel>
							<PanelBody
								icon={ GlobalBlockIcon }
								title={ sprintf( __( '%s Block', 'altis' ), blockTypes[ postBlockType || 'standard' ] ) }
							>
								<p>
									{ __( 'Currently editing', 'altis' ) }:
									<br />
									<strong>
										<Title
											index={ parentVariantIndex }
											type={ postBlockType }
											variant={ parentVariant.attributes }
										/>
									</strong>
								</p>
							</PanelBody>
						</Panel>
					</InspectorControls>
				);
			}
			return output;
		}

		// Modifications for non Global Blocks.
		if ( blockName !== 'core/block' && parentGlobalBlock ) {
			return [
				<InspectorControls key="controls">
					{ isSelected && (
						<Panel>
							<PanelBody
								icon={ GlobalBlockIcon }
								title={ sprintf( __( '%s Block', 'altis' ), blockTypes[ parentGlobalBlock?.attributes?.blockType || 'standard' ] ) }
							>
								{ blockPost?.title && (
									<>
										<p>
											{ __( 'Currently editing', 'altis' ) }
											{ ' ' }
											<strong>{ blockPost?.title || __( 'Synced Pattern', 'altis' ) }</strong>
										</p>
										{ blockPost?.blockType !== 'standard' && (
											<p>
												{ __( 'Variant', 'altis' ) }:
												{ ' ' }
												<strong>
													<Title
														index={ parentVariantIndex }
														type={ blockPost?.blockType }
														variant={ parentVariant.attributes }
													/>
												</strong>
											</p>
										) }
									</>
								) }
								<Button
									isSecondary
									onClick={ () => selectBlock( parentGlobalBlock.clientId ) }
								>
									{ __( 'Select Global Block', 'altis' ) }
								</Button>
							</PanelBody>
						</Panel>
					) }
				</InspectorControls>,
				<BlockEdit key="edit" { ...props } />,
			];
		}

		// Deal with orphaned variants.
		if ( blockName === 'altis/variant' && ( ! rootBlock || rootBlock.name !== 'core/block' ) ) {
			// Convert to group block.
			replaceBlock( clientId, createBlock( 'core/group', {}, currentBlock?.innerBlocks || [] ) );
		}

		// Standard blocks.
		if ( blockName !== 'core/block' ) {
			return <BlockEdit key="edit" { ...props } />;
		}

		// Global block within other content.
		const title = block?.title || __( '(no title)', 'altis' );

		const classNames = Object.entries( {
			'global-block-wrapper': true,
			'wp-block wp-block-block': true,
			'is-selected': isThisOrChildSelected,
			'is-empty': ! hasChildBlocks,
			'alignnone': ! props.attributes.align || props.attributes.align === 'none',
			'alignwide': props.attributes.align === 'wide',
			'alignfull': props.attributes.align === 'full',
			'alignleft': props.attributes.align === 'left',
			'alignright': props.attributes.align === 'right',
			'aligncenter': props.attributes.align === 'center',
		} )
			.filter( ( [ , active ] ) => active )
			.map( ( [ className, ] ) => className )
			.join( ' ' );

		return [
			<BlockControls key="toolbar">
				<Toolbar>
					<ToolbarGroup>
						<DropdownMenu
							focusOnMount={ false }
							icon={ MenuIcon }
							label={ __( 'Synced Pattern Controls', 'altis' ) }
							toggleProps={ {
								ref: dropdown,
								children: (
									<div className="altis-gb-label">
										<strong className="altis-gb-type">
											{ blockTypes[ block?.blockType || 'standard' ] }
											{ ' ' }
											{ block?.blockType !== 'standard' ? <small>{ sprintf( _n( '%d Variant', '%d Variants', variants.length, 'altis' ), variants.length ) }</small> : '' }
										</strong>
										{ ' ' }
										<span className="altis-gb-title">
											{ title }
											{ block?.blockType !== 'standard' && variants.length > 0 && (
												<>
													{ ' - ' }
													<Title
														index={ selectedVariant }
														type={ block?.blockType || 'standard' }
														variant={ variants[ selectedVariant ]?.attributes || { fallback: true } }
													/>
												</>
											) }
										</span>
									</div>
								)
							} }
						>
							{ ( { onClose } ) => (
								<Controls
									clientId={ clientId } // This is set to scope block selection when GB is part of other content.
									id={ ref }
								/>
							) }
						</DropdownMenu>
					</ToolbarGroup>
				</Toolbar>
			</BlockControls>,
			<InspectorControls key="controls">
				<AdvancedControls
					block={ parentGlobalBlock }
					blockPost={ block }
					wrapper={ ( { children, title }, index ) => (
						<Panel key={ index }>
							<PanelBody initialOpen={ false } title={ title }>
								{ children }
							</PanelBody>
						</Panel>
					) }
				/>
			</InspectorControls>,
			<div key="global-block" className={ classNames } onClick={ () => selectBlock( clientId ) }>
				{ ( ! isThisOrChildSelected ) && (
					<div className="global-block-label">
						{ __( 'Synced Pattern', 'altis' ) }
						{ block?.blockType && block?.blockType !== 'standard' ? ` - ${ blockTypes[ block?.blockType ] }` : '' }
					</div>
				) }
				<div className="global-block-wrapper-inner">
					{ ! hasChildBlocks && (
						<Placeholder
							icon={ GlobalBlockIcon }
							label={ __( 'Edit this synced pattern to add content', 'altis' ) }
						/>
					) }
					<BlockEdit key="edit" { ...props } />
				</div>
			</div>
		];
	},
	'withAccelerateControls'
);

const PluginSidebar = () => {
	const post = useSelect( select => {
		return select( 'core/editor' ).getCurrentPost();
	} );

	if ( post.type !== 'wp_block' ) {
		return null;
	}

	return (
		<AdvancedControls
			blockPost={ post }
			wrapper={ ( { children, title }, index ) => (
				<PluginDocumentSettingPanel
					key={ index }
					className="altis-gb-document"
					name={ `altis-gb-document-${ index }` }
					title={ title }
				>
					{ children }
				</PluginDocumentSettingPanel>
			) }
		/>
	);
};

export const Plugin = {
	name: 'altis-global-block-panels',
	settings: {
		render: PluginSidebar,
		icon: GlobalBlockIcon,
	},
};
