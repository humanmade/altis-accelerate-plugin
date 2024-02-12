import moment from 'moment';
import { __ } from '@wordpress/i18n';
import { Post } from "../../utils/admin";
import Image from "./Image";
import classNames from 'classnames';
import './BlockSelectorList.scss';

import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import {
	useSortable,
	arrayMove,
	SortableContext,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { decodeEntities } from '@wordpress/html-entities';

type ListProps = {
	blocks: Post[],
	selected: number[],
	onChange: Function,
}

export default function BlockSelectorList ( props: ListProps ) {
	const {
		blocks,
		onChange,
		selected,
	} = props;

	const sensors = useSensors(
		useSensor( PointerSensor, {
			// Require the mouse to move by 10 pixels before activating
			activationConstraint: {
				distance: 10,
			},
		} ),
	);

	function onDragEnd ( event: any ) {
		const { active, over } = event;

		// We have to only account for sorted items that are actually selected.
		const _oldIndex = selected.indexOf( active.id );
		const _newIndex = selected.indexOf( over.id );
		const sorted = arrayMove( selected, _oldIndex, _newIndex );
		onChange( sorted );
	}


	// Sort selected blocks according to selection.
	blocks.sort( ( a, b ) => selected.indexOf( a.id ) - selected.indexOf( b.id ) );
	// Sort other blocks AFTER selected one.
	blocks.sort( ( a, b ) => ( selected.includes( a.id ) ? 0 : 1 ) - ( selected.includes( b.id ) ? 0 : 1 ) );

	return (
		<div className="accelerate__block-list_wrapper">
			<DndContext
				collisionDetection={ closestCenter }
				sensors={ sensors }
				onDragEnd={ onDragEnd }
			>
				<SortableContext
					items={ blocks }
					strategy={ verticalListSortingStrategy }
				>
					<ul>
						{ blocks.map( ( block: Post ) => (
							<BlockSelectorListItem
								key={ block.id }
								block={ block }
								selected={ Array.from( selected ).includes( block.id ) }
								onAdd={ ( id: number ) => onChange( [ ...selected, id ] ) }
								onRemove={ ( id: number ) => onChange( selected.filter( child => child !== id ) ) }
							/>
						) ) }
					</ul>
				</SortableContext>
			</DndContext>
		</div>
	)
}

type BlockItemProps = {
	block: Post,
	selected: boolean,
	onAdd: Function,
	onRemove: Function,
}

function BlockSelectorListItem ( props: BlockItemProps ) {
	const {
		block,
		selected,
		onAdd,
		onRemove
	} = props;

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable( {
		id: block.id,
		disabled: ! selected
	} );

	return (
		<li
			ref={ setNodeRef }
			className={ classNames(
				'accelerate__block-list_item',
				{ 'accelerate__block-list_item--sortable': selected }
			) }
			style={ {
				transform: CSS.Transform.toString( transform ),
				transition,
			} }
			{ ...attributes }
			{ ...listeners }
		>
			{/* { selected && ( <Icon icon="move" /> ) || ( <Icon icon='' /> ) } */}
			<div className="accelerate__block-list_item--thumb">
				{ block.thumbnail && (
					<Image
						alt={ block.title }
						height={ 47 }
						src={ block.thumbnail }
						width={ 105 }
					/>
				) }
			</div>
			<div className="accelerate__block-list_item--details">
				<div className="accelerate__block-list_item--title" title={ block.title }>
					{ decodeEntities( block.title ) }
					<div className="accelerate__block-list_item--date" title={ block.date }>
						{ moment.utc( block.date ).fromNow() }
					</div>
				</div>
			</div>
			<div className="accelerate__block-list_item--actions">
				{
					selected
					? (
						<button
							className="accelerate__block-list_item--remove"
							onClick={ () => onRemove( block.id ) }
						>
							{ __( 'Remove', 'altis' ) }
						</button>
					) : (
						<button
							className="accelerate__block-list_item--add"
							onClick={ () => onAdd( block.id ) }
						>
							{ __( 'Add', 'altis' ) }
						</button>
					)
				}
			</div>
		</li>
	);
}
