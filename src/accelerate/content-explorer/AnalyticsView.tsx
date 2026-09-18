import { ChevronsUpDown, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { Post } from '../../audiences/types';
import FilterEditor from '../../dashboard/components/FilterEditor';
import FilterSummary from '../../dashboard/components/FilterSummary';
import { store } from '../../data';
import { usePersistentState } from '../../data/hooks';
import { Duration, Filter } from '../../utils/admin';
import { StickyPeriodBar, REALTIME_INTERVAL_SECONDS } from '../components/shared/StickyPeriodBar';

import BreakdownPanel from './BreakdownPanel';
import { DimensionDrill, DrillTarget } from './BreakdownPanel/RowCell';
import HeroChart from './HeroChart';

import { Button } from '@/components/ui/button';

// Minimal structural deep-equal for plain-JSON audience objects. Avoids a
// `lodash` external that is present in the analytics (dashboard) bundle but
// NOT the home-dashboard (accelerate) bundle this shared component now also
// loads into — importing it there throws "lodash is not defined" at module
// eval and blanks the page. Order-insensitive over object keys, matching the
// isEqual semantics this replaces.
function deepEqual( a: unknown, b: unknown ): boolean {
	if ( a === b ) {
		return true;
	}
	if ( typeof a !== 'object' || typeof b !== 'object' || a === null || b === null ) {
		return false;
	}
	const ak = Object.keys( a as Record<string, unknown> );
	const bk = Object.keys( b as Record<string, unknown> );
	if ( ak.length !== bk.length ) {
		return false;
	}
	return ak.every( k => deepEqual(
		( a as Record<string, unknown> )[ k ],
		( b as Record<string, unknown> )[ k ]
	) );
}

// Cross-fade the chart + BreakdownPanel when the period changes. The
// min-height floor matches the typical combined height (chart ~340 +
// gap + 4-tile panel ~360) so the page below doesn't jump while a
// new period's payload is mid-fetch. Reduced motion skips the
// AnimatePresence entirely and renders children directly.
function PeriodCrossfade( { periodKey, children }: { periodKey: Duration; children: React.ReactNode } ) {
	const reduced = useReducedMotion();
	if ( reduced ) {
		return <div className="min-h-[640px]">{ children }</div>;
	}
	return (
		<div className="min-h-[640px]">
			<AnimatePresence mode="popLayout">
				<motion.div
					key={ String( periodKey ) }
					animate={ { opacity: 1 } }
					exit={ { opacity: 0 } }
					initial={ { opacity: 0 } }
					transition={ {
						duration: 0.18,
						ease: [ 0.2, 0, 0, 1 ],
					} }
				>
					{ children }
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

interface Props {
	// Key for the persisted period selection. Distinct per surface so the
	// Dashboard and Analytics page remember their own period independently.
	periodPersistKey: string;
	// When true, render the audience/filter row and thread the resulting
	// filter into the body. When false/absent the filter is `{}` and no row
	// renders — the body behaves byte-identically to the unfiltered view.
	showFilters?: boolean;
	// Fullscreen is owned by the surface wrapper (one useFullscreenMode
	// instance per surface) and passed in, so the Dashboard can gate its
	// onboarding on the SAME state the period bar's toggle drives.
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}

/**
 * Shared analytics body used by both the WP-home Dashboard and the Analytics
 * page. Owns period state, the realtime-tick chain, the period bar, an
 * optional filter/audience row, and the HeroChart + BreakdownPanel.
 */
export default function AnalyticsView( { periodPersistKey, showFilters = false, isFullscreen, onToggleFullscreen }: Props ) {
	const [ period, setPeriod ] = usePersistentState<Duration>( periodPersistKey, 'P7D' );

	// The filter row starts visible on surfaces that opt in (Analytics page).
	// On surfaces that don't (the home Dashboard) a click-to-drill reveals it
	// so the applied facet shows in FilterSummary and the user can clear it.
	const [ filtersVisible, setFiltersVisible ] = useState( showFilters );
	// Re-reveal the filter row if the parent toggles showFilters on after mount
	// (e.g. the Analytics page conditionally rendering the view). Never force-hide
	// here — the user may have drilled in and made it visible intentionally.
	useEffect( () => {
		if ( showFilters ) {
			setFiltersVisible( true );
		}
	}, [ showFilters ] );

	// Filter/audience state — only meaningful when the filter row is shown.
	// While hidden the filter stays `{}` and nothing downstream changes.
	const [ filter, setFilter ] = useState<Filter>( {} );
	const [ showingEditor, setShowingEditor ] = useState( false );
	const [ nextFilter, setNextFilter ] = useState<Filter>( {} );

	// When the filter row scrolls up under the sticky bar, surface a compact
	// copy of the filter control inside the bar. Mirrors how the bar reveals
	// the AltisMark when stuck.
	const filterRowRef = useRef<HTMLDivElement>( null );
	const [ filterPast, setFilterPast ] = useState( false );
	useEffect( () => {
		if ( ! filtersVisible ) {
			setFilterPast( false );
			return;
		}
		const row = filterRowRef.current;
		if ( ! row ) {
			return;
		}
		// Bar's bottom edge from the viewport top: admin bar height (0 in
		// fullscreen) + the bar's own height (~52px).
		const topOffset = ( isFullscreen ? 0 : 32 ) + 52;
		const obs = new IntersectionObserver(
			( [ entry ] ) => setFilterPast( ! entry.isIntersecting ),
			{
				rootMargin: `-${ topOffset }px 0px 0px 0px`,
				threshold: 0,
			}
		);
		obs.observe( row );
		return () => obs.disconnect();
	}, [ filtersVisible, isFullscreen ] );

	// Realtime tick — fires REALTIME_INTERVAL_SECONDS after each load completes.
	// ringTick increments on load-complete so the ring resets at that moment,
	// giving an accurate "X seconds until next refresh" countdown.
	const isRealtime = period === 'PT30M';
	const [ realtimeTick, setRealtimeTick ] = useState( 0 );
	const [ ringTick, setRingTick ] = useState( 0 );
	const isLoadingStats = useSelect( select => select( store ).getIsLoadingStats() );
	const prevLoading = useRef( isLoadingStats );

	// Re-entering realtime: past ticks are cached by the data store, so the
	// stats selector returns the stale resolved payload without fetching —
	// no load-complete transition ever fires, and the polling chain below
	// never starts. Bump the tick to force a fresh fetch and restart the
	// chain. First-ever entry ( tick === 0 ) fetches uncached naturally.
	// Bumped here rather than in an effect so the period and tick updates
	// batch into one render — an effect leaves an intermediate render on
	// the stale tick, double-firing tick-keyed fetches downstream.
	const changePeriod = ( p: Duration ) => {
		if ( p === 'PT30M' && period !== 'PT30M' ) {
			setRealtimeTick( t => ( t > 0 ? t + 1 : t ) );
		}
		setPeriod( p );
	};

	useEffect( () => {
		const wasLoading = prevLoading.current;
		prevLoading.current = isLoadingStats;

		if ( ! isRealtime ) {
			return;
		}

		// Schedule the next tick once a load transitions from in-progress → done.
		if ( wasLoading && ! isLoadingStats ) {
			setRingTick( t => t + 1 );
			const id = setTimeout(
				() => setRealtimeTick( t => t + 1 ),
				REALTIME_INTERVAL_SECONDS * 1000
			);
			return () => clearTimeout( id );
		}
	}, [ isRealtime, isLoadingStats ] );

	const currentAudience = useSelect<Post | null>(
		select => ( filter.audienceId ? select( store ).getPost( filter.audienceId ) : null ),
		[ filter ]
	);

	const isModified = ! currentAudience || ! deepEqual( filter.audience, currentAudience.audience );
	const hasFilters = !! filter.path || !! filter.audience || Object.keys( filter.dimensions || {} ).length > 0;

	const onOpenFilters = () => {
		setNextFilter( filter );
		setShowingEditor( true );
	};

	// Click-to-drill (#669): a breakdown row narrows the view by its facet.
	// A `path` target replaces filter.path directly (Top content). Any other
	// target sets one or more event-level dimension filters: clicking the same
	// field replaces its value, different fields compose. This unifies what used
	// to be bespoke audience-rule drills (country/tech/referrer/UTM) into plain
	// dimension filters applied server-side from a whitelist.
	const onDrill = ( target: DrillTarget ) => {
		setFiltersVisible( true );
		if ( ! Array.isArray( target ) && 'path' in target ) {
			setFilter( prev => ( {
				...prev,
				path: target.path,
			} ) );
			return;
		}
		const drills: DimensionDrill[] = Array.isArray( target ) ? target : [ target ];
		setFilter( prev => {
			const dimensions = { ...prev.dimensions };
			for ( const { field, value } of drills ) {
				dimensions[ field ] = value;
			}
			return {
				...prev,
				dimensions,
			};
		} );
	};

	// Compact copy of the filter trigger, shown in the sticky bar once the
	// filter row scrolls out of view. Reuses the same handler/state.
	const filterControl = (
		<div className="flex items-center gap-1">
			<Button className="!h-8 !max-w-xs !justify-between !gap-2" size="sm" variant="outline" onClick={ onOpenFilters }>
				<span className={ `grow truncate text-left text-xs ${ hasFilters ? 'text-foreground' : 'text-muted-foreground' }` }>
					<FilterSummary filter={ filter } />
				</span>
				<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
			</Button>
			{ hasFilters && (
				<Button
					aria-label={ __( 'Clear filters', 'altis' ) }
					className="!h-6 !w-6 !shrink-0 !rounded-full !p-0"
					size="icon"
					variant="ghost"
					onClick={ () => setFilter( {} ) }
				>
					<X aria-hidden="true" className="h-4 w-4" />
				</Button>
			) }
		</div>
	);

	return (
		<div className="tailwind">
			<StickyPeriodBar
				filterSlot={ filtersVisible ? filterControl : null }
				isFullscreen={ isFullscreen }
				period={ period }
				realtimeTick={ ringTick }
				showFilterSlot={ filtersVisible && filterPast }
				onChange={ changePeriod }
				onToggleFullscreen={ onToggleFullscreen }
			/>
			<div className="mx-4 lg:mx-16">
				{ filtersVisible && (
					<div ref={ filterRowRef } className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
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
									aria-label={ __( 'Clear filters', 'altis' ) }
									className="!h-6 !w-6 !rounded-full !p-0"
									size="icon"
									variant="ghost"
									onClick={ () => setFilter( {} ) }
								>
									<X aria-hidden="true" className="h-4 w-4" />
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
				) }

				<PeriodCrossfade periodKey={ period }>
					<HeroChart filter={ filter } period={ period } realtimeTick={ realtimeTick } />
					<div className="mt-2 mb-12">
						<BreakdownPanel filter={ filter } period={ period } realtimeTick={ realtimeTick } onDrill={ onDrill } />
					</div>
				</PeriodCrossfade>
			</div>

			{ filtersVisible && (
				<FilterEditor
					nextFilter={ nextFilter }
					showingEditor={ showingEditor }
					onSetShowingEditor={ setShowingEditor }
					onUpdateFilter={ setFilter }
					onUpdateNextFilter={ setNextFilter }
				/>
			) }
		</div>
	);
}
