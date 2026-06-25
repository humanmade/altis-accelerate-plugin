import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

import { resolveSelectedDate } from '../../../data';
import { usePersistentState } from '../../../data/hooks';
import { Duration, Filter, StatGroup } from '../../../utils/admin';

import { AnimatedNumber } from './AnimatedNumber';
import { CountryTileBody, deriveCountryState } from './CountryTile';
import { formatEngaged } from './formatEngaged';
import { DrillTarget, RowLabel, ValueCell } from './RowCell';
import { StatTile } from './StatTile';
import { useBreakdownStats } from './useBreakdownStats';
import { useTopContent } from './useTopContent';
import { useTopEngaged } from './useTopEngaged';

import { CompactSelect } from '@/components/CompactSelect';
import { TileGrid } from '@/components/TileGrid';
import { Caption, Overline } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import type { DataState } from '@/types/component-states';

const LIST_LIMIT = 10;
// Must match the server-side rename of the empty-referer bucket in
// register_default_aggregations() (by_referer parse_result). The Direct row's
// key is this label, not a URL, so the referrer drill maps it back to ''.
const DIRECT_TRAFFIC_LABEL = __( 'Direct traffic', 'altis' );
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
	// Optional path/audience filter, threaded into every breakdown request.
	// Empty/absent keeps behavior byte-identical to the unfiltered view.
	filter?: Filter;
	// Click-to-drill (#669). When provided, rows become buttons that narrow the
	// view by their facet via a dimension filter: Top content (path), Country,
	// Tech (browser/OS), Referrers, UTM (campaign mode), and Search. Outbound
	// and Engaged time stay display-only.
	onDrill?: ( target: DrillTarget ) => void;
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
type Item = { key: string; value: number; label?: string; path?: string };

interface RowProps {
	item: Item;
	max: number;
	improvedAt: number;
	reduced: boolean | null;
	barTransition: object;
	format?: ( value: number ) => string;
	// Server period total — when present, the row shows a muted % on hover/focus
	// (#672). Omitted for the engaged-time tile (share-of-time isn't meaningful).
	total?: number;
	// When present the row becomes a drill button (#669); otherwise it's inert.
	onSelect?: ( item: Item ) => void;
}

/**
 * Row sub-component. Built against the canonical row contract
 * documented in src/components/CLAUDE.md (h-8 bar IS the row,
 * bg-brand/15, label overlaid absolute left-2). Layers BreakdownPanel-
 * specific motion (rank pulse + micro-bounce) on top of the shared
 * silhouette.
 */
