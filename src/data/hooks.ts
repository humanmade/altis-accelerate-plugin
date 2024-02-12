import { useState, Dispatch, SetStateAction } from 'react';
import { useCallback } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
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
	const post: Post = useSelect( ( select ) => select( 'accelerate' ).getPost( id ), [ id ] );

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
};
