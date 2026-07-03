import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { SourceBadge } from './components/SourceBadge';

const meta: Meta<typeof SourceBadge> = {
	title: 'Experiments/SourceBadge',
	component: SourceBadge,
	parameters: {
		layout: 'centered',
	},
};

export default meta;

type Story = StoryObj<typeof SourceBadge>;

export const AiGenerated: Story = {
	args: {
		source: 'ai',
		status: 'completed',
		title: 'AI: Picnic guide featured image',
	},
};

export const AutopilotRunning: Story = {
	args: {
		source: 'autopilot',
		status: 'running',
		title: 'Returning reader newsletter offer',
	},
};

export const ManualExperiment: Story = {
	args: {
		source: 'demo',
		status: 'running',
		title: 'Tomato tart CTA',
	},
};
