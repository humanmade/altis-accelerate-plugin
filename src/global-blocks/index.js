import { registerBlockType, registerBlockVariation } from '@wordpress/blocks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { register, useSelect } from '@wordpress/data';
import { createPortal, useEffect, useState, useRef } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';

import { store } from '../data';

import * as GlobalBlock from './blocks/global';
import { Header } from './blocks/global/components/Header';
import * as StaticGlobalBlock from './blocks/static-global';
import * as Variant from './blocks/variant';
import { AccelerateBlockIcon } from './utils/icons';

import './styles.scss';

// Set up redux store.
register( store );

// Accelerate icon SVG for replacing synced pattern icons
const accelerateIconSVG = `<svg viewBox="0 0 253 199" xmlns="http://www.w3.org/2000/svg" width="24" height="24" aria-hidden="true" focusable="false">
	<path d="M235.34 186.5 H29.1875 L184.158 23.95 Z M214.9 171.5 H64.2 L177.5 52.7 Z" fill="currentColor" fill-rule="evenodd"/>
</svg>`;

// Replace icons in the slash command inserter autocomplete for A/B test and personalization patterns.
// Uses MutationObserver to detect when autocomplete options appear and replaces icons based on blockType.
const setupInserterIconReplacement = () => {
	// Cache for blockType lookups to avoid repeated API calls
	const blockTypeCache = {};

	const getBlockType = refId => {
		if ( blockTypeCache[ refId ] !== undefined ) {
			return blockTypeCache[ refId ];
		}
		const wpBlocks = wp.data.select( 'core' ).getEntityRecords( 'postType', 'wp_block', { per_page: -1 } );
		if ( wpBlocks ) {
			const pattern = wpBlocks.find( b => b.id === refId );
			blockTypeCache[ refId ] = pattern?.blockType || 'standard';
		} else {
			blockTypeCache[ refId ] = 'standard';
		}
		return blockTypeCache[ refId ];
	};

	const replaceInserterIcons = () => {
		// Find autocomplete buttons for synced patterns (core/block)
		// Button IDs are like: components-autocomplete-item-X-block-core/block/REF_ID
		const buttons = document.querySelectorAll( '[id*="block-core/block/"]' );

		buttons.forEach( button => {
			// Skip if already processed
			if ( button.dataset.accelerateIcon ) {
				return;
			}

			// Extract the ref ID from the button ID
			const match = button.id.match( /block-core\/block\/(\d+)/ );
			if ( ! match ) {
				return;
			}

			const refId = parseInt( match[ 1 ], 10 );
			const blockType = getBlockType( refId );

			if ( blockType === 'abtest' || blockType === 'personalization' ) {
				// Find the icon element and replace it
				const iconSpan = button.querySelector( '.block-editor-block-icon' );
				if ( iconSpan ) {
					iconSpan.innerHTML = accelerateIconSVG;
					button.dataset.accelerateIcon = 'true';
				}
			}
		} );
	};

	// Observe for autocomplete popover appearing
	const observer = new MutationObserver( replaceInserterIcons );
	observer.observe( document.body, {
		childList: true,
		subtree: true,
	} );

	// Also run immediately in case elements already exist
	replaceInserterIcons();
};

// Initialize when DOM is ready
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', setupInserterIconReplacement );
} else {
	setupInserterIconReplacement();
}

// Register block variations for core/block (synced patterns) to show Accelerate icon
// when the pattern is an A/B test or personalization block.
registerBlockVariation( 'core/block', {
	name: 'accelerate-abtest',
	title: 'A/B Test Block',
	description: 'A synced pattern with A/B testing enabled.',
	icon: AccelerateBlockIcon,
	attributes: {
		blockType: 'abtest',
	},
	isActive: blockAttributes => blockAttributes.blockType === 'abtest',
} );

registerBlockVariation( 'core/block', {
	name: 'accelerate-personalization',
	title: 'Personalization Block',
	description: 'A synced pattern with personalization enabled.',
	icon: AccelerateBlockIcon,
	attributes: {
		blockType: 'personalization',
	},
	isActive: blockAttributes => blockAttributes.blockType === 'personalization',
} );

// HOC to sync blockType attribute from the referenced pattern to core/block instances.
// This enables the block variations above to show the correct icon.
const withBlockTypeSync = createHigherOrderComponent( BlockEdit => {
	return props => {
		const { name, attributes, setAttributes } = props;

		// Only apply to core/block (synced patterns)
		if ( name !== 'core/block' || ! attributes.ref ) {
			return <BlockEdit { ...props } />;
		}

		// Fetch the pattern's data to get its blockType using the same pattern as static-global
		// Note: The API returns subtype.name (e.g., "abtest", "personalization") not blockType
		const patternBlockType = useSelect(
			select => {
				const posts = select( 'accelerate' ).getPosts( {
					type: 'wp_block',
					include: attributes.ref,
				}, false );
				return posts[ 0 ]?.subtype?.name || 'standard';
			},
			[ attributes.ref ]
		);

		// Sync the blockType attribute when the pattern data loads
		useEffect( () => {
			if ( patternBlockType && patternBlockType !== attributes.blockType ) {
				setAttributes( { blockType: patternBlockType } );
			}
		}, [ patternBlockType, attributes.blockType, setAttributes ] );

		return <BlockEdit { ...props } />;
	};
}, 'withBlockTypeSync' );

