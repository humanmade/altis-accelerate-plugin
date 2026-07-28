import React from 'react';

import { __, sprintf, _n } from '@wordpress/i18n';

import type { Experiment } from '../data/store';

import { SourceBadge } from './SourceBadge';
import { StatusBadge } from './StatusBadge';

import StandaloneBlockPreview from '@/accelerate/components/StandaloneBlockPreview';

interface ExperimentRowProps {
	experiment: Experiment;
}

const TYPE_LABELS: Record<string, string> = {
	block: __( 'A/B Test', 'altis' ),
	personalization: __( 'Personalization', 'altis' ),
	titles: __( 'Title Test', 'altis' ),
	featured_images: __( 'Image Test', 'altis' ),
};

function getRelativeTime( dateString: string | null ): string {
	if ( ! dateString ) {
		return '';
	}

	const date = new Date( dateString );
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor( diffMs / ( 1000 * 60 * 60 * 24 ) );

	if ( diffDays === 0 ) {
		return __( 'Today', 'altis' );
	}
	if ( diffDays === 1 ) {
		return __( 'Yesterday', 'altis' );
	}
	if ( diffDays < 30 ) {
		/* translators: %d: number of days ago */
		return sprintf( __( '%d days ago', 'altis' ), diffDays );
	}
	if ( diffDays < 365 ) {
		const months = Math.floor( diffDays / 30 );
		/* translators: %d: number of months ago */
		return sprintf( __( '%d months ago', 'altis' ), months );
	}

	const years = Math.floor( diffDays / 365 );
	/* translators: %d: number of years ago */
	return sprintf( __( '%d years ago', 'altis' ), years );
}

declare global {
	interface Window {
		AccelerateExperimentsData?: {
			headingFontFamily?: string;
		};
	}
}

function ThumbnailCell( { experiment }: { experiment: Experiment } ) {
	const isBlockType = experiment.type === 'block' || experiment.type === 'personalization';
	const hasMultipleVariants = isBlockType && experiment.variant_count > 1;

	if ( isBlockType && experiment.raw_content ) {
		if ( hasMultipleVariants ) {
			const extraCount = experiment.variant_count - 2;
			return (
				<div className="record-thumbnail-group-wrap record-thumbnail-group-wrap--multiple">
					{ extraCount > 0 && (
						<span className="record-thumbnail-extra-variant-count">
							+{ extraCount }
						</span>
					) }
					<StandaloneBlockPreview
						className="stacked-preview stacked-preview--back"
						content={ experiment.raw_content }
						height={ 47 }
						variantIndex={ 1 }
						width={ 105 }
					/>
					<StandaloneBlockPreview
						className="stacked-preview stacked-preview--front"
						content={ experiment.raw_content }
						height={ 47 }
						variantIndex={ 0 }
						width={ 105 }
					/>
				</div>
			);
		}

		return (
			<StandaloneBlockPreview
				content={ experiment.raw_content }
				height={ 47 }
				width={ 105 }
			/>
		);
	}

	// Featured image tests: show stacked variant images.
	if ( experiment.type === 'featured_images' && experiment.variant_thumbnails && experiment.variant_thumbnails.length > 0 ) {
		if ( experiment.variant_thumbnails.length > 1 ) {
			const extraCount = experiment.variant_count - 2;
			return (
				<div className="record-thumbnail-group-wrap record-thumbnail-group-wrap--multiple record-thumbnail-group-wrap--images">
					{ extraCount > 0 && (
						<span className="record-thumbnail-extra-variant-count">
							+{ extraCount }
						</span>
					) }
					<img
						alt=""
						className="stacked-preview stacked-preview--back"
						src={ experiment.variant_thumbnails[ 1 ] }
					/>
					<img
						alt={ experiment.title }
						className="stacked-preview stacked-preview--front"
						src={ experiment.variant_thumbnails[ 0 ] }
					/>
				</div>
			);
		}

		return (
			<img
				alt={ experiment.title }
				className="record-thumbnail--image"
				src={ experiment.variant_thumbnails[ 0 ] }
			/>
		);
	}

	// Title tests: show title text in a styled gray box.
	if ( experiment.type === 'titles' ) {
		const headingFont = window.AccelerateExperimentsData?.headingFontFamily || 'Georgia, serif';
		const titleText = experiment.default_title || experiment.title;
		return (
			<div className="record-thumbnail__title-preview">
				<span
					className="record-thumbnail__title-text"
					style={ { fontFamily: headingFont } }
				>
					{ titleText }
				</span>
			</div>
		);
	}

	if ( experiment.thumbnail_url ) {
		return (
			<img
				alt={ experiment.title }
				src={ experiment.thumbnail_url }
			/>
		);
	}

	return (
		<div className="record-thumbnail__empty" />
	);
}

export default function ExperimentRow( { experiment }: ExperimentRowProps ) {
	const isPersonalization = experiment.type === 'personalization';
	const typeLabel = TYPE_LABELS[ experiment.type ] || experiment.type;
	const relativeTime = ! isPersonalization ? getRelativeTime( experiment.start_time ) : '';

	return (
		<tr className="record-item">
			<td className="record-thumbnail">
				<div className="record-thumbnail-wrap">
					<ThumbnailCell experiment={ experiment } />
				</div>
			</td>
			<td className="record-name">
				<div className="record-cell-col">
					<div className="record-name__title record-cell-text-pri">
						<a href={ experiment.edit_url }>
							{ experiment.title || __( '(Untitled)', 'altis' ) }
						</a>
						{ ' ' }
						<StatusBadge status={ experiment.status } />
						{ ' ' }
						<SourceBadge
							source={ experiment.source }
							status={ experiment.status }
							title={ experiment.title }
						/>
					</div>
					<div className="record-name__meta record-cell-text-sec">
						<div className="record-name__type">{ typeLabel }</div>
						<div>
							{ sprintf(
								/* translators: %d: number of variants */
								_n( '%d variant', '%d variants', experiment.variant_count, 'altis' ),
								experiment.variant_count
							) }
						</div>
						{ experiment.usage_label && (
							<div>{ experiment.usage_label }</div>
						) }
						{ relativeTime && (
							<div className="record-name__date" title={ experiment.start_time || '' }>
								{ relativeTime }
							</div>
						) }
					</div>
				</div>
			</td>
			<td className="record-traffic">
				{ ! isPersonalization && experiment.conversion_rate !== null ? (
					<div className="record-cell-col">
						<div className="record-cell-text-pri">{ experiment.conversion_rate }%</div>
						<div className="record-cell-text-sec">{ __( 'Conv. Rate', 'altis' ) }</div>
					</div>
				) : null }
			</td>
			<td className="record-lift">
				{ ! isPersonalization && experiment.lift !== null ? (
					<div className="record-cell-col">
						<div className="record-cell-text-pri">
							{ experiment.lift > 0 ? '+' : '' }{ experiment.lift }%
						</div>
						<div className="record-cell-text-sec">{ __( 'Lift', 'altis' ) }</div>
					</div>
				) : null }
			</td>
			<td className="record-meta">
				<div className="record-cell-col">
					<div className="record-meta__links record-cell-text-pri">
						<a href={ experiment.edit_url }>
							{ __( 'Edit', 'altis' ) }
						</a>
					</div>
				</div>
			</td>
		</tr>
	);
}
