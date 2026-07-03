import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { SearchField } from './SearchField';

const meta: Meta<typeof SearchField> = {
	title: 'Components/SearchField',
	component: SearchField,
	args: {
		placeholder: 'Search content...',
		onChange: () => undefined,
	},
};

export default meta;

type Story = StoryObj<typeof SearchField>;

export const Default: Story = {
	render: args => (
		<div className="max-w-sm">
			<SearchField { ...args } />
		</div>
	),
};

export const CustomPlaceholder: Story = {
	args: {
		placeholder: 'Search experiments by name...',
	},
	render: args => (
		<div className="max-w-sm">
			<SearchField { ...args } />
		</div>
	),
};

export const FastDebounce: Story = {
	args: {
		placeholder: 'Filter audiences...',
		debounce: 150,
	},
	render: args => (
		<div className="max-w-sm">
			<SearchField { ...args } />
		</div>
	),
};
