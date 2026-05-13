import { isEqual } from 'lodash';
import React, { useState } from 'react';

import { createSlotFill } from '@wordpress/components';
import { useSelect } from '@wordpress/data';

import { defaultAudience } from '../../audiences/data/defaults';
import { Post, Rule } from '../../audiences/types';
import { resolveSelectedDate } from '../../data';
import { store } from '../../data';
import { useInterval } from '../../lib/hooks';
import { BlockFillProps, Filter, SelectableDate, StatsResult } from '../../utils/admin';

import Browsers from './Browsers';
import Country from './Country';
import Devices from './Devices';
import Header from './Header';
import Referrers from './Referrers';
import Searches from './Searches';
import Summary from './Summary';
import TopUrls from './TopUrls';
import TrafficGraphNew from './TrafficGraphNew';
import './App.css';

const BlockSlotFill = createSlotFill( 'Altis.Analytics.StatsBlock' );

export const BlockFill = BlockSlotFill.Fill;

// Refresh realtime feed every 30s.
const REALTIME_INTERVAL = 30 * 1000;

export default function App() {
	const [ filter, setFilter ] = useState<Filter>( {} );
	const [ period, setPeriod ] = useState<SelectableDate>( 'P7D' );
	const data = useSelect(
		select => {
			return select( store ).getStats( {
				filter,
				period,
			} );
		},
		[ filter, period ]
	);

	const currentAudience = useSelect(
		select => ( filter.audienceId ? select( store ).getPost( filter.audienceId ) : null ),
		[ filter ]
	);

	// Automatically refresh if real time.
	const isRealTime = period === 'PT30M';
	useInterval( () => {
		if ( ! isRealTime ) {
			return;
		}

		setFilter( {
			...filter,
			time: Date.now(),
		} );
	}, REALTIME_INTERVAL );

	const isLoadingStats = useSelect<boolean>( select => select( 'accelerate' ).getIsLoadingStats(), [] );

	const blockFillProps: BlockFillProps = {
		data,
		// Convenience function for adding a single rule.
		onAddRule: ( rule: Rule ) => {
			const audience = filter.audience || defaultAudience;
			const nextFilter = {
				...filter,
				audience: {
					...audience,
					groups: [
						{
							...audience.groups?.[0],
							include: audience.groups?.[0]?.include || 'all',
							rules: [ ...audience.groups?.[0]?.rules?.filter( r => !! r.field ) || [], rule ],
						},
						...audience.groups?.slice( 1 ) || [],
					],
				},
			};
			setFilter( nextFilter );
		},
		onUpdateFilter: setFilter, // callback => this.setState( state => ( { filter: callback( state.filter ) } ) ),
	};

	const isNew = ! filter.audienceId;
	const hasAudienceFilter = !! filter.audience;
	const isModified = ! currentAudience || ! isEqual( filter.audience, currentAudience.audience );

	return (
		<main className="App tailwind">
			<Header
				filter={ filter }
				period={ period }
				onChangePeriod={ setPeriod }
				onRefresh={ () =>
					setFilter( {
						...filter,
						time: Date.now(),
					} ) }
				onUpdateFilter={ setFilter }
			/>

			<div className="mx-2 lg:mx-16 mb-4 flex justify-between">
				{ currentAudience ? (
					<p>
						Selected audience <span className="font-semibold">{ currentAudience.title.rendered }</span>
						{ isModified ? ' (modified)' : '' }
					</p>
				) : (
					<p>
						Selected audience <span className="font-semibold">All visitors</span>
					</p>
				) }
				{ /* <div className="flex items-center gap-4">
					{ ! isNew && (
						<button
							className={ [
								'text-md text-blue-600 hover:text-blue-800',
								( ! hasAudienceFilter || ! isModified ) ? 'opacity-50 cursor-not-allowed' : '',
							].join( ' ' ) }
							disabled={ ! hasAudienceFilter || ! isModified }
							onClick={ () => { console.log( 'saving' ) } }
						>
							Update audience →
						</button>
					) }
					<button
						className={ [
							'text-md text-blue-600 hover:text-blue-800',
							( ! hasAudienceFilter || ! isModified ) ? 'opacity-50 cursor-not-allowed' : '',
						].join( ' ' ) }
						disabled={ ! hasAudienceFilter || ! isModified }
						onClick={ () => { console.log( 'saving' ) } }
					>
						Save as new audience →
					</button>
				</div> */ }
			</div>

			<Summary data={ data } />

			<TrafficGraphNew
				data={ data }
				isLoading={ isLoadingStats }
				period={ resolveSelectedDate( period, null ) }
			/>

			<div className="mx-2 lg:mx-16 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
				<BlockSlotFill.Slot fillProps={ blockFillProps } />

				<BlockFill>{ ( props: BlockFillProps ) => <TopUrls { ...props } /> }</BlockFill>
				<BlockFill>{ ( props: BlockFillProps ) => <Searches { ...props } /> }</BlockFill>
				<BlockFill>{ ( props: BlockFillProps ) => <Country { ...props } /> }</BlockFill>
				<BlockFill>{ ( props: BlockFillProps ) => <Referrers { ...props } /> }</BlockFill>
				<BlockFill>{ ( props: BlockFillProps ) => <Devices { ...props } /> }</BlockFill>
				<BlockFill>{ ( props: BlockFillProps ) => <Browsers { ...props } /> }</BlockFill>
			</div>
		</main>
	);
}
