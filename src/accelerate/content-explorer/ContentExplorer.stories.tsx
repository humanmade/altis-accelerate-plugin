import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import ContentExplorer from './ContentExplorer';

import '../index.scss';

const postTypes = [
	{
		name: 'post',
		label: 'Posts',
		singular_label: 'Post',
	},
	{
		name: 'page',
		label: 'Pages',
		singular_label: 'Page',
	},
	{
		name: 'wp_block',
		label: 'Blocks',
		singular_label: 'Block',
	},
];

const meta: Meta<typeof ContentExplorer> = {
	title: 'Content Explorer/List',
	component: ContentExplorer,
	args: {
		postTypes,
		user: {
			id: 11,
			name: 'Mara Ellis',
		},
	},
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof ContentExplorer>;

export const Overview: Story = {};
