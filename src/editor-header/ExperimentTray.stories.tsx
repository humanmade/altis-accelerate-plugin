import * as React from 'react';

import { withEditorRegistry } from '../../.storybook/editor-registry';

import { ExperimentTray } from './components/ExperimentTray';

type TrayDemoProps = {
	expandedTestId: string | null,
};

const TrayDemo = ( { expandedTestId }: TrayDemoProps ) => (
	<div className="border-b border-gray-200 bg-white">
		<ExperimentTray expandedTestId={ expandedTestId } />
	</div>
);

const meta = {
	title: 'Editor Controls/ExperimentTray',
	component: TrayDemo,
	decorators: [
		withEditorRegistry,
	],
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

export const ABTestRunningSettings = {
	args: {
		expandedTestId: 'titles',
	},
	parameters: {
		editorControlsScenario: 'running',
	},
};

export const TestCompletedResults = {
	args: {
		expandedTestId: 'titles',
	},
	parameters: {
		editorControlsScenario: 'completed',
	},
};

export const FeaturedImageSettings = {
	args: {
		expandedTestId: 'featured_images',
	},
	parameters: {
		editorControlsScenario: 'running',
	},
};

export const PersonalizationVariantsActive = {
	args: {
		expandedTestId: 'audience_segments',
	},
	parameters: {
		editorControlsScenario: 'personalization',
	},
};
