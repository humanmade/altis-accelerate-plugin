import React from 'react';

import { __ } from '@wordpress/i18n';

import { BlockFillProps, StatsResult } from '../../utils/admin';

import BreakdownBlock from './BreakdownBlock';

export default function Browsers( props: BlockFillProps ) {
	const { data } = props;
	if ( ! data || ! data.stats || ! data.stats.by_browser ) {
		return null;
	}

	const stats = Object.keys( data.stats.by_browser ).map( key => ( {
		title: key,
		value: data.stats.by_browser[ key ],
	} ) );

	return (
		<BreakdownBlock
			header={ {
				title: __( 'Browser', 'altis' ),
				value: __( 'Views', 'altis' ),
			} }
			items={ stats }
			maxItems={ 5 }
			total={ data.stats.summary.views }
			onSelectItem={ item => props.onAddRule( {
				field: 'endpoint.Demographic.Model',
				value: item.title,
				type: 'string',
				operator: '=',
			} ) }
		/>
	);
}
