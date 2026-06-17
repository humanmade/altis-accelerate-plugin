import React from 'react';

import { __ } from '@wordpress/i18n';

interface Props {
	isSelectMode: boolean;
}

/**
 * Audience listing headers.
 */
const ListRowHeading = ( props: Props ) => (
	<div className="flex items-center py-3 border-b border-border text-sm font-medium text-muted-foreground">
		<div className="w-12 shrink-0">
		</div>
		<div className="flex-1 min-w-0">
			{ __( 'Audience Name (Priority-ranked & traffic coverage %)', 'altis' ) }
		</div>
		<div className="w-48 shrink-0">
			{ __( 'Status', 'altis' ) }
		</div>
		{ props.isSelectMode && (
			<div className="w-24 shrink-0">&nbsp;</div>
		) }
	</div>
);

export default ListRowHeading;
