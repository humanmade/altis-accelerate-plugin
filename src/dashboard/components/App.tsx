import { isEqual } from 'lodash';
import React, { useState } from 'react';

import { createSlotFill } from '@wordpress/components';
import { useSelect } from '@wordpress/data';

import { Post } from '../../audiences/types';
import { resolveSelectedDate } from '../../data';
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

export default function App() {

	const [ filter, setFilter ] = useState<Filter>( {} );
	const [ period, setPeriod ] = useState<SelectableDate>( 'P7D' );
	const data = useSelect<StatsResult>( select => {
		return select( 'accelerate' ).getStats( {
			filter,
			period,
			interval: '1 day',
		} );
	}, [ filter, period ] );
	const currentAudience: Post | null = useSelect( select => filter.audienceId ? select( 'audience' ).getPost( filter.audienceId ) : null );

	const blockFillProps: BlockFillProps = {
		data,
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
				onRefresh={ () => setFilter( {
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

			<Summary
				data={ data }
			/>

			<TrafficGraphNew
				data={ data }
				period={ resolveSelectedDate( period, null ) }
			/>

			<div className="mx-2 lg:mx-16 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
				<BlockSlotFill.Slot
					fillProps={ blockFillProps }
				/>

				<BlockFill>
					{ ( props: BlockFillProps ) => <TopUrls { ...props } /> }
				</BlockFill>
				<BlockFill>
					{ ( props: BlockFillProps ) => <Searches { ...props } /> }
				</BlockFill>
				<BlockFill>
					{ ( props: BlockFillProps ) => <Country { ...props } /> }
				</BlockFill>
				<BlockFill>
					{ ( props: BlockFillProps ) => <Referrers { ...props } /> }
				</BlockFill>
				<BlockFill>
					{ ( props: BlockFillProps ) => <Devices { ...props } /> }
				</BlockFill>
				<BlockFill>
					{ ( props: BlockFillProps ) => <Browsers { ...props } /> }
				</BlockFill>
			</div>
		</main>
	);
}
