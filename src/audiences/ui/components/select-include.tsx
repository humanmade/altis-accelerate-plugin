import React from 'react';

import { __ } from '@wordpress/i18n';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

interface Props {
	label: string,
	name?: string,
	readOnly?: boolean,
	value?: string,
	onChange: ( e: React.ChangeEvent<HTMLSelectElement> ) => void,
}

/**
 * Include selector.
 */
export default function SelectInclude( props: Props ) {
	const { label, readOnly, value, onChange } = props;

	// Create a synthetic event to maintain compatibility with existing handlers
	const handleValueChange = ( newValue: string ) => {
		onChange( {
			target: { value: newValue },
		} as React.ChangeEvent<HTMLSelectElement> );
	};

	return (
		<Select disabled={ readOnly } value={ value } onValueChange={ handleValueChange }>
			<SelectTrigger className="w-auto">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="any">
					{ __( 'Match any of the following', 'altis' ) } { label }
				</SelectItem>
				<SelectItem value="all">
					{ __( 'Match all of the following', 'altis' ) } { label }
				</SelectItem>
			</SelectContent>
		</Select>
	);
}

SelectInclude.defaultProps = {
	label: '',
};
