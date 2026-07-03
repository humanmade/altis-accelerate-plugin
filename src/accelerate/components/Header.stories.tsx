import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import Header from './Header';

import '../index.scss';

const meta: Meta<typeof Header> = {
	title: 'Components/Admin/Header',
	component: Header,
	args: {
		title: 'Pantry & Plate',
		version: 'v4.2.0',
	},
};

export default meta;

type Story = StoryObj<typeof Header>;

export const Default: Story = {};
