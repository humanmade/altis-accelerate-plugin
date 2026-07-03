import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { periods } from '../../data/periods';
import type { CustomFilters } from '../../utils/admin';

import ListFilters from './ListFilters';

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
];

const customFilters: CustomFilters = {
	all: {
		label: 'All',
		callback: () => {},
	},
	mine: {
		label: 'My Content',
		callback: () => {},
	},
};

const meta: Meta<typeof ListFilters> = {
	title: 'Components/Admin/ListFilters',
	component: ListFilters,
	args: {
		listId: 'storybook-list',
		searchPlaceholder: 'Search recipes and guides...',
		customFilters,
		periods,
		postTypes,
		period: 'P7D',
		customFilter: 'all',
		onAddNewItem: () => undefined,
		onSetCustomFilter: () => undefined,
		onSetPeriod: () => undefined,
		onSetSearch: () => undefined,
	},
};

export default meta;

type Story = StoryObj<typeof ListFilters>;

export const Default: Story = {};

export const MultiplePostTypes: Story = {
	args: {
		postTypes: [
			...postTypes,
			{
				name: 'wp_block',
				label: 'Blocks',
				singular_label: 'Block',
			},
		],
	},
};

export const PeriodFilterHidden: Story = {
	args: {
		hidePeriodFilter: true,
	},
};
