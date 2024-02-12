import React, { useState } from 'react';

import { createBlock } from '@wordpress/blocks';
import {
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	Button,
	SelectControl,
	Tooltip,
} from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';

import SparkChart from '../../../../accelerate/components/SparkChart';
import { compactMetric } from '../../../../utils/admin';
import VariantRow from './VariantRow';
import { getLetter, getLift } from '../../../../utils';

const { AudiencePicker } = window.Altis.Analytics.components;

export function Controls( props ) {
	const {
		clientId = null,
		id,
	} = props;

	const blockPost = useSelect( select => {
		return select( 'core' ).getEditedEntityRecord( 'postType', 'wp_block', id );
	}, [ id ] );

	const {
		blockType,
		goal,
		previewThumb,
	} = blockPost;

	const [
		block,
		blocks,
	] = useSelect( select => {
		return [
			select( 'core/block-editor' ).getBlock( clientId ),
			select( 'core/block-editor' ).getBlocks( clientId ),
		];
	}, [ clientId ] );
	const variants = blocks.filter( block => block.name === 'altis/variant' );
	const selectedVariant = useSelect( select => select( 'core/preferences' ).get( 'altis/global-blocks', `${ id }:variant` ) || 0, [ id ] );
	const { set: setPreference } = useDispatch( 'core/preferences' );
	const { insertBlock, removeBlocks, updateBlockAttributes } = useDispatch( 'core/block-editor' );
	const { editEntityRecord } = useDispatch( 'core' );
	const updateBlockPost = edits => {
		editEntityRecord( 'postType', 'wp_block', id, edits );
	};

	// A/B test handling.
	let hasEnded = null;
	let baseVariantData, winningVariantId, winningVariantData = null;
	const abTests = blockPost?.ab_tests || {}
	const test = abTests?.block || {};
	const startTime = test?.start_time;

	const [ period, setPeriod ] = useState( 'P30D' );
	const histogram = useSelect( select => {
		const args = { ids: [ id ] };
		if ( blockType === 'abtest' ) {
			args.start = new Date( startTime ).toISOString();
		} else {
			args.period = period;
		}
		return select( 'accelerate' ).getDiffs( args );
	}, [ id, period, startTime, blockType ] );

	const analytics = useSelect( select => {
		const args = {};
		if ( blockType === 'abtest' ) {
			args.start = new Date( startTime ).toISOString();
		} else {
			args.period = period;
		}
		return select( 'accelerate/xbs' ).getViews( id, args );
	}, [ id, period, startTime, blockType ] );


	// Probability to be best.
	const maxRate = ( test?.results?.variants || [] ).reduce( ( carry, variant ) => {
		return variant.rate > carry ? variant.rate : carry;
	}, 0 );

	if ( blockType === 'abtest' && test ) {
		// Check end status of test.
		hasEnded = ( test?.end_time && test?.end_time <= Date.now() ) || Number.isInteger( test?.results?.winner );
		winningVariantId = Number.isInteger( test?.results?.winner ) ? test.results.winner : false;
		winningVariantData = ( winningVariantId !== false && test?.results?.variants && test?.results?.variants[ winningVariantId ] ) || false;
		baseVariantData = test?.results?.variants && test?.results?.variants[ 0 ] || false;
	}

	return (
		<div className="altis-gb-dropdown">
			{ blockType === 'abtest' && hasEnded && (
				<div className="altis-gb-dropdown-abtest-result">
					<div className="altis-gb-dropdown-text">
						{ winningVariantId === 0 && (
							<>
								<p><strong>{ __( 'Variant A is the winner!', 'altis' ) } 🏆</strong></p>
								<p>{ sprintf(
									__( 'Conversion rate: %s, the original version is the best.', 'altis' ),
									compactMetric( winningVariantData.rate * 100, '%' )
								) }</p>
								<p>{ __( 'The winning variant will be shown to everyone, you can also convert the block to a standard Global Block using the winning variant using the sidebar controls.' ) }</p>
							</>
						) }
						{ winningVariantId !== false && winningVariantId !== 0 && (
							<>
								<p><strong>{ sprintf(
									__( 'Variant %s is the winner!', 'altis' ),
									getLetter( winningVariantId )
								) } 🏆</strong></p>
								<p>{ sprintf(
									__( 'The conversion rate was %s, %s higher than the original.', 'altis' ),
									compactMetric( winningVariantData.rate * 100, '%' ),
									compactMetric( getLift( winningVariantData.rate, baseVariantData.rate ), '%' )
								) }</p>
								<p>{ __( 'The winning variant will be shown to everyone, you can also convert the block to a standard Global Block using the winning variant using the sidebar controls.' ) }</p>
							</>
						) }
						{ winningVariantId === false && (
							<>
								<p><strong>{ __( 'There was no clear winner', 'altis' ) } 🤷</strong></p>
								<p>{ __( 'There was no statistically significant improvement in the conversion rate between the variants.', 'altis' ) }</p>
								<p>{ __( 'You can downgrade to a regular Global Block using the sidebar controls or make some edits and save the block to try the test again.', 'altis' ) }</p>
							</>
						) }
					</div>
				</div>
			) }
			{ blockType !== 'abtest' && (
				<div className="altis-gb-dropdown-meta">
					<ToggleGroupControl
						className="altis-gb-dropdown-meta-date"
						hideLabelFromVision
						isAdaptiveWidth
						value={ period }
						onChange={ value => setPeriod( value ) }
					>
						<ToggleGroupControlOption label={ __( '7D', 'altis' ) } value="P7D" />
						<ToggleGroupControlOption label={ __( '30D', 'altis' ) } value="P30D" />
						<ToggleGroupControlOption label={ __( '90D', 'altis' ) } value="P90D" />
					</ToggleGroupControl>
				</div>
			) }
			<div className="altis-gb-dropdown-insights-wrap">
				<div className="altis-gb-dropdown-insights">
					<div className="altis-gb-dropdown-insight-kpi">
						<Tooltip text={ __( 'Total number of block impressions for the time period selected', 'altis' ) }>
							<div className="altis-gb-dropdown-label">
								<span>{ __( 'Blockviews', 'altis' ) }</span>
								<span className="dashicons dashicons-info-outline"></span>
							</div>
						</Tooltip>
						<div className="altis-gb-dropdown-insights-row">
							<div className="altis-gb-dropdown-kpi">{ compactMetric( histogram[ id ]?.current.views ) }</div>
							<SparkChart
								className="altis-gb-dropdown-chart"
								height={ 23 }
								histogram={ histogram[ id ]?.current.by_date || [] }
								period={ period }
							/>
						</div>
					</div>
					<div className="altis-gb-dropdown-insight-chart">
						<div className="altis-gb-dropdown-label">&nbsp;</div>

					</div>
					<div className="altis-gb-dropdown-insight-kpi">
						<Tooltip text={ __( 'Which interactions to track as a conversion', 'altis' ) }>
							<div className="altis-gb-dropdown-label">
								<span>{ __( 'Conversion Rate & Goal', 'altis' ) }</span>
								<span className="dashicons dashicons-info-outline"></span>
							</div>
						</Tooltip>
						<div className="altis-gb-dropdown-insights-row">
							<div className="altis-gb-dropdown-kpi">{ ( analytics?.unique?.views || 0 ) > 0 ? compactMetric( ( analytics.unique.conversions / analytics.unique.views ) * 100, '%' ) : '0%' }</div>
							<div>
								<div>
									<SelectControl
										__nextHasNoMarginBottom
										options={ Object.values( Altis.Analytics.Experiments.Goals ).map( goalConfig => {
											return {
												label: goalConfig.label,
												value: goalConfig.name,
											};
										} ) }
										value={ goal }
										onChange={ newGoal => updateBlockPost( { goal: newGoal } ) }
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			{ blockType !== 'standard' && (
				<table className="altis-gb-dropdown-list">
					<thead className="altis-gb-dropdown-listheader-wrap">
						<tr className="altis-gb-dropdown-listheader">
							<th>&nbsp;</th>
							<th className="">{ __( 'Variant Name', 'altis' ) }</th>
							{ blockType === 'personalization' && (
								<th className="altis-gb-dropdown-listitem-short">
									<Tooltip text={ __( 'Percentage of total traffic this audience covers', 'altis' ) }>
										<>
											<span>{ __( 'Coverage', 'altis' ) }</span>
											<span className="dashicons dashicons-info-outline"></span>
										</>
									</Tooltip>
								</th>
							) }
							<th className="altis-gb-dropdown-listitem-short">
								<Tooltip text={ __( 'Conversions divided by total views', 'altis' ) }>
									<>
										<span>{ __( 'Conversion Rate', 'altis' ) }</span>
										<span className="dashicons dashicons-info-outline"></span>
									</>
								</Tooltip>
							</th>
							<th className="altis-gb-dropdown-listitem-short">{ __( 'Improvement', 'altis' ) }</th>
							{ blockType === 'abtest' && (
								<th className="altis-gb-dropdown-listitem-short">
									<div>
										<span>{ __( 'Probability to be Best', 'altis' ) }</span>
										<span className="dashicons dashicons-info-outline"></span>
									</div>
								</th>
							) }
							<th className="altis-gb-dropdown-listitem-short">&nbsp;</th>
						</tr>
					</thead>
					<tbody className="altis-gb-dropdown-listitem-wrap">
						{ variants.map( ( variant, index ) => {
							const result = test?.results?.variants[ index ] || {};
							const pValue = result.p || 1;
							const relativeRate = result.rate / maxRate;
							const p2bb = relativeRate * ( 1 - pValue );

							return (
								<VariantRow
									key={ variant.clientId }
									analytics={ analytics }
									blockClientId={ clientId }
									blockType={ blockType }
									index={ index }
									isVisible={ selectedVariant === index }
									p2bb={ p2bb }
									previewThumb={ previewThumb }
									variant={ variant }
									variants={ variants }
									onSelectVariant={ variantIndex => {
										setPreference( 'altis/global-blocks', `${ id }:variant`, variantIndex );
									} }
								/>
							);
						} ) }
					</tbody>
				</table>
			) }
			<div className="altis-gb-dropdown-actions-wrap">
				<div className="altis-gb-dropdown-actions">
					<div className="altis-gb-dropdown-actions-upgrade">
						<div>
							{ blockType === 'standard' && (
								<>
									<Button
										isSecondary
										onClick={ () => {
											setPeriod( 'P90D' );
											updateBlockPost( {
												blockType: 'abtest',
											} );
											removeBlocks( blocks.map( b => b.clientId ) );
											const newVariant = createBlock( 'altis/variant', {
												fallback: true,
												title: __( 'Variant A', 'altis' ),
											}, blocks );
											insertBlock( newVariant, 0, clientId || '' );
											clientId && updateBlockAttributes( clientId, { lock: { ...( block.attributes?.lock || {} ), edit: false } } );
										} }
									>
										{ __( 'Convert to A/B Test', 'altis' ) }
									</Button>
									<Button
										isSecondary
										onClick={ () => {
											updateBlockPost( {
												blockType: 'personalization',
											} );
											removeBlocks( blocks.map( b => b.clientId ) );
											const newVariant = createBlock( 'altis/variant', {
												fallback: true,
												title: __( 'Fallback', 'altis' ),
											}, blocks );
											insertBlock( newVariant, 0, clientId || '' );
											clientId && updateBlockAttributes( clientId, { lock: { ...( block.attributes?.lock || {} ), edit: false } } );
										 } }
									>
										{ __( 'Convert to Personalized Content', 'altis' ) }
									</Button>
								</>
							) }
							{ blockType === 'abtest' && (
								<Button
									icon="plus"
									isSecondary
									onClick={ () => {
										const newVariant = createBlock( 'altis/variant' );
										insertBlock( newVariant, variants.length, clientId || '' );
										clientId && updateBlockAttributes( clientId, { lock: { ...( block.attributes?.lock || {} ), edit: false } } );
									} }
								>
									{ __( 'Add variant', 'altis' ) }
								</Button>
							) }
							{ blockType === 'personalization' && (
								<AudiencePicker
									audience={ null }
									button={ ( { onOpen } ) => (
										<Button
											icon="plus"
											isSecondary
											onClick={ onOpen }
										>
											{ __( 'Add audience', 'altis' ) }
										</Button>
									) }
									onSelect={ audience => {
										const newVariant = createBlock( 'altis/variant', { audience } );
										insertBlock( newVariant, variants.length, clientId || '' );
										clientId && updateBlockAttributes( clientId, { lock: { ...( block.attributes?.lock || {} ), edit: false } } );
									} }
								/>
							) }
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
