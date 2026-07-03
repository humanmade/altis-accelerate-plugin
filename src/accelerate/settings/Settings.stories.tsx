import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import Settings from './Settings';

import '../index.scss';

const meta: Meta<typeof Settings> = {
	title: 'Settings/Panel',
	component: Settings,
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof Settings>;

export const Scene: Story = {};
