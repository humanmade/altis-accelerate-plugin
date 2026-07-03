import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Input } from './input';
import { Label } from './label';
import { Switch } from './switch';

const meta: Meta<typeof Label> = {
	title: 'Components/UI/Label',
	component: Label,
};

export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {
	args: {
		children: 'Experiment name',
	},
};

export const WithInput: Story = {
	render: () => (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor="experiment-name">Experiment name</Label>
			<Input id="experiment-name" placeholder="Homepage hero test" />
		</div>
	),
};

export const WithSwitch: Story = {
	render: () => (
		<div className="flex items-center gap-2">
			<Switch id="auto-optimize" />
			<Label htmlFor="auto-optimize">Auto-optimize traffic split</Label>
		</div>
	),
};
