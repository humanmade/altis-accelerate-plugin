import Fuse from 'fuse.js';
import { memoize } from 'lodash';
import React, { Component, Fragment } from 'react';
import styled, { css } from 'styled-components';

import { Button, Notice } from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import Search from '../../components/Search';
import { trackEvent } from '../../utils/admin';
import { Post } from '../types';

import ListRow from './components/list-row';
import ListRowHeading from './components/list-row-heading';
import ListRowLoading from './components/list-row-loading';

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

// Timer type
let timer: ReturnType<typeof setTimeout> | undefined;

const getSearchEngine = memoize(
	( posts: Post[] ) =>
		new Fuse<Post>( posts, {
			keys: [ 'title.rendered', 'audience.groups.rules.value' ],
			shouldSort: false,
		} ),
	( posts: Post[] ) => posts.map( post => post.id ).join( '-' )
);

const selectModeCSS = css`
	tbody tr.audience-row--active:hover {
		cursor: pointer;
		background-color: rgba(70, 103, 222, 0.2);
	}
`;

// Styled component with prop typing
const AudienceList = styled.div<{ selectMode: boolean }>`
	.wp-list-table {
		border: 0;
	}
	.wp-list-table thead,
	.wp-list-table tfoot {
		border-left: 0;
		border-right: 0;
	}
	.audience-list__controls {
		display: flex;
		flex-wrap: nowrap;
		margin: 20px 5%;

		> * + * {
			margin-left: 20px;
		}
	}
	.audience-list__search-box {
		flex: 3 100%;
		width: 100%;
		margin-bottom: 5px;
		position: relative;
	}
	#audience-search-input {
		width: 100%;
		padding: 3px 10px;
		background: #eef0f4;
		border-color: transparent;
		border-radius: 10px;
		padding-left: 35px;
		height: 36px;

		&:focus {
			outline: 0;
			box-shadow: none;
			border-bottom: none;
		}

		&::placeholder {
			color: #7b7b7b;
		}
	}
	.dashicons-search {
		position: absolute;
		left: 0;
		margin: 8px 10px;
		color: #cbc9c9;
	}
	tbody tr {
		background: #f5f6f8;
	}
	tbody tr:first-child td {
		border-top: 0;
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	tbody td {
		border: 10px solid #fff;
		border-width: 10px 0;
	}
	th:first-child,
	td:first-child {
		padding-left: 5%;
	}
	th:last-child,
	td:last-child {
		padding-right: 5%;
	}
	.column-order {
		width: 12%;
	}
	.column-active {
		width: 14rem;
	}
	.column-select {
		width: 5rem;
	}
	.column-estimate {
		padding-right: 5%;
	}
	& .audience-estimate__percentage {
		max-width: 4rem;
	}

	.audience-row--no-results td,
	.audience-row--load-more td {
		padding: 30px;
		vertical-align: middle;
		text-align: center;
	}

	${ props => props.selectMode && selectModeCSS }
`;

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
		// eslint-disable-line @typescript-eslint/no-unused-vars
		console.error( error, errorInfo );
	}

	// Fetch posts on search.
	onSearch = ( event: React.ChangeEvent<HTMLInputElement> ) => {
		const value = event.target.value;
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
	};

	// Helper to adapt click handler to ListRow's expected no-arg signature.
	private rowClick = ( post: Post ) => ( event: React.MouseEvent<HTMLElement> ) => this.onSelectRow( event, post );

	onSelectRow = ( event: React.MouseEvent<HTMLElement>, post: Post ) => {
		if ( post.status !== 'publish' ) {
			return;
		}
		let el: HTMLElement | null = event.target as HTMLElement;
		let depth = 0;
		while ( el && depth++ < 4 ) {
			if ( [ 'A', 'INPUT', 'BUTTON' ].includes( el.nodeName ) ) {
				return;
			}
			el = el.parentElement;
		}
		event.stopPropagation();
		this.props.onSelect && this.props.onSelect( post );
	};

	onMove = ( posts: Post[], index: number, direction: 'up' | 'down' = 'up' ) => {
		const post = posts[index];
		if ( ! post ) return;
		const directionInt = direction === 'up' ? -1 : 1;
		this.props.onUpdatePost( {
			id: post.id,
			menu_order: post.menu_order + directionInt,
		} );
		const swap = posts[index + directionInt];
		if ( swap ) {
			this.props.onUpdatePost( {
				id: swap.id,
				menu_order: post.menu_order,
			} );
		}
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
			<AudienceList className="audience-listing" selectMode={ isSelectMode }>
				{ error && (
					<Notice isDismissible status="error" onRemove={ () => this.setState( { error: null } ) }>
						{ error.toString() }
					</Notice>
				) }
				<div className="audience-list__controls">
					<Search
						placeholder={ __( 'Search Audiences', 'altis' ) }
						onChange={ e => {
							timer && clearTimeout( timer );
							timer = setTimeout(
								event => {
									trackEvent( 'Audiences', 'Search' );
									this.onSearch( event as React.ChangeEvent<HTMLInputElement> );
								},
								500,
								e
							);
						} }
					/>
					<Controls />
				</div>
				<table className="wp-list-table widefat fixed posts">
					<thead>
						<ListRowHeading isSelectMode={ isSelectMode } />
					</thead>
					<tbody>
						{ ! loading && filteredPosts.length === 0 && (
							<tr className="audience-row audience-row--no-results">
								<td colSpan={ isSelectMode ? 5 : 4 }>
									{ __( 'No audiences were found', 'altis' ) }
									{ search.length > 0 && ` ${ __( 'for that search term', 'altis' ) }` }
									{ '. ' }
									{ canCreate && (
										<Button isLink onClick={ () => onEdit() }>
											{ __( 'Create a new audience.' ) }
										</Button>
									) }
								</td>
							</tr>
						) }
						{ filteredPosts.length > 0 &&
							filteredPosts.map( ( post, index ) => (
								<ListRow
									key={ post.id }
									canMoveDown={ Boolean( canCreate && filteredPosts[index + 1] ) }
									canMoveUp={ Boolean( canCreate && filteredPosts[index - 1] ) }
									index={ index }
									post={ post }
									onClick={ this.rowClick( post ) as unknown as () => void }
									onEdit={ onEdit }
									onMoveDown={ () => this.onMove( filteredPosts, index, 'down' ) }
									onMoveUp={ () => this.onMove( filteredPosts, index, 'up' ) }
									onSelect={ onSelect }
								/>
							) ) }
						{ ! loading && pagination.total > filteredPosts.length && (
							<tr className="audience-row audience-row--load-more">
								<td colSpan={ isSelectMode ? 5 : 4 }>
									<Button className="button" onClick={ this.onNextPage }>
										{ __( 'Load more audiences', 'altis' ) }
									</Button>
								</td>
							</tr>
						) }
						{ loading && (
							<Fragment>
								<ListRowLoading />
								<ListRowLoading />
								<ListRowLoading />
							</Fragment>
						) }
					</tbody>
					<tfoot>
						<ListRowHeading isSelectMode={ isSelectMode } />
					</tfoot>
				</table>
			</AudienceList>
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
