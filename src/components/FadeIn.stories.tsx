import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { FadeIn } from './FadeIn';

const meta: Meta<typeof FadeIn> = {
	title: 'Components/FadeIn',
	component: FadeIn,
};

export default meta;

type Story = StoryObj<typeof FadeIn>;

export const Default: Story = {
	render: args => (
		<FadeIn { ...args }>
			<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
				<p className="!m-0 !text-sm !font-medium !text-gray-900">Top landing pages</p>
				<p className="!m-0 !text-sm !text-muted-foreground">4,218 visitors this week</p>
			</div>
		</FadeIn>
	),
};

export const LargeTranslate: Story = {
	args: {
		translateY: 16,
	},
	render: args => (
		<FadeIn { ...args }>
			<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
				<p className="!m-0 !text-sm !font-medium !text-gray-900">Experiment: Homepage CTA color</p>
				<p className="!m-0 !text-sm !text-muted-foreground">Variant B is leading with a 12% lift</p>
			</div>
		</FadeIn>
	),
};
