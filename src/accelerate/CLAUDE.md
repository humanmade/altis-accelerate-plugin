# Admin app (`src/accelerate/`)

The Accelerate admin surface — Content Explorer, Audiences, Broadcasts, Settings. SCSS-first with `$acc-*` tokens. Loads when Claude enters this directory.

## Hard rules

- **All SCSS variables in this project use the `$acc-*` prefix.** Defined in `src/accelerate/variables.scss`. Don't introduce new bare `$gray-*`, `$brand-*`, etc. — they collide with WordPress Gutenberg's globals which are also imported in this file.
- **`$acc-slate-*` is intentionally blue-tinted (HSL 218°) — NOT neutral gray.** It's for editor UI only. If you need neutral gray, use `$acc-gray-*` (HSL 0°, 0% saturation). Mixing them up is the most common mistake here.
- **`$acc-charcoal` / `$acc-charcoal-hover`** are the primary action colors (`#1d2327` / `#2c3338`). They align with Tailwind's `--color-primary`. Never hardcode these hex values — use the tokens.
- **Use shadcn `Button` here, never `@wordpress/components` Button.** This is admin land, not block-editor land.
- **Use the typography components** (`@/components/ui/typography`) for text. The admin app inherits WP admin's aggressive base styles, so raw `text-*` classes often fail without `!`.

## Token reference (`src/accelerate/variables.scss`)

| Group | Tokens | Notes |
|-------|--------|-------|
| Brand | `$acc-brand`, `$acc-brand-hover`, `$acc-brand-light`, `$acc-brand-lighter` | Purple `#9332FF` — links, toggles, brand accents |
| Charcoal | `$acc-charcoal`, `$acc-charcoal-hover` | Primary action / button color |
| Slate (blue) | `$acc-slate-10/25/50/75/200/300` | Editor UI only — `$acc-slate-300` is **dark navy**, not gray |
| Gray (neutral) | `$acc-gray-50/100/150/200/400/600` | Pure neutral grays |
| Semantic | `$acc-positive`, `$acc-positive-light`, `$acc-negative`, `$acc-negative-light` | Success / error |

## Charts (`content-explorer/`)

- **`TimeSeriesPlot.tsx` is the chart primitive** for the pageviews graph — a pure visx plot (scales, axes, grid, line/area/bar marks, clip, tooltip, realtime dot). Extend it for new timeseries chart work; don't re-inline SVG in `HeroChart`. `HeroChart` is the container (data fetch, KPI strip, realtime rAF loop, persistence) and the plot's first consumer. Feed it `TimeSeriesPoint{id,time,value}[]` built from `StatsResult.by_interval` via `toTimeSeriesPoints()` (which trims not-yet-occurred future buckets and sorts chronologically).
- **Chart-type presentation persists per tile** via `useChartPresentation(tileKey)` (enum `'line'|'bar'`, default `bar`) — mirror this pattern for new per-tile chart settings rather than building a settings framework (see #696 vs #697).
- **Period comparison rides existing data:** `usePriorStats` returns the full prior `StatsResult` incl. `by_interval`; the overlay aligns prior↔current by **bucket index** (not date) and reuses `resolvePriorStatsArgs`/`computeDelta`. The compare toggle is default-off and disabled for periods with no prior (P90D).
- **Stacked composition (bar only)** comes from a separate `GET /accelerate/v1/stats/segments?dimension=referer` (not the presentation enum). Cap is ≤3 segments: top referer hosts over the window, or top 2 + Other when 4+ hosts. `attachSegmentSeries()` joins them onto `TimeSeriesPoint.segments` by bucket id. Line mode renders totals only. With compare on, prior fetches the same endpoint for the prior window and stacks the **current period's keys** in light gray (side-by-side, flush in-band); unknown prior hosts fold into Other. Host keys strip leading `www.` (PHP + `prettyLabel`). Segments always scan raw `analytics` — the hourly rollup has no referer.
- **One shared `.nice()`-rounded y-scale** drives axis, gridlines, and all marks (line/area/bars/ghost/stacks) — never give bars an independent max, or they overshoot the top gridline.
- **SVG gradient/clip-path IDs must be `useId()`-derived** — `PeriodCrossfade` mounts two plots at once, so fixed IDs collide.

## Sub-files

This module's SCSS lives alongside the React. The `$acc-*` token rules above are the only admin-specific rules — everything else inherits from `src/CLAUDE.md` and `src/components/ui/CLAUDE.md`.
