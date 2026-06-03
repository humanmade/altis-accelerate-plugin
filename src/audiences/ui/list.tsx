import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, Modifier } from '@dnd-kit/core';
import type { PointerSensorOptions } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Fuse from 'fuse.js';
import { memoize } from 'lodash';
import type { PointerEvent } from 'react';
import React, { Component, Fragment } from 'react';

import { Notice } from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { trackEvent } from '../../utils/admin';
import { Post } from '../types';

import ListRow from './components/list-row';
import ListRowHeading from './components/list-row-heading';
import ListRowLoading from './components/list-row-loading';

import { SearchField } from '@/components/SearchField';
import { Button } from '@/components/ui/button';

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

// Added types
interface Pagination {
	readonly total: number;
	readonly pages: number;
}

interface GetPostsArgs {
	page?: number;
	search?: string;
	context?: string;
	status?: string;
}

interface ExternalProps {
	controls?: React.ComponentType | ( () => JSX.Element | null );
	onSelect?: ( post: Post ) => void;
	onEdit: ( post?: Post ) => void;
}

interface ListProps {
	canCreate: boolean;
	loading: boolean;
	pagination: Pagination;
	posts: Post[];
	onGetPosts: ( args: GetPostsArgs ) => Post[] | void;
	onUpdatePost: ( post: Partial<Post> & { id: number } ) => void;
}

interface ListState {
	page: number;
	search: string;
	error: Error | null;
}

const getSearchEngine = memoize(
	( posts: Post[] ) =>
		new Fuse<Post>( posts, {
			keys: [ 'title.rendered', 'audience.groups.rules.value' ],
			shouldSort: false,
		} ),
	( posts: Post[] ) => posts.map( post => post.id ).join( '-' )
);

// Wrapper component to use hooks with class component
function ListWithDnd( props: {
	filteredPosts: Post[];
	canCreate: boolean;
	onDragEnd: ( event: DragEndEvent ) => void;
	rowClick: ( post: Post ) => () => void;
	onEdit: ( post?: Post ) => void;
	onSelect?: ( post: Post ) => void;
} ) {
	const { filteredPosts, canCreate, onDragEnd, rowClick, onEdit, onSelect } = props;

	const sensors = useSensors(
		useSensor( PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		} )
	);

	return (
		<DndContext
			collisionDetection={ closestCenter }
			modifiers={ [ restrictToVerticalAxisWithTolerance ] }
			sensors={ sensors }
			onDragEnd={ onDragEnd }
		>
			<SortableContext
				items={ filteredPosts.map( p => p.id ) }
				strategy={ verticalListSortingStrategy }
			>
				{ filteredPosts.map( ( post, index ) => (
					<ListRow
						key={ post.id }
						index={ index }
						post={ post }
						sortable={ canCreate && filteredPosts.length > 1 }
						onClick={ rowClick( post ) }
						onEdit={ onEdit }
						onSelect={ onSelect }
					/>
				) ) }
			</SortableContext>
		</DndContext>
	);
}

/**
 * Audience list component.
 */
class List extends Component<ListProps & ExternalProps, ListState> {
	static defaultProps: Partial<ListProps & ExternalProps> = {
		canCreate: false,
		loading: false,
		pagination: {
			total: 0,
			pages: 0,
		},
		posts: [],
		onGetPosts: () => {},
		onUpdatePost: () => {},
	};

	state: ListState = {
		page: 1,
		search: '',
		error: null,
	};

	static getDerivedStateFromError( error: Error ): Partial<ListState> {
		return { error };
	}

	componentDidCatch( error: Error, errorInfo: React.ErrorInfo ) {
		console.error( error, errorInfo );
	}

	// Helper to adapt click handler to ListRow's expected no-arg signature.
	private rowClick = ( post: Post ) => () => this.onSelectRow( post );

	onSelectRow = ( post: Post ) => {
		if ( post.status !== 'publish' ) {
			return;
		}
		this.props.onSelect && this.props.onSelect( post );
	};

	onDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		if ( ! over || active.id === over.id ) {
			return;
		}

		const { posts } = this.props;
		const validPosts = posts.filter( post => ! post.error && post.status !== 'trash' );

		const oldIndex = validPosts.findIndex( p => p.id === active.id );
		const newIndex = validPosts.findIndex( p => p.id === over.id );

		if ( oldIndex === -1 || newIndex === -1 ) {
			return;
		}

