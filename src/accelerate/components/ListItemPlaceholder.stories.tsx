import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import ListItemPlaceholder from './ListItemPlaceholder';

import '../index.scss';

const meta: Meta<typeof ListItemPlaceholder> = {
	title: 'Components/Admin/ListItemPlaceholder',
	component: ListItemPlaceholder,
	args: {
		i: 0,
	},
};

export default meta;

type Story = StoryObj<typeof ListItemPlaceholder>;

export const Default: Story = {
	render: args => (
		<table>
			<tbody>
				<ListItemPlaceholder { ...args } />
			</tbody>
		</table>
	),
};

export const Rows: Story = {
	render: () => (
		<table>
			<tbody>
				{ [ ...Array( 4 ) ].map( ( _, i ) => (
					<ListItemPlaceholder key={ i } i={ i } />
				) ) }
			</tbody>
		</table>
	),
};

export const Nestable: Story = {
	args: {
		isNestable: true,
	},
	render: args => (
		<table>
			<tbody>
				<ListItemPlaceholder { ...args } />
			</tbody>
		</table>
	),
};
