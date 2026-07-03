import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { analyticsAggregations } from '../../fixtures';

import CountryMap from './CountryMap';

import '../../accelerate/index.scss';

const meta: Meta<typeof CountryMap> = {
	title: 'Analytics/CountryMap',
	component: CountryMap,
	args: {
		data: analyticsAggregations.by_country,
		height: 360,
		width: 720,
		onSelect: () => undefined,
	},
	parameters: {
		layout: 'centered',
	},
	render: args => (
		<div className="tailwind rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
			<CountryMap { ...args } />
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof CountryMap>;

export const Default: Story = {};

export const SparseData: Story = {
	args: {
		data: {
			US: 19320,
			GB: 5650,
			AU: 2410,
		},
	},
};
