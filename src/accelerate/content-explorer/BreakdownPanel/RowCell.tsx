import * as React from 'react';

import { prettyLabel } from './prettyLabel';

import { cn } from '@/lib/utils';

// A single dimension filter: a whitelisted field key and the exact value to
// filter the view to. The field key must match the server-side whitelist
// (get_dimension_field_map() in inc/api/namespace.php).
export type DimensionDrill = { field: string, value: string };

// A drill target either sets the path filter directly (top content / URLs) or
// applies one or more dimension filters (referrer, country, tech, UTM, search).
// Multiple pairs compose into one drill — used by the UTM pair cards which set
// both source and campaign/medium at once. See AnalyticsView.onDrill.
export type DrillTarget = { path: string } | DimensionDrill | DimensionDrill[];

/**
 * Share of the server's period total for a single row. Returns null when the
 * total is unknown (0, missing, or still loading) so callers never render a
 * misleading `0.0%` / `NaN%` — see #672.
 */
export function computeShare( value: number, total?: number ): number | null {
	if ( ! total || total <= 0 ) {
		return null;
	}
	return ( value / total ) * 100;
}

function formatShare( pct: number ): string {
	// Matches Plausible's breakdown %: one decimal place (88.8%, 11.3%), two
	// only for tiny shares below 0.1% (0.07%), and trailing zeros dropped so
	// 8.0% renders as 8% and 0% as 0%. Number() does the trailing-zero strip.
	const dp = pct < 0.1 ? 2 : 1;
	return `${ Number( pct.toFixed( dp ) ) }%`;
}

/**
 * Right-aligned value cell shared by the animated (Row) and static
 * (CountryList) breakdown rows. Renders the count, then — only when a `total`
 * is provided (count-based tiles, not engaged-time) — a collapsed percentage
 * tray. The tray (and the matching `group/tray` on the list container) means
 * hovering anywhere on the panel reveals the WHOLE % column at once: each
 * tray animates open from the right, pushing the counts left to make room —
 * the Plausible reveal. Resting state shows the count alone.
 */
export function ValueCell( {
	value,
	total,
	children,
}: {
	value: number;
	total?: number;
	children: React.ReactNode;
} ) {
	const pct = computeShare( value, total );
	return (
		<span className="flex h-8 shrink-0 items-center justify-end">
			{ children }
			{ pct !== null && (
				<span
					aria-hidden="true"
					className={ cn(
						// Width 0 at rest; expands on panel hover/focus so the count
						// (rendered before it) slides left and the % slides in at the
						// right edge. overflow-hidden clips it while collapsed.
						'flex justify-end overflow-hidden w-0 opacity-0',
						'transition-[width,opacity] duration-150 ease-out',
						'group-hover/tray:w-[3.25rem] group-hover/tray:opacity-100',
						'group-focus-within/tray:w-[3.25rem] group-focus-within/tray:opacity-100',
						'motion-reduce:transition-none'
					) }
				>
					<span className="shrink-0 whitespace-nowrap pl-3 text-sm text-muted-foreground tabular-nums">
						{ formatShare( pct ) }
					</span>
				</span>
			) }
		</span>
	);
}

/**
 * Label overlaid on the bar — shared truncation/positioning contract. `key` is
 * the raw value; `label` is the optional decoded display override.
 */
export function RowLabel( { value, label }: { value: string; label?: string } ) {
	const text = label ?? prettyLabel( value );
	return (
		<span
			className="!absolute !left-2 !top-1/2 !-translate-y-1/2 !m-0 !block !truncate !whitespace-nowrap !text-sm !text-gray-900 max-w-full pr-2"
			title={ text }
		>
			{ text }
		</span>
	);
}
