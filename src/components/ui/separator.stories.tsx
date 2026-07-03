import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Separator } from './separator';

const meta: Meta<typeof Separator> = {
	title: 'Components/UI/Separator',
	component: Separator,
};

export default meta;

type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
	render: () => (
		<div className="w-64">
			<p className="text-sm text-foreground">Homepage hero experiment</p>
			<Separator className="my-3" />
			<p className="text-sm text-muted-foreground">Started 12 days ago</p>
		</div>
	),
};

export const Vertical: Story = {
	render: () => (
		<div className="flex h-8 items-center gap-3 text-sm text-foreground">
			<span>Visitors</span>
			<Separator orientation="vertical" />
			<span>Conversions</span>
			<Separator orientation="vertical" />
			<span>Bounce rate</span>
		</div>
	),
};
