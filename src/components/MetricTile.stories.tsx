import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { computeDelta } from '../lib/utils';

import { MetricTile } from './MetricTile';
import { TileGrid } from './TileGrid';

const meta: Meta<typeof MetricTile> = {
	title: 'Components/MetricTile',
	component: MetricTile,
	args: {
		label: 'Page views',
		value: '12,418',
	},
};

export default meta;

type Story = StoryObj<typeof MetricTile>;

export const Default: Story = {
	render: args => (
		<div className="max-w-xs">
			<MetricTile { ...args } />
		</div>
	),
};

export const SummaryStrip: Story = {
	render: () => (
		<TileGrid variant="metric">
			<MetricTile label="Page views" value="12,418" />
			<MetricTile delta={ computeDelta( 412, 318 ) } deltaTone="positive" label="Visitors" value="412" />
			<MetricTile delta={ computeDelta( 87, 142 ) } deltaTone="negative" label="Bounce rate" value="61%" />
			<MetricTile delta={ computeDelta( 5, 0 ) } deltaTone="neutral" hint="No prior data" label="New metric" value="5" />
		</TileGrid>
	),
};

export const WithHint: Story = {
	args: {
		label: 'Engaged time',
		labelTitle: 'Average active reading time during the selected period.',
		value: '2m 14s',
		hint: 'Median active time across matched content.',
		delta: computeDelta( 134, 121 ),
		deltaLabel: 'vs prior',
		deltaTone: 'positive',
	},
	render: args => (
		<div className="max-w-sm">
			<MetricTile { ...args } />
		</div>
	),
};
