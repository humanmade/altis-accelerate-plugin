import { withEditorRegistry } from '../../.storybook/editor-registry';

import { PostPageHeader } from './index';

const meta = {
	title: 'Editor Controls/HeaderBar',
	component: PostPageHeader,
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
