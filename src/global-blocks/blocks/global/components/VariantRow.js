import React from 'react';

import { Button } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { cloneBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

import Image from '../../../../accelerate/components/Image';
import { CloneVariantIcon, DeleteVariantIcon } from '../../../utils/icons';
import Title from '../../variant/components/Title';
import { compactMetric, getLift } from '../../../../utils';

const { AudiencePicker } = window.Altis.Analytics.components;

export default function VariantRow( props ) {
	const {
		analytics,
		blockClientId,
		blockType,
		index,
		isVisible,
		p2bb,
		previewThumb,
		variant,
		variants,
		onSelectVariant,
	} = props;

	const { attributes, clientId } = variant;

	const { insertBlock, removeBlock } = useDispatch( 'core/block-editor' );
	const audience = useSelect( select => {
		if ( blockType !== 'personalization' ) {
			return null;
		}
		return select( 'audience' ).getPost( attributes.audience );
	}, [ blockType, attributes?.audience ] );

	const defaultAnalytics = {
		loads: 0,
		views: 0,
		conversions: 0,
		unique: {
			loads: 0,
			views: 0,
			conversions: 0,
		},
	};
	const rowAnalytics = ( analytics?.variants && analytics?.variants.find( variant => variant.id === index ) ) || defaultAnalytics;
	const fallbackAnalytics = ( analytics?.variants && analytics?.variants.find( variant => variant.id === 0 ) ) || defaultAnalytics;
	const baseConversionRate = ( fallbackAnalytics?.unique?.views || 0 ) > 0
		? ( fallbackAnalytics.unique.conversions / fallbackAnalytics.unique.views ) * 100
		: 0;
	const conversionRate = ( rowAnalytics?.unique?.views || 0 ) > 0
		? ( rowAnalytics.unique.conversions / rowAnalytics.unique.views ) * 100
		: 0;
	const lift = getLift( conversionRate, baseConversionRate );

	return (
		<tr
			key={ clientId }
			className={ `altis-gb-dropdown-listitem ${ isVisible ? 'altis-gb-dropdown-listitem--selected' : '' }` }
			onClick={ () => onSelectVariant( index ) }
		>
			<td className="altis-gb-dropdown-listitem-thumb">
				<Image
					alt={ '' }
					className="altis-gb-dropdown-thumb"
					height={ 34 }
					src={ previewThumb.replace( /variant-id%3D0/, 'variant-id%3D' + index ) }
					width={ 78 }
				/>
			</td>
			<td className="altis-gb-dropdown-listitem-title">
				<Title
					index={ index }
					type={ blockType }
					variant={ attributes }
				/>
			</td>
			{ blockType === 'personalization' && (
				<td className="">
					{ audience
						? compactMetric( audience.estimate.total ? Math.round( ( audience.estimate.count / audience.estimate.total ) * 100 ) : 0, '%' )
						: ' ' }
				</td>
			) }
			<td className="">{ compactMetric( conversionRate, '%' ) }</td>
			<td className="">
				{ index === 0 && (
					<span className="altis-score-fallback">
						&nbsp;
					</span>
				) }
				{ index !== 0 && (
					<span className={ `altis-score altis-score-${ lift >= 0 ? 'positive' : 'negative' }` }>{ compactMetric( lift, '%' ) }</span>
				) }
			</td>
			{ blockType === 'abtest' && (
				<td className="">{ compactMetric( p2bb, '%' ) }</td>
			) }
			<td className="textright">
				{ blockType === 'abtest' && (
					<Button
						icon={ CloneVariantIcon }
						isTertiary
						label={ __( 'Clone', 'altis' ) }
						onClick={ () => {
							const newVariant = cloneBlock( variant, {
								fallback: false,
								audience: null,
								title: null,
							} );
							insertBlock( newVariant, variants.length, blockClientId || '' );
							onSelectVariant( variants.length );
						} }
					/>
				) }
				{ blockType === 'personalization' && (
					<AudiencePicker
						audience={ null }
						button={ ( { onOpen } ) => (
							<Button
								icon={ CloneVariantIcon }
								isTertiary
								label={ __( 'Clone', 'altis' ) }
								onClick={ onOpen }
							/>
						) }
						onSelect={ audience => {
							const newVariant = cloneBlock( variant, {
								fallback: false,
								audience,
								title: null,
							} );
							insertBlock( newVariant, variants.length, blockClientId || '' );
							onSelectVariant( variants.length );
						} }
					/>
				) }
				{ index !== 0 && (
					<Button
						icon={ DeleteVariantIcon }
						isTertiary
						label={ __( 'Trash', 'altis' ) }
						onClick={ () => {
							// eslint-disable-next-line no-alert
							if ( window.confirm( __( 'Are you sure you want to remove this variant?', 'altis' ) ) ) {
								onSelectVariant( 0 );
								removeBlock( clientId );
							}
						} }
					/>
				) }
			</td>
		</tr>
	);
};
