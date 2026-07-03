import './wordpress-globals';
import '../src/experiments/titles';
import '../src/experiments/featured-images';

import * as React from 'react';

import {
	createReduxStore,
	createRegistry,
	RegistryProvider,
} from '@wordpress/data';

import { store as accelerateStore } from '../src/data';
import { contentDiffs } from '../src/fixtures';

type ABTest = {
	started: boolean,
	paused: boolean,
	start_time: number,
	end_time: number,
	ended?: boolean,
	traffic_percentage: number,
	results: {
		winner: number | null,
		variants: Array<{
			size: number,
			hits?: number,
			rate: number,
			p?: number,
		}>,
	},
};

type PostABTestConfig = {
	label: string,
	singular_label: string,
	suggestion_prompt?: string,
};

type EditorScenarioKey = 'empty' | 'running' | 'completed' | 'personalization';

type EditorScenario = {
	key: EditorScenarioKey,
	postABTests: Record<string, PostABTestConfig>,
	attributes: Record<string, unknown>,
	media: Record<number, unknown>,
};

type CoreEditorState = {
	currentPostId: unknown,
	currentPostType: unknown,
	attributes: Record<string, unknown>,
	edits: Record<string, unknown>,
};

type CoreState = {
	media: Record<number, unknown>,
	postTypes: Record<string, {
		slug: string,
		rest_base: string,
	}>,
};

type EditPostState = {
	sidebar: string | null,
};

type StorybookDecorator = (
	Story: React.ComponentType,
	context: {
		parameters: Record<string, unknown>,
	},
) => React.ReactNode;

type StoryWindow = Window & typeof globalThis & {
	Altis?: any,
	AltisAccelerateDashboardData?: any,
};

