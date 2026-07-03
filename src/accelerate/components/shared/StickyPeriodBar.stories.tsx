import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import type { Duration } from '../../../utils/admin';

import { StickyPeriodBar } from './StickyPeriodBar';

const meta: Meta<typeof StickyPeriodBar> = {
	title: 'Components/Admin/StickyPeriodBar',
	component: StickyPeriodBar,
	parameters: {
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof StickyPeriodBar>;

const StickyPeriodBarDemo = ( { initial = 'P7D' as Duration }: { initial?: Duration } ) => {
	const [ period, setPeriod ] = React.useState<Duration>( initial );
	const [ isFullscreen, setIsFullscreen ] = React.useState( false );
	return (
		<StickyPeriodBar
			isFullscreen={ isFullscreen }
			period={ period }
			realtimeTick={ 0 }
			onChange={ setPeriod }
			onToggleFullscreen={ () => setIsFullscreen( f => ! f ) }
		/>
	);
};

export const Default: Story = {
	render: () => <StickyPeriodBarDemo />,
};

export const Realtime: Story = {
	render: () => <StickyPeriodBarDemo initial="PT30M" />,
};
