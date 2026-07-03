import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import Image from './Image';

const SAMPLE_IMAGE = `data:image/svg+xml,${ encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="94">'
	+ '<rect width="210" height="94" fill="#d9c8ff" />'
	+ '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#4c1d95">Recipe photo</text>'
	+ '</svg>'
) }`;

const meta: Meta<typeof Image> = {
	title: 'Components/Admin/Image',
	component: Image,
	args: {
		alt: 'Five Summer Salads for the Grill',
		src: SAMPLE_IMAGE,
		width: 105,
		height: 47,
	},
};

export default meta;

type Story = StoryObj<typeof Image>;

export const Default: Story = {};