const imageDataUri = ( label: string, fill: string ) => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220" viewBox="0 0 420 220"><rect width="420" height="220" rx="18" fill="${ fill }"/><circle cx="330" cy="66" r="38" fill="rgba(255,255,255,.35)"/><path d="M38 162c48-50 82-58 124-24 29 23 52 25 81 5 38-26 78-23 139 16v27H38z" fill="rgba(255,255,255,.55)"/><text x="34" y="54" fill="white" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700">${ label }</text></svg>`;
	return `data:image/svg+xml,${ encodeURIComponent( svg ) }`;
};

const media = {
	901: {
		id: 901,
		alt_text: 'Picnic sandwiches on a board',
		source_url: imageDataUri( 'Picnic guide', '#9332ff' ),
	},
	902: {
		id: 902,
		alt_text: 'Summer salad ingredients',
		source_url: imageDataUri( 'Summer spread', '#16a34a' ),
	},
};

const postABTests = {
	titles: {
		label: 'Title',
		singular_label: 'Title',
	},
	featured_images: {
		label: 'Featured image',
		singular_label: 'Image',
	},
};

const personalizationPostABTests = {
	...postABTests,
	audience_segments: {
		label: 'Audience variants',
		singular_label: 'Audience',
	},
};

const baseAttributes = {
	id: 101,
	type: 'post',
	status: 'draft',
	title: 'Five Summer Salads for the Grill',
	featured_media: 901,
	ab_test_titles: [
		'Five Summer Salads for the Grill',
		'The Summer Salad Lineup Worth Grilling For',
	],
	ab_test_featured_images: [
		901,
		902,
	],
	ab_test_audience_segments: [
		'Fallback recipe module',
		'Returning reader prep list',
		'Newsletter subscriber shortcut',
	],
};

const createRunningTest = (): ABTest => ( {
	started: true,
	paused: false,
	start_time: Date.now() - ( 7 * 24 * 60 * 60 * 1000 ),
	end_time: Date.now() + ( 14 * 24 * 60 * 60 * 1000 ),
	traffic_percentage: 50,
	results: {
		winner: null,
		variants: [
			{
				size: 3820,
				hits: 214,
				rate: 0.056,
				p: 0.24,
			},
			{
				size: 3915,
				hits: 276,
				rate: 0.071,
				p: 0.76,
			},
		],
	},
} );

const createCompletedTest = (): ABTest => ( {
	started: true,
	paused: false,
	start_time: Date.now() - ( 24 * 24 * 60 * 60 * 1000 ),
	end_time: Date.now() - ( 2 * 24 * 60 * 60 * 1000 ),
	traffic_percentage: 60,
	results: {
		winner: 1,
		variants: [
			{
				size: 5410,
				hits: 288,
				rate: 0.053,
				p: 0.18,
			},
			{
				size: 5488,
				hits: 412,
				rate: 0.075,
				p: 0.97,
			},
		],
	},
} );

const createPersonalizationTest = (): ABTest => ( {
	started: true,
	paused: false,
	start_time: Date.now() - ( 3 * 24 * 60 * 60 * 1000 ),
	end_time: Date.now() + ( 21 * 24 * 60 * 60 * 1000 ),
	traffic_percentage: 70,
	results: {
		winner: null,
		variants: [
			{
				size: 1980,
				hits: 96,
				rate: 0.048,
				p: 0.31,
			},
			{
				size: 1260,
				hits: 88,
				rate: 0.07,
				p: 0.62,
			},
			{
				size: 840,
				hits: 53,
				rate: 0.063,
				p: 0.51,
			},
		],
	},
} );

const buildScenario = ( key: EditorScenarioKey ): EditorScenario => {
	if ( key === 'empty' ) {
		return {
			key,
			postABTests: {},
			attributes: {
				...baseAttributes,
				ab_tests: {},
			},
			media,
		};
	}

	if ( key === 'completed' ) {
		return {
			key,
			postABTests,
			attributes: {
				...baseAttributes,
				ab_tests: {
					titles: createCompletedTest(),
					featured_images: createRunningTest(),
				},
			},
			media,
		};
	}

	if ( key === 'personalization' ) {
		return {
			key,
			postABTests: personalizationPostABTests,
			attributes: {
				...baseAttributes,
				ab_tests: {
					titles: createRunningTest(),
					featured_images: createCompletedTest(),
					audience_segments: createPersonalizationTest(),
				},
			},
			media,
		};
	}

	return {
		key,
		postABTests,
		attributes: {
			...baseAttributes,
			ab_tests: {
				titles: createRunningTest(),
				featured_images: {
					...createRunningTest(),
					paused: true,
				},
			},
		},
		media,
	};
};

const createCoreEditorStore = ( scenario: EditorScenario ) => createReduxStore( 'core/editor', {
	reducer: ( state = {
		currentPostId: scenario.attributes.id,
		currentPostType: scenario.attributes.type,
		attributes: scenario.attributes,
		edits: {},
	} as CoreEditorState, action: any ) => {
		if ( action.type === 'EDIT_POST' ) {
			return {
				...state,
				edits: {
					...state.edits,
					...action.edits,
				},
			};
		}
		return state;
	},
	actions: {
		editPost: ( edits: Record<string, unknown> ) => ( {
			type: 'EDIT_POST',
			edits,
		} ),
	},
	selectors: {
		getCurrentPost: ( state: CoreEditorState ) => ( {
			...state.attributes,
			...state.edits,
		} ),
		getCurrentPostId: ( state: CoreEditorState ) => state.currentPostId,
		getCurrentPostType: ( state: CoreEditorState ) => state.currentPostType,
		getCurrentPostAttribute: ( state: CoreEditorState, attribute: string ) => state.attributes[ attribute ],
		getEditedPostAttribute: ( state: CoreEditorState, attribute: string ) => (
			Object.prototype.hasOwnProperty.call( state.edits, attribute )
				? state.edits[ attribute ]
				: state.attributes[ attribute ]
		),
	},
} );

const createCoreStore = ( scenario: EditorScenario ) => createReduxStore( 'core', {
	reducer: ( state = {
		media: scenario.media,
		postTypes: {
			post: {
				slug: 'post',
				rest_base: 'posts',
			},
			page: {
				slug: 'page',
				rest_base: 'pages',
			},
		},
	} as CoreState ) => state,
	selectors: {
		getMedia: ( state: CoreState, id: number ) => state.media[ id ],
		getPostType: ( state: CoreState, type: string ) => state.postTypes[ type ],
	},
} );

const createEditPostStore = () => createReduxStore( 'core/edit-post', {
	reducer: ( state = { sidebar: null } as EditPostState, action: any ) => {
		if ( action.type === 'OPEN_GENERAL_SIDEBAR' ) {
			return {
				...state,
				sidebar: action.sidebar,
			};
		}
		return state;
	},
	actions: {
		openGeneralSidebar: ( sidebar: string ) => ( {
			type: 'OPEN_GENERAL_SIDEBAR',
			sidebar,
		} ),
	},
	selectors: {
		getActiveGeneralSidebarName: ( state: EditPostState ) => state.sidebar,
	},
} );

const setScenarioGlobals = ( scenario: EditorScenario ) => {
	const storyWindow = window as StoryWindow;
	storyWindow.Altis = {
		...( storyWindow.Altis || {} ),
		Analytics: {
			...( storyWindow.Altis?.Analytics || {} ),
			components: [],
			Experiments: {
				Goals: {
					engagement: {
						label: 'Engagement',
						name: 'engagement',
					},
					click_any_link: {
						label: 'Link click',
						name: 'click_any_link',
					},
				},
				PostABTests: scenario.postABTests,
			},
		},
	};
	storyWindow.AltisAccelerateDashboardData = {
		post_types: [],
		version: 'storybook',
		screen: 'post',
		tracking: {
			opt_in: true,
		},
		user: {
			id: 1,
			name: 'Storybook',
		},
		welcomed: true,
		onboarding: {
			connected_at: Date.now(),
			first_test_created: Date.now(),
			authorize_url: '#',
		},
		outbound_tracking_enabled: true,
		timezone: {
			string: 'America/New_York',
			offset: -4,
		},
	};
};

const createEditorRegistry = ( scenario: EditorScenario ) => {
	const registry = createRegistry() as any;
	registry.register( createCoreEditorStore( scenario ) );
	registry.register( createCoreStore( scenario ) );
	registry.register( createEditPostStore() );
	registry.register( accelerateStore );

	registry.dispatch( 'accelerate' ).setDiffs(
		{
			101: contentDiffs[101],
		},
		'ids:[101];interval:"P1D";period:"P7D"'
	);
	registry.dispatch( 'accelerate' ).setIsLoadingDiffs( false );

	return registry;
};

const EditorFrame = ( { children }: { children: React.ReactNode } ) => (
	<div className="min-h-[360px] bg-[#f0f0f1] p-4">
		<div className="interface-interface-skeleton__content relative min-h-[300px] overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
			<div className="components-notice-list" />
			{ children }
			<div className="p-6">
				<div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center !text-sm text-gray-500">
					Editor canvas placeholder
				</div>
			</div>
		</div>
	</div>
);

export const withEditorRegistry: StorybookDecorator = ( Story, context ) => {
	const scenarioKey = ( context.parameters.editorControlsScenario || 'running' ) as EditorScenarioKey;
	const scenario = React.useMemo( () => buildScenario( scenarioKey ), [ scenarioKey ] );
	const registry = React.useMemo( () => createEditorRegistry( scenario ), [ scenario ] );

	React.useEffect( () => {
		setScenarioGlobals( scenario );
		window.localStorage.removeItem( '_altis_ab_tests' );
	}, [ scenario ] );

	setScenarioGlobals( scenario );

	return (
		<RegistryProvider value={ registry }>
			<EditorFrame>
				<Story />
			</EditorFrame>
		</RegistryProvider>
	);
};
