import { isEqual } from 'lodash';
import { ChevronsUpDown, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { createSlotFill } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import {
	REALTIME_INTERVAL_SECONDS,
	StickyPeriodBar,
} from '../../accelerate/components/shared/StickyPeriodBar';
import { defaultAudience } from '../../audiences/data/defaults';
import { Post, Rule } from '../../audiences/types';
import { resolveSelectedDate, store } from '../../data';
import { useFullscreenMode } from '../../lib/hooks';
import { BlockFillProps, Duration, Filter, StatsResult } from '../../utils/admin';

import Browsers from './Browsers';
import Country from './Country';
import Devices from './Devices';
import FilterEditor from './FilterEditor';
import FilterSummary from './FilterSummary';
import Referrers from './Referrers';
import Searches from './Searches';
import Summary from './Summary';
import TopUrls from './TopUrls';
import TrafficGraphNew from './TrafficGraphNew';
import './App.css';

import { Button } from '@/components/ui/button';

const BlockSlotFill = createSlotFill( 'Altis.Analytics.StatsBlock' );

export const BlockFill = BlockSlotFill.Fill;

export default function App() {
	const [ filter, setFilter ] = useState<Filter>( {} );
	const [ period, setPeriod ] = useState<Duration>( 'P7D' );
	const [ showingEditor, setShowingEditor ] = useState( false );
	const [ nextFilter, setNextFilter ] = useState<Filter>( {} );

	const [ isFullscreen, toggleFullscreen ] = useFullscreenMode();

	// Realtime tick — fires REALTIME_INTERVAL_SECONDS after each load completes.
	const isRealtime = period === 'PT30M';
	const [ realtimeTick, setRealtimeTick ] = useState( 0 );

	const data = useSelect<StatsResult>(
		select => select( store ).getStats( {
			filter,
			period,
		} ),
		[ filter, period ]
	);

	const currentAudience = useSelect<Post | null>(
		select => ( filter.audienceId ? select( store ).getPost( filter.audienceId ) : null ),
		[ filter ]
	);

	const isLoadingStats = useSelect<boolean>(
		select => select( 'accelerate' ).getIsLoadingStats(),
		[]
	);
	const prevLoading = useRef( isLoadingStats );

	useEffect( () => {
		const wasLoading = prevLoading.current;
		prevLoading.current = isLoadingStats;

		if ( ! isRealtime ) {
			return;
		}

		if ( wasLoading && ! isLoadingStats ) {
			const id = setTimeout( () => {
				setRealtimeTick( t => t + 1 );
				setFilter( prev => ( {
					...prev,
					time: Date.now(),
				} ) );
			}, REALTIME_INTERVAL_SECONDS * 1000 );
			return () => clearTimeout( id );
		}
	}, [ isRealtime, isLoadingStats ] );

	const isModified = ! currentAudience || ! isEqual( filter.audience, currentAudience.audience );
	const hasFilters = !! filter.path || !! filter.audience;

	const blockFillProps: BlockFillProps = {
		data,
		onAddRule: ( rule: Rule ) => {
			const audience = filter.audience || defaultAudience;
			setFilter( {
				...filter,
				audience: {
					...audience,
					groups: [
						{
							...audience.groups?.[ 0 ],
							include: audience.groups?.[ 0 ]?.include || 'all',
							rules: [ ...audience.groups?.[ 0 ]?.rules?.filter( r => !! r.field ) || [], rule ],
						},
						...audience.groups?.slice( 1 ) || [],
					],
				},
			} );
		},
		onUpdateFilter: setFilter,
	};

	const onOpenFilters = () => {
		setNextFilter( filter );
		setShowingEditor( true );
	};

	return (
		<main className="App tailwind">
			<StickyPeriodBar
				isFullscreen={ isFullscreen }
				period={ period }
				realtimeTick={ realtimeTick }
				onChange={ setPeriod }
				onToggleFullscreen={ toggleFullscreen }
			/>

			<div className="mx-4 lg:mx-16">
				{ /* Audience + filter row */ }
				<div className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-1 items-center gap-2 min-w-0">
						<Button
							className="!w-full !max-w-md !justify-between !gap-2"
							variant="outline"
							onClick={ onOpenFilters }
						>
							<span className={ `grow truncate text-left ${ hasFilters ? 'text-foreground' : 'text-muted-foreground' }` }>
								<FilterSummary filter={ filter } />
							</span>
							<ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
						</Button>
						{ hasFilters && (
							<Button
								className="!h-6 !w-6 !rounded-full !p-0"
								size="icon"
								title={ __( 'Clear filters', 'altis' ) }
								variant="ghost"
								onClick={ () => setFilter( {} ) }
							>
								<X className="h-4 w-4" />
							</Button>
						) }
					</div>
					<p className="text-sm text-muted-foreground">
						{ currentAudience ? (
							<>
								{ __( 'Selected audience', 'altis' ) }{ ' ' }
								<span className="font-semibold text-foreground">{ currentAudience.title.rendered }</span>
								{ isModified ? __( ' (modified)', 'altis' ) : '' }
							</>
						) : (
							<>
								{ __( 'Selected audience', 'altis' ) }{ ' ' }
								<span className="font-semibold text-foreground">{ __( 'All visitors', 'altis' ) }</span>
							</>
						) }
					</p>
				</div>

				<Summary data={ data } period={ period } realtimeTick={ realtimeTick } />

				<TrafficGraphNew
					data={ data }
					isLoading={ isLoadingStats }
					period={ resolveSelectedDate( period, null ) }
				/>

				<div className="mt-2 mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<BlockSlotFill.Slot fillProps={ blockFillProps } />
					<BlockFill>{ ( props: BlockFillProps ) => <TopUrls { ...props } /> }</BlockFill>
					<BlockFill>{ ( props: BlockFillProps ) => <Searches { ...props } /> }</BlockFill>
					<BlockFill>{ ( props: BlockFillProps ) => <Country { ...props } /> }</BlockFill>
					<BlockFill>{ ( props: BlockFillProps ) => <Referrers { ...props } /> }</BlockFill>
					<BlockFill>{ ( props: BlockFillProps ) => <Devices { ...props } /> }</BlockFill>
					<BlockFill>{ ( props: BlockFillProps ) => <Browsers { ...props } /> }</BlockFill>
				</div>
			</div>

			<FilterEditor
				nextFilter={ nextFilter }
				showingEditor={ showingEditor }
				onSetShowingEditor={ setShowingEditor }
				onUpdateFilter={ setFilter }
				onUpdateNextFilter={ setNextFilter }
			/>
		</main>
	);
}
