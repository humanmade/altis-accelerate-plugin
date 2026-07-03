import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { DataContainer } from './DataContainer';

function LoadingSkeleton() {
	return (
		<div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
			<div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
			<div className="h-9 w-full animate-pulse rounded-md bg-muted" />
			<div className="h-9 w-4/5 animate-pulse rounded-md bg-muted" />
			<div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
		</div>
	);
}

function LoadedPanel() {
	return (
		<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
			<p className="!m-0 !text-sm !font-medium !text-gray-900">Top content</p>
			<div className="mt-4 space-y-2">
				{ [
					[ 'Pricing page', '4,218 views' ],
					[ 'Demo request', '2,843 views' ],
					[ 'Campaign landing page', '1,906 views' ],
				].map( ( [ label, value ] ) => (
					<div key={ label } className="flex items-center justify-between rounded bg-brand/10 px-3 py-2">
						<span className="!text-sm !text-gray-900">{ label }</span>
						<span className="!text-sm !font-medium !text-gray-900 tabular-nums">{ value }</span>
					</div>
				) ) }
			</div>
		</div>
	);
}

const meta: Meta<typeof DataContainer> = {
	title: 'Components/DataContainer',
	component: DataContainer,
	args: {
		minHeight: 240,
		skeleton: <LoadingSkeleton />,
	},
};

export default meta;

type Story = StoryObj<typeof DataContainer>;

export const Loaded: Story = {
	args: {
		state: 'loaded',
		children: <LoadedPanel />,
	},
};

export const Loading: Story = {
	args: {
		state: 'loading',
		children: <LoadedPanel />,
	},
};

export const Error: Story = {
	args: {
		state: 'error',
		children: <LoadedPanel />,
		errorMessage: 'Content analytics could not be loaded.',
		onRetry: () => undefined,
	},
};
