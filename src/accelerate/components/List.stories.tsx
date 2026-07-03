import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Duration } from '../../utils/admin';

import List from './List';

import { contentPosts } from '@/fixtures';

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

const currentUser = {
	id: 11,
	name: 'Mara Ellis',
};

const meta: Meta<typeof List> = {
	title: 'Components/Admin/List',
	component: List,
	parameters: {
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof List>;

const ListDemo = ( props: Partial<React.ComponentProps<typeof List>> ) => {
	const [ period, setPeriod ] = React.useState<Duration>( 'P7D' );

	return (
		<div className="pt-6">
			<List
				currentUser={ currentUser }
				filters={ [ 'all', 'blocks', 'mine' ] }
				listId="Storybook List"
				period={ period }
				postTypes={ postTypes }
				searchPlaceholder="Search Pages, Posts & Blocks"
				onSetPeriod={ setPeriod }
				{ ...props }
			/>
		</div>
	);
};

export const Default: Story = {
	render: () => <ListDemo />,
};

export const MinimalToolbar: Story = {
	render: () => (
		<ListDemo
			filters={ [ 'all' ] }
			hidePeriodFilter
			listId="Storybook List Minimal"
		/>
	),
};

export const SelectedItem: Story = {
	render: () => (
		<ListDemo
			filters={ [ 'selected', 'all' ] }
			listId="Storybook List Selected"
			postId={ contentPosts[0].id }
		/>
	),
};
