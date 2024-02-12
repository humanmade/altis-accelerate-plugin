import React from 'react';

import { __ } from '@wordpress/i18n';

import './Search.scss';

interface Props {
	label?: string,
	placeholder?: string,
	onChange( event: React.ChangeEvent<HTMLInputElement> ): void,
}

export default function Search( props: Props ) {
	return (
		<label className="accelerate-search" htmlFor="accelerate-search">
			<span className="dashicons dashicons-search"></span>
			<span className="screen-reader-text">{ props?.label || __( 'Search', 'altis' ) }</span>
			<input
				className="search"
				id="accelerate-search"
				placeholder={ props?.placeholder || props?.label || __( 'Search', 'altis' ) }
				type="text"
				onChange={ props.onChange }
			/>
		</label>
	);
}
