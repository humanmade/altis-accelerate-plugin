import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutGrid, List } from 'lucide-react';
import * as React from 'react';

import { ToggleGroup, ToggleGroupItem } from './toggle-group';

const meta: Meta<typeof ToggleGroup> = {
	title: 'Components/UI/ToggleGroup',
	component: ToggleGroup,
};

export default meta;

type Story = StoryObj<typeof ToggleGroup>;

export const Default: Story = {
	render: () => (
		<ToggleGroup defaultValue="list" type="single">
			<ToggleGroupItem aria-label="Map view" value="map">
				Map
			</ToggleGroupItem>
			<ToggleGroupItem aria-label="List view" value="list">
				List
			</ToggleGroupItem>
		</ToggleGroup>
	),
};

export const IconOnly: Story = {
	render: () => (
		<ToggleGroup defaultValue="list" size="sm" type="single">
			<ToggleGroupItem aria-label="Grid view" value="grid">
				<LayoutGrid aria-hidden="true" className="h-4 w-4" />
			</ToggleGroupItem>
			<ToggleGroupItem aria-label="List view" value="list">
				<List aria-hidden="true" className="h-4 w-4" />
			</ToggleGroupItem>
		</ToggleGroup>
	),
};

export const OutlineVariant: Story = {
	render: () => (
		<ToggleGroup defaultValue="7d" type="single" variant="outline">
			<ToggleGroupItem value="today">Today</ToggleGroupItem>
			<ToggleGroupItem value="7d">7 days</ToggleGroupItem>
			<ToggleGroupItem value="30d">30 days</ToggleGroupItem>
		</ToggleGroup>
	),
};
