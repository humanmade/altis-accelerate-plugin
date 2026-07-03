import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Button } from './button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from './card';

const meta: Meta<typeof Card> = {
	title: 'Components/UI/Card',
	component: Card,
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
	render: () => (
		<Card className="w-96">
			<CardHeader>
				<CardTitle>Homepage hero experiment</CardTitle>
				<CardDescription>Running for 12 days &middot; 84% confidence</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">
					Variant B is outperforming control by 6.2% on conversion rate.
				</p>
			</CardContent>
		</Card>
	),
};

export const WithFooterActions: Story = {
	render: () => (
		<Card className="w-96">
			<CardHeader>
				<CardTitle>Pricing page CTA</CardTitle>
				<CardDescription>Awaiting significance</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">
					2,140 visitors so far. Estimated 3 more days to reach 95% confidence.
				</p>
			</CardContent>
			<CardFooter className="gap-2">
				<Button variant="outline">Pause</Button>
				<Button>View report</Button>
			</CardFooter>
		</Card>
	),
};

export const Compact: Story = {
	render: () => (
		<Card className="w-64 !p-4">
			<CardTitle className="!text-sm">Bounce rate</CardTitle>
			<p className="mt-1 text-2xl font-semibold text-foreground">42.3%</p>
		</Card>
	),
};
