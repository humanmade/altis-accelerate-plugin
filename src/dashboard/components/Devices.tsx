import React from 'react';

import { __ } from '@wordpress/i18n';

import { BlockFillProps, StatsResult } from '../../utils/admin';

import BreakdownBlock from './BreakdownBlock';

export default function Devices( props: BlockFillProps ) {
	const { data } = props;
	if ( ! data ) {
		return null;
	}

	const stats = Object.keys( data.stats.by_os || {} ).map( key => ( {
		title: key,
		value: data.stats.by_os[ key ],
	} ) );

	return (
		<BreakdownBlock
			header={ {
				title: __( 'Operating System', 'altis' ),
				value: __( 'Views', 'altis' ),
			} }
			items={ stats }
			maxItems={ 5 }
			total={ data.stats.summary.views }
			onSelectItem={ item => props.onAddRule( {
				field: 'endpoint.Demographic.Platform',
				value: item.title,
				type: 'string',
				operator: '=',
			} ) }
		/>
	);
}
