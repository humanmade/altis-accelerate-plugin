import React from 'react';

import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

import './AddNew.css';

interface Props {
	label?: string,
	onClick: Function,
}

export default function AddNew( props: Props ) {
	return (
		<Button
			className="AddNew dashicons-before dashicons-plus"
			isPrimary
			onClick={ () => props.onClick() }
		>
			{ props.label ? props.label : __( 'Add New', 'altis' ) }
		</Button>
	);
}
