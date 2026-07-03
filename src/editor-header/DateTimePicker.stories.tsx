import * as React from 'react';

import { DateTimePicker } from './components/DateTimePicker';

type DateTimeDemoProps = {
	initialValue: number,
};

const DateTimeDemo = ( { initialValue }: DateTimeDemoProps ) => {
	const [ value, setValue ] = React.useState( initialValue );

	return (
		<div className="flex min-h-24 items-center gap-3 border-b border-gray-200 bg-white px-4">
			<DateTimePicker value={ value } onChange={ setValue } />
		</div>
	);
};

const meta = {
	title: 'Editor Controls/DateTimePicker',
	component: DateTimeDemo,
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

export const StartDate = {
	args: {
		initialValue: new Date( '2026-07-03T09:30:00-04:00' ).getTime(),
	},
};

export const EndDate = {
	args: {
		initialValue: new Date( '2026-07-24T17:00:00-04:00' ).getTime(),
	},
};
