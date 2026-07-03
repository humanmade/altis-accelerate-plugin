import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { HeaderRow, VerticalDivider } from './HeaderRow';

const meta: Meta<typeof HeaderRow> = {
	title: 'Components/Admin/HeaderRow',
	component: HeaderRow,
};

export default meta;

type Story = StoryObj<typeof HeaderRow>;

export const Default: Story = {
	render: () => (
		<HeaderRow>
			<span className="font-semibold">Pantry & Plate</span>
			<VerticalDivider />
			<span className="text-sm text-gray-500">Content Explorer</span>
		</HeaderRow>
	),
};
