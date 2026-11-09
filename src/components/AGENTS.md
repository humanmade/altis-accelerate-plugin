# Shared compounds (`src/components/`)

The level above primitives. Combinations of `src/components/ui/` parts that show up in more than one admin surface and should look identical everywhere.

Loads when Claude enters this directory.

## Hard rules

- **Primitives go in `src/components/ui/`. Compounds go here.** A "compound" is a primitive + a project-specific opinion (a fixed prop, a wrapper Card, a paired ARIA contract).
- **One way to do each thing.** If a compound already exists for a need, use it. Don't fork it with a one-off file.
- **Named PascalCase exports.** `MetricTile.tsx` exports `MetricTile`. Never default exports.
- **Don't import from `src/dashboard/components/` or `src/accelerate/`.** Those are feature surfaces, not shared infra. The dependency direction is feature → shared, never the reverse. (`MetricTile` currently imports `dashboard/components/Card` — that's a legacy crossing; the Card primitive should move down into `src/components/ui/` next time someone touches it.)

## When to use which

| Need | Use | When to pick this |
|---|---|---|
| 2–3 short or icon-able options, mutually exclusive | `ui/toggle-group.tsx` (ToggleGroup `size="sm"`) | Country map↔list, view mode toggles |
| 3+ options with verbose labels | `CompactSelect` | UTM grouping, sort-by, time-range with worded labels |
| Headline metric tile | `MetricTile` | Anywhere you'd otherwise reach for "big number + uppercase label + delta" |

`ToggleGroup` and `CompactSelect` both render at `h-8` with `bg-muted` hover — they're the two halves of the same selector family. Pick by content shape, not by surface.

## `MetricTile`

The shared metric tile used by:

- `src/dashboard/components/Summary.tsx` (Analytics page — 4-card strip above the chart)
- `src/accelerate/content-explorer/HeroChart.tsx` (Content Explorer — same strip)

**Anatomy** — `!p-4` Card, 11px uppercase label, 4xl semibold value, optional delta line, optional hint. Pass `delta` (from `computeDelta()` in `lib/utils.ts`) and `deltaTone` to render the prior-period arrow. Omitting both reverts to the original Summary tile (pixel-identical).

`deltaTone` is consumer-owned because "good direction" is metric-specific: visitors ↑ is `positive`, bounce ↑ is `negative`. Compute it at the call site with the small `toneFor()` helper pattern (see `HeroChart.tsx` for the canonical example).

## `CompactSelect`

Compact dropdown matching the `ToggleGroup size="sm"` silhouette. Wraps shadcn `DropdownMenu` + `DropdownMenuRadioGroup` with the canonical compact trigger.

**Required prop**: `label` — used as the trigger's `aria-label`. The visible text is the currently-selected option's label, which alone isn't enough for screen readers (they need the role context, e.g. "Group by, source / campaign").

Keyboard behavior comes free from Radix — Enter/Space opens, ↑/↓ moves selection, Esc closes, focus returns to trigger.

## Card header row (visual contract)

Every Card header row that may optionally include a trailing action (`CompactSelect`, `ToggleGroup`, button) must reserve `min-h-8` so tiles with and without actions sit at the same baseline. Without this, the row collapses to text height (~20px) when no action is present, the body content jumps up, and side-by-side widget cards visibly misalign.

```tsx
<div className="mb-4 flex min-h-8 items-center justify-between gap-3">
  <h3 className="!m-0 !text-sm !font-medium !text-muted-foreground">{title}</h3>
  {action /* optional */ }
</div>
```

`StatTile` already follows this; replicate the pattern in any new card-style compound.

## Row treatment (visual contract, not a component)

Both `dashboard/components/BarList.tsx` (Analytics page widgets) and the `Row` sub-component in `accelerate/content-explorer/BreakdownPanel/index.tsx` render rows that match the same visual silhouette:

- Row height: `h-8`
- Between-row gap: `space-y-1.5`
- Full-height bar: `bg-brand/15`, `rounded`, `width: ${pct}%`, positioned `absolute inset-y-0 left-0`
- Label: `absolute left-2 top-1/2 -translate-y-1/2 truncate text-sm text-gray-900` overlaid on the bar
- Value: right-aligned, `h-8 flex items-center text-sm tabular-nums`

The two implementations exist separately because BreakdownPanel layers motion (rank pulse, micro-bounce, `motion.li layout`) that BarList doesn't need. Sharing one component would either bloat BarList or strip the motion — neither is worth it. Keep the silhouette identical visually; when one drifts, fix it back.

## Visual reference

The styleguide page at `wp-admin/admin.php?page=accelerate-styleguide` renders all of the above with example data. It is unlinked from the admin menu (direct URL only) and pulls exclusively from this folder + `src/components/ui/`. Anything you want documented there must first live in one of those two folders.
