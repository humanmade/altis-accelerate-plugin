import React from 'react';

import type { Experiment } from '../data/store';

import { EXPERIMENT_COLUMNS } from './columns';
import ExperimentRow from './ExperimentRow';

import { DataTable } from '@/components/DataTable';

interface ExperimentsListProps {
	experiments: Experiment[];
	footer?: React.ReactNode;
}

export default function ExperimentsList( { experiments, footer }: ExperimentsListProps ) {
	return (
		<DataTable columns={ EXPERIMENT_COLUMNS } footer={ footer }>
			{ experiments.map( experiment => (
				<ExperimentRow key={ `${ experiment.type }-${ experiment.id }` } experiment={ experiment } />
			) ) }
		</DataTable>
	);
}
