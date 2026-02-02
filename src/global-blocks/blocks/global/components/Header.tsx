import { store as BlockEditorStore } from '@wordpress/block-editor';
import { BlockInstance, createBlock } from '@wordpress/blocks';
import { Icon, Tooltip } from '@wordpress/components';
import { store as CoreDataStore } from '@wordpress/core-data';
import { useSelect, useDispatch, useRegistry, select } from '@wordpress/data';
import { store as CoreEditorStore } from '@wordpress/editor';
import { useState } from '@wordpress/element';
import { __, _n } from '@wordpress/i18n';
import { info, chartBar, trendingUp } from '@wordpress/icons';
import { store as PreferencesStore } from '@wordpress/preferences';

import SparkChart from '../../../../accelerate/components/SparkChart';
import { store as AnalyticsStore } from '../../../../blocks/data';
import { store } from '../../../../data/index';
import { BlockAnalytics } from '../../../../global';
import { compactMetric, Post } from '../../../../utils/admin';

import ABTestResult from './ABTestResult';
import VariantRow from './VariantRow';

const PERIODS = [ 'P7D', 'P30D', 'P90D' ] as const;

type Period = ( typeof PERIODS )[number];

export const Header = () => {
	const registry = useRegistry();
	const { set: setPreference } = useDispatch( PreferencesStore );

	const postId = useCurrentPostId();
	if ( ! postId ) {
		return null;
	}

	const post = useCurrentPost();

	if ( ! post ) {
		return null;
	}
	const {
		blockType,
		previewThumb,
	} = post;

	const abTests = post?.ab_tests || {};
	const test = abTests?.block || { start_time: 0 };
	const startTime = test?.start_time;

	const [ period, setPeriod ] = useState<Period>( 'P7D' );
	const histogram = useSelect(
		select => {
			const args = { ids: [ postId ] } as any;
			if ( blockType === 'abtest' ) {
				args.start = new Date( startTime ).toISOString();
			} else {
				args.period = period;
			}
			return select( store ).getDiffs( args );
		},
		[ postId, period, startTime, blockType ]
	);

	const analytics: BlockAnalytics = useSelect(
		select => {
			const args: Record<string, any> = {};
			if ( blockType === 'abtest' ) {
				args.start = new Date( startTime ).toISOString();
			} else {
				args.period = period;
			}
			return select( AnalyticsStore ).getViews( postId, args );
		},
		[ postId, period, startTime, blockType ]
	);

	const [ blocks ] = useSelect(
		select => {
			return [ select( BlockEditorStore ).getBlocks() as BlockInstance[] ];
		},
		[ blockType ]
	);

	const variants = blocks.filter( block => block.name === 'altis/variant' );
	const selectedVariant: number = useSelect(
		select => {
			const pref = select( PreferencesStore ).get( 'altis/global-blocks', `${ postId }:variant` ) || 0;

			// The preference stores the WordPress block index, find which variant has that block index
			const { getBlockIndex } = select( BlockEditorStore );

			const arrayIndex = variants.findIndex( v => {
				const blockIndex = getBlockIndex( v.clientId );
				return blockIndex === pref;
			} );

			return arrayIndex >= 0 ? arrayIndex : 0;
		},
		[ postId, variants ]
	);

	// Header expansion controls.
	const variantsExpanded = useSelect( select => {
		const value = select( PreferencesStore ).get( 'altis/global-blocks', 'variantsExpanded' );
		if ( value !== undefined ) {
			return value;
		}
		// Default to expanded if no preference is set
		return true;
	}, [] );
	const setVariantsExpanded = ( expanded: boolean ) => {
		setPreference( 'altis/global-blocks', 'variantsExpanded', expanded );
	};

	const {
		insertBlock,
		removeBlocks,
		clearSelectedBlock,
		selectBlock,
	} = useDispatch( BlockEditorStore );

	const { editEntityRecord } = useDispatch( CoreDataStore );
	const updateBlockPost = ( edits: any ) => {
		editEntityRecord( 'postType', 'wp_block', postId, edits, {
			undoIgnore: false,
		} );
	};

	const convertToAbTest = () => {
		setPeriod( 'P7D' );
		registry.batch( () => {
			updateBlockPost( {
				blockType: 'abtest',
			} );
			removeBlocks( blocks.map( b => b.clientId ) );
			const newVariant = createBlock(
				'altis/variant',
				{
					fallback: true,
					title: __( 'Variant A', 'altis' ),
				},
				blocks
			);
			insertBlock( newVariant, 0, '' );
		} );
	};

	const convertToPersonalization = () => {
		setPeriod( 'P7D' );
		registry.batch( () => {
			updateBlockPost( {
				blockType: 'personalization',
			} );
			removeBlocks( blocks.map( b => b.clientId ) );
			const newVariant = createBlock(
				'altis/variant',
				{
					fallback: true,
					title: __( 'Fallback', 'altis' ),
				},
				blocks
			);
			insertBlock( newVariant, 0, '' );
		} );
	};

	const addBlankVariant = () => {
		// Create a default paragraph block to put inside the variant so it's immediately editable
		const defaultParagraph = createBlock( 'core/paragraph' );

		const newVariant = createBlock(
			'altis/variant',
			{
				fallback: false,
			},
			[ defaultParagraph ]
		);
		insertBlock( newVariant, blocks.length, '' );

		// Set the preference to point to the new variant
		setTimeout( () => {
			const { getBlockIndex } = select( BlockEditorStore );
			const actualBlockIndex = getBlockIndex( newVariant.clientId );
			setPreference( 'altis/global-blocks', `${ postId }:variant`, actualBlockIndex );
			selectBlock( newVariant.clientId );
		}, 100 );
	};

	return (
		<>
			<div className="p-3 pl-[80px] flex gap-6 border-b" style={ {
				backgroundColor: '#f8f8f8',
				borderBottomColor: '#ccc',
			} }>
				{ blockType === 'standard' && (
					<div className="flex items-center gap-2 text-synced-color font-bold">
						<span>{ __( 'Global Block', 'altis' ) }</span>
					</div>
				) }
				{ blockType === 'standard' && (
					<div className="w-px -my-3" style={ { backgroundColor: '#ccc' } }></div>
				) }
				{ blockType !== 'standard' && (
					<button
						className="flex items-center gap-2 text-synced-color font-bold"
						onClick={ () => setVariantsExpanded( ! variantsExpanded ) }
					>
						<span
							aria-expanded={ variantsExpanded }
							aria-label={
								variantsExpanded ? __( 'Collapse variants', 'altis' ) : __( 'Expand variants', 'altis' )
							}
							className={ `dashicons dashicons-arrow-right-alt2 transition-transform duration-200 ease-in-out ${
								variantsExpanded ? 'rotate-90' : 'rotate-0'
							}` }
						></span>
						<span className="flex items-center gap-2">
							<span>
								{ blockType === 'abtest' && __( 'A/B Block', 'altis' ) }
								{ blockType === 'personalization' && __( 'Personalized Block', 'altis' ) }
							</span>
							<span
								className="px-2 py-1 text-xs rounded border"
								style={ {
									color: 'var(--wp-block-synced-color)',
									borderColor: 'color-mix(in srgb, var(--wp-block-synced-color) 25%, transparent)',
									backgroundColor: 'color-mix(in srgb, var(--wp-block-synced-color) 10%, transparent)',
								} }
							>
								{ blockType === 'personalization'
									? `${ variants.length } ${ _n( 'Audience', 'Audiences', variants.length, 'altis' ) }`
									: `${ variants.length } ${ _n( 'Variant', 'Variants', variants.length, 'altis' ) }` }
							</span>
						</span>
					</button>
				) }
				{ blockType !== 'standard' && (
					<div className="w-px -my-3" style={ { backgroundColor: '#ccc' } }></div>
				) }
				<div className="flex gap-2 text-gray-500 items-center">
					{ ( histogram[postId]?.current.by_date?.length > 0 ) ? (
						PERIODS.map( ( p: Period ) => (
							<button
								key={ p }
								className={ `relative ${ p === period ? 'text-gray-800 font-bold' : 'text-gray-400' }` }
								onClick={ () => setPeriod( p ) }
							>
								<span aria-hidden="true" className="invisible font-bold">
									{ p.replace( 'P', '' ) }
								</span>
								<span className={ `absolute inset-0 flex items-center justify-center ${ p === period ? 'font-bold' : 'font-normal' }` }>
									{ p.replace( 'P', '' ) }
								</span>
							</button>
						) )
					) : (
						<span className="text-gray-500">
							{ __( 'Collecting data...', 'altis' ) }
						</span>
					) }
				</div>
				<div className="w-px -my-3" style={ { backgroundColor: '#ccc' } }></div>
				<div className={ `flex text-gray-500 ${ ! ( histogram[postId]?.current.by_date?.length > 0 ) ? 'gap-6' : 'gap-2' }` }>
					<div className="flex gap-2 items-center">
						<span className="font-bold flex items-center gap-1 text-gray-900">
							<Icon icon={ chartBar } size={ 18 } />
							{ __( 'Views', 'altis' ) }
						</span>
						<span>{ histogram[postId]?.current.views || 0 }</span>
						{ ( histogram[postId]?.current.by_date?.length > 0 ) && (
							<SparkChart height={ 23 } histogram={ histogram[postId].current.by_date } period={ period } />
						) }
					</div>

					{ analytics && (
						<div className="flex gap-2 items-center">
							<span className="font-bold flex items-center gap-1 text-gray-900">
								<Icon icon={ trendingUp } size={ 18 } />
								{ __( 'Conversion', 'altis' ) }
							</span>
							<span>
								{ ( analytics.unique.views || 0 ) > 0
									? compactMetric( ( analytics.unique.conversions / analytics.unique.views ) * 100, '%' )
									: '—' }
							</span>
						</div>
					) }
				</div>

				{ blockType === 'standard' && (
					<div className="w-px -my-3" style={ { backgroundColor: '#ccc' } }></div>
				) }
				{ blockType === 'standard' && (
					<div className="flex gap-2 text-gray-500 items-center ml-auto">
						<span>{ __( 'Convert to', 'altis' ) }</span>
						<button
							className="components-button is-compact is-primary altis-convert-button"
							onClick={ convertToAbTest }
						>
							{ __( 'A/B test', 'altis' ) }
						</button>
						<button
							className="components-button is-compact is-primary altis-convert-button"
							onClick={ convertToPersonalization }
						>
							{ __( 'Personalized block', 'altis' ) }
						</button>
					</div>
				) }
			</div>

			{ blockType === 'abtest' && <ABTestResult test={ test } /> }

			{ blockType !== 'standard' && (
				<div
					className={ `grid transition-[grid-template-rows] duration-300 ease-in-out ${
						variantsExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
					}` }
					style={ { backgroundColor: '#f8f8f8' } }
				>
					<div className={ 'p-3 pl-[80px] overflow-hidden' }>
						<table className="w-full table-auto">
							<thead className="text-left text-gray-400 text-xs">
								<tr>
									<th>&nbsp;</th>
									<th className="pb-1 pr-2">{ __( 'Variant Name', 'altis' ) }</th>
									{ blockType === 'personalization' && (
										<th className="pb-1 pr-2">
											<Tooltip text={ __( 'Percentage of total traffic this audience covers', 'altis' ) }>
												<div className="gap-1 flex">
													<span>{ __( 'Coverage', 'altis' ) }</span>
													<Icon icon={ info } size={ 16 } style={ { color: '#9ca3af' } } />
												</div>
											</Tooltip>
										</th>
									) }
									<th className="pb-1 pr-2">
										<Tooltip text={ __( 'Unique conversions divided by total unique views', 'altis' ) }>
											<div className="gap-1 flex">
												<span>{ __( 'Conversion Rate', 'altis' ) }</span>
												<Icon icon={ info } size={ 16 } />
											</div>
										</Tooltip>
									</th>
									<th className="pb-1 pr-2">{ __( 'Improvement', 'altis' ) }</th>
									{ blockType === 'abtest' && (
										<th className="pb-1 pr-2">
											<Tooltip text={ __( 'Current likelihood this variant will win', 'altis' ) }>
												<div className="gap-1 flex">
													<span>{ __( 'Probability to be Best', 'altis' ) }</span>
													<Icon icon={ info } size={ 16 } style={ { color: '#9ca3af' } } />
												</div>
											</Tooltip>
										</th>
									) }
									<th className="pb-1 w-44 font-normal">
										<button
											className="components-button is-compact is-tertiary"
											onClick={ addBlankVariant }
										>
											{ __( '+ Add blank variant', 'altis' ) }
										</button>
									</th>
								</tr>
							</thead>
							<tbody className="border" style={ { borderColor: '#ddd' } }>
								{ variants.map( ( variant, index ) => {
									return (
										<VariantRow
											key={ variant.clientId }
											analytics={ analytics }
											blockType={ blockType }
											index={ index }
											isSelected={ selectedVariant === index }
											previewThumb={ previewThumb }
											test={ test }
											variant={ variant }
											variants={ variants }
											onAddBlankVariant={ addBlankVariant }
											onSelectVariant={ variantIndex => {
												if ( variants[variantIndex] ) {
													const targetClientId = variants[variantIndex].clientId;

													// Get the WordPress block index and set preference manually
													const { getBlockIndex } = select( BlockEditorStore );
													const actualBlockIndex = getBlockIndex( targetClientId );

													setPreference( 'altis/global-blocks', `${ postId }:variant`, actualBlockIndex );
													selectBlock( targetClientId );
												}
											} }
										/>
									);
								} ) }
							</tbody>
						</table>
					</div>
				</div>
			) }
		</>
	);
};

const useCurrentPostId = () => {
	return useSelect( select => {
		const editor = select( CoreEditorStore );
		return editor.getCurrentPostId();
	}, [] );
};

const useCurrentPost = (): Post | false => {
	const postId = useCurrentPostId();
	if ( ! postId ) {
		return false;
	}
	return useSelect(
		select => {
			return select( CoreDataStore ).getEditedEntityRecord( 'postType', 'wp_block', postId );
		},
		[ postId ]
	) as Post | false;
};
