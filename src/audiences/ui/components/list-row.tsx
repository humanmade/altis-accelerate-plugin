import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import React from 'react';

import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

import {
	useCanDelete,
	useCanEdit,
	useDeletePost,
	useUpdatePost,
} from '../../data/hooks';
import { Post } from '../../types';

import ActionLink from './action-link';
import Estimate from './estimate';
import StatusToggle from './status-toggle';

import { Button } from '@/components/ui/button';

interface Props {
	/**
	 * Post object.
	 */
	post: Post;
	/**
	 * Index of the post in the list.
	 */
	index: number;
	/**
	 * Whether sorting is enabled for this row.
	 */
	sortable?: boolean;
	/**
	 * Click handler.
	 */
	onClick?: () => void;
	/**
	 * Edit handler.
	 */
	onEdit: () => void;
	/**
	 * Select handler. If present, a select button will be shown.
	 */
	onSelect?: ( post: Post ) => void;
}

/**
 * Audience list row component.
 *
 * @param {Object} props Component props.
 * @returns {React.ReactNode} List row component.
 */
const ListRow = ( props: Props ) => {
	const {
		index,
		post,
		sortable = false,
		onClick,
		onEdit,
		onSelect,
	} = props;

	const isSelectMode = !! onSelect;
	const isPublished = post.status === 'publish';
	const canEdit = useCanEdit( post.id );
	const canDelete = useCanDelete( post.id );
	const deletePost = useDeletePost();
	const updatePost = useUpdatePost();

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( {
		id: post.id,
		disabled: ! sortable,
		transition: {
			duration: 150,
			easing: 'ease-out',
		},
	} );

	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	/**
	 * Delete post handler.
	 */
	const onDeletePost = () => {
		// eslint-disable-next-line no-alert
		if ( window.confirm( __( 'Are you sure you want to delete this audience?', 'altis' ) ) ) {
			deletePost( post.id );
		}
	};

	/**
	 * Audience status change handler.
	 *
	 * @returns {void}
	 */
	const onStatusChange = () => updatePost( {
		id: post.id,
		status: post.status === 'publish' ? 'draft' : 'publish',
	} );

	const postTitle = decodeEntities( post.title.rendered || __( '(no title)', 'altis' ) );

	return (
		<div
			ref={ setNodeRef }
			className={ `flex items-center py-4 border-b border-border bg-background hover:bg-muted/50 ${ isPublished ? '' : 'opacity-60' } ${ sortable ? 'cursor-grab active:cursor-grabbing select-none touch-none' : '' }` }
			style={ style }
			onClick={ onClick }
			{ ...attributes }
			{ ...listeners }
		>
			<div className="w-12 shrink-0 flex items-center justify-center">
				{ sortable && (
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				) }
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex flex-col gap-1">
					{ ! canEdit && (
						<span className="!text-sm !font-semibold">{ postTitle }</span>
					) }
					{ canEdit && (
						<ActionLink
							className="!text-sm !font-semibold"
							label={ __( 'Edit "%s"' ) }
							post={ post }
							onClick={ onEdit }
						>
							{ postTitle }
						</ActionLink>
					) }
					<div className="flex items-center gap-1 text-sm">
						{ canEdit && (
							<ActionLink
								label={ __( 'Edit "%s"' ) }
								post={ post }
								onClick={ onEdit }
							>
								{ __( 'Edit' ) }
							</ActionLink>
						) }
						{ canDelete && (
							<>
								<span className="text-muted-foreground">|</span>
								<ActionLink
									className="text-destructive hover:text-destructive"
									label={ __( 'Move "%s" to the Trash' ) }
									post={ post }
									onClick={ onDeletePost }
								>
									{ __( 'Trash' ) }
								</ActionLink>
							</>
						) }
					</div>
				</div>
			</div>
			<div className="w-48 shrink-0">
				{ canEdit && (
					<StatusToggle
						status={ post.status }
						onChange={ onStatusChange }
					/>
				) }
				{ ! canEdit && (
					<span>{ post.status === 'publish' ? __( 'Active', 'altis' ) : __( 'Inactive', 'altis' ) }</span>
				) }
			</div>
			<div className="w-32 shrink-0 self-start">
				<Estimate estimate={ post.estimate } showTotals={ false } />
			</div>
			{ isSelectMode && (
				<div className="w-24 shrink-0">
					{ isPublished && (
						<Button
							size="sm"
							variant="outline"
							onClick={ () => onSelect( post ) }
						>
							{ __( 'Select', 'altis' ) }
						</Button>
					) }
				</div>
			) }
		</div>
	);
};

ListRow.defaultProps = {
	/**
	 * Default click handler.
	 */
	onClick: () => {},
};

export default ListRow;
