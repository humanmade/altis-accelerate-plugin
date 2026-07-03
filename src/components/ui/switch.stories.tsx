import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Label } from './label';
import { Switch } from './switch';

const meta: Meta<typeof Switch> = {
	title: 'Components/UI/Switch',
	component: Switch,
};

export default meta;

type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const Checked: Story = {
	args: {
		defaultChecked: true,
	},
};

export const Disabled: Story = {
	args: {
		disabled: true,
	},
};

export const WithLabel: Story = {
	render: () => (
		<div className="flex items-center gap-2">
			<Switch defaultChecked id="self-optimize" />
			<Label htmlFor="self-optimize">Let the bandit self-optimize traffic</Label>
		</div>
	),
};
