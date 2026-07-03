import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import OnboardingBar from './OnboardingBar';

import '../index.scss';

const meta: Meta<typeof OnboardingBar> = {
	title: 'Analytics/OnboardingBar',
	component: OnboardingBar,
	args: {
		userName: 'Mara Ellis',
		onDismiss: () => undefined,
		onboarding: {
			connected_at: false,
			first_test_created: false,
			authorize_url: '#connect',
		},
	},
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
	render: args => (
		<div className="Dashboard tailwind">
			<OnboardingBar { ...args } />
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof OnboardingBar>;

export const ConnectStep: Story = {};

export const ExperimentStep: Story = {
	args: {
		onboarding: {
			connected_at: 1719388800,
			first_test_created: false,
			authorize_url: '#connect',
		},
	},
};

export const ResultsStep: Story = {
	args: {
		onboarding: {
			connected_at: 1719388800,
			first_test_created: 1719475200,
			authorize_url: '#connect',
		},
	},
};
