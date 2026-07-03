import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import ConnectionSuccessDialog from './ConnectionSuccessDialog';

import '../index.scss';

const meta: Meta<typeof ConnectionSuccessDialog> = {
	title: 'Analytics/ConnectionSuccessDialog',
	component: ConnectionSuccessDialog,
	parameters: {
		accelerateLayout: 'page',
		layout: 'centered',
	},
	render: () => (
		<div className="Dashboard tailwind">
			<ConnectionSuccessDialog />
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof ConnectionSuccessDialog>;

export const Default: Story = {};
