import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { createReduxStore, register, select } from '@wordpress/data';

import type { Audience } from '../../audiences/types';
import { audiencePosts, returningVisitorsAudience } from '../../fixtures';
import type { Filter } from '../../utils/admin';
import '../../audiences/data';

import FilterAudiencePicker, { SelectionMode } from './FilterAudiencePicker';
import FilterEditor from './FilterEditor';
import FilterSummary from './FilterSummary';

import '../../accelerate/index.scss';
import './FilterEditor.css';

const coreStoryStore = createReduxStore( 'core', {
	reducer: ( state = {} ) => state,
	selectors: {
		canUser: () => true,
	},
} );

if ( ! select( 'core' ) ) {
	register( coreStoryStore );
}

function AudiencePickerStory() {
	const [ selectedMode, setSelectedMode ] = React.useState<SelectionMode>( 'audience' );
	const [ selectedAudienceId, setSelectedAudienceId ] = React.useState<number | undefined>( audiencePosts[ 0 ]?.id );

	const onSelectAudience = ( audience: Audience, id: number ) => {
		setSelectedMode( 'audience' );
		setSelectedAudienceId( id );
	};

	return (
		<div className="w-[760px] rounded-lg border border-gray-200 bg-white shadow-xs">
			<FilterAudiencePicker
				selectedAudienceId={ selectedAudienceId }
				selectedMode={ selectedMode }
				onSelectAllTraffic={ () => {
					setSelectedMode( 'all' );
					setSelectedAudienceId( undefined );
				} }
				onSelectAudience={ onSelectAudience }
				onSelectCustomFilter={ () => {
					setSelectedMode( 'custom' );
					setSelectedAudienceId( undefined );
				} }
			/>
		</div>
	);
}

function FilterEditorStory() {
	const [ showingEditor, setShowingEditor ] = React.useState( true );
	const [ filter, setFilter ] = React.useState<Filter>( {} );
	const [ nextFilter, setNextFilter ] = React.useState<Filter>( filter );

	return (
		<FilterEditor
			nextFilter={ nextFilter }
			showingEditor={ showingEditor }
			onSetShowingEditor={ setShowingEditor }
			onUpdateFilter={ value => {
				setFilter( value );
				setNextFilter( value );
			} }
			onUpdateNextFilter={ setNextFilter }
		/>
	);
}

const meta: Meta<typeof FilterSummary> = {
	title: 'Analytics/Filters',
	component: FilterSummary,
	parameters: {
		layout: 'centered',
	},
	render: args => (
		<div className="tailwind max-w-3xl rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-xs">
			<FilterSummary { ...args } />
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof FilterSummary>;

export const SummaryAllTraffic: Story = {
	args: {
		filter: {},
	},
};

export const SummaryPathAndDimensions: Story = {
	args: {
		filter: {
			path: '/recipes/five-summer-salads-for-the-grill/',
			dimensions: {
				country: 'US',
				referer: 'google.com',
			},
		},
	},
};

export const SummaryAudienceRules: Story = {
	args: {
		filter: {
			audience: returningVisitorsAudience,
		},
	},
};

export const AudiencePicker: Story = {
	render: () => (
		<div className="tailwind">
			<AudiencePickerStory />
		</div>
	),
};

export const EditorOpen: Story = {
	parameters: {
		layout: 'fullscreen',
	},
	render: () => (
		<div className="tailwind min-h-screen bg-muted/30 p-8">
			<FilterEditorStory />
		</div>
	),
};
