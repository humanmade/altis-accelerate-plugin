import React from 'react';

import { Button } from '@/components/ui/button';

const { __ } = wp.i18n;

function Suggest( props ) {
	const {
		prompt,
		onChange,
	} = props;

	const { Icon, useAiSummary } = window.AltisAi;
	const { loading, submitPrompt } = useAiSummary();

	const onClick = async () => {
		const res = await submitPrompt( prompt );

		// Clean up the result.
		const text = res.replace( /^"|"$/g, '' );
		onChange( text );
	};

	return (
		<Button
			disabled={ loading }
			size="sm"
			type="button"
			variant="outline"
			onClick={ onClick }
		>
			{ Icon && <Icon /> }
			Write it for me
		</Button>
	);
}

/**
 * Text field component.
 *
 * @param {React.ComponentProps} props The component props.
 * @returns {React.ReactNode} Text text field component.
 */
const TextInput = props => {
	const {
		allValues,
		compact,
		isEditable,
		suggestionPrompt,
		onChange,
		onRemove,
		value = '',
		index,
	} = props;

	const inputClassName = '!w-full !rounded-md !border !border-border !bg-background !px-3 !py-2 !text-sm placeholder:text-muted-foreground focus:!outline-none focus:!ring-1 focus:!ring-ring';

	const sharedProps = {
		autoFocus: ( allValues || [] ).length - 1 === index,
		placeholder: __( 'Type a variant…', 'altis' ),
		readOnly: ! isEditable,
		value,
		onChange: event => onChange( event.target.value ),
		onFocus: event => {
			const length = event.target.value.length * 2;
			event.target.setSelectionRange( length, length );
		},
		onKeyUp: event => {
			if (
				isEditable &&
				value === '' &&
				event.target.value === '' &&
				(
					( event.key && event.key === 'Backspace' ) ||
					( event.which && event.which === 8 )
				)
			) {
				onRemove();
			}
		},
	};

	return (
		<>
			{ compact ? (
				<input
					{ ...sharedProps }
					className={ inputClassName }
					type="text"
				/>
			) : (
				<textarea
					{ ...sharedProps }
					className={ `${ inputClassName } !resize-y` }
					rows={ 3 }
				/>
			) }
			{ ( isEditable && value === '' && suggestionPrompt && window.AltisAi ) && (
				<Suggest
					prompt={ suggestionPrompt }
					onChange={ onChange }
				/>
			) }
		</>
	);
};

export default TextInput;
