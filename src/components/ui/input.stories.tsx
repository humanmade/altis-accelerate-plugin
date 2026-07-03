import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Input } from './input';

const meta: Meta<typeof Input> = {
	title: 'Components/UI/Input',
	component: Input,
	args: {
		placeholder: 'Search campaigns…',
	},
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithValue: Story = {
	args: {
		defaultValue: 'Spring sale banner',
	},
};

export const Disabled: Story = {
	args: {
		defaultValue: 'Archived experiment',
		disabled: true,
	},
};

export const Types: Story = {
	render: () => (
		<div className="flex flex-col gap-3">
			<Input placeholder="you@company.com" type="email" />
			<Input placeholder="Traffic allocation %" type="number" />
			<Input placeholder="Search audiences" type="search" />
		</div>
	),
};
