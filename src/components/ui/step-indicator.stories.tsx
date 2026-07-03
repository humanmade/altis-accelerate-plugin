import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { StepIndicator } from './step-indicator';

const meta: Meta<typeof StepIndicator> = {
	title: 'Components/UI/StepIndicator',
	component: StepIndicator,
};

export default meta;

type Story = StoryObj<typeof StepIndicator>;

export const Default: Story = {
	args: {
		percent: 40,
	},
};

export const NearComplete: Story = {
	args: {
		percent: 90,
	},
};

export const Loading: Story = {
	args: {
		isLoading: true,
		percent: 0,
	},
};
