import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import BlockSelectorList from './BlockSelectorList';

import { contentPosts } from '@/fixtures';

import '../index.scss';

const imageSvg = encodeURIComponent( '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#2563eb"/><circle cx="502" cy="82" r="50" fill="#facc15"/><path d="M72 274c72-82 128-98 188-48 42 35 82 38 128 8 58-38 112-34 188 22v50H72z" fill="#ffffff" opacity=".72"/></svg>' );
const previewBlocks = contentPosts.map( block => {
	if ( block.id === 101 ) {
		return {
			...block,
			rawContent: `<!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="data:image/svg+xml,${ imageSvg }" alt="Recipe preview"/></figure><!-- /wp:image -->`,
		};
	}

	if ( block.id === 201 ) {
		return {
			...block,
			rawContent: '<!-- wp:heading --><h2 class="wp-block-heading">Summer recipes</h2><!-- /wp:heading -->',
		};
	}

	return block;
} );

const meta: Meta<typeof BlockSelectorList> = {
	title: 'Components/Admin/BlockSelectorList',
	component: BlockSelectorList,
};

export default meta;

type Story = StoryObj<typeof BlockSelectorList>;

const BlockSelectorListDemo = ( { initialSelected = [] as number[] } ) => {
	const [ selected, setSelected ] = React.useState<number[]>( initialSelected );
	return (
		<BlockSelectorList
			blocks={ previewBlocks }
			selected={ selected }
			onChange={ setSelected }
		/>
	);
};

export const NoSelection: Story = {
	render: () => <BlockSelectorListDemo />,
};

export const WithSelection: Story = {
	render: () => <BlockSelectorListDemo initialSelected={ [ 101, 201 ] } />,
};
