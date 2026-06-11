import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { store } from '../../data';
import { usePersistentState } from '../../data/hooks';
import { useFullscreenMode } from '../../lib/hooks';
import { InitialData, Duration } from '../../utils/admin';
import List from '../components/List';
import { StickyPeriodBar, REALTIME_INTERVAL_SECONDS } from '../components/shared/StickyPeriodBar';

import BreakdownPanel from './BreakdownPanel';
import ConnectionSuccessDialog from './ConnectionSuccessDialog';
import HeroChart from './HeroChart';
import OnboardingBar from './OnboardingBar';
import Welcome from './Welcome';

const isConnected = new URLSearchParams( window.location.search ).get( 'connected' ) === '1';

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
	postTypes: InitialData['postTypes'],
	user: InitialData['user'],
	showWelcome: boolean,
	onboarding?: InitialData['onboarding'],
}

export default function Dashboard( props: Props ) {
	const [ period, setPeriod ] = usePersistentState<Duration>( 'Content Explorer-period', 'P7D' );
	const [ checklistDismissed, setChecklistDismissed ] = usePersistentState<boolean>( 'onboarding-checklist-dismissed', false );
	const [ isFullscreen, toggleFullscreen ] = useFullscreenMode();

	const showChecklist = !! props.onboarding && ! checklistDismissed && ! isFullscreen;

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

	return (
		<div className="Dashboard">
			{ isConnected && <ConnectionSuccessDialog /> }
			{ props.showWelcome ? (
				<Welcome user={ props.user } />
			) : null }
			{ showChecklist && props.onboarding && (
				<OnboardingBar
					onboarding={ props.onboarding }
					userName={ props.user.name }
					onDismiss={ () => setChecklistDismissed( true ) }
				/>
			) }
			<div className="tailwind">
				<StickyPeriodBar
					isFullscreen={ isFullscreen }
					period={ period }
					realtimeTick={ ringTick }
					onChange={ changePeriod }
					onToggleFullscreen={ toggleFullscreen }
				/>
				<div className="mx-4 lg:mx-16">
					<PeriodCrossfade periodKey={ period }>
						<HeroChart period={ period } realtimeTick={ realtimeTick } />
						<div className="mt-2 mb-12">
							<BreakdownPanel period={ period } realtimeTick={ realtimeTick } />
						</div>
					</PeriodCrossfade>
				</div>
			</div>
			<List
				currentUser={ props.user }
				filters={ [ 'all', 'blocks', 'mine' ] }
				hidePeriodFilter
				listId="Content Explorer"
				period={ period }
				postTypes={ props.postTypes }
				refresh={ realtimeTick }
				searchPlaceholder={ __( 'Search Pages, Posts & Blocks', 'altis' ) }
				onSetPeriod={ changePeriod }
			/>
		</div>
	);
}
