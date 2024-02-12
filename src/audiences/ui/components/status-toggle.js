import React from 'react';

const { ToggleControl } = wp.components;
const { __ } = wp.i18n;

/**
 * Audience status toggle.
 *
 * @param {Object} props Component props.
 * @returns {*} Status toggle component.
 */
const StatusToggle = props => {
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
