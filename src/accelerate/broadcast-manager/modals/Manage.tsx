import { Pencil, Trash2 } from 'lucide-react';
import React from 'react';

import { useDispatch } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

import { Post } from '../../../utils/admin';

import Edit from './Edit';
import Upsert from './Upsert';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

import './Manage.scss';

type Props = {
	listId: string,
	item: Post | null | 'new',
	onClose(): void,
	onSuccess( post: Post ): void,
};

/**
 * Create a Broadcast modal component.
 *
 * @param {Object} props Props.
 *
 * @return {React.element} Modal component.
 */
export default function ManageModal( props: Props ) {
	const {
		listId,
		item,
		onClose,
		onSuccess,
	} = props;

	const [ isEditing, setIsEditing ] = useState<boolean>( false );
	const { deletePost } = useDispatch( 'accelerate' );

	const onDelete = () => {
		/* eslint-disable no-alert */
		if ( ! window.confirm( __( 'Are you sure you want to delete this broadcast?', 'altis' ) ) ) {
			return;
		}

		if ( item !== 'new' && item?.id ) {
			deletePost( item.id );
			onClose();
		}
	};

	return (
		<Dialog open onOpenChange={ open => ! open && onClose() }>
			<DialogContent className="sm:max-w-[600px] altis-ui accelerate-broadcast-modal">
				<DialogHeader>
					<DialogTitle>
						{ item === 'new' ? __( 'Create Broadcast', 'altis' ) : __( 'Edit Broadcast', 'altis' ) }
					</DialogTitle>
				</DialogHeader>
				<div className="accelerate-broadcast-modal__inner">
					{ item === 'new' || isEditing ? (
						<Upsert
							item={ item !== 'new' ? item : null }
							listId={ listId }
							onCancel={ () => {
								setIsEditing( false );
								item === 'new' && onClose();
							} }
							onSuccess={ post => {
								setIsEditing( false );
								onSuccess( post );
							} }
						/>
					) : (
						<div className="accelerate-modal__header flex items-center gap-2">
							<h1 className="flex-1 text-xl font-semibold m-0">
								{ decodeEntities( item?.title || '' ) }
							</h1>
							<Button
								size="icon"
								title={ __( 'Edit title', 'altis' ) }
								variant="ghost"
								onClick={ () => setIsEditing( true ) }
							>
								<Pencil className="h-4 w-4" />
							</Button>
							<Button
								className="text-destructive hover:text-destructive hover:bg-destructive/10"
								size="icon"
								title={ __( 'Delete Broadcast', 'altis' ) }
								variant="ghost"
								onClick={ onDelete }
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					) }
					{ item !== 'new' && item?.id ? (
						<Edit
							key={ `edit-${ item.id }-${ item.blocks?.length || 0 }` }
							item={ item }
							listId={ listId }
						/>
					) : null }
				</div>
			</DialogContent>
		</Dialog>
	);
}
