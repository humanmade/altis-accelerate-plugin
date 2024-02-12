import React from "react";
import { Button, TextControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Post, trackEvent } from '../../../utils/admin';
import { useDispatch, useSelect } from '@wordpress/data';

type Props = {
	listId: string,
	item?: Post|null,
	onCancel(): void,
	onSuccess( post: Post ): void,
};

/**
 * Create a Broadcast modal component.
 *
 * @param {Object} props Props.
 *
 * @return {React.element} Modal component.
 */
export default function Upsert( props: Props ) {
	const {
		listId,
		item,
		onCancel,
		onSuccess,
	} = props;

	const { createPost, updatePost } = useDispatch( 'accelerate' );
	const isSaving: boolean = useSelect( select => select( 'accelerate' ).getIsUpdating<boolean>() );
	const [ title, setTitle ] = useState<string>( item ? item.title : '' );

	const onSave = async function ( e: React.FormEvent ) {
		e.preventDefault();
		let post: Post;

		if ( item ) {
			post = await updatePost( { id: item.id, title, type: 'broadcast' } );
			trackEvent( listId, 'Action', { action: 'rename', type: 'broadcast' } );
		} else {
			post = await createPost( { title, type: 'broadcast', status: 'publish' } );
			trackEvent( listId, 'Action', { action: 'create', type: 'broadcast' } );
		}

		onSuccess( post );
	};

	return (
		<form onSubmit={ onSave }>
			<TextControl
				/* eslint-disable-next-line jsx-a11y/no-autofocus */
				autoFocus
				className="accelerate-broadcast__edit-title"
				label={ __( 'Choose a name for the Broadcast:', 'altis' ) }
				readOnly={ isSaving }
				value={ title }
				onChange={ setTitle }
			/>

			<div className="accelerate-broadcast__edit-actions">
				<Button disabled={ isSaving || title === '' } isPrimary onClick={ onSave }>
					{
						/* eslint-disable no-nested-ternary */
						item
						? isSaving ? __( 'Updating…', 'altis' ) : __( 'Update', 'altis' )
						: isSaving ? __( 'Creating…', 'altis' ) : __( 'Create', 'altis' )
					}
				</Button>
				<Button disabled={ isSaving } isSecondary onClick={ onCancel }>
					{ __( 'Cancel', 'altis' ) }
				</Button>
			</div>
		</form>
	);
}
