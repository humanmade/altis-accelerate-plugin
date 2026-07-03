import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import ListItem from './ListItem';

import { broadcastPosts, contentDiffs, contentPosts } from '@/fixtures';

import '../index.scss';

const meta: Meta<typeof ListItem> = {
	title: 'Components/Admin/ListItem',
	component: ListItem,
	args: {
		listId: 'Storybook List',
		item: contentPosts[0],
		histogramDiffs: contentDiffs,
		maxViewsPerUrl: 1160,
		period: 'P7D',
	},
};

export default meta;

type Story = StoryObj<typeof ListItem>;

const renderInList = ( args: React.ComponentProps<typeof ListItem> ) => (
	<div className="List tailwind">
		<div className="table-wrap">
			<div className="table-content">
				<table>
					<tbody>
						<ListItem { ...args } />
					</tbody>
				</table>
			</div>
		</div>
	</div>
);

export const Default: Story = {
	render: renderInList,
};

export const WithActions: Story = {
	args: {
		actions: {
			Duplicate: () => {},
			Archive: () => {},
		},
	},
	render: renderInList,
};

export const Broadcast: Story = {
	args: {
		item: broadcastPosts[0],
	},
	render: renderInList,
};
