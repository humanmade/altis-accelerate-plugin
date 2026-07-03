import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from './select';

const meta: Meta<typeof Select> = {
	title: 'Components/UI/Select',
	component: Select,
};

export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
	render: () => (
		<Select defaultValue="7d">
			<SelectTrigger className="w-48">
				<SelectValue placeholder="Select a period" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="today">Today</SelectItem>
				<SelectItem value="7d">Last 7 days</SelectItem>
				<SelectItem value="30d">Last 30 days</SelectItem>
				<SelectItem value="90d">Last 90 days</SelectItem>
			</SelectContent>
		</Select>
	),
};

export const WithGroups: Story = {
	render: () => (
		<Select defaultValue="visitors">
			<SelectTrigger className="w-56">
				<SelectValue placeholder="Select a metric" />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>Traffic</SelectLabel>
					<SelectItem value="visitors">Visitors</SelectItem>
					<SelectItem value="pageviews">Pageviews</SelectItem>
				</SelectGroup>
				<SelectSeparator />
				<SelectGroup>
					<SelectLabel>Engagement</SelectLabel>
					<SelectItem value="bounce-rate">Bounce rate</SelectItem>
					<SelectItem value="conversions">Conversions</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	),
};

export const Disabled: Story = {
	render: () => (
		<Select defaultValue="7d" disabled>
			<SelectTrigger className="w-48">
				<SelectValue placeholder="Select a period" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="7d">Last 7 days</SelectItem>
			</SelectContent>
		</Select>
	),
};
