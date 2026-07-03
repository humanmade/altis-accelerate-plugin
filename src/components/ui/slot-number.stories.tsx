import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { SlotNumber } from './slot-number';

const meta: Meta<typeof SlotNumber> = {
	title: 'Components/UI/SlotNumber',
	component: SlotNumber,
	args: {
		value: '1,284',
	},
};

export default meta;

type Story = StoryObj<typeof SlotNumber>;

export const Default: Story = {
	render: args => <SlotNumber { ...args } className="text-2xl font-semibold text-foreground" />,
};

const RefreshingDemo = () => {
	const [ value, setValue ] = React.useState( '1,284' );

	React.useEffect( () => {
		const values = [ '1,284', '1,297', '1,312', '999', '1,006' ];
		let i = 0;
		const timer = setInterval( () => {
			i = ( i + 1 ) % values.length;
			setValue( values[ i ] );
		}, 1500 );
		return () => clearInterval( timer );
	}, [] );

	return <SlotNumber className="text-2xl font-semibold text-foreground" value={ value } />;
};

export const RefreshingVisitorCount: Story = {
	render: () => <RefreshingDemo />,
};
