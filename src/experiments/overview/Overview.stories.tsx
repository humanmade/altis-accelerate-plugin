import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { register, select } from '@wordpress/data';

import Dashboard from './Dashboard';
import { store } from './data/store';

import '../../accelerate/index.scss';

if ( ! select( 'accelerate/experiments' ) ) {
	register( store );
}

const resetStoryState = () => {
	window.localStorage.removeItem( 'altis-state-experiments-status' );
	window.localStorage.removeItem( 'altis-state-experiments-type' );
	window.AccelerateExperimentsData = {
		headingFontFamily: 'Georgia, serif',
	};
};

const meta: Meta<typeof Dashboard> = {
	title: 'Experiments/Overview',
	component: Dashboard,
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof Dashboard>;

export const Scene: Story = {
	render: () => {
		resetStoryState();
		return <Dashboard />;
	},
};
