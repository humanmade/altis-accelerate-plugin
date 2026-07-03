import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { DataTable } from '../../components/DataTable';
import { experiments } from '../../fixtures';

import { EXPERIMENT_COLUMNS } from './components/columns';
import ExperimentRow from './components/ExperimentRow';

import '../../accelerate/index.scss';

const meta: Meta<typeof ExperimentRow> = {
	title: 'Experiments/ExperimentRow',
	component: ExperimentRow,
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
	render: ( args: React.ComponentProps<typeof ExperimentRow> ) => (
		<DataTable columns={ EXPERIMENT_COLUMNS }>
			<ExperimentRow { ...args } />
		</DataTable>
	),
};

export default meta;

type Story = StoryObj<typeof ExperimentRow>;

export const RunningBlock: Story = {
	args: {
		experiment: experiments[1],
	},
};

export const CompletedTitle: Story = {
	args: {
		experiment: experiments[0],
	},
};

export const Personalization: Story = {
	args: {
		experiment: experiments[2],
	},
};
