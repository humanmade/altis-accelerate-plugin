import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import Loader from './Loader';

import '../index.scss';

const meta: Meta<typeof Loader> = {
	title: 'Components/Admin/Loader',
	component: Loader,
	args: {
		isGiant: false,
		isLight: false,
	},
};

export default meta;

type Story = StoryObj<typeof Loader>;

export const Default: Story = {};

export const Giant: Story = {
	args: {
		isGiant: true,
	},
};

export const Light: Story = {
	args: {
		isLight: true,
	},
	render: args => (
		<div style={ {
			background: '#1d2327',
			padding: '2rem',
		} }>
			<Loader { ...args } />
		</div>
	),
};
