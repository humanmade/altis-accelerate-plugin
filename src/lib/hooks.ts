import { useCallback, useEffect, useRef, useState } from 'react';

const FULLSCREEN_BODY_CLASS = 'accelerate-fullscreen';

/**
 * Wall-display mode. Toggling sets a body class that hides WP admin
 * chrome (admin bar, sidebar, footer, page header) and best-effort
 * triggers the browser Fullscreen API. Listens to fullscreenchange so
 * pressing Esc cleans the body class up. Strips the class on unmount
 * so a hot reload doesn't strand the rest of WP admin in fullscreen.
 */
export function useFullscreenMode(): [ boolean, () => void ] {
	const [ isFullscreen, setIsFullscreen ] = useState( false );

	const toggle = useCallback( () => {
		setIsFullscreen( prev => {
			const next = ! prev;
			// `requestFullscreen?.()` returns undefined when the API
			// is missing (e.g. some embedded browsers). Wrap in
			// Promise.resolve so the `.catch` below doesn't blow up.
			if ( next ) {
				Promise.resolve( document.documentElement.requestFullscreen?.() ).catch( () => {} );
			} else if ( document.fullscreenElement ) {
				Promise.resolve( document.exitFullscreen?.() ).catch( () => {} );
			}
			return next;
		} );
	}, [] );

	useEffect( () => {
		document.body.classList.toggle( FULLSCREEN_BODY_CLASS, isFullscreen );
		const onChange = () => {
			if ( ! document.fullscreenElement ) {
				setIsFullscreen( false );
			}
		};
		document.addEventListener( 'fullscreenchange', onChange );
		return () => {
			document.removeEventListener( 'fullscreenchange', onChange );
		};
	}, [ isFullscreen ] );

	useEffect( () => {
		return () => {
			document.body.classList.remove( FULLSCREEN_BODY_CLASS );
		};
	}, [] );

	return [ isFullscreen, toggle ];
}

/**
 * Custom hook to handle intervals.
 *
 * Uses a ref, see https://www.30secondsofcode.org/react/s/use-interval/
 */
export function useInterval( callback: () => void, delay: number | null ) {
	const savedCallback = useRef( callback );

	// Remember the latest callback if it changes.
	useEffect( () => {
		savedCallback.current = callback;
	}, [ callback ] );

	useEffect( () => {
		if ( delay === null ) {
			return;
		}

		const id = setInterval( () => {
			savedCallback.current();
		}, delay );

		return () => clearInterval( id );
	}, [ delay ] );
}
