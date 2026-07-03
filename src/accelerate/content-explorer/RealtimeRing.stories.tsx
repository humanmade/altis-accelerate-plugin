import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { RealtimeRing } from './RealtimeRing';

const meta: Meta<typeof RealtimeRing> = {
	title: 'Analytics/RealtimeRing',
	component: RealtimeRing,
	args: {
		active: true,
		periodSeconds: 30,
		tick: 1,
		title: 'Refreshes every 30 seconds',
	},
	render: args => (
		<div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
			<RealtimeRing { ...args } />
			<span>Realtime</span>
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof RealtimeRing>;

export const Active: Story = {};

export const Idle: Story = {
	args: {
		active: false,
	},
};
