import type { Meta, StoryObj } from '@storybook/react-vite';
import { Filter } from 'lucide-react';
import * as React from 'react';

import { CompactSelect } from './CompactSelect';

const meta: Meta<typeof CompactSelect> = {
	title: 'Components/CompactSelect',
	component: CompactSelect,
	args: {
		label: 'Group by',
		value: 'source',
		options: [
			{
				value: 'source',
				label: 'Source',
			},
			{
				value: 'campaign',
				label: 'Campaign',
			},
			{
				value: 'medium',
				label: 'Medium',
			},
		],
		onChange: () => undefined,
	},
};

export default meta;

type Story = StoryObj<typeof CompactSelect>;

export const Default: Story = {
	render: args => (
		<div className="max-w-xs">
			<CompactSelect { ...args } />
		</div>
	),
};

export const WithLeadingIcon: Story = {
	args: {
		label: 'Time range',
		value: '7d',
		leadingIcon: <Filter className="h-3.5 w-3.5" />,
		options: [
			{
				value: '24h',
				label: 'Last 24 hours',
			},
			{
				value: '7d',
				label: 'Last 7 days',
			},
			{
				value: '30d',
				label: 'Last 30 days',
			},
		],
	},
	render: args => (
		<div className="max-w-xs">
			<CompactSelect { ...args } />
		</div>
	),
};

export const LongLabels: Story = {
	args: {
		label: 'Sort by',
		value: 'conversion-rate',
		options: [
			{
				value: 'pageviews',
				label: 'Page views (descending)',
			},
			{
				value: 'conversion-rate',
				label: 'Conversion rate (descending)',
			},
			{
				value: 'bounce-rate',
				label: 'Bounce rate (ascending)',
			},
		],
	},
	render: args => (
		<div className="max-w-xs">
			<CompactSelect { ...args } />
		</div>
	),
};
