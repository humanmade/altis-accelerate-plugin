
/* eslint-disable no-nested-ternary */

import classNames from 'classnames';
import { ChevronRight } from 'lucide-react';
import moment from 'moment';
import React, { useState } from 'react';

import { useSelect } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';

import { Duration, Post, HistogramDiffs, compactMetric, getConversionRateLift, trackEvent } from '../../utils/admin';

import ImageGroup from './ImageGroup';
import SparkChart from './SparkChart';
import StandaloneBlockPreview from './StandaloneBlockPreview';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const ListItem = function ( props: {
	listId: string,
	item: Post,
	maxViewsPerUrl?: number,
	histogramDiffs?: HistogramDiffs,
	period?: Duration,
	onManage?: Function,
	isNested?: boolean,
	actions?: {
		[ k: string ]: Function
	},
} ) {
	const {
		listId,
		item: post,
		maxViewsPerUrl,
		histogramDiffs = {},
		period,
		onManage,
		isNested,
		actions,
	} = props;

	const [ isExpanded, setIsExpanded ] = useState<boolean>( false );
	const [ canFetch, setCanFetch ] = useState<boolean>( false );

	let lift: number | null = null;
	let change: number | null = null;

	if ( post.lift ) {
		lift = getConversionRateLift( post.lift.fallback, post.lift.personalized );
	}

	if ( histogramDiffs[ post.id ] && histogramDiffs[ post.id ].previous.views > 0 ) {
		change = ( ( histogramDiffs[ post.id ].current.views - histogramDiffs[ post.id ].previous.views ) / histogramDiffs[ post.id ].previous.views ) * 100;
	}

	const isNestable = post.type.name === 'broadcast';
	const nested = useSelect( select => {
		if ( ! canFetch || ! post.blocks?.length ) {
			return [];
		}
		return select( 'accelerate' ).getPosts( {
			type: 'wp_block',
			include: post.blocks,
		}, false );
	}, [ post.blocks, canFetch ] );

	const onEdit = ( e: React.MouseEvent ) => {
		trackEvent( listId, 'Action', {
			action: 'edit',
			type: post.type,
		} );

		if ( onManage ) {
			e.preventDefault();
			onManage( post );
		}
	};

	return (
		<>
			<tr key={ post.id } className={ classNames( {
				'record-item': true,
				'record-item--nestable': isNestable,
				'record-item--nested': isNested,
				'record-item--empty': isNestable && post.blocks.length === 0,
			} ) }>
				{ isNestable && (
					<td className='record-expand'>
						<div className="tailwind">
							<Button
								className="h-8 w-8"
								size="icon"
								title={ isExpanded ? __( 'Collapse', 'altis' ) : __( 'Expand', 'altis' ) }
								variant="ghost"
								onClick={ () => {
									if ( isExpanded ) {
										setIsExpanded( false );
									} else {
										setCanFetch( true );
										setIsExpanded( true );
									}
								} }
							>
								<ChevronRight className={ `h-4 w-4 transition-transform duration-200 ${ isExpanded ? 'rotate-90' : '' }` } />
							</Button>
						</div>
					</td>
				) }
				{ isNested && (
					<td className='record-expand record-expand--nested'></td>
				) }
				<td className='record-thumbnail'>
					<div className='record-thumbnail-wrap'>
						{
							isNestable
								? ( post.blocks.length > 0 )
									? (
										<ImageGroup
											blocks={ post.blocks }
											height={ 47 }
											width={ 105 }
										/>
									) : (
										<div
											className='record-thumbnail__empty'
										>
										</div>
									)
								: post.rawContent
									? (
										post.variants > 1
											? (
												<div className="record-thumbnail-group-wrap record-thumbnail-group-wrap--multiple">
													{ post.variants > 2 && ( <span className="record-thumbnail-extra-variant-count">+{ post.variants - 2 }</span> ) }
													{ /* Back card - variant B */ }
													<StandaloneBlockPreview
														className="stacked-preview stacked-preview--back"
														content={ post.rawContent }
														height={ 47 }
														variantIndex={ 1 }
														width={ 105 }
													/>
													{ /* Front card - variant A */ }
													<StandaloneBlockPreview
														className="stacked-preview stacked-preview--front"
														content={ post.rawContent }
														height={ 47 }
														variantIndex={ 0 }
														width={ 105 }
													/>
												</div>
											) : (
												<StandaloneBlockPreview
													content={ post.rawContent }
													height={ 47 }
													width={ 105 }
												/>
											)
									) : post.editUrl && (
										<div
											className='record-thumbnail__empty'
										>
										</div>
									)
						}
					</div>
				</td>
				<td className="record-name">
					<div className="record-cell-col">
						<div className='record-name__title record-cell-text-pri'>
							<a href={ post.editUrl || '' } onClick={ ( e: React.MouseEvent ) => {
								if ( onManage ) {
									onEdit( e );
								} else if ( post.editUrl ) {
									trackEvent( listId, 'Navigate', { type: post.type } );
								}
							} }>
								{ decodeEntities( post.title ) }
							</a>
						</div>
						<div className='record-name__meta record-cell-text-sec'>
							<div className='record-name__type'>
								{ decodeEntities( post.subtype?.label || post.type.label ) }
							</div>
							{ post.parent && (
								<div className='record-name__parent'>
									<a href={ post.parent.editUrl }>{ post.parent.title }</a>
								</div>
							) }
							<div className='record-name__date' title={ post.date }>
								{ moment.utc( post.date ).fromNow() }
							</div>
						</div>
					</div>
				</td>
				<td className="record-traffic">
					{ ! isNested ? (
						<div className='record-cell-row'>
							<SparkChart
								histogram={ histogramDiffs[ post.id ]?.current.by_date || [] }
								maxViews={ maxViewsPerUrl }
								period={ period }
							/>
							<div className="record-traffic__numbers record-cell-col">
								<div className='record-cell-text-pri'>{ new Intl.NumberFormat().format( histogramDiffs[ post.id ]?.current?.views || post.views ) }</div>
								<div className='record-cell-text-sec'>
									<span
										className={ `record-traffic__change score-${ change && change >= 0 ? 'pos' : 'neg' }` }
										title={ __( 'Comparison to previous period', 'altis' ) }
									>
										{ !! change && ! isNaN( change ) && ( change > 0 ? '↑' : '↓' ) }
										&nbsp;
										{ !! change && ! isNaN( change ) && compactMetric( parseFloat( Math.abs( change ).toFixed( 1 ) ), '%' ) }
									</span>
								</div>
							</div>
						</div>
					) : <>&nbsp;</> }
				</td>
				<td className="record-lift">
					<GlobalBlockConvertionRate post={ post } />
				</td>
				<td className="record-meta">
					<div className='record-cell-row'>
						<div className='record-meta__author record-cell-col'>
							<img alt="" className="record-meta__author-avatar" src={ post.author.avatar } />
						</div>
						<div className='record-cell-col'>
							<div className="record-meta__links record-cell-text-pri">
								{ ! actions && post.editUrl && ( <>
									{ ' ' }
									<a href={ post.editUrl } onClick={ onEdit }>
										{ __( 'Edit', 'altis' ) }
									</a>
								</> ) }
								{ post.url && ( <>
									{ ' ' }
									<a href={ post.url } onClick={ () => trackEvent( listId, 'Action', {
										action: 'view',
										type: post.type,
									} ) }>
										{ __( 'View', 'altis' ) }
									</a>
								</> ) }
								{
									actions && Object.keys( actions ).map( label => (
										<a
											key={ label }
											href="#"
											onClick={ e => {
												e.preventDefault();
												actions[ label ]( post );
											} }
										>
											{ label }
										</a>
									) )
								}
							</div>
							<div className='record-meta__author-name record-cell-text-sec'>
								{ decodeEntities( post.author.name ) }
							</div>
						</div>
					</div>
				</td>
			</tr>
			{ isExpanded && (
				( post.blocks.length > 0 )
					? (
						( nested ? nested.map( nestedBlock => (
							<ListItem
								key={ nestedBlock.id }
								isNested
								item={ nestedBlock }
								listId={ listId }
								period={ period }
							/>
						)
						): (
							<td className="record-item--nested-loading" colSpan={ 7 }>
								<div className="flex items-center gap-2">
									<Spinner />
									{ __( 'Loading nested blocks...', 'altis' ) }
								</div>
							</td>
						) )
					) : (
						<tr className="record-item--nested-empty">
							<td colSpan={ 7 }>
								{ __( 'No blocks assigned to this block just yet.', 'altis' ) }
								{ ' ' }
								<a href={ post.editUrl || '' } onClick={ onEdit }>
									{ __( 'Add blocks', 'altis' ) }
								</a>
							</td>
						</tr>
					)
			) }
		</>
	);
};

function GlobalBlockConvertionRate( { post }: { post: Post } ) {
	if ( ! post.lift || ! post.subtype || post.lift.conversions / post.lift.views * 100 === 0 ) {
		return null;
	}

	const goalLabelMap = {
		click_any_link: __( 'Clickthrough', 'altis' ),
		engagement: __( 'Engagement', 'altis' ),
		submit_form: __( 'Form Submission', 'altis' ),
	};

	return (
		<div
			className="record-cell-col"
			title={ sprintf( __( 'The number of unique conversions for the global black. %d unique views, and %d conversions' ), post.lift.views, post.lift.conversions ) }
		>
			<div className="record-cell-text-pri">{ Math.round( post.lift.conversions / post.lift.views * 100 ) }%</div>
			<div className="record-cell-text-sec">{ ( goalLabelMap[ post.goal ] ) || '' }</div>
		</div>
	);
}

export default ListItem;
