import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import StandaloneBlockPreview from './StandaloneBlockPreview';

import { contentPosts } from '@/fixtures';

import '../index.scss';

const RECIPE_CONTENT = contentPosts[ 0 ].rawContent as string;

const meta: Meta<typeof StandaloneBlockPreview> = {
	title: 'Components/Admin/StandaloneBlockPreview',
	component: StandaloneBlockPreview,
	args: {
		content: RECIPE_CONTENT,
		width: 480,
		height: 360,
	},
};

export default meta;

type Story = StoryObj<typeof StandaloneBlockPreview>;

export const Default: Story = {};

export const Large: Story = {
	args: {
		content: RECIPE_CONTENT,
		width: 720,
		height: 540,
	},
};

export const Empty: Story = {
	args: {
		content: '',
		width: 440,
		height: 280,
	},
	render: args => (
		<>
			{ /* Matches BlockSelectorList.scss's .record-thumbnail__empty background, scoped to this story only */ }
			<style>{ '.record-thumbnail__empty { background-color: hsl(0, 0%, 95%); }' }</style>
			<StandaloneBlockPreview { ...args } />
		</>
	),
};
