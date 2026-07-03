import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { MetricTile } from './MetricTile';
import { TileGrid } from './TileGrid';

function PanelTile( { title }: { title: string } ) {
	return (
		<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
			<p className="!m-0 !text-sm !font-medium !text-gray-900">{ title }</p>
			<div className="mt-4 h-32 rounded-md bg-muted" />
		</div>
	);
}

const meta: Meta<typeof TileGrid> = {
	title: 'Components/TileGrid',
	component: TileGrid,
};

export default meta;

type Story = StoryObj<typeof TileGrid>;

export const MetricStrip: Story = {
	render: () => (
		<TileGrid variant="metric">
			<MetricTile label="Page views" value="12,418" />
			<MetricTile label="Visitors" value="412" />
			<MetricTile label="Bounce rate" value="61%" />
			<MetricTile label="Conversion rate" value="3.4%" />
		</TileGrid>
	),
};

export const PanelOddCount: Story = {
	render: () => (
		<TileGrid variant="panel">
			<PanelTile title="Top content" />
			<PanelTile title="Engagement" />
			<PanelTile title="Audiences" />
		</TileGrid>
	),
};

export const PanelEvenCount: Story = {
	render: () => (
		<TileGrid variant="panel">
			<PanelTile title="Top content" />
			<PanelTile title="Engagement" />
			<PanelTile title="Audiences" />
			<PanelTile title="Experiments" />
		</TileGrid>
	),
};
