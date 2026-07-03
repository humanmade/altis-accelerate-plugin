import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from './table';

const meta: Meta<typeof Table> = {
	title: 'Components/UI/Table',
	component: Table,
};

export default meta;

type Story = StoryObj<typeof Table>;

const experiments = [
	{
		conversion: '4.2%',
		name: 'Homepage hero',
		status: 'Running',
		visitors: '12,480',
	},
	{
		conversion: '6.1%',
		name: 'Pricing CTA',
		status: 'Winner: Variant B',
		visitors: '8,210',
	},
	{
		conversion: '2.8%',
		name: 'Checkout banner',
		status: 'Paused',
		visitors: '3,904',
	},
];

export const Default: Story = {
	render: () => (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Experiment</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Visitors</TableHead>
					<TableHead>Conversion</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{ experiments.map( experiment => (
					<TableRow key={ experiment.name }>
						<TableCell>{ experiment.name }</TableCell>
						<TableCell>{ experiment.status }</TableCell>
						<TableCell>{ experiment.visitors }</TableCell>
						<TableCell>{ experiment.conversion }</TableCell>
					</TableRow>
				) ) }
			</TableBody>
		</Table>
	),
};

export const WithCaption: Story = {
	render: () => (
		<Table>
			<TableCaption>Active experiments for the last 30 days.</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead>Experiment</TableHead>
					<TableHead>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{ experiments.map( experiment => (
					<TableRow key={ experiment.name }>
						<TableCell>{ experiment.name }</TableCell>
						<TableCell>{ experiment.status }</TableCell>
					</TableRow>
				) ) }
			</TableBody>
		</Table>
	),
};
