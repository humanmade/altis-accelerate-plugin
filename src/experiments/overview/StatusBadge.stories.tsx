import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { StatusBadge } from './components/StatusBadge';

const meta: Meta<typeof StatusBadge> = {
	title: 'Experiments/StatusBadge',
	component: StatusBadge,
	parameters: {
		layout: 'centered',
	},
	render: ( args: React.ComponentProps<typeof StatusBadge> ) => <StatusBadge { ...args } />,
};

export default meta;

type Story = StoryObj<typeof StatusBadge>;

export const Running: Story = {
	args: {
		status: 'running',
	},
};

export const Paused: Story = {
	args: {
		status: 'paused',
	},
};

export const Completed: Story = {
	args: {
		status: 'completed',
	},
};

export const Draft: Story = {
	args: {
		status: 'draft',
	},
};
