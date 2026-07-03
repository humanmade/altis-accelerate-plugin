import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import {
	Body,
	Caption,
	CardTitle,
	Overline,
	PageTitle,
	SectionTitle,
} from './typography';

const meta: Meta<typeof PageTitle> = {
	title: 'Components/UI/Typography',
	component: PageTitle,
};

export default meta;

type Story = StoryObj<typeof PageTitle>;

export const Scale: Story = {
	render: () => (
		<div className="flex flex-col gap-3">
			<PageTitle>Content Explorer</PageTitle>
			<SectionTitle>Top performing pages</SectionTitle>
			<CardTitle>Homepage hero experiment</CardTitle>
			<Body>Variant B is outperforming control by 6.2% on conversion rate.</Body>
			<Caption>Updated 4 minutes ago</Caption>
			<Overline>Experiment status</Overline>
		</div>
	),
};

export const PolymorphicAs: Story = {
	render: () => (
		<CardTitle as="span" className="text-brand">
			Rendered as a span, styled as a CardTitle
		</CardTitle>
	),
};
