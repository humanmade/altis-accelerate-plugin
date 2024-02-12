import React from 'react';

const { __ } = wp.i18n;

/**
 * Audience listing headers.
 *
 * @param {Object} props Component props.
 * @returns {React.ReactNode} List row headers component.
 */
const ListRowHeading = props => (
	<tr>
		<th className="manage-column column-order" scope="col">
			{ __( 'Priority', 'altis' ) }
		</th>
		<th className="manage-column column-title column-primary" scope="col">
			{ __( 'Title', 'altis' ) }
		</th>
		<th className="manage-column column-active" scope="col">
			{ __( 'Status', 'altis' ) }
		</th>
		<th className="manage-column column-estimate" scope="col">
			{ __( 'Size', 'altis' ) }
		</th>
		{ props.isSelectMode && (
			<th className="manage-column column-select" scope="col">&nbsp;</th>
		) }
	</tr>
);

export default ListRowHeading;
