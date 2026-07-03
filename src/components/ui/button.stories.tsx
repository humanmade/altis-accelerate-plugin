import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, RefreshCcw, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from './button';

const meta: Meta<typeof Button> = {
	title: 'Components/UI/Button',
	component: Button,
	args: {
		children: 'Create experiment',
	},
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
	args: {
		onClick: () => undefined,
	},
};

export const Variants: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Button>Save changes</Button>
			<Button variant="outline">View report</Button>
			<Button variant="ghost">Dismiss</Button>
			<Button variant="destructive">Delete variant</Button>
		</div>
	),
};

export const WithIcons: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Button>
				<Download aria-hidden="true" />
				Export report
			</Button>
			<Button variant="outline">
				<RefreshCcw aria-hidden="true" />
				Refresh
			</Button>
			<Button size="sm" variant="destructive">
				<Trash2 aria-hidden="true" />
				Delete
			</Button>
		</div>
	),
};
