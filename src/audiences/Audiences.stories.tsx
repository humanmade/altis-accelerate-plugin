import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { createReduxStore, dispatch, register, select } from '@wordpress/data';

import {
	audienceFields,
	audiencePosts,
	returningVisitorsEstimate,
} from '../fixtures';

import { store } from './data';
import type { Post } from './types';
import AudienceSort from './ui/components/audience-sort';
import Estimate from './ui/components/estimate';
import Edit from './ui/edit';
import Manager from './ui/manager';
import Select from './ui/select';

import '../accelerate/index.scss';
import './index.css';

const AudienceSelect = Select as unknown as React.ComponentType<{
	audience?: number;
	label?: string;
	onClearSelection?: () => void;
	onSelect: ( id: number, post: Post ) => void;
}>;

const corePermissionsStore = createReduxStore( 'core', {
	reducer: ( state = {} ) => state,
	selectors: {
		canUser: () => true,
	},
} );

const registerCorePermissions = () => {
	const core = select( 'core' ) as { canUser?: unknown } | undefined;
	if ( ! core?.canUser ) {
		register( corePermissionsStore );
	}
};

function AudienceStoreSeed( {
	children,
	currentPost = audiencePosts[0],
}: {
	children: React.ReactNode;
	currentPost?: Post;
} ) {
	const [ ready, setReady ] = React.useState( false );

	React.useEffect( () => {
		const audienceDispatch = dispatch( store );
		audienceDispatch.setFields( audienceFields );
		audienceDispatch.addPosts( audiencePosts );
		audienceDispatch.setPagination( audiencePosts.length, 1 );
		audienceDispatch.setCurrentPost( currentPost );
		if ( currentPost.audience ) {
			audienceDispatch.addEstimate( currentPost.audience, currentPost.estimate || returningVisitorsEstimate );
		}
		setReady( true );
	}, [ currentPost ] );

	if ( ! ready ) {
		return null;
	}

	return <>{ children }</>;
}

const withAudienceData: Decorator = ( Story: React.ComponentType ) => {
	registerCorePermissions();
	return (
		<AudienceStoreSeed>
			<Story />
		</AudienceStoreSeed>
	);
};

const meta: Meta<typeof Manager> = {
	title: 'Audiences/Manager',
	component: Manager,
	decorators: [ withAudienceData ],
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
};

export default meta;

type Story = StoryObj<typeof Manager>;

export const Scene: Story = {
	render: () => (
		<Manager
			canCreate
			onSetCurrentPost={ () => undefined }
		/>
	),
};

export const Editor: Story = {
	render: () => (
		<Edit
			onViewList={ () => undefined }
		/>
	),
};

export const EstimateCard: Story = {
	parameters: {
		layout: 'centered',
	},
	render: () => (
		<div style={ { width: 360 } }>
			<Estimate
				estimate={ returningVisitorsEstimate }
				sparkline
				title="Audience size"
			/>
		</div>
	),
};

export const SelectControl: Story = {
	parameters: {
		layout: 'centered',
	},
	render: () => (
		<AudienceSelect
			audience={ audiencePosts[0].id }
			label="Audience"
			onClearSelection={ () => undefined }
			onSelect={ () => undefined }
		/>
	),
};

export const SortControl: Story = {
	parameters: {
		layout: 'centered',
	},
	render: () => (
		<AudienceSort
			canMoveDown
			canMoveUp
			index={ 1 }
			onMoveDown={ () => undefined }
			onMoveUp={ () => undefined }
		/>
	),
};
