import * as React from 'react';

import { withEditorRegistry } from '../../.storybook/editor-registry';

import { ExperimentChips } from './components/ExperimentChips';

type ChipsDemoProps = {
	defaultExpandedTestId?: string | null,
};

const ChipsDemo = ( { defaultExpandedTestId = null }: ChipsDemoProps ) => {
	const [ expandedTestId, setExpandedTestId ] = React.useState<string | null>( defaultExpandedTestId );

	return (
		<div className="flex min-h-12 items-center gap-2 border-b border-gray-200 bg-white px-4">
			<ExperimentChips
				expandedTestId={ expandedTestId }
				onToggle={ setExpandedTestId }
			/>
		</div>
	);
};

const meta = {
	title: 'Editor Controls/ExperimentChips',
	component: ChipsDemo,
	decorators: [
		withEditorRegistry,
	],
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

export const NoExperimentsYet = {
	parameters: {
		editorControlsScenario: 'empty',
	},
};

export const ABTestRunning = {
	args: {
		defaultExpandedTestId: 'titles',
	},
	parameters: {
		editorControlsScenario: 'running',
	},
};

export const TestCompletedWithWinner = {
	args: {
		defaultExpandedTestId: 'titles',
	},
	parameters: {
		editorControlsScenario: 'completed',
	},
};

export const PersonalizationVariantsActive = {
	args: {
		defaultExpandedTestId: 'audience_segments',
	},
	parameters: {
		editorControlsScenario: 'personalization',
	},
};
