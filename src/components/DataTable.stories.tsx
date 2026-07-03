import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import type { ColumnDef } from './DataTable';
import { DataTable } from './DataTable';
import { EmptyState } from './EmptyState';

const COLUMNS: ColumnDef[] = [
	{
		headerClass: 'name',
		label: 'Page',
	},
	{
		headerClass: 'traffic',
		label: 'Views',
	},
	{
		headerClass: 'lift',
		label: 'Conv. rate',
	},
	{
		headerClass: 'meta',
		label: ' ',
	},
];

const ROWS = [
	{
		name: 'Pricing',
		views: '4,218',
		rate: '3.1%',
	},
	{
		name: 'Demo request',
		views: '2,843',
		rate: '5.4%',
	},
	{
		name: 'Campaign landing page',
		views: '1,906',
		rate: '2.2%',
	},
];

function ExampleRows() {
	return (
		<React.Fragment>
			{ ROWS.map( row => (
				<tr key={ row.name }>
					<td className="record-name">{ row.name }</td>
					<td className="record-traffic">{ row.views }</td>
					<td className="record-lift">{ row.rate }</td>
					<td className="record-meta">&nbsp;</td>
				</tr>
			) ) }
		</React.Fragment>
	);
}

const meta: Meta<typeof DataTable> = {
	title: 'Components/DataTable',
	component: DataTable,
	args: {
		columns: COLUMNS,
	},
};

export default meta;

type Story = StoryObj<typeof DataTable>;

export const Default: Story = {
	render: args => (
		<DataTable { ...args }>
			<ExampleRows />
		</DataTable>
	),
};

export const Empty: Story = {
	render: args => (
		<DataTable
			{ ...args }
			emptyContent={ <EmptyState description="Content will appear here once visitors start arriving." title="No landing pages yet" /> }
		>
			{ [] }
		</DataTable>
	),
};

export const WithFooter: Story = {
	render: args => (
		<DataTable
			{ ...args }
			footer={ <span className="text-sm text-muted-foreground">Showing 1-3 of 24 pages</span> }
		>
			<ExampleRows />
		</DataTable>
	),
};
