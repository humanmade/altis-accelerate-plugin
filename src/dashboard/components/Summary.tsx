import React from 'react';
import { __ } from '@wordpress/i18n';

import { StatsResult } from '../../utils/admin';

import './Summary.css';

const formatBigNumber = ( views: number ) => {
	if ( views < 1000 ) {
		return views;
	}

	return `${ Math.floor( views / 1000 ) }.${ Math.floor( ( views % 1000 ) / 100 ) }k`;
}

interface Props {
	data?: StatsResult,
}

export default function Summary( props: Props ) {
	if ( ! props.data ) {
		return null;
	}

	return (
		<div className="Summary">
			<h2 className="screen-reader-text">{ __( 'Summary', 'altis' ) }</h2>
			<div className="Summary__block">
				<h3>{ __( 'Uniques', 'altis' ) }</h3>
				<p className="Summary__statistic">{ formatBigNumber( props.data.stats.summary.visitors ) }</p>
			</div>
			<div className="Summary__block">
				<h3>{ __( 'Views', 'altis' ) }</h3>
				<p className="Summary__statistic">{ formatBigNumber( props.data.stats.summary.views ) }</p>
			</div>
			<div className="Summary__block">
				<h3>{ __( 'Views per unique', 'altis' ) }</h3>
				<p className="Summary__statistic">
					{
						Math.round(
							props.data.stats.summary.views / Math.max( props.data.stats.summary.visitors, 1 ) * 10
						) / 10
					}
				</p>
			</div>
		</div>
	)
}
