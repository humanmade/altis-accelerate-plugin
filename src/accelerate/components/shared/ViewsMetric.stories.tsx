import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { ViewsMetric } from './ViewsMetric';

const meta: Meta<typeof ViewsMetric> = {
	title: 'Components/Admin/ViewsMetric',
	component: ViewsMetric,
	args: {
		views: 6050,
		period: 'P7D',
		histogram: [
			{
				index: 0,
				count: 610,
			},
			{
				index: 1,
				count: 720,
			},
			{
				index: 2,
				count: 860,
			},
			{
				index: 3,
				count: 810,
			},
			{
				index: 4,
				count: 920,
			},
			{
				index: 5,
				count: 970,
			},
			{
				index: 6,
				count: 1160,
			},
		],
	},
};

export default meta;

type Story = StoryObj<typeof ViewsMetric>;

export const Default: Story = {};

export const Loading: Story = {
	args: {
		loading: true,
	},
};

export const CollectingData: Story = {
	args: {
		views: 0,
		histogram: [],
	},
};
