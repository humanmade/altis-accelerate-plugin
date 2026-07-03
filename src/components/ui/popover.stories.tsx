import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta: Meta<typeof Popover> = {
	title: 'Components/UI/Popover',
	component: Popover,
};

export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {
	render: () => (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline">Confidence interval</Button>
			</PopoverTrigger>
			<PopoverContent>
				<p className="text-sm text-foreground">
					Variant B has a 95% confidence interval of +2.1% to +6.4% uplift over control.
				</p>
			</PopoverContent>
		</Popover>
	),
};

export const AlignedStart: Story = {
	render: () => (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="ghost">Segment info</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64">
				<p className="text-sm text-foreground">
					Visitors from the &quot;Returning EU shoppers&quot; audience segment.
				</p>
			</PopoverContent>
		</Popover>
	),
};
