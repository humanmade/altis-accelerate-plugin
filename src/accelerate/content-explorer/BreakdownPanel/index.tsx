import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

import { usePersistentState } from '../../../data/hooks';
import { Duration, StatGroup } from '../../../utils/admin';

import { AnimatedNumber } from './AnimatedNumber';
import { prettyLabel } from './prettyLabel';
import { StatTile } from './StatTile';
import { useBreakdownStats } from './useBreakdownStats';
import { useTopContent } from './useTopContent';

import { CompactSelect } from '@/components/CompactSelect';
import { TileGrid } from '@/components/TileGrid';
import { Caption, Overline } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import type { DataState } from '@/types/component-states';

const LIST_LIMIT = 10;
// Brand color (#9332FF) for the rank-up pulse. Hardcoded because motion's
// imperative animate sets inline style which overrides the tailwind
// `bg-brand/10` class. Keep in sync with `--color-brand`.
const PULSE_KEYFRAMES = [
	'rgba(147, 50, 255, 0.1)',
	'rgba(147, 50, 255, 0.32)',
	'rgba(147, 50, 255, 0.1)',
];

interface Props {
	period: Duration;
	realtimeTick?: number;
}

function topN( group: StatGroup | undefined, n = LIST_LIMIT ): { key: string; value: number }[] {
	if ( ! group ) {
		return [];
	}
	return Object.entries( group )
		.map( ( [ key, value ] ) => ( {
			key,
			value: Number( value ) || 0,
		} ) )
		.sort( ( a, b ) => b.value - a.value )
		.slice( 0, n );
}

// Tweaks via motion: rows re-flow when their rank changes, bars width-tween,
// numbers count up/down. Spring tuned for a calm wall-display rhythm —
// firm but never wobbly.
const ROW_TRANSITION = {
	layout: {
		type: 'spring',
		stiffness: 320,
		damping: 36,
		mass: 0.6,
	},
	opacity: {
		duration: 0.28,
		ease: [ 0.2, 0, 0, 1 ],
	},
} as const;

// `label` is an optional display override: the Top content tile keys rows by
// post id (stable rank identity) but shows the decoded post title.
type Item = { key: string; value: number; label?: string };

interface RowProps {
	item: Item;
	max: number;
	improvedAt: number;
	reduced: boolean | null;
	barTransition: object;
}

/**
 * Row sub-component. Built against the canonical row contract
 * documented in src/components/CLAUDE.md (h-8 bar IS the row,
 * bg-brand/15, label overlaid absolute left-2). Layers BreakdownPanel-
 * specific motion (rank pulse + micro-bounce) on top of the shared
 * silhouette.
 */
const Row = React.memo( function Row( { item, max, improvedAt, reduced, barTransition }: RowProps ) {
	const barRef = React.useRef<HTMLDivElement>( null );
	const rowRef = React.useRef<HTMLLIElement>( null );
	const pct = item.value === 0 ? 0 : Math.max( 2, ( item.value / max ) * 100 );

	React.useEffect( () => {
		if ( ! improvedAt || reduced ) {
			return;
		}
		// Bar pulse — brand brightens then settles back over 700ms
		// ease-out. Imperative because motion's keyframe array on a
		// prop forces the width animation to compete; isolating the
		// color animation keeps the width spring clean.
		if ( barRef.current ) {
			animate(
				barRef.current,
				{ backgroundColor: PULSE_KEYFRAMES },
				{
					duration: 0.7,
					ease: [ 0.2, 0, 0, 1 ],
				}
			);
		}
		// Row micro-bounce — 2px lift then settle over 500ms. Paired
		// with the bar pulse it reads as "this one moved up".
		if ( rowRef.current ) {
			animate(
				rowRef.current,
				{ y: [ 0, -2, 0 ] },
				{
					duration: 0.5,
					ease: [ 0.2, 0, 0, 1 ],
				}
			);
		}
	}, [ improvedAt, reduced ] );

	return (
		<motion.li
			ref={ rowRef }
			animate={ {
				opacity: 1,
				y: 0,
			} }
			className="flex items-center gap-3"
			exit={ {
				opacity: 0,
				y: -6,
			} }
			initial={ {
				opacity: 0,
				y: 6,
			} }
			layout={ ! reduced }
			transition={ ROW_TRANSITION }
		>
			<div className="relative h-8 min-w-0 flex-1">
				<motion.div
					ref={ barRef }
					animate={ { width: `${ pct }%` } }
					aria-hidden="true"
					className="absolute inset-y-0 left-0 flex items-center rounded bg-brand/15"
					initial={ false }
					transition={ barTransition }
				/>
				<p
					className="!absolute !left-2 !top-1/2 !-translate-y-1/2 !m-0 !truncate !whitespace-nowrap !text-sm !text-gray-900 max-w-full pr-2"
					title={ item.label ?? prettyLabel( item.key ) }
				>
					{ item.label ?? prettyLabel( item.key ) }
				</p>
			</div>
			<p className="!m-0 !flex !h-8 !items-center !justify-end !text-sm !leading-none !text-gray-900 !shrink-0 tabular-nums">
				<AnimatedNumber value={ item.value } />
			</p>
		</motion.li>
	);
// topN() rebuilds item objects on every call via Object.entries, so item
// reference always changes even when key/value are identical. Compare
// fields directly so the memo actually fires on unchanged rows.
}, ( prev, next ) =>
	prev.item.key === next.item.key &&
	prev.item.value === next.item.value &&
	prev.item.label === next.item.label &&
	prev.max === next.max &&
	prev.improvedAt === next.improvedAt &&
	prev.reduced === next.reduced
);

