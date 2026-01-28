import React from 'react';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import styled from 'styled-components';

import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { store } from '../../data';
import { Audience, Estimate as TEstimate } from '../../types';

import PieChart from './pie-chart';

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
		flex: 0 1 70px;
		margin-right: 20px;
		max-width: 3.85rem;
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
	 * Props for the pie chart component.
	 */
	pieChartProps?: Record<string, unknown>;

	/**
	 * Whether to show the pie chart.
	 */
	showPie?: boolean;

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
		pieChartProps = {},
		showPie = true,
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
			{ showPie && (
				<PieChart
					className="audience-estimate__percentage"
					isLoading={ estimate.isLoading }
					percent={ estimate.isLoading ? 0 : percent }
					{ ...pieChartProps }
				/>
			) }
			<div className="audience-estimate__totals">
				{ sparkline && (
					<Sparklines
						// @ts-ignore
						className="audience-estimate__sparkline"
						data={ estimate.histogram.map( item => item.count ) }
						height={ 60 }
						preserveAspectRatio="xMidYMid meet"
						width={ 220 }
					>
						<SparklinesLine color="#2271b1" style={ { strokeWidth: 5 } } />
					</Sparklines>
				) }
				{ showTotals && (
					<p className="audience-estimate__count">
						{ estimate.isLoading && (
							<span>{ __( 'Loading estimate', 'altis' ) }…</span>
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

	if ( ! audience ) {
		return null;
	}
	const estimate = useSelect( select => select( store ).getEstimate( audience ), [ audience ] );

	return <Estimate { ...props } estimate={ estimate } />;
}
