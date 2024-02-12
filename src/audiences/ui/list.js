import Fuse from 'fuse.js';
import { memoize } from 'lodash';
import React, { Component, Fragment } from 'react';
import styled, { css } from 'styled-components';

import ListRow from './components/list-row';
import ListRowHeading from './components/list-row-heading';
import ListRowLoading from './components/list-row-loading';
import Search from '../../components/Search';

import { trackEvent } from '../../utils/admin';

let timer;

const { compose } = wp.compose;
const {
	withSelect,
	withDispatch,
} = wp.data;
const { __ } = wp.i18n;
const {
	Button,
	Notice,
} = wp.components;

const getSearchEngine = memoize(
	posts => new Fuse( posts, {
		keys: [
			'title.rendered',
			'audience.groups.rules.value',
		],
		shouldSort: false,
	} ),
	posts => posts.map( post => post.id ).join( '-' )
);

const selectModeCSS = css`
	tbody tr.audience-row--active:hover {
		cursor: pointer;
		background-color: rgba(70, 103, 222, .2);
	}
`;

const AudienceList = styled.div`
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
class List extends Component {

	state = {
		page: 1,
		search: '',
		error: null,
	};

	static getDerivedStateFromError( error ) {
		return { error };
	}

	componentDidCatch( error, errorInfo ) {
		console.error( error, errorInfo );
	}

	/**
	 * Fetch posts on search.
	 *
	 * @param {Event} event Search typing event.
	 */
	onSearch = event => {
		const value = event.target.value;
		this.setState( {
			page: 1,
			search: value,
		} );
		// Query posts by the search term if we don't have an existing request.
		if ( ! this.props.loading ) {
			this.props.onGetPosts( {
				page: this.state.page,
				search: value,
				context: this.props.canCreate ? 'edit' : 'view',
				status: this.props.canCreate ? 'publish,draft' : 'publish',
			} );
		}
	}

	/**
	 * On audience selection.
	 *
	 * @param {Event} event Audience row click event.
	 * @param {Object} post Post object.
	 */
	onSelectRow = ( event, post ) => {
		// Check if it's an active audience.
		if ( post.status !== 'publish' ) {
			return;
		}

		// Check elements a few levels up to see if they're interactive.
		let el = event.target;
		let depth = 0;
		do {
			if ( [ 'A', 'INPUT', 'BUTTON' ].indexOf( el.nodeName ) >= 0 ) {
				return;
			}
			el = el.parentNode;
		} while ( depth++ < 4 );

		// Ignore events on other targets.
		event.stopPropagation();

		// Trigger on select behaviour if we're in select mode.
		this.props.onSelect && this.props.onSelect( post );
	}

	/**
	 * Updates the audience priority.
	 *
	 * @param {Array} posts All posts in the list.
	 * @param {number} index Current row index.
	 * @param {string} direction The direction to move the audience.
	 */
	onMove = ( posts, index, direction = 'up' ) => {
		const post = posts[ index ];
		const directionInt = direction === 'up' ? -1 : 1;

		// Swap the menu order of the audiences in the direction of prioritisation.
		this.props.onUpdatePost( {
			id: post.id,
			menu_order: post.menu_order + directionInt,
		} );
		this.props.onUpdatePost( {
			id: posts[ index + directionInt ].id,
			menu_order: post.menu_order,
		} );
	}

	/**
	 * Fetch the next page of results.
	 */
	onNextPage = () => {
		const { page, search } = this.state;
		this.props.onGetPosts( {
			page: page + 1,
			search,
			context: this.props.canCreate ? 'edit' : 'view',
			status: this.props.canCreate ? 'publish,draft' : 'publish',
		} );
		this.setState( { page: page + 1 } );
	}

	render() {
		const {
			canCreate,
			controls = () => null,
			loading,
			pagination,
			posts,
			onEdit,
			onSelect,
		} = this.props;

		const {
			error,
			search,
		} = this.state;

		// Remove any posts that are REST API errors or trashed.
		const validPosts = posts.filter( post => ! post.error && post.status !== 'trash' );

		// Filter posts using fuzzy matching on title and rule values.
		const searchEngine = getSearchEngine( validPosts );

		const filteredPosts = search
			? searchEngine.search( search ).map( result => result.item )
			: validPosts;

		// Whether to show the 5th column or not.
		const isSelectMode = filteredPosts && filteredPosts.length > 0 && onSelect;

		const Controls = controls;

		return (
			<AudienceList className="audience-listing" selectMode={ isSelectMode }>
				{ error && (
					<Notice
						isDismissable
						status="error"
						onRemove={ () => this.setState( { error: null } ) }
					>
						{ error.toString() }
					</Notice>
				) }
				<div className="audience-list__controls">
					<Search
						name="s"
						placeholder={ __( 'Search Audiences', 'altis' ) }
						type="search"
						onChange={ e => {
							timer && clearTimeout( timer );
							timer = setTimeout( event => {
								trackEvent( 'Audiences', 'Search' );
								this.onSearch( event );
							}, 500, e );
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
										<Button
											isLink
											onClick={ () => onEdit() }
										>
											{ __( 'Create a new audience.' ) }
										</Button>
									) }
								</td>
							</tr>
						) }
						{ filteredPosts.length > 0 && filteredPosts.map( ( post, index ) => {
							return (
								<ListRow
									key={ post.id }
									canMoveDown={ canCreate && filteredPosts[ index + 1 ] }
									canMoveUp={ canCreate && filteredPosts[ index - 1 ] }
									index={ index }
									post={ post }
									onClick={ event => this.onSelectRow( event, post ) }
									onEdit={ onEdit }
									onMoveDown={ () => this.onMove( filteredPosts, index, 'down' ) }
									onMoveUp={ () => this.onMove( filteredPosts, index, 'up' ) }
									onSelect={ onSelect }
								/>
							);
						} ) }
						{ ! loading && pagination.total > filteredPosts.length && (
							<tr className="audience-row audience-row--load-more">
								<td colSpan={ isSelectMode ? 5 : 4 }>
									<Button
										className="button"
										onClick={ this.onNextPage }
									>
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

List.defaultProps = {
	canCreate: false,
	loading: false,
	pagination: {
		total: 0,
		pages: 0,
	},
	posts: [],
	/**
	 *
	 */
	onGetPosts: () => { },
	/**
	 *
	 */
	onUpdatePost: () => { },
};

const applyWithSelect = withSelect( select => {
	const {
		getPosts,
		getIsLoading,
		getPagination,
	} = select( 'audience' );
	const canCreate = select( 'core' ).canUser( 'create', 'audiences' );
	const loading = getIsLoading();
	const pagination = getPagination();
	const queryArgs = {
		context: canCreate ? 'edit' : 'view',
		status: canCreate ? 'publish,draft' : 'publish',
	};
	const posts = getPosts( queryArgs );

	return {
		canCreate,
		loading,
		pagination,
		posts,
		onGetPosts: getPosts,
	};
} );

const applyWithDispatch = withDispatch( dispatch => {
	const { updatePost } = dispatch( 'audience' );

	return {
		onUpdatePost: updatePost,
	};
} );

export default compose(
	applyWithSelect,
	applyWithDispatch
)( List );
