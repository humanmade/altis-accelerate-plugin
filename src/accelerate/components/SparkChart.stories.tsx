import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import SparkChart from './SparkChart';

import { contentDiffs } from '@/fixtures';

const meta: Meta<typeof SparkChart> = {
	title: 'Components/Admin/SparkChart',
	component: SparkChart,
	args: {
		histogram: contentDiffs[101].current.by_date,
		period: 'P7D',
		maxViews: 1200,
	},
};

export default meta;

type Story = StoryObj<typeof SparkChart>;

export const Default: Story = {};

export const Realtime: Story = {
	args: {
		histogram: contentDiffs[201].current.by_date,
		period: 'PT30M',
	},
};

export const Empty: Story = {
	args: {
		histogram: [],
	},
};
