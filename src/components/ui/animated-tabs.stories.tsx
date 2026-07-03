import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { AnimatedTabs } from './animated-tabs';

const meta: Meta<typeof AnimatedTabs> = {
	title: 'Components/UI/AnimatedTabs',
	component: AnimatedTabs,
};

export default meta;

type Story = StoryObj<typeof AnimatedTabs>;

const PeriodTabsDemo = () => {
	const [ value, setValue ] = React.useState( '7d' );
	return (
		<AnimatedTabs
			options={ [
				{
					value: 'today',
					label: 'Today',
				},
				{
					value: '7d',
					label: '7 days',
				},
				{
					value: '30d',
					label: '30 days',
				},
			] }
			value={ value }
			onValueChange={ setValue }
		/>
	);
};

export const Default: Story = {
	render: () => <PeriodTabsDemo />,
};

const MetricTabsDemo = () => {
	const [ value, setValue ] = React.useState( 'visitors' );
	return (
		<AnimatedTabs
			options={ [
				{
					value: 'visitors',
					label: 'Visitors',
				},
				{
					value: 'conversions',
					label: 'Conversions',
				},
				{
					value: 'bounce-rate',
					label: 'Bounce rate',
				},
				{
					value: 'revenue',
					label: 'Revenue',
				},
			] }
			value={ value }
			onValueChange={ setValue }
		/>
	);
};

export const ManyOptions: Story = {
	render: () => <MetricTabsDemo />,
};

const TwoOptionDemo = () => {
	const [ value, setValue ] = React.useState( 'control' );
	return (
		<AnimatedTabs
			options={ [
				{
					value: 'control',
					label: 'Control',
				},
				{
					value: 'variant-b',
					label: 'Variant B',
				},
			] }
			value={ value }
			onValueChange={ setValue }
		/>
	);
};

export const TwoOptions: Story = {
	render: () => <TwoOptionDemo />,
};
