import { useState, Dispatch, SetStateAction, useRef, useEffect, RefObject } from 'react';

import { useSelect, useDispatch } from '@wordpress/data';
import { store as CoreEditorStore } from '@wordpress/editor';
import { useCallback } from '@wordpress/element';

import { Post, PostUpdateObject } from '../utils/admin';

interface UsePostReturn {
	post: Post,
	onUpdatePost: ( post: PostUpdateObject ) => void,
	isUpdating: boolean,
}

/**
 * Use Post hook.
 *
 * @param {number} id Post ID.
 * @returns {UsePostReturn}
 */
export const usePost = ( id: number ) : UsePostReturn => {
	const post: Post = useSelect( select => select( 'accelerate' ).getPost( id ), [ id ] );

	const { updatePost } = useDispatch( 'accelerate' );
	const onUpdatePost = useCallback( ( post: PostUpdateObject ) => updatePost( post ), [ updatePost ] );

	const isUpdating = useSelect<boolean>( select => select( 'accelerate' ).getIsUpdating() );

	return {
		post,
		onUpdatePost,
		isUpdating,
	};
};

/**
 * useState but stores the value in localstorage by context key.
 *
 * @param {string} key The key to store the preference against.
 * @param {*} defaultValue The default state value.
 * @returns State value.
 */
export function usePersistentState<T>( key: string, defaultValue: T ) : [ T, Dispatch<SetStateAction<T>> ] {
	const stored = JSON.parse( window.localStorage.getItem( `altis-state-${ key }` ) as string ) as T;
	if ( stored ) {
		defaultValue = stored;
	}

	const [ pref, setPref ] = useState<T>( defaultValue );

	const setPersistentPref = ( value: T ) : void => {
		window.localStorage.setItem( `altis-state-${ key }`, JSON.stringify( value ) );
		setPref( value );
	};

	return [ pref, setPersistentPref ];
}

/**
 * Get the current post ID from the editor.
 *
 * @returns {number | undefined} The current post ID.
 */
export const useCurrentPostId = (): number | undefined => {
	return useSelect( select => {
		const editor = select( CoreEditorStore );
		return editor.getCurrentPostId();
	}, [] );
};

/**
 * Get the current post type from the editor.
 *
 * @returns {string | undefined} The current post type.
 */
export const useCurrentPostType = (): string | undefined => {
	return useSelect( select => {
		const editor = select( CoreEditorStore );
		return editor.getCurrentPostType();
	}, [] );
};

interface UseEditorPortalReturn {
	portalNode: RefObject<HTMLDivElement>;
	container: HTMLElement | null;
}

/**
 * Hook to create a portal node that inserts into the editor skeleton.
 * Handles waiting for the DOM element and cleanup on unmount.
 *
 * @param {string | undefined} postType - The current post type (used as dependency for re-mounting).
 * @returns {UseEditorPortalReturn} The portal node ref and container element.
 */
export const useEditorPortal = ( postType?: string ): UseEditorPortalReturn => {
	const [ container, setContainer ] = useState<HTMLElement | null>( null );
	const portalNode = useRef<HTMLDivElement>( document.createElement( 'div' ) );

	useEffect( () => {
		const node = portalNode.current;

		// Apply sticky positioning to the portal node itself
		node.style.position = 'sticky';
		node.style.top = '0';
		node.style.zIndex = '1000';

		const waitForTarget = () => {
			const el = document.querySelector( '.interface-interface-skeleton__content' );

			if ( el ) {
				// Look for notice lists to insert after
				const noticeLists = el.querySelectorAll( '.components-notice-list' );

				if ( noticeLists.length > 0 ) {
					const lastNoticeList = noticeLists[ noticeLists.length - 1 ];
					const nextElement = lastNoticeList.nextElementSibling;

					if ( nextElement ) {
						el.insertBefore( node, nextElement );
					} else {
						el.appendChild( node );
					}
				} else {
					el.insertBefore( node, el.firstChild );
				}
				setContainer( el as HTMLElement );
			} else {
				requestAnimationFrame( waitForTarget );
			}
		};

		waitForTarget();

		return () => {
			if ( node.parentNode ) {
				node.parentNode.removeChild( node );
			}
		};
	}, [ postType ] );

	return {
		portalNode,
		container,
	};
};

/**
 * Resolve the document that hosts the block canvas DOM.
 *
 * In recent WordPress the block editor renders inside
 * `iframe[name="editor-canvas"]`, so block DOM lives in a separate
 * document. This hook returns that document (or the top document when
 * the canvas is not iframed), re-resolving when the iframe mounts late,
 * is replaced, or reloads internally.
 *
 * @returns {Document | null} The canvas document, or null while loading.
 */
export const useCanvasDocument = (): Document | null => {
	const [ doc, setDoc ] = useState<Document | null>( null );
	const iframeRef = useRef<HTMLIFrameElement | null>( null );

	useEffect( () => {
		const resolve = () => {
			const iframe = document.querySelector( 'iframe[name="editor-canvas"]' ) as HTMLIFrameElement | null;
			const target = iframe ? iframe.contentDocument : document;

			// Move the load listener if the iframe element changed.
			if ( iframe !== iframeRef.current ) {
				if ( iframeRef.current ) {
					iframeRef.current.removeEventListener( 'load', resolve );
				}
				if ( iframe ) {
					iframe.addEventListener( 'load', resolve );
				}
				iframeRef.current = iframe;
			}

			// Readiness requires both the document and its body.
			if ( ! target || ! target.body ) {
				return;
			}

			setDoc( prev => prev === target ? prev : target );
		};

		resolve();

		const observer = new MutationObserver( resolve );
		observer.observe( document.body, {
			childList: true,
			subtree: true,
		} );

		return () => {
			observer.disconnect();
			if ( iframeRef.current ) {
				iframeRef.current.removeEventListener( 'load', resolve );
			}
		};
	}, [] );

	return doc;
};
