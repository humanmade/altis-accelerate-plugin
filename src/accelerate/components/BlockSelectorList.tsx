import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, Modifier } from '@dnd-kit/core';
import type { PointerSensorOptions } from '@dnd-kit/core';
import { useSortable, arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import classNames from 'classnames';
import moment from 'moment';
import type { PointerEvent } from 'react';

import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

import { Post } from '../../utils/admin';

import Image from './Image';

import './BlockSelectorList.scss';

// Custom modifier: allow 10px horizontal tolerance while dragging vertically
const restrictToVerticalAxisWithTolerance: Modifier = ( { transform } ) => {
	const tolerance = 10;
	return {
		...transform,
		x: Math.max( -tolerance, Math.min( tolerance, transform.x ) ),
	};
};

// Check if element or its parents are interactive (buttons, inputs, etc.)
function isInteractiveElement( element: HTMLElement | null ): boolean {
	const interactiveTags = [ 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A' ];

	while ( element ) {
		if ( interactiveTags.includes( element.tagName ) ) {
			return true;
		}
		element = element.parentElement;
	}
	return false;
}

// Custom PointerSensor that ignores interactive elements
class SmartPointerSensor extends PointerSensor {
	static activators = [
		{
			eventName: 'onPointerDown' as const,
			handler: (
				{ nativeEvent: event }: PointerEvent,
				{ onActivation }: PointerSensorOptions
			) => {
				if ( ! event.isPrimary || event.button !== 0 ) {
					return false;
				}

				if ( ! ( event.target instanceof HTMLElement ) ) {
					return false;
				}

				// Don't activate drag on interactive elements
				if ( isInteractiveElement( event.target ) ) {
					return false;
				}

				onActivation?.( { event } );
				return true;
			},
		},
	];
}

type ListProps = {
	blocks: Post[];
	selected: number[];
	onChange: Function;
};

export default function BlockSelectorList( props: ListProps ) {
	const { blocks, onChange, selected } = props;

	const sensors = useSensors(
		useSensor( SmartPointerSensor )
	);

	function onDragEnd( event: any ) {
		const { active, over } = event;

		// We have to only account for sorted items that are actually selected.
		const _oldIndex = selected.indexOf( active.id );
		const _newIndex = selected.indexOf( over.id );
		const sorted = arrayMove( selected, _oldIndex, _newIndex );
		onChange( sorted );
	}

	// Split blocks into selected and available
	const selectedBlocks = blocks
		.filter( b => selected.includes( b.id ) )
		.sort( ( a, b ) => selected.indexOf( a.id ) - selected.indexOf( b.id ) );

	// Sort available blocks by recency (most recently modified first)
	const availableBlocks = blocks
		.filter( b => ! selected.includes( b.id ) )
		.sort( ( a, b ) => {
			const dateA = new Date( a.modified || a.date ).getTime();
			const dateB = new Date( b.modified || b.date ).getTime();
			return dateB - dateA;
		} );

	return (
		<div className="accelerate__block-list_wrapper">
			{ /* In Broadcast section */ }
			<div className="accelerate__block-list_section">
				<h4 className="accelerate__block-list_section--header">
					{ __( 'In Broadcast', 'altis' ) }
					{ selectedBlocks.length === 0 && (
						<span className="accelerate__block-list_section--empty-inline">
							{ __( '(No blocks selected)', 'altis' ) }
						</span>
					) }
				</h4>
				{ selectedBlocks.length > 0 && (
					<DndContext collisionDetection={ closestCenter } modifiers={ [ restrictToVerticalAxisWithTolerance ] } sensors={ sensors } onDragEnd={ onDragEnd }>
						<SortableContext items={ selectedBlocks } strategy={ verticalListSortingStrategy }>
							<ul>
								{ selectedBlocks.map( ( block: Post ) => (
									<BlockSelectorListItem
										key={ block.id }
										block={ block }
										selected
										onAdd={ ( id: number ) => onChange( [ ...selected, id ] ) }
										onRemove={ ( id: number ) => onChange( selected.filter( child => child !== id ) ) }
									/>
								) ) }
							</ul>
						</SortableContext>
					</DndContext>
				) }
			</div>

			{ /* Available Blocks section */ }
			<div className="accelerate__block-list_section accelerate__block-list_section--available">
				<h4 className="accelerate__block-list_section--header">
					{ __( 'Available Blocks', 'altis' ) }
				</h4>
				<ul>
					{ availableBlocks.length > 0 ? (
						availableBlocks.map( ( block: Post ) => (
							<BlockSelectorListItem
								key={ block.id }
								block={ block }
								selected={ false }
								onAdd={ ( id: number ) => onChange( [ ...selected, id ] ) }
								onRemove={ ( id: number ) => onChange( selected.filter( child => child !== id ) ) }
							/>
						) )
					) : (
						<li className="accelerate__block-list_empty">
							{ __( 'No blocks have been created.', 'altis' ) }{ ' ' }
							<a href="/wp-admin/edit.php?post_type=wp_block">
								{ __( 'Create your first block', 'altis' ) }
							</a>
						</li>
					) }
				</ul>
			</div>
		</div>
	);
}

type BlockItemProps = {
	block: Post;
	selected: boolean;
	onAdd: Function;
	onRemove: Function;
};

function BlockSelectorListItem( props: BlockItemProps ) {
	const { block, selected, onAdd, onRemove } = props;

	const { attributes, listeners, setNodeRef, transform, transition } = useSortable( {
		id: block.id,
		disabled: ! selected,
		transition: {
			duration: 150,
			easing: 'ease-out',
		},
	} );

	return (
		<li
			ref={ setNodeRef }
			className={ classNames( 'accelerate__block-list_item', { 'accelerate__block-list_item--sortable': selected } ) }
			style={ {
				transform: CSS.Transform.toString( transform ),
				transition,
			} }
			{ ...attributes }
			{ ...listeners }
		>
			<div className="accelerate__block-list_item--thumb">
				{ block.thumbnail && <Image alt={ block.title } height={ 47 } src={ block.thumbnail } width={ 105 } /> }
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
				{ selected ? (
					<button className="accelerate__block-list_item--remove" onClick={ () => onRemove( block.id ) }>
						{ __( 'Remove', 'altis' ) }
					</button>
				) : (
					<button className="accelerate__block-list_item--add" onClick={ () => onAdd( block.id ) }>
						{ __( 'Add', 'altis' ) }
					</button>
				) }
			</div>
		</li>
	);
}
