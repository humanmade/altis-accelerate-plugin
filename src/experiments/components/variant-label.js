import React from 'react';

import { VariantLabelContainer } from '.';

const { __ } = wp.i18n;
const { Icon } = wp.components;

/**
 * Variant label component.
 *
 * @param {React.ComponentProps} props The component props.
 * @returns {React.ReactNode} Variant label component.
 */
const VariantLabel = props => {
	const {
		label,
		isEditable,
		onRemove,
	} = props;

	return (
		<VariantLabelContainer>
			{ /* eslint-disable-next-line jsx-a11y/label-has-for */ }
			<label className="components-base-control__label">{ label }</label>
			{ isEditable && (
				<Icon
					className='components-base-control__icon'
					icon='remove'
					title={ __( 'Remove', 'altis' ) }
					onClick={ onRemove }
				/>
			) }
		</VariantLabelContainer>
	);
};

export default VariantLabel;
