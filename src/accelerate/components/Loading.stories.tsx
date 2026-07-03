import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import Loading from './Loading';

const meta: Meta<typeof Loading> = {
	title: 'Components/Admin/Loading',
	component: Loading,
};

export default meta;

type Story = StoryObj<typeof Loading>;

export const Default: Story = {
	render: () => (
		<div style={ { width: 80 } }>
			<Loading />
		</div>
	),
};

export const CustomSize: Story = {
	render: () => (
		<div style={ { width: 160 } }>
			<Loading svgProps={ {
				style: {
					width: '100%',
					height: 'auto',
				},
			} } />
		</div>
	),
};
