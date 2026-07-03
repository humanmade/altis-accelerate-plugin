import * as React from 'react';

import { withEditorRegistry } from '../../.storybook/editor-registry';

import { ExperimentIndicators } from './components/ExperimentIndicators';

const IndicatorsDemo = () => (
	<div className="flex min-h-12 items-center gap-1 border-b border-gray-200 bg-white px-4">
		<ExperimentIndicators />
	</div>
);

const meta = {
	title: 'Editor Controls/ExperimentIndicators',
	component: IndicatorsDemo,
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
	parameters: {
		editorControlsScenario: 'running',
	},
};

export const TestCompletedWithWinner = {
	parameters: {
		editorControlsScenario: 'completed',
	},
};

export const PersonalizationVariantsActive = {
	parameters: {
		editorControlsScenario: 'personalization',
	},
};
