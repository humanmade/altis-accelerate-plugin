import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Button } from './button';
import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = {
	title: 'Components/UI/Spinner',
	component: Spinner,
};

export default meta;

type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
	render: () => <Spinner />,
};

export const Large: Story = {
	render: () => <Spinner className="size-8" />,
};

export const InButton: Story = {
	render: () => (
		<Button disabled>
			<Spinner aria-hidden="true" />
			Loading report…
		</Button>
	),
};
