# PRD: Experiments Overview Page

**Issue**: [#429 — General : Feature : Experiments Overview](https://github.com/humanmade/accelerate/issues/429)
**Target**: 3.6.0 (nice-to-have)

---

## Problem

Users have no way to see their current and past experiments at a glance. To check experiment status, they must click into each individual block or post in the editor. There's no central place to answer: "What experiments are running?", "What worked?", or "What should I do next?"

## Solution

A dedicated **Experiments** admin page under the Accelerate menu. A unified, filterable list of all experiment types — block-level A/B tests, post-level title/image tests, and personalization blocks — showing status, performance metrics, and usage at a glance.

---

## Scope

### Experiment types included

| Type | Test ID | Source | Storage | Has A/B Lifecycle? |
|------|---------|--------|---------|-------------------|
| **A/B Block** | `block` | `wp_block` posts with `_xb_type = 'abtest'` | Post meta (`_altis_ab_test_block_*`) | Yes |
| **Title Test** | `titles` | Posts/pages with `_altis_ab_test_titles_started` | Post meta (`_altis_ab_test_titles_*`) | Yes |
| **Image Test** | `featured_images` | Posts/pages with `_altis_ab_test_featured_images_started` | Post meta (`_altis_ab_test_featured_images_*`) | Yes |
| **Personalization** | — | `wp_block` posts with `_xb_type = 'personalization'` | Post meta (`_xb_type`) | **No** (read-only listing) |

> **Note on Personalization**: Personalization blocks use audience-based variant selection, not A/B testing. They have no start/end lifecycle, no conversion tracking, and no winner detection. They appear in the list for discoverability but with limited columns (name, type, usage only — no status, conversion rate, or lift).

### Out of scope (for now)
- Inline controls (pause/resume/end) from the list — link to editor instead
- Experiment creation from this page
- Aggregate summary dashboard / hero chart
- Experiment comparison view

---

## Data Model Reference

### Meta Key Pattern

All A/B test meta follows the pattern `_altis_ab_test_{test_id}_{property}`:

| Property | Meta Key Example (for `titles`) | Type | Purpose |
|----------|--------------------------------|------|---------|
| `variants` | `_altis_ab_test_titles_variants` | `array` | Variant values (strings for titles, attachment IDs for images, inner blocks for A/B blocks) |
| `started` | `_altis_ab_test_titles_started` | `bool` | Whether test has been started |
| `paused` | `_altis_ab_test_titles_paused` | `string` (`'true'`/`'false'`) | Pause state |
| `ended` | `_altis_ab_test_titles_ended` | `string` (`'true'`/`'false'`) | End state (manually ended or winner found) |
| `start_time` | `_altis_ab_test_titles_start_time` | `int` (milliseconds) | Test start timestamp |
| `end_time` | `_altis_ab_test_titles_end_time` | `int` (milliseconds) | Test end timestamp |
| `traffic_percentage` | `_altis_ab_test_titles_traffic_percentage` | `int` (0–100) | Traffic allocation |
| `results` | `_altis_ab_test_titles_results` | `array` | Current results (updated hourly via cron) |
| `completed` | `_altis_ab_test_titles_completed` | `array` | Final results snapshot (written when winner found) |

Source: `inc/experiments/namespace.php:610-908`

### Status Derivation Logic

Status is **computed**, not stored directly. Logic from `is_ab_test_running_for_post()` at `inc/experiments/namespace.php:884-893`:

| Status | Condition | Color |
|--------|-----------|-------|
| **Running** | `has_variants AND started AND NOT paused AND start_time ≤ now < end_time` | Green |
| **Paused** | `started AND _paused = 'true'` | Amber |
| **Completed** | `_ended = 'true'` (winner found or manually ended) | Gray |
| **Expired** | `started AND NOT ended AND end_time < now` | Gray (treat as completed in UI) |
| **Draft** | `NOT started` (variants may or may not exist) | Outline/muted |

> **Implementation note**: "Expired" (time window passed but `_ended` not set) should display the same as "Completed" in the UI. The REST API should normalize this.

### Results Data Structure

From `analyse_ab_test_results()` at `inc/experiments/namespace.php:1254-1322`:

```json
{
  "timestamp": 1704067200000,
  "winning": 1,
  "winner": 1,
  "variants": [
    {
      "value": "Original Title",
      "size": 1500,
      "hits": 45,
      "rate": 0.03,
      "p": 0.12
    },
    {
      "value": "New Title",
      "size": 1480,
      "hits": 72,
      "rate": 0.0486,
      "p": 0.95
    }
  ]
}
```

- `winner`: 0-based variant index (integer) or `null`
- `winning`: Currently leading variant index or `null`
- `p`: Bayesian P2BB (Probability to Be Best) — winner declared at ≥0.95 with ≥300 impressions
- `rate`: Conversion rate (hits / size)

### Personalization Data Model

Personalization blocks (`_xb_type = 'personalization'`) do **not** use `_altis_ab_test_*` meta. They use:
- Inner `altis/variant` blocks with `audience` attribute (audience post ID)
- `_xb_type` meta on the `wp_block` post
- No start/end/paused/results lifecycle

### Usage Count Infrastructure

Already exists via shadow taxonomy:
- **Taxonomy**: `wp_block_to_post` (`inc/global-blocks/connections.php:15`)
- **Sync**: On `post_updated`, parses content for `core/block` refs → `wp_set_object_terms()` (`connections.php:230-273`)
- **Query**: `get_associated_term_id()` + `WP_Query` with `tax_query` (`connections.php:315-336`)
- **Cache**: `block_usage_count_{id}`, 8h TTL, busted on content change

---

## Page Details

### Navigation
- New submenu: **Accelerate → Experiments**
- Menu slug: `experiments` (screen ID becomes `accelerate_page_experiments`)
- Capability: `edit_posts` (matches other Accelerate pages)
- Position: After Content Explorer, before Audiences

### List Columns

| Column | A/B Tests | Personalization | Notes |
|--------|-----------|-----------------|-------|
| **Name** | Experiment title (clickable → editor) | Block title (clickable → editor) | Block title or post title. Uses `CardTitle` typography. |
| **Type** | Badge: `A/B Block` · `Title Test` · `Image Test` | Badge: `Personalization` | Subtle colored background per type. |
| **Status** | Color-coded pill (see status table above) | Always "Active" when published, "Draft" otherwise | Personalization has no A/B lifecycle. |
| **Variants** | Count (e.g., "3 variants") | Count (audience-based) | Number of inner `altis/variant` blocks or meta array length. |
| **Conversion Rate** | Best variant's rate (e.g., "4.2%") | — (hidden) | `null` if no data. Right-aligned numeric. |
| **Lift** | Best vs control (e.g., "+23%") | — (hidden) | `null` if no data or single variant. Right-aligned numeric. |
| **Used In** | "Used in 5 posts" / "On: Post Title" | "Used in 5 posts" | Shadow taxonomy count for global blocks; post title for post-level tests. |
| **Started** | Relative date ("3 days ago") | — (hidden) | `null` if draft. |

### Filters

- **Status chips** (via `AnimatedTabs`): All · Active (running + paused) · Completed · Draft
  - Personalization blocks appear in "All" and filter by their publish status
- **Type chips** (via `AnimatedTabs`, show if list >10 items): All · A/B Blocks · Personalization · Post Tests
- **Search** (via `SearchField`): Full-text search by experiment name

Filter selections persisted via `usePersistentState` from `@/data/hooks`.

### Sorting
- Default: Active experiments first, then by start date (newest first)
- Completed/expired experiments sorted by end date (most recent first)
- Personalization blocks sorted by title (no date)

### Empty State

Uses `EmptyState` component (`@/components/EmptyState`):
- Icon: Beaker or test tube (from `lucide-react`)
- Title: `__( 'No experiments yet', 'altis' )`
- Description: `__( 'Create A/B tests and personalization blocks in the editor to see them here.', 'altis' )`
- Action: `<Button variant="outline">` → links to Accelerate docs

### Row Click Behavior
- **Global blocks (A/B / Personalization)**: Opens the synced pattern editor (`/wp-admin/post.php?post={id}&action=edit`)
- **Post-level tests (Title / Image)**: Opens the post editor (`/wp-admin/post.php?post={id}&action=edit`)

---

## REST API

### Endpoint

`GET /accelerate/v1/experiments`

**Namespace**: `accelerate/v1` (defined in `inc/api/namespace.php:22`)

**Permission**: `current_user_can( 'edit_posts' )`

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `string` | `''` | Filter: `running`, `paused`, `completed`, `draft`, `active` (running+paused) |
| `type` | `string` | `''` | Filter: `block`, `personalization`, `titles`, `featured_images` |
| `search` | `string` | `''` | Search by title |
| `orderby` | `string` | `status` | Sort field: `status`, `start_time`, `title` |
| `order` | `string` | `desc` | Sort direction: `asc`, `desc` |
| `page` | `int` | `1` | Page number |
| `per_page` | `int` | `20` | Items per page (max 100) |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-WP-Total` | Total items matching query |
| `X-WP-TotalPages` | Total pages |

### Response Shape (per item)

```json
{
  "id": 123,
  "title": "Hero Banner Test",
  "type": "block",
  "status": "running",
  "post_type": "wp_block",
  "variant_count": 3,
  "conversion_rate": 4.2,
  "lift": 23.1,
  "winner": null,
  "start_time": "2025-12-01T00:00:00Z",
  "end_time": "2025-12-31T00:00:00Z",
  "usage_count": 5,
  "usage_label": "Used in 5 posts",
  "edit_url": "/wp-admin/post.php?post=123&action=edit"
}
```

**Field notes**:
- `type`: One of `block`, `personalization`, `titles`, `featured_images`
- `status`: One of `running`, `paused`, `completed`, `draft`. Expired tests normalize to `completed`.
- `conversion_rate`: `float | null` — best variant's rate × 100. `null` if no data or personalization.
- `lift`: `float | null` — percentage improvement of best variant vs control. `null` if no data, single variant, or personalization.
- `winner`: `int | null` — 0-based variant index. `null` if no winner yet.
- `start_time`: ISO 8601 string or `null` (draft/personalization)
- `end_time`: ISO 8601 string or `null`
- `usage_count`: Integer. For global blocks: shadow taxonomy count. For post-level tests: always `1`.
- `usage_label`: Formatted string. "Used in N posts" for global blocks, "On: {post_title}" for post-level tests.

### PHP Query Strategy

```php
// 1. A/B Block experiments
$block_query = new WP_Query([
    'post_type' => 'wp_block',
    'meta_query' => [
        ['key' => '_xb_type', 'value' => 'abtest'],
    ],
]);

// 2. Personalization blocks
$personalization_query = new WP_Query([
    'post_type' => 'wp_block',
    'meta_query' => [
        ['key' => '_xb_type', 'value' => 'personalization'],
    ],
]);

// 3. Title tests (posts with title experiments)
$title_query = new WP_Query([
    'post_type' => get_post_types_by_support('altis.experiments.titles'),
    'meta_query' => [
        ['key' => '_altis_ab_test_titles_variants', 'compare' => 'EXISTS'],
    ],
]);

// 4. Image tests (posts with featured image experiments)
$image_query = new WP_Query([
    'post_type' => get_post_types_by_support('altis.experiments.featured_images'),
    'meta_query' => [
        ['key' => '_altis_ab_test_featured_images_variants', 'compare' => 'EXISTS'],
    ],
]);
```

Status and metrics are computed per-item from stored meta using existing functions:
- `is_ab_test_running_for_post($test_id, $post_id)`
- `is_ab_test_paused_for_post($test_id, $post_id)`
- `has_ab_test_ended_for_post($test_id, $post_id)`
- `get_ab_test_results_for_post($test_id, $post_id)`

---

## UI Components

### Reuse from existing codebase

| Component | Import Path | Usage |
|-----------|-------------|-------|
| `HeaderRow` | `@/accelerate/components/shared/HeaderRow` | Page header bar with Accelerate logo |
| `AnimatedTabs` | `@/components/ui/animated-tabs` | Status and type filter chips |
| `SearchField` | `@/components/SearchField` | Search input with debounce |
| `DataContainer` | `@/components/DataContainer` | Loading/loaded/empty/error state wrapper |
| `EmptyState` | `@/components/EmptyState` | Empty state display |
| `FadeIn` | `@/components/FadeIn` | Entrance animation |
| `Button` | `@/components/ui/button` | CTA actions (shadcn, not @wordpress/components) |
| `Skeleton` | `@/components/ui/skeleton` | Loading placeholders |
| `CardTitle`, `Caption` | `@/components/ui/typography` | Consistent text styles with `!important` WP overrides |
| `usePersistentState` | `@/data/hooks` | Persist filter selections in localStorage |
| `DataState` type | `@/types/component-states` | `'loading' | 'loaded' | 'empty' | 'error'` |

### New components (feature-scoped)

All new components live in `src/experiments/overview/components/` until needed elsewhere:

| Component | Purpose |
|-----------|---------|
| `ExperimentsList` | Main list/table component |
| `ExperimentRow` | Individual row with columns |
| `ExperimentRowSkeleton` | Loading placeholder row (matches column widths) |
| `StatusBadge` | Color-coded status pill (green/amber/gray/outline) |
| `TypeBadge` | Experiment type label with subtle colored background |

### Page Structure

```tsx
<div className="tailwind">
  <HeaderRow>
    <AnimatedTabs {/* status filter */} />
    <VerticalDivider />
    <AnimatedTabs {/* type filter (conditional) */} />
    <div className="flex-1" />
    <SearchField />
  </HeaderRow>
  <div className="mx-2 md:mx-4 lg:mx-16">
    <DataContainer state={dataState} skeleton={<ExperimentRowSkeleton count={5} />}>
      <ExperimentsList>
        <ExperimentRow /> × N
      </ExperimentsList>
      <Pagination />
    </DataContainer>
  </div>
</div>
```

---

## File Structure

### PHP (backend)

| File | Change | Purpose |
|------|--------|---------|
| `inc/experiments/rest_api/namespace.php` | **New** | REST endpoint for experiments list |
| `inc/experiments/namespace.php` | **Modify** | Add `admin_page()` registration, REST API setup call, asset registration |
| `inc/admin/namespace.php` | **Modify** | Add `accelerate_page_experiments` to `is_altis_screen()` array |

### JS/TS (frontend)

| File | Change | Purpose |
|------|--------|---------|
| `src/experiments/overview/index.tsx` | **New** | Entry point: mount React app to `#altis-experiments-overview` |
| `src/experiments/overview/Dashboard.tsx` | **New** | Page container with HeaderRow, filters, DataContainer |
| `src/experiments/overview/data/store.ts` | **New** | Redux store: actions, selectors, resolvers for experiments API |
| `src/experiments/overview/components/ExperimentsList.tsx` | **New** | List component with column headers |
| `src/experiments/overview/components/ExperimentRow.tsx` | **New** | Individual row |
| `src/experiments/overview/components/ExperimentRowSkeleton.tsx` | **New** | Loading state |
| `src/experiments/overview/components/StatusBadge.tsx` | **New** | Status pill |
| `src/experiments/overview/components/TypeBadge.tsx` | **New** | Type label |

### Build config

| File | Change | Purpose |
|------|--------|---------|
| `.config/webpack.config.dev.js` | **Modify** | Add entry: `'experiments/overview': filePath('src/experiments/overview/index.tsx')` |
| `.config/webpack.config.prod.js` | **Modify** | Same entry |

---

## Design Notes

- Follow the Audiences list layout (dedicated page, flex rows, status indicators) and Content Explorer filter pattern (HeaderRow + AnimatedTabs + SearchField)
- Use Tailwind + shadcn primitives, scoped under `.tailwind` wrapper
- Status colors: Running = green (`bg-green-100 text-green-800`), Paused = amber (`bg-amber-100 text-amber-800`), Completed = gray (`bg-muted text-muted-foreground`), Draft = outline (`border border-border text-muted-foreground`)
- Type badges: Subtle colored backgrounds — use semantic tokens, not hardcoded hex
- Conversion rate and lift columns: right-aligned, monospace-ish (`tabular-nums`)
- Personalization rows: hide conversion rate, lift, and started columns; show reduced row
- Responsive: hide Used In and Started columns below `md` breakpoint
- All text uses Typography components (`CardTitle`, `Caption`) — never inline `text-sm font-semibold`
- WP admin CSS overrides require `!important` prefix (`!text-sm`, `!font-semibold`) per `src/components/ui/CLAUDE.md`

## Accessibility

- Table uses `role="table"`, `role="row"`, `role="cell"` (or native `<table>`)
- Status badges include `aria-label` (e.g., `aria-label="Status: Running"`)
- Filter chips are keyboard-navigable (AnimatedTabs already handles this)
- Row click targets use `<a>` elements wrapping the name, not div `onClick`
- Empty state has descriptive text for screen readers
- All strings use `__()` / `sprintf()` from `@wordpress/i18n`

## Telemetry

Follow Content Explorer pattern (`src/accelerate/components/ListFilters.tsx`):
- Track filter changes: `trackEvent('experiments', 'Filter', { type: value })`
- Track search: `trackEvent('experiments', 'Search')`
- Track row clicks: `trackEvent('experiments', 'Open', { type, id })`

---

## Success Criteria

1. User can see all active experiments and personalization blocks from one page
2. User can quickly identify which experiments have completed and what the results were
3. User can filter by status and type to focus on specific experiments
4. User can search for a specific experiment by name
5. Clicking any experiment takes them to the right editor screen to manage it
6. Page loads with skeleton placeholders and transitions to content (never blank screen)
7. Personalization blocks appear for discoverability but clearly lack A/B metrics

---

## Resolved Questions

| Question | Resolution |
|----------|------------|
| **Usage count performance** | Already solved: shadow taxonomy `wp_block_to_post` with 8h cached `WP_Query` (`inc/global-blocks/connections.php:315-336`). No additional caching needed. |
| **Real-time results** | Results update hourly via cron (`inc/experiments/namespace.php:429`). No "last updated" indicator needed for v1. |
| **Personalization "status"** | Personalization blocks show as "Active" (published) or "Draft" (not published). No A/B lifecycle columns. |
| **Pagination** | Use server-side pagination from day one. Consistent with `X-WP-Total` / `X-WP-TotalPages` header pattern. Default 20 per page. |

## Open Questions (remaining)

1. **Menu position**: Should Experiments appear before or after Audiences in the submenu? (Currently proposed: after Content Explorer, before Audiences)
2. **Expired vs Completed UI**: Should expired tests (time window passed, no winner) show a different visual treatment than completed tests (winner found)? Current proposal: same gray treatment.
