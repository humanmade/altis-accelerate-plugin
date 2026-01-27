import React from 'react';

import {
	NUMERIC_OPERATIONS,
	STRING_OPERATIONS,
} from '../../data/constants';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

interface Props {
	className?: string,
	disabled?: boolean,
	name?: string,
	type: 'string' | 'number',
	value?: string,
	onChange: ( e: React.ChangeEvent<HTMLSelectElement> ) => void,
}

/**
 * Operator selector.
 */
export default function SelectOperator( props: Props ) {
	const {
		className,
		disabled,
		type = 'string',
		value,
		onChange,
	} = props;

	const options = type === 'number' ? NUMERIC_OPERATIONS : STRING_OPERATIONS;

	// Create a synthetic event to maintain compatibility with existing handlers
	const handleValueChange = ( newValue: string ) => {
		onChange( {
			target: { value: newValue },
		} as React.ChangeEvent<HTMLSelectElement> );
	};

	return (
		<Select disabled={ disabled } value={ value } onValueChange={ handleValueChange }>
			<SelectTrigger className={ className }>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{ Object.entries( options ).map( ( [ optValue, label ] ) => (
					<SelectItem key={ optValue } value={ optValue }>
						{ label }
					</SelectItem>
				) ) }
			</SelectContent>
		</Select>
	);
}
