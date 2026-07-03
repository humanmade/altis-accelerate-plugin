import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { analyticsAggregations } from '../../fixtures';
import type { Duration } from '../../utils/admin';

import BreakdownPanel from './BreakdownPanel';
import { AnimatedNumber } from './BreakdownPanel/AnimatedNumber';
import { CountryTileBody } from './BreakdownPanel/CountryTile';
import type { DimensionDrill, DrillTarget } from './BreakdownPanel/RowCell';
import { RowLabel, ValueCell } from './BreakdownPanel/RowCell';
import { StatTile } from './BreakdownPanel/StatTile';

import '../index.scss';

const postTypes = [
	{
		name: 'post',
		label: 'Posts',
		singular_label: 'Post',
	},
	{
		name: 'page',
		label: 'Pages',
		singular_label: 'Page',
	},
	{
		name: 'wp_block',
		label: 'Blocks',
		singular_label: 'Block',
	},
];

const setupDashboardData = () => {
	window.AltisAccelerateDashboardData = {
		post_types: postTypes,
		version: 'storybook',
		home_url: 'https://pantryandplate.example',
		screen: 'analytics',
		location: 'storybook',
		tracking: {
			opt_in: true,
		},
		user: {
			id: 11,
			name: 'Mara Ellis',
		},
		welcomed: true,
		onboarding: {
			connected_at: 1719388800,
			first_test_created: 1719475200,
			authorize_url: '#connect',
		},
		outbound_tracking_enabled: true,
		timezone: {
			string: 'America/New_York',
			offset: -4,
		},
	};
};

setupDashboardData();

const listSkeleton = (
	<ul className="flex flex-col space-y-1.5">
		{ [ 88, 72, 64, 52 ].map( width => (
			<li key={ width } className="flex items-center gap-3">
				<div className="relative h-8 min-w-0 flex-1">
					<div className="absolute inset-y-0 left-0 rounded bg-muted" style={ { width: `${ width }%` } } />
				</div>
				<div className="h-3 w-8 shrink-0 rounded-sm bg-muted" />
			</li>
		) ) }
	</ul>
);

const sampleRows = [
	{
		label: 'Five Summer Salads for the Grill',
		value: 6050,
		width: 100,
	},
	{
		label: 'A Weeknight Tomato Tart That Still Feels Special',
		value: 2410,
		width: 40,
	},
	{
		label: 'Crispy Lemon Herb Chicken with New Potatoes',
		value: 1840,
		width: 30,
	},
];

function formatDrillTarget( target: DrillTarget | null ) {
	if ( ! target ) {
		return 'None';
	}
	if ( Array.isArray( target ) ) {
		return target.map( item => `${ item.field }: ${ item.value }` ).join( ', ' );
	}
	if ( 'path' in target ) {
		return `Path: ${ target.path }`;
	}
	return `${ target.field }: ${ target.value }`;
}

function DrillableBreakdownPanel( args: React.ComponentProps<typeof BreakdownPanel> ) {
	const [ target, setTarget ] = React.useState<DrillTarget | null>( null );
	return (
		<div className="space-y-4">
			<BreakdownPanel { ...args } onDrill={ setTarget } />
			<div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
				Last drill: { formatDrillTarget( target ) }
			</div>
		</div>
	);
}

const meta: Meta<typeof BreakdownPanel> = {
	title: 'Analytics/BreakdownPanel',
	component: BreakdownPanel,
	args: {
		period: 'P7D' as Duration,
		realtimeTick: 0,
	},
	parameters: {
		accelerateLayout: 'page',
		layout: 'fullscreen',
	},
	render: args => (
		<div className="Dashboard tailwind p-6">
			<DrillableBreakdownPanel { ...args } />
		</div>
	),
};

export default meta;

type Story = StoryObj<typeof BreakdownPanel>;

export const Panel: Story = {};

export const StatTileLoaded: Story = {
	render: () => (
		<div className="Dashboard tailwind max-w-lg p-6">
			<StatTile
				body={
					<ul className="flex flex-col space-y-1.5 group/tray">
						{ sampleRows.map( item => (
							<li key={ item.label } className="group flex items-center gap-3">
								<span className="relative block h-8 min-w-0 flex-1">
									<span
										aria-hidden="true"
										className="absolute inset-y-0 left-0 rounded bg-brand/15"
										style={ { width: `${ item.width }%` } }
									/>
									<RowLabel label={ item.label } value={ item.label } />
								</span>
								<ValueCell total={ 47118 } value={ item.value }>
									<span className="!m-0 !flex !h-8 !items-center !justify-end !text-sm !leading-none !text-gray-900 tabular-nums">
										<AnimatedNumber value={ item.value } />
									</span>
								</ValueCell>
							</li>
						) ) }
					</ul>
				}
				skeleton={ listSkeleton }
				state="loaded"
				title="Top content"
			/>
		</div>
	),
};

export const CountryTile: Story = {
	render: () => (
		<div className="Dashboard tailwind max-w-lg p-6">
			<StatTile
				body={
					<CountryTileBody
						byCountry={ analyticsAggregations.by_country }
						total={ 47118 }
						onSelect={ () => undefined }
					/>
				}
				skeleton={ listSkeleton }
				state="loaded"
				title="Country"
			/>
		</div>
	),
};

export const RowCellsAndDrillTargets: Story = {
	render: () => {
		const drills: DimensionDrill[] = [
			{
				field: 'country',
				value: 'US',
			},
			{
				field: 'referer',
				value: 'google.com',
			},
		];
		return (
			<div className="Dashboard tailwind max-w-lg p-6">
				<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
					<ul className="flex flex-col space-y-1.5 group/tray">
						<li className="flex items-center gap-3">
							<span className="relative block h-8 min-w-0 flex-1">
								<span aria-hidden="true" className="absolute inset-y-0 left-0 rounded bg-brand/15" style={ { width: '72%' } } />
								<RowLabel label="google.com" value="https://google.com/search?q=recipes" />
							</span>
							<ValueCell total={ 47118 } value={ 12640 }>
								<span className="!m-0 !flex !h-8 !items-center !justify-end !text-sm !leading-none !text-gray-900 tabular-nums">
									12,640
								</span>
							</ValueCell>
						</li>
					</ul>
					<div className="mt-4 flex flex-wrap gap-2">
						{ drills.map( drill => (
							<span key={ `${ drill.field }-${ drill.value }` } className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
								{ drill.field }: { drill.value }
							</span>
						) ) }
					</div>
				</div>
			</div>
		);
	},
};

export const AnimatedNumberTile: Story = {
	render: () => (
		<div className="Dashboard tailwind max-w-xs p-6">
			<StatTile
				body={
					<div className="text-4xl font-semibold tabular-nums text-gray-900">
						<AnimatedNumber value={ 47118 } />
					</div>
				}
				skeleton={ <div className="h-10 w-32 rounded bg-muted" /> }
				state="loaded"
				title="Page views"
			/>
		</div>
	),
};