function HostList( { items }: { items: Item[] } ) {
	const reduced = useReducedMotion();
	const max = Math.max( 1, ...items.map( i => i.value ) );
	const barTransition = reduced
		? { duration: 0 }
		: {
			type: 'spring' as const,
			stiffness: 260,
			damping: 32,
			mass: 0.7,
		};

	// Track previous rank per key for asymmetric rank-up flourish.
	// improvedAt is a per-render snapshot used as a dependency in each
	// Row's useEffect — only rows that climbed get a non-zero value.
	const prevRanksRef = React.useRef<Map<string, number>>( new Map() );
	const renderTs = Date.now();
	const improvedAt = new Map<string, number>();
	items.forEach( ( item, idx ) => {
		const prev = prevRanksRef.current.get( item.key );
		if ( prev !== undefined && prev > idx ) {
			improvedAt.set( item.key, renderTs );
		}
	} );
	// Commit new ranks AFTER render so the next render's comparison is
	// correct. No mutation during render.
	React.useEffect( () => {
		const next = new Map<string, number>();
		items.forEach( ( item, idx ) => next.set( item.key, idx ) );
		prevRanksRef.current = next;
	} );

	return (
		<motion.ul className="flex flex-col space-y-1.5" layout={ ! reduced }>
			<AnimatePresence initial={ false } mode="popLayout">
				{ items.map( item => (
					<Row
						key={ item.key }
						barTransition={ barTransition }
						improvedAt={ improvedAt.get( item.key ) ?? 0 }
						item={ item }
						max={ max }
						reduced={ reduced }
					/>
				) ) }
			</AnimatePresence>
		</motion.ul>
	);
}

// Skeleton/empty preview that hints at the shape of the content.
// Used both for `loading` and `empty` states so the user always sees the
// layout they're about to get.
function ListPreview( { dimmed = false }: { dimmed?: boolean } ) {
	// 10 placeholder bars match the 10-row content the card will hold
	// once data lands. Varied widths so the silhouette doesn't look
	// like a stack of identical bars.
	const widths = [ 90, 70, 80, 55, 65, 60, 45, 50, 40, 35 ];
	return (
		<ul aria-hidden="true" className={ cn( 'flex flex-col space-y-1.5', dimmed && 'opacity-60' ) }>
			{ widths.map( ( w, i ) => (
				<li key={ i } className="flex items-center gap-3">
					<div className="relative h-8 min-w-0 flex-1">
						<div className="absolute inset-y-0 left-0 rounded bg-muted" style={ { width: `${ w }%` } } />
					</div>
					<div className="h-3 w-8 shrink-0 rounded-sm bg-muted" />
				</li>
			) ) }
		</ul>
	);
}

function EmptyHint( { label }: { label: string } ) {
	return (
		<div className="relative">
			<ListPreview dimmed />
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				<Caption className="!rounded-md !bg-background/90 !px-3 !py-1 !text-xs !shadow-xs">
					{ label }
				</Caption>
			</div>
		</div>
	);
}

function deriveListState( base: 'loading' | 'loaded' | 'empty' | 'error', count: number ): DataState {
	if ( base === 'error' || base === 'loading' ) {
		return base;
	}
	return count > 0 ? 'loaded' : 'empty';
}

