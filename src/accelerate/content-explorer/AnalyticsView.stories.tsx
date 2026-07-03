import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import AnalyticsView from './AnalyticsView';

import '../index.scss';

const meta: Meta<typeof AnalyticsView> = {
	title: 'Analytics/Overview',
	component: AnalyticsView,
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof AnalyticsView>;

export const Overview: Story = {
	args: {
		isFullscreen: false,
		periodPersistKey: 'Storybook Analytics View-period',
		showFilters: true,
		onToggleFullscreen: () => undefined,
	},
};
