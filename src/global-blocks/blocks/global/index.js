import React, { useEffect, useRef, useState } from 'react';

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
	Icon,
	Panel,
	PanelBody,
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
	standard: __( 'Global', 'altis' ),
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
			lock = { edit: false, remove: false, move: false },
			ref = null,
		} = attributes;

		const [
			currentBlock,
			isGlobalBlockPost,
			isFirstBlock,
			postId,
			postTitle,
			postBlockType,
			rootBlock,
		] = useSelect( select => {
			const { getCurrentPost, getEditedPostAttribute } = select( 'core/editor' );
			const { getBlock, getBlockIndex, getBlockRootClientId } = select( 'core/block-editor' );
			const post = getCurrentPost();
			const rootClientId = getBlockRootClientId( clientId );
			const blockIndex = getBlockIndex( clientId );
			return [
				getBlock( clientId ),
				post.type === 'wp_block',
				blockIndex === 0 && rootClientId === '',
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

		const { selectBlock, replaceBlock } = useDispatch( 'core/block-editor' );

		const [ firstLoad, setFirstLoad ] = useState( true );
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

		// Set default lock on first load of page, allows moving and removing but not editing content.
		useEffect( () => {
			if ( blockName === 'core/block' && firstLoad ) {
				setFirstLoad( false );
			}
			if ( blockName === 'altis/variant' && firstLoad ) {
				setFirstLoad( false );
			}
		}, [ blockName, firstLoad, setAttributes, setFirstLoad ] );

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
					<div key="controls" className="wp-block">
						<Toolbar>
							<ToolbarGroup style={ { borderRightWidth: '1px' } }>
								<ToolbarButton
									icon={ GlobalBlockIcon }
									onClick={ () => dropdown.current.click() }
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
											<strong>{ blockPost?.title || __( 'Global Block', 'altis' ) }</strong>
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

		// Set variant default lock state.
		if ( firstLoad && blockName === 'altis/variant' && props.attributes ) {
			// Convert to group block.
			props.attributes.lock = { edit: false, remove: false, move: true, ...( props.attributes.lock || {} ) };
		}

		// Standard blocks.
		if ( blockName !== 'core/block' ) {
			return <BlockEdit key="edit" { ...props } />;
		}

		// Set default lock state without using store to avoid undo/redo states.
		if ( firstLoad && props.attributes ) {
			props.attributes.lock = { edit: true, remove: false, move: false };
		}

		// Global block within other content.
		const isLocked = lock?.edit || false;
		const label = isLocked ? __( 'Locked', 'altis' ) : __( 'Unlocked', 'altis' );
		const icon = isLocked ? 'lock' : 'unlock';
		const title = block?.title || __( '(no title)', 'altis' );

		const classNames = Object.entries( {
			'global-block-wrapper': true,
			'is-locked': isLocked,
			'is-selected': isThisOrChildSelected,
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
						<ToolbarButton
							icon={ icon }
							label={ label }
							onClick={ () => setAttributes( { lock: { ...lock, edit: ! isLocked } } ) }
						/>
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
			<div key="locked" className={ classNames }>
				{ ( isLocked || ! isThisOrChildSelected ) && (
					<div className="global-block-label">
						<Icon icon={ icon } />
						{ ' ' }
						{ __( 'Synced Pattern', 'altis' ) }
						{ block?.blockType && block?.blockType !== 'standard' ? ` - ${ blockTypes[ block?.blockType ] }` : '' }
						{ ' ' }
						<span className="screen-reader-text">{ label }</span>
					</div>
				) }
				<div className="global-block-wrapper-inner">
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
