import React from 'react';

import { Button, Modal } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

import { Post } from '../../../utils/admin';

import Edit from './Edit';
import Upsert from './Upsert';

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
		<Modal
			className="altis-ui accelerate-broadcast-modal"
			title={ item === 'new' ? __( 'Create Broadcast', 'altis' ) : __( 'Edit Broadcast', 'altis' ) }
			onRequestClose={ onClose }
		>
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
					<div className="accelerate-modal__header">
						<h1>
							{ decodeEntities( item?.title || '' ) }
						</h1>
						<Button
							icon="edit"
							onClick={ () => setIsEditing( true ) }
						>
							<span className="screen-reader-text">{ __( 'Edit title', 'altis' ) }</span>
						</Button>
						<Button
							icon="trash"
							isDestructive
							onClick={ onDelete }
						>
							<span className="screen-reader-text">{ __( 'Delete Broadcast', 'altis' ) }</span>
						</Button>
					</div>
				) }
				{ item !== 'new' && item?.id ? (
					<Edit
						item={ item }
						listId={ listId }
					/>
				) : null }
			</div>
		</Modal>
	);
}
