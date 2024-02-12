import React, { useEffect, useState } from 'react';
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { Pagination } from 'react-pagination-bar';

import { usePersistentState } from '../../data/hooks';
import { periods } from '../../data/periods';
import { Duration, InitialData, Post, State, StatsResult, CustomFilters, HistogramDiffs, PostType } from '../../utils/admin';

import ListItemPlaceholder from './ListItemPlaceholder';
import ListFilters from './ListFilters';
import ListItem from './ListItem';

import './List.scss';

let resultsTimer: ReturnType<typeof setTimeout> | undefined;

type Props = {
	listId: string,
	searchPlaceholder: string,
	postTypes: InitialData[ 'postTypes' ],
	postType?: PostType,
	currentUser: InitialData[ 'user' ],
	period: Duration,
	filters: string[],
	onAddNewItem?: Function,
	onManageItem?: Function,
	actions?: {
		[ k: string ]: Function
	},
	postId?: number | null,
	refresh?: number,
	onSetPeriod: React.Dispatch<React.SetStateAction<Duration>>,
	onSetPostId?: ( id: number | null ) => void,
};

export default function List( props: Props ) {
	const {
		listId,
		searchPlaceholder,
		currentUser,
		postType,
		postTypes,
		period,
		filters,
		onAddNewItem,
		onManageItem,
		actions,
		postId,
		refresh = 0,
		onSetPeriod,
		onSetPostId = () => {},
	} = props;

	// Filters.
	const [ customFilter, setCustomFilter ] = usePersistentState<string>( `${ listId }-filter`, filters[0] );
	const [ search, setSearch ] = useState<string>('');
	const [ type, setType ] = usePersistentState<string | null>( `${ listId }-type`, postType?.name || null );
	const [ user, setUser ] = usePersistentState<number | null>( `${ listId }-user`, null );
	const [ page, setPage ] = useState<number>( 1 );
	const [ showNoResults, setShowNoResults ] = useState<boolean>( false );

	// Handle selecting single item.
	useEffect( () => {
		if ( postId ) {
			setCustomFilter( 'selected' );
		}
	}, [ postId ] );

	const {
		posts,
		pagination,
		isLoading,
	} = useSelect( select => {
		return {
			posts: select( 'accelerate' ).getPosts( {
				period,
				search,
				type,
				user,
				page,
				include: postId ? [ postId ] : [],
				refresh,
			}, true ),
			pagination: select( 'accelerate' ).getPagination(),
			isLoading: select( 'accelerate' ).getIsLoading(),
		};
	}, [ search, page, type, user, period, postId, refresh ] );

	// Delay showing no results output.
	useEffect( () => {
		clearTimeout( resultsTimer );
		setShowNoResults( false );
		if ( ! isLoading ) {
			resultsTimer = setTimeout( () => {
				setShowNoResults( true );
			}, 1000 );
		}
	}, [ setShowNoResults, isLoading ] );

	const histogramDiffs: HistogramDiffs = useSelect( select => {
		const postIds = posts.map( ( p: Post ) => p.id );
		if ( postIds.length === 0 ) {
			return {};
		}
		return select( 'accelerate' ).getDiffs<State['diffs'][ Duration ]>( {
			ids: postIds,
			period,
		} );
	}, [ posts, period ] );

	const currentPeriod = periods.find( p => p.value === period ) || periods[0];
	const maxViewsPerUrl = useSelect<number>( select => {
		const stats: StatsResult = select( 'accelerate' ).getStats( {
			period: currentPeriod.value,
			interval: currentPeriod.intervals[0].interval,
		} );
		return Math.max( 0, ...Object.values( stats?.stats.by_url || {} ) );
	}, [ currentPeriod ] );

	const customFilters: CustomFilters = {
		selected: {
			label: __( 'Selected', 'altis' ),
			callback: () => {}
		},
		all: {
			label: __( 'All', 'altis' ),
			callback: () => {
				setType( postType?.name || null );
				setUser( null );
			}
		},
		blocks: {
			label: __( 'Blocks', 'altis' ),
			callback: () => {
				setType( 'wp_block' );
				setUser( null );
			}
		},
		mine: {
			label: __( 'My Content', 'altis' ),
			callback: () => {
				setType( postType?.name || null );
				setUser( currentUser.id || 1 );
			}
		}
	};

	const enabledCustomFilters: CustomFilters = filters.reduce( ( all, filter ) => {
		all[ filter ] = customFilters[ filter ];
		return all;
	}, {} as CustomFilters );

	function onSetCustomFilter ( filter: string ) {
		setShowNoResults( false );
		setPage( 1 );
		setCustomFilter( filter );
		onSetPostId( null );

		customFilters[ filter ].callback( filter );
	}

	const redirectAddNewItem = function( type: string ) {
		window.location.href = '/wp-admin/post-new.php?post_type=' + type;
	}

	return (
		<div className="List">
			<div className="table-wrap">
				<ListFilters
					listId={ listId }
					customFilters={ enabledCustomFilters }
					periods={ periods }
					postTypes={ postTypes }
					period={ period }
					onSetPeriod={ period => {
						setShowNoResults( false );
						setPage( 1 );
						onSetPostId( null );
						onSetPeriod( period );
					} }
					customFilter={ customFilter }
					onSetCustomFilter={ onSetCustomFilter }
					onSetSearch={ value => {
						setShowNoResults( false );
						setPage( 1 );
						onSetPostId( null );
						setSearch( value );
					} }
					searchPlaceholder={ searchPlaceholder }
					onAddNewItem={ onAddNewItem || redirectAddNewItem }
				/>
				<div className="table-content">
					<table aria-live="polite">
						<thead>
							<tr>
								{ postType?.name === 'broadcast' ? <th>&nbsp;</th> : null }
								<th className="table-header-thumbnail">&nbsp;</th>
								<th className="table-header-name">&nbsp;</th>
								<th className="table-header-traffic">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
									<path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
									</svg>
									<span>{ sprintf( __( '%s-Day Views', 'altis' ), period.replace( /\D+/g, '' ) ) }</span>
								</th>
								<th className="table-header-lift">{ __( 'Conversion %', 'altis' ) }</th>
								<th className="table-header-meta">{ __( 'Actions', 'altis' ) }</th>
							</tr>
						</thead>
						<tbody>
							{ posts.length > 0 && posts.map( post => (
								<ListItem
									key={ post.id }
									listId={ listId }
									item={ post }
									maxViewsPerUrl={ maxViewsPerUrl }
									histogramDiffs={ histogramDiffs }
									period={ period }
									onManage={ onManageItem }
									actions={ actions }
								/>
							) ) }
							{ isLoading || ( posts.length === 0 && ! showNoResults )
								? [ ...Array( 10 ) ].map( ( _, i ) => (
										<ListItemPlaceholder
											i={ i }
											isNestable={ postType?.name === 'broadcast' }
											key={ i }
										/>
									)
								)
								: posts.length === 0 && showNoResults && (
									<tr>
										<td className="record-empty" colSpan={ postType?.name === 'broadcast' ? 6 : 5 }>
											{ __( 'No content found...', 'altis' ) }
										</td>
									</tr>
								)
							}
						</tbody>
					</table>
					{ pagination.total > 0 && (
						<div className="table-footer">
							<div className="pagination">
								<Pagination
									initialPage={ 1 }
									itemsPerPage={ 25 }
									onPageСhange={ setPage }
									totalItems={ pagination.total }
									pageNeighbours={ 10 }
								/>
								<span className="current-page">{ sprintf( __( 'Page %d of %d ', 'altis' ), page, pagination.pages ) }</span>
							</div>
						</div>
					) }
				</div>
			</div>
		</div>
	)
}
