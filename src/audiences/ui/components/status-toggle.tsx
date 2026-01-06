import React from 'react';

import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

interface Props {
	disabled?: boolean,
	status: string,
	onChange: ( value: boolean ) => void,
}

/**
 * Audience status toggle.
 *
 * @param {Object} props Component props.
 * @returns {*} Status toggle component.
 */
const StatusToggle = ( props: Props ) => {
	const {
		disabled,
		status,
		onChange,
	} = props;

	const helpText = status === 'publish'
		? __( 'Audience is active', 'altis' )
		: __( 'Audience is inactive', 'altis' );

	return (
		<ToggleControl
			checked={ status === 'publish' }
			disabled={ disabled }
			help={ helpText }
			label={ __( 'Active', 'altis' ) }
			onChange={ onChange }
		/>
	);
};

export default StatusToggle;
