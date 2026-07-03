import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import type { Duration } from '../../utils/admin';

import HeroChart from './HeroChart';

import '../index.scss';

const postTypes = [
	{
		name: 'post',
		label: 'Posts',
		singular_label: 'Post',
	},
	{
		name: 'page',
		label: 'Pages',
		singular_label: 'Page',
	},
	{
		name: 'wp_block',
		label: 'Blocks',
		singular_label: 'Block',
	},
];

const setupDashboardData = () => {
	window.AltisAccelerateDashboardData = {
		post_types: postTypes,
		version: 'storybook',
		home_url: 'https://pantryandplate.example',
		screen: 'analytics',
		location: 'storybook',
		tracking: {
			opt_in: true,
		},
		user: {
			id: 11,
			name: 'Mara Ellis',
		},
		welcomed: true,
		onboarding: {
			connected_at: 1719388800,
			first_test_created: 1719475200,
			authorize_url: '#connect',
		},
		outbound_tracking_enabled: true,
		timezone: {
			string: 'America/New_York',
			offset: -4,
		},
	};
};

setupDashboardData();

const meta: Meta<typeof HeroChart> = {
	title: 'Analytics/HeroChart',
	component: HeroChart,
	args: {
		period: 'P7D' as Duration,
		realtimeTick: 0,
	},
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
	render: args => (
		<div className="Dashboard tailwind p-6">
			<HeroChart { ...args } />
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof HeroChart>;

export const SevenDays: Story = {};

export const CountryFiltered: Story = {
	args: {
		filter: {
			dimensions: {
				country: 'US',
			},
		},
	},
};
