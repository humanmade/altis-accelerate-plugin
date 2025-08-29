import { registerBlockType } from '@wordpress/blocks';
import { register, useSelect } from '@wordpress/data';
import { createPortal, useEffect, useState, useRef } from '@wordpress/element';
import { registerPlugin } from '@wordpress/plugins';

import { store } from '../data';

import * as GlobalBlock from './blocks/global';
import { Header } from './blocks/global/components/Header';
import * as StaticGlobalBlock from './blocks/static-global';
import * as Variant from './blocks/variant';

import './styles.scss';

// Set up redux store.
register( store );

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

// Enable Hot Module Replacement for React components
if ( module.hot ) {
	module.hot.accept();
}
