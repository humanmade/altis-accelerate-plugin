import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import ImageGroup from './ImageGroup';

import '../index.scss';

const meta: Meta<typeof ImageGroup> = {
	title: 'Components/Admin/ImageGroup',
	component: ImageGroup,
	args: {
		width: 105,
		height: 47,
	},
};

export default meta;

type Story = StoryObj<typeof ImageGroup>;

const renderInThumbnailCell = ( args: React.ComponentProps<typeof ImageGroup> ) => (
	<div className="List tailwind">
		<table>
			<tbody>
				<tr>
					<td className="record-thumbnail">
						<div className="record-thumbnail-wrap">
							<ImageGroup { ...args } />
						</div>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
);

export const Single: Story = {
	args: {
		blocks: [ 201 ],
	},
	render: renderInThumbnailCell,
};

export const Pair: Story = {
	args: {
		blocks: [ 201, 101 ],
	},
	render: renderInThumbnailCell,
};

export const Multiple: Story = {
	args: {
		blocks: [ 201, 101, 105, 104 ],
	},
	render: renderInThumbnailCell,
};