		// Update the menu_order for affected posts
		const reorderedPosts = arrayMove( validPosts, oldIndex, newIndex );
		reorderedPosts.forEach( ( post, index ) => {
			if ( post.menu_order !== index ) {
				this.props.onUpdatePost( {
					id: post.id,
					menu_order: index,
				} );
			}
		} );
	};

	onNextPage = () => {
		const { page, search } = this.state;
		this.props.onGetPosts( {
			page: page + 1,
			search,
			context: this.props.canCreate ? 'edit' : 'view',
			status: this.props.canCreate ? 'publish,draft' : 'publish',
		} );
		this.setState( { page: page + 1 } );
	};

	render() {
		const { canCreate, controls = () => null, loading, pagination, posts, onEdit, onSelect } = this.props;
		const { error, search } = this.state;

		const validPosts = posts.filter( post => ! post.error && post.status !== 'trash' );
		const searchEngine = getSearchEngine( validPosts );
		const filteredPosts = search ? searchEngine.search( search ).map( result => result.item ) : validPosts;
		const isSelectMode = Boolean( filteredPosts.length > 0 && onSelect );
		const Controls = controls;

		return (
			<div className="tailwind">
				<div className="mx-2 md:mx-4 lg:mx-16">
					{ error && (
						<Notice isDismissible status="error" onRemove={ () => this.setState( { error: null } ) }>
							{ error.toString() }
						</Notice>
					) }
					<div className="flex flex-nowrap gap-5 my-5">
						<SearchField
							placeholder={ __( 'Search Audiences', 'altis' ) }
							onChange={ value => {
								trackEvent( 'audiences_search' );
								this.setState( {
									page: 1,
									search: value,
								} );
								if ( ! this.props.loading ) {
									this.props.onGetPosts( {
										page: 1,
										search: value,
										context: this.props.canCreate ? 'edit' : 'view',
										status: this.props.canCreate ? 'publish,draft' : 'publish',
									} );
								}
							} }
						/>
						<Controls />
					</div>

					{ /* Header */ }
					<ListRowHeading isSelectMode={ isSelectMode } />

					{ /* Body */ }
					{ ! loading && filteredPosts.length === 0 && (
						<div className="py-8 text-center border-b border-border">
							{ __( 'No audiences were found', 'altis' ) }
							{ search.length > 0 && ` ${ __( 'for that search term', 'altis' ) }` }
							{ '. ' }
							{ canCreate && (
								<button
									className="bg-transparent border-0 p-0 cursor-pointer text-foreground hover:underline"
									type="button"
									onClick={ () => onEdit() }
								>
									{ __( 'Create a new audience.' ) }
								</button>
							) }
						</div>
					) }

					{ filteredPosts.length > 0 && (
						<ListWithDnd
							canCreate={ canCreate }
							filteredPosts={ filteredPosts }
							rowClick={ this.rowClick }
							onDragEnd={ this.onDragEnd }
							onEdit={ onEdit }
							onSelect={ onSelect }
						/>
					) }

					{ ! loading && pagination.total > filteredPosts.length && (
						<div className="py-8 text-center border-b border-border">
							<Button variant="outline" onClick={ this.onNextPage }>
								{ __( 'Load more audiences', 'altis' ) }
							</Button>
						</div>
					) }

					{ loading && (
						<Fragment>
							<ListRowLoading />
							<ListRowLoading />
							<ListRowLoading />
						</Fragment>
					) }

					{ /* Footer */ }
					<ListRowHeading isSelectMode={ isSelectMode } />
				</div>
			</div>
		);
	}
}

// @ts-ignore – limited API typing for WP data HOCs here.
const applyWithSelect = withSelect( ( select: any ) => {
	const { getPosts, getIsLoading, getPagination } = select( 'audience' );
	const canCreate = select( 'core' ).canUser( 'create', 'audiences' );
	const loading = getIsLoading();
	const pagination = getPagination();
	const queryArgs = {
		context: canCreate ? 'edit' : 'view',
		status: canCreate ? 'publish,draft' : 'publish',
	};
	const posts = getPosts( queryArgs ) as Post[];
	return {
		canCreate,
		loading,
		pagination,
		posts,
		onGetPosts: getPosts,
	};
} );

// @ts-ignore – limited API typing for WP data HOCs here.
const applyWithDispatch = withDispatch( ( dispatch: any ) => {
	const { updatePost } = dispatch( 'audience' );
	return {
		onUpdatePost: updatePost,
	};
} );

export default compose( applyWithSelect, applyWithDispatch )( List ) as React.ComponentType<ExternalProps>;
