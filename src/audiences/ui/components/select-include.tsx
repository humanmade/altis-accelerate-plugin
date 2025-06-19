import { __ } from '@wordpress/i18n';
import React from 'react';
import styled from 'styled-components';

const StyledSelect = styled.select`
	vertical-align: middle;
`;

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
	label: string,
}

/**
 * Include selector.
 */
export default function SelectInclude( props: Props ) {
	return (
		<StyledSelect { ...props }>
			<option value="any">{ __( 'Match any of the following', 'altis' ) } { props.label }</option>
			<option value="all">{ __( 'Match all of the following', 'altis' ) } { props.label }</option>
		</StyledSelect>
	);
}

SelectInclude.defaultProps = {
	label: '',
};
