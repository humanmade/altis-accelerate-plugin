import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import Welcome from './Welcome';

import '../index.scss';

const meta: Meta<typeof Welcome> = {
	title: 'Analytics/Welcome',
	component: Welcome,
	args: {
		user: {
			id: 11,
			name: 'Mara Ellis',
		},
	},
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
	render: args => (
		<div className="Dashboard tailwind p-6">
			<Welcome { ...args } />
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof Welcome>;

export const Default: Story = {};
