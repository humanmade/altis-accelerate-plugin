import React from 'react';

import { __ } from '@wordpress/i18n';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Caption } from '@/components/ui/typography';

interface Props {
	compact?: boolean,
	disabled?: boolean,
	status: string,
	onChange: ( value: boolean ) => void,
}

/**
 * Audience status toggle.
 *
 * @param {Object} props Component props.
 * @returns {*} Status toggle component.
 */
const StatusToggle = ( props: Props ) => {
	const {
		compact = false,
		disabled,
		status,
		onChange,
	} = props;

	const isActive = status === 'publish';
	const helpText = isActive
		? __( 'Audience is active', 'altis' )
		: __( 'Audience is inactive', 'altis' );

	return (
		<div className="tailwind">
			<div className="flex items-center space-x-3">
				<Switch
					checked={ isActive }
					disabled={ disabled }
					id="audience-status"
					onCheckedChange={ onChange }
				/>
				<Label htmlFor="audience-status">
					{ __( 'Active', 'altis' ) }
				</Label>
			</div>
			{ ! compact && (
				<Caption className="mt-0.5 ml-11">
					{ helpText }
				</Caption>
			) }
		</div>
	);
};

export default StatusToggle;
