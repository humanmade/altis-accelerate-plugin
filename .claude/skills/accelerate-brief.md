---
description: "Daily Brief - quick morning dashboard of site performance, experiments, and opportunities"
---

# Accelerate Daily Brief

A concise "state of the site" dashboard. Run each morning to see what changed, what needs attention, and where the opportunities are.

## Required Tools

This skill uses the WordPress MCP abilities:
- `mcp__wordpress__mcp-adapter-execute-ability` with Accelerate abilities

**Important:** Always pass at least one parameter to each ability — empty `{}` objects fail with the MCP adapter.

## API Reference

### accelerate/get-performance-summary
```json
{
  "entity_type": "site",
  "granularity": "daily"
}
```
Returns: `views`, `visitors`, `conversions`, `conversion_rate`, `time_series[]`

### accelerate/get-top-content
```json
{
  "limit": 10
}
```
Returns: ranked content with views and metrics. Use the `post_id` values for `get-content-diff`.

Call a **second time** with `type: "wp_block"` to get synced pattern (global block) performance:
```json
{
  "type": "wp_block",
  "limit": 5
}
```
This is Accelerate's key differentiator — block-level analytics across every page a block appears on.

### accelerate/get-content-diff
```json
{
  "post_ids": [123, 456],
  "current_period": {"start": "ISO8601", "end": "ISO8601"},
  "comparison_period": {"start": "ISO8601", "end": "ISO8601"}
}
```
Returns: per-post `current`, `previous`, `change_percent`

### accelerate/list-active-experiments
```json
{
  "type": "all"
}
```

### accelerate/get-traffic-breakdown
```json
{
  "dimension": "referrer",
  "limit": 5
}
```

### accelerate/get-audience-segments
```json
{
  "include_estimates": true
}
```

---

## Workflow

### Step 1: Parallel Data Fetch

Run these **in parallel** (they are independent):

1. `accelerate/get-performance-summary` — `entity_type: "site"`, `granularity: "daily"`
2. `accelerate/get-top-content` — `limit: 10`
3. `accelerate/get-top-content` — `type: "wp_block"`, `limit: 5` (synced patterns)
4. `accelerate/list-active-experiments` — `type: "all"`
5. `accelerate/get-traffic-breakdown` — `dimension: "referrer"`, `limit: 5`
6. `accelerate/get-audience-segments` — `include_estimates: true`

### Step 2: Sequential Follow-Up

After Step 1 completes, take the `post_id` values from `get-top-content` results and call:

7. `accelerate/get-content-diff` — pass the top content post IDs, with:
   - `current_period`: last 7 days
   - `comparison_period`: the 7 days before that

### Step 3: Assemble the Brief

Combine all data into the output format below.

---

## Output Format

Keep the entire brief to **one screen** — scannable, numbers first.

### Header
```
┌─────────────────────────────────────────────────────────────┐
│  DAILY BRIEF                           [date]               │
└─────────────────────────────────────────────────────────────┘
```

### 1. Performance Snapshot

Show this-week vs last-week with directional arrows:

```
│ Metric          │ This Week  │ vs Last Week │
│─────────────────│────────────│──────────────│
│ Views           │ X,XXX      │ ↑ +X%        │
│ Visitors        │ X,XXX      │ ↓ -X%        │
│ Conversions     │ XXX        │ ↑ +X%        │
│ Conv. Rate      │ X.X%       │ → 0%         │
│ Top Referrer    │ [source]   │ XX% share    │
```

Use ↑ for positive change, ↓ for negative, → for flat (< 1% change).

### 2. Content Movers

Show the biggest gainers and losers from `get-content-diff`. List up to 3 of each:

```
📈 Gaining                          📉 Declining
  [Page title]  +XX% views            [Page title]  -XX% views
  [Page title]  +XX% views            [Page title]  -XX% views
```

If no comparison data is available, skip this section.

### 3. Block Performance

Show top synced patterns (global blocks) from the `wp_block` call. These are reusable blocks that appear across multiple pages — Accelerate tracks their combined performance site-wide, which no page-level analytics tool can do.

```
🧱 Top Blocks (site-wide)
  [Block name]  X,XXX views across XX pages  [has experiment / no experiment]
  [Block name]  X,XXX views across XX pages  [has experiment / no experiment]
  [Block name]  X,XXX views across XX pages  [has experiment / no experiment]
```

Flag blocks with high views but no active experiment — these are prime testing candidates.

If no synced patterns exist, skip this section.

### 4. Experiment Check-In

For each active experiment, show a one-line status:

```
🧪 Active Experiments
  [Experiment name] — X,XXX views, variant B leading (+X.X% lift), [X days running]
  [Experiment name] — X,XXX views, too early to call, [X days running]
```

If no experiments are running, show:
```
🧪 No active experiments
```

### 5. Today's Opportunities

2-3 short, actionable suggestions based on the data. Keep each to one sentence. Lean into block-level actions — this is what makes Accelerate different from page-level analytics tools.

**Priority order for deriving suggestions:**

1. **High-traffic blocks without experiments** → "Test the [block name] CTA — it gets X,XXX views across XX pages, but has no A/B test running." This is the highest-leverage move because one block test covers the entire site.
2. **Declining content** → suggest an A/B test on that page's headline block or CTA block (name the block, not just the page)
3. **Unused audience segments** → cross-reference `get-audience-segments` results against active experiments/personalization rules from `list-active-experiments`. If a segment is defined but not used in any personalization rule, suggest it: "Personalize the [block] for your [audience name] segment — XX% of traffic matches but sees generic content."
4. **Traffic source concentration** → suggest source-specific personalization on a synced pattern (e.g., "Show a different hero CTA to visitors from [top referrer]")

Format:
```
💡 Opportunities
  1. [Action verb] [specific suggestion] — [one-line data reason]
  2. [Action verb] [specific suggestion] — [one-line data reason]
  3. [Action verb] [specific suggestion] — [one-line data reason]
```

---

## Tone & Style

- Dashboard-style, scannable
- Numbers first, commentary second
- Plain language, no jargon
- Action verbs for suggestions: "Test", "Personalize", "Investigate", "Boost"
- Do NOT include detailed recommendation cards (that's what `/accelerate` is for)
- If the user wants deeper analysis on anything, suggest they run `/accelerate`
