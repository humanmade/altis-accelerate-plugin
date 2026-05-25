import { store as CoreDataStore } from '@wordpress/block-editor';
import { cloneBlock } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import StandaloneBlockPreview from '../../../../accelerate/components/StandaloneBlockPreview';
import { store } from '../../../../audiences/data';
import { Select as AudiencePicker } from '../../../../audiences/ui';
import { ABTest, BlockAnalytics } from '../../../../global';
import { compactMetric, getLift } from '../../../../utils';
import { getP2BB } from '../../../../utils/admin';
import Title from '../../variant/components/Title';

import { Button } from '@/components/ui/button';

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

interface VariantRowProps {
	analytics: BlockAnalytics,
	blockType: 'abtest' | 'personalization' | 'standard',
	index: number,
	isSelected: boolean,
	test: ABTest,
	variant: any,
	variants: any[],
	onSelectVariant: ( index: number ) => void,
	onAddBlankVariant?: () => void,
}

export default function VariantRow( props: VariantRowProps ) {
	const {
		analytics,
		blockType,
		index,
		isSelected,
		test,
		variant,
		variants,
		onSelectVariant,
		onAddBlankVariant,
	} = props;

	const { attributes, clientId, innerBlocks } = variant;

	const { insertBlock, removeBlock, updateBlockAttributes } = useDispatch( CoreDataStore );

	// Retrieve the audience if this is a personalised block.
	const audience = useSelect( select => {
		if ( blockType !== 'personalization' ) {
			return null;
		}
		return select( store ).getPost( attributes.audience );
	}, [ blockType, attributes?.audience ] );

	// Finding the correct analytics data for the current variant is a little tricky, as the variant id is different for abtests or personalization blocks.
	// AB tests are index-based, incrementing integer from 0. The fallback is id: 0, etc. So, we have to use the current row index (props.index) to find the corrosponding analytics data.
	// Personalization blocks are are id-based whereby the variant ID is the audience ID.
	let rowAnalytics;
	if ( blockType === 'abtest' ) {
		rowAnalytics = ( analytics?.variants && analytics?.variants.find( variant => variant.id === index ) ) || defaultAnalytics;
	} else if ( blockType === 'personalization' ) {
		const audienceId = attributes?.audience ?? 0;
		rowAnalytics = ( analytics?.variants && analytics?.variants.find( v => v.id === audienceId ) ) || defaultAnalytics;
	} else {
		rowAnalytics = defaultAnalytics;
	}

	const fallbackAnalytics = ( analytics?.variants && analytics?.variants.find( variant => variant.id === 0 ) ) || defaultAnalytics;
	const baseConversionRate = ( fallbackAnalytics?.unique?.views || 0 ) > 0
		? ( fallbackAnalytics.unique.conversions / fallbackAnalytics.unique.views ) * 100
		: 0;
	const conversionRate = ( rowAnalytics?.unique?.views || 0 ) > 0
		? ( rowAnalytics.unique.conversions / rowAnalytics.unique.views ) * 100
		: 0;
	const lift = getLift( conversionRate, baseConversionRate );

	// Probability to be best.
	const maxRate = ( test?.results?.variants || [] ).reduce( ( carry: number, variant: { rate: number } ) => {
		return variant.rate > carry ? variant.rate : carry;
	}, 0 );

	const result = test?.results?.variants[ index ] || {
		p: 0,
		rate: 0,
	};
	const p2bb = getP2BB( result.p ); // result.p is now P2BB directly

	const hasNoViews = ( rowAnalytics?.unique?.views || 0 ) === 0;

	const duplicateVariant = async ( e: React.MouseEvent<HTMLButtonElement> ) => {
		e.preventDefault();
		const newVariant = cloneBlock( variant, {
			fallback: false,
			audience: null,
			title: null,
		} );
		await insertBlock( newVariant, index + 1 );
	};

	return (
		<tr
			className={ `transition-all duration-300 font-bold cursor-pointer relative ${ isSelected ? 'bg-white' : 'text-gray-500' } ${ index > 0 ? 'border-t' : '' }` }
			style={ index > 0 ? { borderTopColor: '#ddd' } : {} }
			onClick={ () => onSelectVariant( index ) }
		>
			<td className="w-[115px] pr-8 relative align-middle">
				<div
					className={ `absolute top-0 bottom-0 w-4 flex items-center justify-center text-white font-bold transition-opacity duration-300 ${ isSelected ? 'opacity-100' : 'opacity-0' }` }
					style={ {
						backgroundColor: 'var(--wp-block-synced-color)',
						writingMode: 'vertical-lr',
						textOrientation: 'mixed',
						transform: 'rotate(180deg)',
						left: '-16px',
						fontSize: '10px',
						letterSpacing: '1px',
						borderTopRightRadius: '4px',
						borderBottomRightRadius: '4px',
					} }
				>
					EDITING
				</div>
				<div className="mx-3 my-3 min-h-[70px] flex items-center">
					<StandaloneBlockPreview
						blocks={ innerBlocks }
						height={ 65 }
						showShadow={ false }
						width={ 115 }
					/>
				</div>
			</td>
			<td className="align-middle">
				{ ( blockType === 'personalization' && ! audience && index !== 0 /* fallback */ ) ?

					(
						<AudiencePicker
							audience={ null }
							button={ ( { onOpen } ) => (
								<Button
									variant="outline"
									onClick={ onOpen }
								>
									{ __( 'Select audience', 'altis' ) }
								</Button>
							) }
							onSelect={ audience => {
								updateBlockAttributes( clientId, { audience } );
							} }
						/>
					) :
					<Title
						index={ index }
						type={ blockType }
						variant={ attributes }
					/> }
			</td>
			{ blockType === 'personalization' && (
				<td className="align-middle">
					{ audience
						? compactMetric( audience.estimate?.total ? Math.round( ( audience.estimate.count / audience.estimate.total ) * 100 ) : 0, '%' )
						: ' ' }
				</td>
			) }

			{ hasNoViews ?
			 (
					<td className="align-middle" colSpan={ 2 }>
						<div
							className="px-2 py-1 text-xs rounded border font-normal"
							style={ {
								color: '#6b7280',
								borderColor: '#d1d5db',
								backgroundColor: '#f9fafb',
								display: 'inline-block',
							} }
						>
							{ __( 'Collecting data...', 'altis' ) }
						</div>
					</td>
				) : (

					<>
						<td className="align-middle">
							{ compactMetric( conversionRate, '%' ) }
						</td>

						<td className="align-middle">
							{ index === 0 && (
								<span className="altis-score-fallback">
								&nbsp;
								</span>
							) }
							{ index !== 0 && (
								<span className={ `altis-score altis-score-${ lift >= 0 ? 'positive' : 'negative' }` }>{ compactMetric( lift, '%' ) }</span>
							) }
						</td>
					</>
				) }

			{ blockType === 'abtest' && (
				<td className="align-middle">{ ! hasNoViews && compactMetric( p2bb, '%' ) }</td>
			) }

			<td className="text-right w-44 align-middle">
				<div className="gap-2 flex">
					{ blockType === 'abtest' && (
						<Button
							variant="outline"
							onClick={ duplicateVariant }
						>
							{ __( 'Duplicate', 'altis' ) }
						</Button>
					) }
					{ blockType === 'personalization' && (
						<AudiencePicker
							audience={ null }
							button={ ( { onOpen } ) => (
								<Button
									variant="outline"
									onClick={ onOpen }
								>
									{ __( 'Duplicate', 'altis' ) }
								</Button>
							) }
							onSelect={ audience => {
								const newVariant = cloneBlock( variant, {
									fallback: false,
									audience,
									title: null,
								} );
								insertBlock( newVariant, variants.length, '' );
								onSelectVariant( variants.length );
							} }
						/>
					) }
					{ index !== 0 ? (
						<Button
							className="!text-gray-500 hover:!text-gray-700"
							variant="link"
							onClick={ () => {
								// eslint-disable-next-line no-alert
								if ( window.confirm( __( 'Are you sure you want to remove this variant?', 'altis' ) ) ) {
									onSelectVariant( 0 );
									removeBlock( clientId );
								}
							} }
						>
							{ __( 'Delete', 'altis' ) }
						</Button>
					) : null }
				</div>
			</td>
		</tr>
	);
}
