import React from 'react';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import styled from 'styled-components';

import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { store } from '../../data';
import { Audience, Estimate as TEstimate } from '../../types';

import { Spinner } from '@/components/ui/spinner';
import { StepIndicator } from '@/components/ui/step-indicator';

// Define props interface for the styled component
interface StyledEstimateProps {
	isLoading?: boolean;
}

const StyledEstimate = styled.div<StyledEstimateProps>`
	display: flex;
	flex-wrap: wrap;
	margin: 0;

	.audience-estimate__title {
		flex: 0 0 100%;
		margin: 0 0 20px;
	}

	.audience-estimate__percentage {
		flex: 0 1 100px;
		margin-right: 20px;
		max-width: 5.5rem;
	}

	.audience-estimate__sparkline,
	.audience-estimate__percentage {
		opacity: ${ props => props.isLoading ? 0.7 : 1 };
		transition: opacity ease-in-out .3s;
	}

	.audience-estimate__totals {
		flex: 2;
	}

	.audience-estimate__totals svg {
		width: 220px;
		height: 60px;
		max-width: 220px;
		margin-top: 5px;
		margin-bottom: 10px;
	}

	.audience-estimate__totals p {
		margin: 0;
	}

	.audience-estimate__totals strong {
		margin-right: 2px;
	}
`;

interface Props {
	/**
	 * Estimate data.
	 */
	estimate?: TEstimate;

	/**
	 * Whether to show the step indicator.
	 */
	showIndicator?: boolean;

	/**
	 * Whether to show total count.
	 */
	showTotals?: boolean;

	/**
	 * Whether to show a sparkline of historical counts.
	 */
	sparkline?: boolean;

	/**
	 * Title to display above the estimate.
	 */
	title?: string;
}
/**
 * Audience size estimator.
 *
 * @param {Object} props Component props.
 * @returns {React.ReactNode} Estimation component.
 */
export default function Estimate( props: Props ) {
	const {
		estimate,
		showIndicator = true,
		showTotals = true,
		sparkline = false,
		title = '',
	} = props;

	if ( ! estimate ) {
		return null;
	}

	const percent = estimate.total ? Math.round( ( estimate.count / estimate.total ) * 100 ) : 0;

	return (
		<StyledEstimate className="audience-estimate" { ...props } isLoading={ estimate.isLoading }>
			{ title && (
				<h3 className="audience-estimate__title">{ title }</h3>
			) }
			{ showIndicator && (
				<StepIndicator
					className="audience-estimate__percentage"
					isLoading={ estimate.isLoading }
					percent={ estimate.isLoading ? 0 : percent }
				/>
			) }
			<div className="audience-estimate__totals">
				{ sparkline && (
					<Sparklines
						// @ts-ignore
						className="audience-estimate__sparkline"
						data={ estimate.histogram.map( item => item.count ) }
						preserveAspectRatio="xMidYMid meet"
					>
						<SparklinesLine color="var(--color-brand)" style={ { strokeWidth: 5 } } />
					</Sparklines>
				) }
				{ showTotals && (
					<p className="audience-estimate__count">
						{ estimate.isLoading && (
							<span className="tailwind">
								<span className="inline-flex items-center gap-1.5">
									<Spinner className="size-3" />
									{ __( 'Loading estimate', 'altis' ) }…
								</span>
							</span>
						) }
						{ ! estimate.isLoading && (
							<>
								<strong>{ estimate.count }</strong>
								{ ' ' }
								<span>{ __( 'uniques in the last 7 days', 'altis' ) }</span>
							</>
						) }
					</p>
				) }
			</div>
		</StyledEstimate>
	);
}

interface DynamicProps {
	audience?: Audience
}

/**
 * Dynamic Audience size estimator with data fetching.
 *
 * @param {Object} props Component props.
 * @returns {React.ReactNode} Estimation component.
 */
export function DynamicEstimate( props: DynamicProps & Props ) {
	const {
		audience,
	} = props;

	const estimate = useSelect(
		select => audience ? select( store ).getEstimate( audience ) : undefined,
		[ audience ]
	);

	if ( ! audience ) {
		return null;
	}

	return <Estimate { ...props } estimate={ estimate } />;
}
