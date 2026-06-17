import * as React from 'react';

import { cn } from '../lib/utils';

// Count-aware responsive grid for dashboard tiles. Callers render tiles in
// priority order and TileGrid derives the column rules from how many
// children actually rendered — tiles entering or exiting the ecosystem
// (Top content, Engagement, …) never require a call-site class change.
//
// Breakpoints are container queries, not viewport queries: available width
// in wp-admin depends on the admin menu (folded vs not) and the panel the
// grid sits in, so the same grid self-adjusts wherever it's mounted.
//
// Two variants encode different odd-count policies:
// - `metric` (compact stat tiles): equal widths always; a short last row
//   (3+2, 4+3) is preferred over resizing tiles, because stat tiles scan
//   by uniformity.
// - `panel` (tall list tiles): the FIRST child is promoted to a 2-column
//   hero when — and only when — the count is odd, which keeps every row
//   full-width (5 → hero+1 / 3, 7 → hero+2 / 4). Priority list == render
//   order, so when a conditional lead tile is absent the next tile
//   inherits hero status automatically. Note: a tile's prominence can
//   therefore change when unrelated tiles enter/exit (count parity flips).
//   That is by design, not a bug.

export type TileGridVariant = 'metric' | 'panel';

// Hero promotion for odd panel counts. Span-2 is consistent across the
// 2-col and wide tiers, so one pair of classes covers both.
const PANEL_HERO = '@2xl:[&>*:first-child]:col-span-2';

// Class strings must be complete literals (Tailwind JIT cannot see
// computed strings). @2xl ≈ the old `md:` viewport switch once admin
// chrome is subtracted; @min-[100rem] ≈ the old `min-[1800px]:` 4-up tier.
const PANEL_GRID: Record<number, string> = {
	1: 'grid-cols-1',
	2: 'grid-cols-1 @2xl:grid-cols-2',
	// 3 fits one row at the wide tier, so the hero demotes back to span-1.
	3: `grid-cols-1 @2xl:grid-cols-2 ${ PANEL_HERO } @min-[100rem]:grid-cols-3 @min-[100rem]:[&>*:first-child]:col-span-1`,
	4: 'grid-cols-1 @2xl:grid-cols-2 @min-[100rem]:grid-cols-4',
	5: `grid-cols-1 @2xl:grid-cols-2 ${ PANEL_HERO } @min-[100rem]:grid-cols-3`,
	6: 'grid-cols-1 @2xl:grid-cols-2 @min-[100rem]:grid-cols-3',
	7: `grid-cols-1 @2xl:grid-cols-2 ${ PANEL_HERO } @min-[100rem]:grid-cols-4`,
	8: 'grid-cols-1 @2xl:grid-cols-2 @min-[100rem]:grid-cols-4',
};

// Metric tiles: max 4 across, rows balanced (5 → 3+2, 7 → 4+3), short
// last row left-aligned. @4xl unifies the previously divergent Summary
// (xl:) and HeroChart (md:) viewport breakpoints.
const METRIC_GRID: Record<number, string> = {
	1: 'grid-cols-1',
	2: 'grid-cols-2',
	3: 'grid-cols-1 @lg:grid-cols-3',
	4: 'grid-cols-2 @4xl:grid-cols-4',
	5: 'grid-cols-2 @4xl:grid-cols-3',
	6: 'grid-cols-2 @4xl:grid-cols-3',
	7: 'grid-cols-2 @4xl:grid-cols-4',
	8: 'grid-cols-2 @4xl:grid-cols-4',
};

const MAX_COUNT = 8;

/**
 * Resolve the grid classes for a tile count. Exported for unit tests.
 * Counts above 8 fall back to the 8-tile layout (4 across, may leave a
 * short last row) — extend the tables when a 9th tile actually ships.
 */
export function tileGridClasses( variant: TileGridVariant, count: number ): string {
	const table = variant === 'panel' ? PANEL_GRID : METRIC_GRID;
	const clamped = Math.min( Math.max( count, 1 ), MAX_COUNT );
	return table[ clamped ];
}

interface Props {
	variant: TileGridVariant;
	children: React.ReactNode;
	className?: string;
}

export function TileGrid( { variant, children, className }: Props ) {
	// toArray drops null/false children, so conditionally-rendered tiles
	// change the count (and the layout) without any caller bookkeeping.
	const count = React.Children.toArray( children ).length;
	return (
		<div className="@container">
			<div className={ cn( 'grid gap-4', tileGridClasses( variant, count ), className ) }>
				{ children }
			</div>
		</div>
	);
}
