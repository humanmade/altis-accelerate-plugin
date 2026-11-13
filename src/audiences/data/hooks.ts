import { useDispatch, useSelect } from '@wordpress/data';

// Compatibility, until we upgrade to latest Gutenberg.
type selectCore = {
	canUser( action: string, type: string, id?: number ): boolean,
}

/**
 * Hook to check if the provided post ID can be edited.
 *
 * @param {number} id An audience post ID.
 * @returns {boolean} True if user can edit audience.
 */
export const useCanEdit = ( id: number ): boolean => useSelect( select => ( select( 'core' ) as selectCore ).canUser( 'update', 'audiences', id ), [ id ] );

/**
 * Hook to check if audiences can be created.
 *
 * @returns {boolean} True if user can create audiences.
 */
export const useCanCreate = (): boolean => useSelect( select => ( select( 'core' ) as selectCore ).canUser( 'create', 'audiences' ), [] );

/**
 * Hook to check if the provided post ID can be deleted.
 *
 * @param {number} id An audience post ID.
 * @returns {boolean} True if user can delete audience.
 */
export const useCanDelete = ( id: number ): boolean => useSelect( select => ( select( 'core' ) as selectCore ).canUser( 'delete', 'audiences', id ), [ id ] );

/**
 * Returns a function to updates an audience post.
 *
 * @returns {Function} Update post function.
 */
export const useUpdatePost = (): Function => useDispatch( 'audience' ).updatePost;

/**
 * Returns a function to delete an audience post.
 *
 * @returns {Function} Delete post function.
 */
export const useDeletePost = (): Function => useDispatch( 'audience' ).deletePost;
