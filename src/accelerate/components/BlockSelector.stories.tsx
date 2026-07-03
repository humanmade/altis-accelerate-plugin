import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import BlockSelector from './BlockSelector';

import '../index.scss';

const meta: Meta<typeof BlockSelector> = {
	title: 'Components/Admin/BlockSelector',
	component: BlockSelector,
};

export default meta;

type Story = StoryObj<typeof BlockSelector>;

const BlockSelectorDemo = ( { initialValue = [] as number[] } ) => {
	const [ value, setValue ] = React.useState<number[]>( initialValue );

	return (
		<BlockSelector
			value={ value }
			onChange={ setValue }
		/>
	);
};

export const NoSelection: Story = {
	render: () => <BlockSelectorDemo />,
};

export const WithSelection: Story = {
	render: () => <BlockSelectorDemo initialValue={ [ 201 ] } />,
};

export const MultipleSelected: Story = {
	render: () => <BlockSelectorDemo initialValue={ [ 201, 101, 105 ] } />,
};
