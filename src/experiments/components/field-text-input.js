import React from 'react';

const {
	Button,
	TextareaControl,
} = wp.components;
const { __ } = wp.i18n;

function Suggest( props ) {
	const {
		prompt,
		onChange
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
			icon={ Icon }
			isBusy={ loading }
			isSecondary
			type="button"
			onClick={ onClick }
		>
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
		isEditable,
		suggestionPrompt,
		onChange,
		onRemove,
		value = '',
		index,
	} = props;

	return (
		<>
			<TextareaControl
				autoFocus={ ( allValues || [] ).length - 1 === index }
				label={ null }
				placeholder={ __( 'Enter another value here.', 'altis' ) }
				readOnly={ ! isEditable }
				rows={ 3 }
				value={ value }
				onChange={ onChange }
				onFocus={ event => {
					const length = event.target.value.length * 2;
					event.target.setSelectionRange( length, length );
				} }
				onKeyUp={ event => {
					if (
						value === '' &&
						event.target.value === '' &&
						(
							( event.key && event.key === 'Backspace' ) ||
							( event.which && event.which === 8 )
						)
					) {
						onRemove();
					}
				} }
			/>
			{ ( value === '' && suggestionPrompt && window.AltisAi ) && (
				<Suggest
					prompt={ suggestionPrompt }
					onChange={ onChange }
				/>
			) }
		</>
	);
};

export default TextInput;
