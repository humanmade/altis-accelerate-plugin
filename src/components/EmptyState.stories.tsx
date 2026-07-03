import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertCircle, Inbox } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from './EmptyState';

import { Button } from '@/components/ui/button';

const meta: Meta<typeof EmptyState> = {
	title: 'Components/EmptyState',
	component: EmptyState,
	args: {
		title: 'No data yet',
	},
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithIconAndDescription: Story = {
	args: {
		icon: <Inbox className="h-8 w-8" />,
		title: 'No experiments yet',
		description: 'Create an experiment to start comparing variants against your content.',
	},
};

export const ErrorWithRetry: Story = {
	args: {
		icon: <AlertCircle className="h-8 w-8" />,
		title: 'Something went wrong',
		description: 'Content analytics could not be loaded.',
		action: <Button variant="outline" onClick={ () => undefined }>Try again</Button>,
	},
};
