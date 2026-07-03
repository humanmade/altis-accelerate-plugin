import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { Calendar } from './calendar';

const meta: Meta<typeof Calendar> = {
	title: 'Components/UI/Calendar',
	component: Calendar,
};

export default meta;

type Story = StoryObj<typeof Calendar>;

const SingleDateDemo = () => {
	const [ date, setDate ] = React.useState<Date | undefined>( new Date( '2026-07-03' ) );
	return (
		<Calendar
			mode="single"
			selected={ date }
			onSelect={ setDate }
		/>
	);
};

export const Default: Story = {
	render: () => <SingleDateDemo />,
};

const RangeDemo = () => {
	const [ range, setRange ] = React.useState<DateRange | undefined>( {
		from: new Date( '2026-06-25' ),
		to: new Date( '2026-07-02' ),
	} );
	return (
		<Calendar
			mode="range"
			selected={ range }
			onSelect={ setRange }
		/>
	);
};

export const DateRangePicker: Story = {
	render: () => <RangeDemo />,
};

export const OutsideDaysHidden: Story = {
	render: () => (
		<Calendar
			mode="single"
			selected={ new Date( '2026-07-03' ) }
			showOutsideDays={ false }
		/>
	),
};
