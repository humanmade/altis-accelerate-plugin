import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { AltisMark } from './AltisMark';

const meta: Meta<typeof AltisMark> = {
	title: 'Components/Admin/AltisMark',
	component: AltisMark,
	args: {
		className: 'h-8 w-8',
	},
};

export default meta;

type Story = StoryObj<typeof AltisMark>;

export const Default: Story = {};

export const BrandColor: Story = {
	args: {
		className: 'h-8 w-8 text-brand',
	},
};
