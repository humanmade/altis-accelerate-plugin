import React from 'react';
import { __ } from '@wordpress/i18n';

import { StatsResult } from '../../utils/admin';

import './Summary.css';
import { Card } from './Card';

const formatBigNumber = ( views: number ) => {
	if ( views < 1000 ) {
		return views;
	}

	return `${ Math.floor( views / 1000 ) }.${ Math.floor( ( views % 1000 ) / 100 ) }k`;
}

type SummaryProps = {
	title: string,
	value: number,
	relative?: number,
	// data?: StatsResult,
}

function SummaryItem( props: SummaryProps ) {
	return (
		<Card>
			<h3 className="text-sm text-gray-500">
				{ props.title }
			</h3>
			<div className="flex items-baseline justify-between">
				<p className="text-lg font-semibold text-gray-900">
					{ formatBigNumber( props.value ) }
				</p>
				{ props.relative !== undefined && (
					<p className="flex items-center space-x-1 text-sm">
						<span className="font-medium text-gray-900">
							{ props.relative > 0 ? '+' : '' }
							{ formatBigNumber( props.relative ) }
						</span>
						<span className="text-gray-500">
							{ props.relative > 0 ? '+' : '' }
							{ Math.round( ( props.relative / props.value ) * 1000 ) / 10 }%
						</span>
					</p>
				) }
				{ /* Sparkline */ }
				{/* { props.data && () } */}
			</div>
		</Card>
	);
}

interface Props {
	data?: StatsResult,
}

export default function Summary( props: Props ) {
	if ( ! props.data ) {
		return null;
	}

	return (
		<div className="mx-2 lg:mx-16 grid gap-6 grid-cols-3">
			{/* <SummaryItem
				title={ __( 'Real-time visitors', 'altis' ) }
				value={ 120 }
				// relative={ props.data.stats.summary.visitors - props.data.stats.previous.summary.visitors }
			/> */}
			<SummaryItem
				title={ __( 'Visitors', 'altis' ) }
				value={ props.data.stats.summary.visitors }
				// relative={ props.data.stats.summary.visitors - props.data.stats.previous.summary.visitors }
			/>
			<SummaryItem
				title={ __( 'Page views', 'altis' ) }
				value={ props.data.stats.summary.views }
				// relative={ props.data.stats.summary.views - props.data.stats.previous.summary.views }
			/>
			<SummaryItem
				title={ __( 'Views per unique', 'altis' ) }
				value={ Math.round( props.data.stats.summary.views / Math.max( props.data.stats.summary.visitors, 1 ) * 10 ) / 10 }
				// relative={ Math.round( ( props.data.stats.summary.views / Math.max( props.data.stats.summary.visitors, 1 ) - props.data.stats.previous.summary.views / Math.max( props.data.stats.previous.summary.visitors, 1 ) ) * 10 ) / 10 }
			/>
		</div>
	)
}
