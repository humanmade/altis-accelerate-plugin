import React from 'react';

import {
	NUMERIC_OPERATIONS,
	STRING_OPERATIONS,
} from '../../data/constants';

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
	type: 'string' | 'number',
}

/**
 * Operator selector.
 */
export default function SelectOperator( props: Props ) {
	const {
		type = 'string',
	} = props;

	let options = type === 'number' ? NUMERIC_OPERATIONS : STRING_OPERATIONS;

	return (
		<select { ...props }>
			{ Object.entries( options ).map( ( [ value, label ] ) => (
				<option key={ value } value={ value }>{ label }</option>
			) ) }
		</select>
	);
}
