import { useEffect, useRef } from 'react';

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