const Row = React.memo( function Row( { item, max, improvedAt, reduced, barTransition, format, total, onSelect }: RowProps ) {
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

	const inner = (
		<>
			<span className="relative block h-8 min-w-0 flex-1">
				<motion.span
					ref={ barRef }
					animate={ { width: `${ pct }%` } }
					aria-hidden="true"
					className="absolute inset-y-0 left-0 flex items-center rounded bg-brand/15"
					initial={ false }
					transition={ barTransition }
				/>
				<RowLabel label={ item.label } value={ item.key } />
			</span>
			<ValueCell total={ total } value={ item.value }>
				<span className="!m-0 !flex !h-8 !items-center !justify-end !text-sm !leading-none !text-gray-900 tabular-nums">
					<AnimatedNumber format={ format } value={ item.value } />
				</span>
			</ValueCell>
		</>
	);

	return (
		<motion.li
			ref={ rowRef }
			animate={ {
				opacity: 1,
				y: 0,
			} }
			className="group"
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
			{ onSelect ? (
				<button
					className="flex w-full items-center gap-3 rounded text-left cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
					type="button"
					onClick={ () => onSelect( item ) }
				>
					{ inner }
				</button>
			) : (
				<div className="flex items-center gap-3">
					{ inner }
				</div>
			) }
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
	prev.reduced === next.reduced &&
	prev.format === next.format &&
	prev.total === next.total &&
	prev.onSelect === next.onSelect
);

function HostList( {
	items,
	format,
	total,
	onSelect,
	canSelect,
}: {
	items: Item[];
	format?: ( value: number ) => string;
	total?: number;
	onSelect?: ( item: Item ) => void;
	// When provided, gates per-row drillability. Rows where canSelect returns
	// false stay inert (div, not button) even when onSelect is defined.
	canSelect?: ( item: Item ) => boolean;
} ) {
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
		<motion.ul className="flex flex-col space-y-1.5 group/tray" layout={ ! reduced }>
			<AnimatePresence initial={ false } mode="popLayout">
				{ items.map( item => {
					const rowSelect = onSelect && ( ! canSelect || canSelect( item ) ) ? onSelect : undefined;
					return (
						<Row
							key={ item.key }
							barTransition={ barTransition }
							format={ format }
							improvedAt={ improvedAt.get( item.key ) ?? 0 }
							item={ item }
							max={ max }
							reduced={ reduced }
							total={ total }
							onSelect={ rowSelect }
						/>
					);
				} ) }
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

type TechMode = 'by_os' | 'by_browser';

const TECH_MODES: { value: TechMode; label: string }[] = [
	{
		value: 'by_os',
		label: __( 'Devices', 'altis' ),
	},
	{
		value: 'by_browser',
		label: __( 'Browsers', 'altis' ),
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

export default function BreakdownPanel( { period, realtimeTick, filter = {}, onDrill }: Props ) {
	const outboundEnabled = window.AltisAccelerateDashboardData?.outbound_tracking_enabled ?? false;
	const { stats, refresh } = useBreakdownStats( period, realtimeTick, outboundEnabled, filter );
	const topContent = useTopContent( period, realtimeTick, filter );
	const topEngaged = useTopEngaged( period, realtimeTick, filter );

	// Server period total — the denominator for the row % share (#672). Never
	// derived from the displayed top-N rows (that undercounts).
	const totalViews = stats.data?.stats?.summary?.views ?? 0;

	// Engaged time rides the shared stats payload (stats.summary.engaged).
	const engaged = stats.data?.stats?.summary?.engaged ?? null;

	// Engaged time is always on, but only data after it was deployed is exact.
	// Flag the period as approximate when it starts before the first engaged
	// event we have in range.
	const engagedFirstSeen = engaged?.first_seen ?? null;
	const engagedPartial = React.useMemo( () => {
		if ( ! engagedFirstSeen ) {
			return false;
		}
		const { start } = resolveSelectedDate( period as any, null );
		return start.valueOf() < new Date( engagedFirstSeen ).getTime();
	}, [ engagedFirstSeen, period ] );
	const [ utmMode, setUtmMode ] = usePersistentState<UtmMode>(
		'utm-card-mode',
		'source_campaign'
	);
	const [ techMode, setTechMode ] = usePersistentState<TechMode>(
		'tech-card-mode',
		'by_os'
	);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	const referrers = React.useMemo( () => topN( stats.data?.stats?.by_referer ), [ stats.data?.stats?.by_referer ] );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const utm = React.useMemo( () => topN( pickUtmGroup( stats, utmMode ) ), [ stats.data, utmMode ] );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const outbound = React.useMemo( () => topN( stats.data?.stats?.by_outbound_host ), [ stats.data?.stats?.by_outbound_host ] );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const searchTerms = React.useMemo( () => topN( stats.data?.stats?.by_search_term ), [ stats.data?.stats?.by_search_term ] );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const tech = React.useMemo( () => topN( stats.data?.stats?.[ techMode ] ), [ stats.data, techMode ] );

	// by_country is a Record<countryCode, views> fetched always-on alongside by_referer.
	const byCountry = ( stats.data?.stats?.by_country as Record<string, number> | undefined ) ?? {};

	// Per-tile drill handlers (#669). Every tile (except Outbound and Engaged
	// time) sets one or more event-level dimension filters keyed by the
	// server-side whitelist (get_dimension_field_map()). The drill value is
	// always the RAW row key (the exact stored column value the WHERE compares
	// against), never the prettified label. Built only when onDrill is provided
	// so display-only surfaces leave rows inert.
	const onDrillContent = onDrill
		? ( item: Item ) => {
			if ( item.path ) {
				onDrill( { path: item.path } );
			}
		}
		: undefined;
	const onDrillCountry = onDrill
		? ( code: string ) => onDrill( {
			field: 'country',
			value: code,
		} )
		: undefined;
	const onDrillTech = onDrill
		? ( item: Item ) => onDrill( {
			field: techMode === 'by_browser' ? 'browser' : 'os',
			value: item.key,
		} )
		: undefined;
	// Referrer rows key by the raw `referer` column value the aggregation groups
	// by, which matches the `referer` dimension field directly. The "Direct
	// traffic" bucket is the renamed empty-referer row: its key is a translated
	// label, so map it back to the empty string it represents (filtering
	// referer = '').
	const onDrillReferer = onDrill
		? ( item: Item ) => onDrill( {
			field: 'referer',
			value: item.key === DIRECT_TRAFFIC_LABEL ? '' : item.key,
		} )
		: undefined;
	// UTM drill — campaign mode only. The pair modes (source/campaign,
	// source/medium) concatenate two values into one row key server-side
	// ("a / b"), which can't be split back safely (a value may itself contain
	// " / "), so those rows stay inert. A structured pair drill is a follow-up.
	const onDrillUtm = onDrill && utmMode === 'campaign'
		? ( item: Item ) => onDrill( {
			field: 'utm_campaign',
			value: item.key,
		} )
		: undefined;
	const onDrillSearch = onDrill
		? ( item: Item ) => onDrill( {
			field: 'search',
			value: item.key,
		} )
		: undefined;

	const topState = deriveListState( topContent.state, topContent.items.length );
	const refState = deriveListState( stats.state, referrers.length );
	const countryState = deriveCountryState( stats.state, Object.keys( byCountry ).length );
	const utmState = deriveListState( stats.state, utm.length );
	const searchState = deriveListState( stats.state, searchTerms.length );
	const techState = deriveListState( stats.state, tech.length );
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

	const techAction = (
		<CompactSelect
			align="end"
			label={ __( 'Group by', 'altis' ) }
			options={ TECH_MODES }
			value={ techMode }
			onChange={ v => setTechMode( v as TechMode ) }
		/>
	);

	const engagedTitle = (
		<span className="inline-flex items-center gap-2">
			<span
				className="cursor-help"
				title={ __( 'Average time visitors spent actively reading or interacting with each piece of content per visit. Time only counts while scrolling, clicking, typing or touching — idle time and background tabs are excluded.', 'altis' ) }
			>
				{ __( 'Engaged time', 'altis' ) }
			</span>
			{ engagedPartial && (
				<Overline
					className="!rounded !bg-muted !px-1.5 !py-0.5 !text-[10px] !uppercase !leading-none cursor-help"
					title={ __( 'This period starts before engaged time tracking began, so the totals only cover part of the range.', 'altis' ) }
				>
					{ __( 'Approx', 'altis' ) }
				</Overline>
			) }
		</span>
	);

	return (
		<div className="tailwind">
			<TileGrid variant="panel">
				<StatTile
					body={ <HostList canSelect={ item => !! item.path } items={ topContent.items } total={ totalViews } onSelect={ onDrillContent } /> }
					empty={ <EmptyHint label={ __( 'No content yet', 'altis' ) } /> }
					errorMessage={ topContent.error }
					skeleton={ <ListPreview /> }
					state={ topState }
					title={ __( 'Top content', 'altis' ) }
					onRetry={ topContent.refresh }
				/>
				<StatTile
					body={ <HostList items={ referrers } total={ totalViews } onSelect={ onDrillReferer } /> }
					empty={ <EmptyHint label={ __( 'No referrers', 'altis' ) } /> }
					errorMessage={ stats.error }
					skeleton={ <ListPreview /> }
					state={ refState }
					title={ __( 'Top referrers', 'altis' ) }
					onRetry={ refresh }
				/>
				<StatTile
					body={ <CountryTileBody byCountry={ byCountry } total={ totalViews } onSelect={ onDrillCountry } /> }
					empty={ <EmptyHint label={ __( 'No country data', 'altis' ) } /> }
					errorMessage={ stats.error }
					skeleton={ <ListPreview /> }
					state={ countryState }
					title={ __( 'Country', 'altis' ) }
					onRetry={ refresh }
				/>
				<StatTile
					action={ utmAction }
					body={ <HostList items={ utm } total={ totalViews } onSelect={ onDrillUtm } /> }
					empty={ <EmptyHint label={ __( 'No utm-tagged traffic', 'altis' ) } /> }
					errorMessage={ stats.error }
					skeleton={ <ListPreview /> }
					state={ utmState }
					title={ __( 'UTM', 'altis' ) }
					onRetry={ refresh }
				/>
				<StatTile
					body={ <HostList items={ searchTerms } total={ totalViews } onSelect={ onDrillSearch } /> }
					empty={ <EmptyHint label={ __( 'No search terms', 'altis' ) } /> }
					errorMessage={ stats.error }
					skeleton={ <ListPreview /> }
					state={ searchState }
					title={ __( 'Search terms', 'altis' ) }
					onRetry={ refresh }
				/>
				<StatTile
					body={ <HostList format={ formatEngaged } items={ topEngaged.items } /> }
					empty={ <EmptyHint label={ __( 'No engaged reads yet', 'altis' ) } /> }
					errorMessage={ topEngaged.error }
					skeleton={ <ListPreview /> }
					state={ deriveListState( topEngaged.state, topEngaged.items.length ) }
					title={ engagedTitle }
					onRetry={ topEngaged.refresh }
				/>
				<StatTile
					body={ <HostList items={ outbound } total={ totalViews } /> }
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
					errorMessage={ stats.error }
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
				<StatTile
					action={ techAction }
					body={ <HostList items={ tech } total={ totalViews } onSelect={ onDrillTech } /> }
					empty={ <EmptyHint label={ __( 'No device data', 'altis' ) } /> }
					errorMessage={ stats.error }
					skeleton={ <ListPreview /> }
					state={ techState }
					title={ __( 'Tech', 'altis' ) }
					onRetry={ refresh }
				/>
			</TileGrid>
		</div>
	);
}
