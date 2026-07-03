import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
	title: 'Components/UI/Skeleton',
	component: Skeleton,
};

export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
	render: () => <Skeleton className="h-4 w-48" />,
};

export const MetricTile: Story = {
	render: () => (
		<div className="flex w-40 flex-col gap-2">
			<Skeleton className="h-3 w-20" />
			<Skeleton className="h-8 w-24" />
		</div>
	),
};

export const TableRows: Story = {
	render: () => (
		<div className="flex w-72 flex-col gap-2">
			<Skeleton className="h-6 w-full" />
			<Skeleton className="h-6 w-full" />
			<Skeleton className="h-6 w-full" />
		</div>
	),
};
