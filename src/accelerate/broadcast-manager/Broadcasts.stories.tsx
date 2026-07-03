import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { broadcastPosts } from '../../fixtures';

import BroadcastEdit from './modals/Edit';
import ManageModal from './modals/Manage';
import Upsert from './modals/Upsert';

import Broadcasts from './index';

import '../index.scss';

const postTypes = [
	{
		name: 'broadcast',
		label: 'Broadcasts',
		singular_label: 'Broadcast',
	},
];

const user = {
	id: 11,
	name: 'Mara Ellis',
};

const meta: Meta<typeof Broadcasts> = {
	title: 'Broadcast/Manager',
	component: Broadcasts,
	args: {
		postTypes,
		user,
	},
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof Broadcasts>;

export const Scene: Story = {};

export const ManageExistingModal: Story = {
	parameters: {
		layout: 'centered',
	},
	render: () => (
		<ManageModal
			item={ broadcastPosts[0] }
			listId="Broadcast Manager"
			onClose={ () => undefined }
			onSuccess={ () => undefined }
		/>
	),
};

export const ManageNewModal: Story = {
	parameters: {
		layout: 'centered',
	},
	render: () => (
		<ManageModal
			item="new"
			listId="Broadcast Manager"
			onClose={ () => undefined }
			onSuccess={ () => undefined }
		/>
	),
};

export const UpsertModal: Story = {
	parameters: {
		layout: 'centered',
	},
	render: () => (
		<div className="accelerate-ui" style={ { width: 520 } }>
			<Upsert
				item={ broadcastPosts[1] }
				listId="Broadcast Manager"
				onCancel={ () => undefined }
				onSuccess={ () => undefined }
			/>
		</div>
	),
};

export const EditBlocksModal: Story = {
	parameters: {
		layout: 'centered',
	},
	render: () => (
		<div className="accelerate-ui accelerate-broadcast-modal" style={ { width: 560 } }>
			<BroadcastEdit
				item={ broadcastPosts[0] }
				listId="Broadcast Manager"
			/>
		</div>
	),
};