type UtmMode = 'source_campaign' | 'source_medium' | 'campaign';

const UTM_MODES: { value: UtmMode; label: string }[] = [
	{
		value: 'source_campaign',
		label: __( 'source / campaign', 'altis' ),
	},
	{
		value: 'source_medium',
		label: __( 'source / medium', 'altis' ),
	},
	{
		value: 'campaign',
		label: __( 'campaign only', 'altis' ),
	},
];

function pickUtmGroup(
	stats: ReturnType<typeof useBreakdownStats>[ 'stats' ],
	mode: UtmMode
): StatGroup | undefined {
	const g = stats.data?.stats;
	if ( ! g ) {
		return undefined;
	}
	switch ( mode ) {
		case 'source_medium':
			return g.by_source_medium;
		case 'campaign':
			return g.by_campaign;
		case 'source_campaign':
		default:
			return g.by_source_campaign;
	}
}

export default function BreakdownPanel( { period, realtimeTick }: Props ) {
	const outboundEnabled = window.AltisAccelerateDashboardData?.outbound_tracking_enabled ?? false;
	const { stats, refresh } = useBreakdownStats( period, realtimeTick, outboundEnabled );
	const topContent = useTopContent( period, realtimeTick );
	const [ utmMode, setUtmMode ] = usePersistentState<UtmMode>(
		'utm-card-mode',
		'source_campaign'
	);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	const referrers = React.useMemo( () => topN( stats.data?.stats?.by_referer ), [ stats.data?.stats?.by_referer ] );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const utm = React.useMemo( () => topN( pickUtmGroup( stats, utmMode ) ), [ stats.data, utmMode ] );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const outbound = React.useMemo( () => topN( stats.data?.stats?.by_outbound_host ), [ stats.data?.stats?.by_outbound_host ] );

	const topState = deriveListState( topContent.state, topContent.items.length );
	const refState = deriveListState( stats.state, referrers.length );
	const utmState = deriveListState( stats.state, utm.length );
	const outboundState: DataState = ! outboundEnabled
		? 'empty'
		: deriveListState( stats.state, outbound.length );

	const utmAction = (
		<CompactSelect
			align="end"
			label={ __( 'Group by', 'altis' ) }
			options={ UTM_MODES }
			value={ utmMode }
			onChange={ v => setUtmMode( v as UtmMode ) }
		/>
	);

	return (
		<div className="tailwind">
			<TileGrid variant="panel">
				<StatTile
					body={ <HostList items={ topContent.items } /> }
					empty={ <EmptyHint label={ __( 'No content yet', 'altis' ) } /> }
					skeleton={ <ListPreview /> }
					state={ topState }
					title={ __( 'Top content', 'altis' ) }
					onRetry={ topContent.refresh }
				/>
				<StatTile
					body={ <HostList items={ referrers } /> }
					empty={ <EmptyHint label={ __( 'No referrers', 'altis' ) } /> }
					skeleton={ <ListPreview /> }
					state={ refState }
					title={ __( 'Top referrers', 'altis' ) }
					onRetry={ refresh }
				/>
				<StatTile
					action={ utmAction }
					body={ <HostList items={ utm } /> }
					empty={ <EmptyHint label={ __( 'No utm-tagged traffic', 'altis' ) } /> }
					skeleton={ <ListPreview /> }
					state={ utmState }
					title={ __( 'UTM', 'altis' ) }
					onRetry={ refresh }
				/>
				<StatTile
					body={ <HostList items={ outbound } /> }
					empty={
						outboundEnabled ? (
							<EmptyHint label={ __( 'No outbound clicks yet', 'altis' ) } />
						) : (
							<div className="relative">
								<ListPreview dimmed />
								<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
									<Caption className="!rounded-md !bg-background/90 !px-3 !py-1 !text-xs !shadow-xs">
										{ __( 'Turn on in Settings to start collecting clicks.', 'altis' ) }
									</Caption>
								</div>
							</div>
						)
					}
					skeleton={ <ListPreview /> }
					state={ outboundState }
					title={
						<span className="inline-flex items-center gap-2">
							{ __( 'Outbound clicks', 'altis' ) }
							{ ! outboundEnabled && (
								<Overline className="!rounded !bg-muted !px-1.5 !py-0.5 !text-[10px] !uppercase !leading-none">
									{ __( 'Off', 'altis' ) }
								</Overline>
							) }
						</span>
					}
					onRetry={ refresh }
				/>
			</TileGrid>
		</div>
	);
}
