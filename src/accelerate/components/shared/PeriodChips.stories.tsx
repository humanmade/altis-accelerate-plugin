import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { PeriodChips } from './PeriodChips';
import type { Period } from './PeriodChips';

const meta: Meta<typeof PeriodChips> = {
	title: 'Components/Admin/PeriodChips',
	component: PeriodChips,
};

export default meta;

type Story = StoryObj<typeof PeriodChips>;

const PeriodChipsDemo = ( { initial = 'P7D' as Period }: { initial?: Period } ) => {
	const [ value, setValue ] = React.useState<Period>( initial );
	return <PeriodChips value={ value } onChange={ setValue } />;
};

export const Default: Story = {
	render: () => <PeriodChipsDemo />,
};

export const NinetyDaySelected: Story = {
	render: () => <PeriodChipsDemo initial="P90D" />,
};
