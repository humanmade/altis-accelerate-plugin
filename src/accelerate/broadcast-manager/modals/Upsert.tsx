import React from 'react';

import { useDispatch, useSelect } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { Post, trackEvent } from '../../../utils/admin';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
			post = await updatePost( {
				id: item.id,
				title,
				type: 'broadcast',
			} );
			trackEvent( 'list_action', {
				list: listId,
				action: 'rename',
				type: 'broadcast',
			} );
		} else {
			post = await createPost( {
				title,
				type: 'broadcast',
				status: 'publish',
			} );
			trackEvent( 'list_action', {
				list: listId,
				action: 'create',
				type: 'broadcast',
			} );
		}

		onSuccess( post );
	};

	return (
		<form className="tailwind mb-6" onSubmit={ onSave }>
			<div className="space-y-2 mb-4">
				<Label htmlFor="broadcast-title">
					{ __( 'Choose a name for the Broadcast:', 'altis' ) }
				</Label>
				<Input
					/* eslint-disable-next-line jsx-a11y/no-autofocus */
					autoFocus
					className="border-gray-300"
					id="broadcast-title"
					readOnly={ isSaving }
					value={ title }
					onChange={ e => setTitle( e.target.value ) }
				/>
			</div>

			<div className="flex gap-2">
				<Button disabled={ isSaving || title === '' } onClick={ onSave }>
					{
						/* eslint-disable no-nested-ternary */
						item
							? isSaving ? __( 'Updating…', 'altis' ) : __( 'Update', 'altis' )
							: isSaving ? __( 'Creating…', 'altis' ) : __( 'Create', 'altis' )
					}
				</Button>
				<Button disabled={ isSaving } variant="outline" onClick={ onCancel }>
					{ __( 'Cancel', 'altis' ) }
				</Button>
			</div>
		</form>
	);
}