addFilter(
	'editor.BlockEdit',
	'accelerate/sync-block-type',
	withBlockTypeSync
);

registerPlugin( GlobalBlock.Plugin.name, GlobalBlock.Plugin.settings );

registerPlugin( 'accelerate-synced-pattern-header', {
	render: () => {
		const postType = useSelect( select => select( 'core/editor' ).getCurrentPostType(), [] );

		const [ container, setContainer ] = useState( null );
		const portalNode = useRef( document.createElement( 'div' ) );

		useEffect( () => {
			const waitForTarget = () => {
				const el = document.querySelector( '.interface-interface-skeleton__content' );

				if ( el ) {
					// Look for the last notice list to insert after
					const noticeLists = el.querySelectorAll( '.components-notice-list' );

					if ( noticeLists.length > 0 ) {
						// Insert after the last notice list
						const lastNoticeList = noticeLists[noticeLists.length - 1];
						const nextElement = lastNoticeList.nextElementSibling;

						if ( nextElement ) {
							el.insertBefore( portalNode.current, nextElement );
						} else {
							el.appendChild( portalNode.current );
						}
					} else {
						// Fallback: insert at beginning if no notices found
						el.insertBefore( portalNode.current, el.firstChild );
					}
					setContainer( el );
				} else {
					// Try again on next frame
					requestAnimationFrame( waitForTarget );
				}
			};

			waitForTarget();
		}, [ postType ] );

		// Effect: Cleanup when unmounting (remove portal node from DOM)
		useEffect( () => {
			return () => {
				if ( portalNode.current.parentNode ) {
					// eslint-disable-next-line react-hooks/exhaustive-deps
					portalNode.current.parentNode.removeChild( portalNode.current );
				}
			};
		}, [] );

		if ( postType !== 'wp_block' ) return null;

		if ( ! container ) return null;

		return createPortal(
			<div
				className="tailwind"
				style={ {
					width: '100%',
				} }
			>
				<Header />
			</div>,
			portalNode.current
		);
	},
} );

registerBlockType( StaticGlobalBlock.name, StaticGlobalBlock.options );
registerBlockType( Variant.name, Variant.options );

// Plugin to replace document panel icon for A/B test and personalization patterns
registerPlugin( 'accelerate-document-icon', {
	render: () => {
		const postType = useSelect( select => select( 'core/editor' ).getCurrentPostType(), [] );
		const postId = useSelect( select => select( 'core/editor' ).getCurrentPostId(), [] );

		// Get blockType from the entity record
		const blockType = useSelect(
			select => {
				if ( postType !== 'wp_block' || ! postId ) {
					return null;
				}
				const record = select( 'core' ).getEditedEntityRecord( 'postType', 'wp_block', postId );
				return record?.blockType || 'standard';
			},
			[ postType, postId ]
		);

		useEffect( () => {
			if ( postType !== 'wp_block' ) {
				return;
			}

			// Only replace icon for A/B test or personalization patterns
			if ( blockType !== 'abtest' && blockType !== 'personalization' ) {
				return;
			}

			const replaceIcon = () => {
				const iconContainer = document.querySelector( '.editor-post-card-panel__icon' );
				if ( iconContainer && ! iconContainer.dataset.accelerateIcon ) {
					// Mark as replaced to avoid repeated replacements
					iconContainer.dataset.accelerateIcon = 'true';
					// Replace with Accelerate outlined triangle icon (uses currentColor to match WordPress style)
					iconContainer.innerHTML = `<svg viewBox="0 0 253 199" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
						<path d="M235.34 186.5 H29.1875 L184.158 23.95 Z M214.9 171.5 H64.2 L177.5 52.7 Z" fill="currentColor" fill-rule="evenodd"/>
					</svg>`;
				}
			};

			// Try immediately and also observe for DOM changes
			replaceIcon();

			const observer = new MutationObserver( replaceIcon );
			observer.observe( document.body, {
				childList: true,
				subtree: true,
			} );

			return () => observer.disconnect();
		}, [ postType, blockType ] );

		return null;
	},
} );

// Enable Hot Module Replacement for React components
if ( module.hot ) {
	module.hot.accept();
}
