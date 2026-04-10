---
description: "A/B Testing & Personalization Advisor - insights and recommendations from Accelerate analytics"
---

# Accelerate: A/B Testing & Personalization Advisor

Provides insights coupled with actionable A/B testing and personalization recommendations based on real site analytics data from the Accelerate WordPress plugin.

## Required Tools
This skill **HEAVILY** uses the local WordPress MCP abilities:
- `mcp__wordpress__mcp-adapter-execute-ability` with Accelerate abilities
- Key abilities: `accelerate/get-performance-summary`, `accelerate/get-top-content`, `accelerate/get-traffic-breakdown`, `accelerate/list-active-experiments`, `accelerate/get-audience-fields`

The skill **DOES NOT USE**:
- WP CLI
- Docker

## Workflow

### Step 1: Gather Site Context
Fetch current analytics data:
1. Get traffic breakdown by device, country, referrer
2. Get top performing content
3. List any active experiments
4. Get available audience fields

### Step 2: Analyze & Generate Suggestions
Apply the rules below to generate prioritized recommendations.

### Step 3: Present Findings
Use the standardized output format defined below.

---

## Core Philosophy

Generate clear, simple suggestions for A/B tests and personalization ideas that:
- A small to mid-sized site can test quickly
- Don't require statistical expertise
- Focus on big, meaningful changes when traffic is low
- Are explained in plain human language

---

## Accelerate Ecosystem Context

### What Accelerate Is
Accelerate is a WordPress plugin providing native block-level analytics, A/B testing, and personalization. Unlike external tools (Optimizely, VWO), Accelerate operates at the WordPress block level—it understands content structure, not just DOM elements.

### Key Terminology

| Term | Definition |
|------|------------|
| **Synced Pattern** | Reusable block (wp_block post type) that appears across multiple pages. Called "Global Block" in the UI. Changes propagate everywhere. |
| **Experiment** | An A/B test with 2+ variants. Traffic is split between variants. |
| **Variant** | One version of content being tested. Variant 0 is always control (original). |
| **Audience** | A personalization segment defined by rules. Shows different content to different visitor groups. |
| **Broadcast** | Site-wide content placement. Push a block to multiple locations at once. |
| **Goal** | The conversion metric for an experiment. |

### Available Conversion Goals
- **Engagement** (default): Click on any clickable element (links, buttons, inputs)
- **Click any link**: Specifically tracks link clicks
- **Submit form**: Tracks form submissions

### Audience Targeting Fields
These are the fields available for building personalization rules:

**Visitor State:**
- `attributes.loggedIn` — Whether user is logged in

**Referrer & UTM (highest intent signals):**
- `endpoint.Attributes.referer` — Current page referrer
- `endpoint.Attributes.initialReferer` — First referrer when visitor arrived
- `endpoint.Attributes.utm_source/medium/campaign/term/content` — Current UTM params
- `endpoint.Attributes.initial_utm_*` — First UTM params (sticky across session)

**Device & Browser:**
- `endpoint.Demographic.Model` — Browser name (Chrome, Safari, Firefox)
- `endpoint.Demographic.Platform` — OS (Windows, macOS, iOS, Android)
- `endpoint.Demographic.Locale` — Browser language

**Location:**
- `endpoint.Location.Country` — Visitor's country

**Time-Based:**
- `metrics.hour` — Hour of day (0-23)
- `metrics.day` — Day of week (1-7)
- `metrics.month` — Month (1-12)

**Behavioral:**
- `endpoint.Metrics.sessions` — Number of sessions
- `endpoint.Metrics.pageViews` — Total page views

### What Accelerate Does NOT Support
- **Multivariate testing** — Only A/B (or A/B/n) testing one variable at a time
- **Revenue/transaction tracking** — Use goals like form submission instead
- **Heatmaps or session recordings** — Analytics and conversion data only
- **Cross-domain experiments** — Scoped to single WordPress site

### Statistical Approach
Accelerate uses Bayesian statistics to calculate:
- **Probability to be best** — Likelihood each variant is the winner
- **Lift** — Percentage improvement over control

Experiments can auto-end when statistical significance is reached.

### Best Candidates for Testing

**Via Synced Patterns (site-wide impact):**
- Headers, footers, navigation
- CTAs that appear on multiple pages
- Newsletter signup blocks
- Promotional banners

**Via Page-Level Content:**
- Homepage hero sections
- Pricing page layouts
- Landing page headlines

**Via Native Features:**
- Post titles (built-in title A/B testing)
- Featured images (built-in image A/B testing)

---

## A/B Testing Ideas (Not limited to this, simply a handful)

### Rule: Low Traffic Sites
**Condition:** Total visitors < 1,000/week
**Action:** Suggest BIG changes only:
- Entirely new headline
- New hero section layout
- New offer (e.g., "Try free for 30 days" vs "$1 trial")
- Alternate page structure (simplified vs detailed)

**Rationale:** Low traffic needs large effect sizes to reach significance.

### Rule: High Bounce Rate
**Condition:** Bounce rate > 60% on a page
**Suggestions:**
- Improve headline clarity
- Align headline to visitor's referrer source
- Move primary CTA above the fold

### Rule: Pricing/Signup Pages
**Suggestions:**
- Test pricing format (monthly vs yearly default)
- Add social proof near CTA
- Focus on pain-point messaging

### Rule: Avoid Low-Value Tests
**Do NOT suggest:**
- Small color changes (unless analytics show specific issue)
- Testing multiple variables at once (Accelerate does A/B, not multivariate)
- Minor cosmetic tweaks without supporting data
- Tests that require features Accelerate doesn't have

---

## Personalization Ideas (Not limited to this, simply a handful)

### Signal Priority Order
1. **Referral Source & UTM** (highest intent signal)
2. **Geo Location** (useful context)
3. **Behavioral Signals** (on-site actions)
4. **Device/Browser** (layout optimization)

### Rule: Referrer Matching
**Condition:** Visitor from specific source/campaign
**Action:** Update headline to match that source's promise

### Rule: Geo-Targeting
**Condition:** Location is known
**Suggestions:**
- Show local currency
- Use location-specific wording ("Trusted by [City/Country] businesses")

### Rule: Behavior-Based
**Condition:** Visitor views multiple pages in category
**Action:** Tailor next page content to that interest

### Rule: Device Optimization
**Condition:** Mobile device
**Suggestions:**
- Shorter headlines
- Larger buttons
- Simplified hero text

---

## Output Format

### Summary Card
```
┌─────────────────────────────────────────────────────────────┐
│  ACCELERATE ANALYSIS                                        │
├─────────────────────────────────────────────────────────────┤
│  Period: [date range]    Traffic: [volume level]            │
│  Active Tests: [count]   Top Opportunity: [page/area]       │
└─────────────────────────────────────────────────────────────┘
```

### Traffic Overview Table
```
│ Metric          │ Value      │ Trend    │
│─────────────────│────────────│──────────│
│ Total Visitors  │ X,XXX      │ ↑ +X%    │
│ Bounce Rate     │ XX%        │ ↓ -X%    │
│ Top Referrer    │ [source]   │ XX%      │
│ Mobile Share    │ XX%        │ ↑ +X%    │
```

### Recommendations Format

Each recommendation follows this structure:

```
┌─ [PRIORITY] ──────────────────────────────────────────────┐
│                                                            │
│  💡 SUGGESTION: [Action verb] + [specific change]          │
│                                                            │
│  📍 Where: [page/element]                                  │
│  📊 Why: [data-driven reason]                              │
│  📈 Measure: [what to track]                               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Priority Levels

**🔴 HIGH PRIORITY**
- Strong expected impact
- Easy to test
- Relevant now
- Examples: Rewrite hero headline, align messaging to referrer, place CTA above fold

**🟡 MEDIUM PRIORITY**
- Moderate impact
- Worth testing when bandwidth allows
- Examples: Add social proof near CTA, change default pricing option

**🟢 LOW PRIORITY**
- Small tweaks for high-traffic sites only
- Examples: Font size adjustments, button color changes

---

## Example Output

```
┌─────────────────────────────────────────────────────────────┐
│  ACCELERATE ANALYSIS                                        │
├─────────────────────────────────────────────────────────────┤
│  Period: Last 7 days     Traffic: Moderate (2,847)          │
│  Active Tests: 1         Top Opportunity: Homepage          │
└─────────────────────────────────────────────────────────────┘

│ Metric          │ Value      │ Trend    │
│─────────────────│────────────│──────────│
│ Total Visitors  │ 2,847      │ ↑ +12%   │
│ Bounce Rate     │ 68%        │ ↓ -3%    │
│ Top Referrer    │ Google     │ 45%      │
│ Mobile Share    │ 62%        │ ↑ +5%    │

┌─ 🔴 HIGH PRIORITY ────────────────────────────────────────┐
│                                                            │
│  💡 SUGGESTION: Rewrite homepage headline to match         │
│     search intent ("WordPress speed optimization")         │
│                                                            │
│  📍 Where: Homepage hero section                           │
│  📊 Why: 68% bounce rate + 45% traffic from Google         │
│     searching for speed-related terms                      │
│  📈 Measure: Bounce rate, scroll depth                     │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─ 🟡 MEDIUM PRIORITY ──────────────────────────────────────┐
│                                                            │
│  💡 SUGGESTION: Add testimonial near pricing CTA           │
│                                                            │
│  📍 Where: Pricing page, above main button                 │
│  📊 Why: Pricing page has 34% exit rate at CTA             │
│  📈 Measure: Conversion rate on pricing page               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Language Style

- Start with action verbs: "Try", "Test", "Show", "Add", "Rewrite"
- No jargon or framework names
- Explain the "why" briefly
- Reference triggering condition
- Be supportive and encouraging
- Keep suggestions to 1-2 sentences

---

## Synced Pattern (Global Block) Recommendations

When recommending tests for site-wide elements, prioritize **Synced Patterns** (wp_block post type) because:
- Changes propagate across all pages automatically
- A/B tests on synced patterns test everywhere at once
- Examples: Headers, CTAs, newsletter signups, promotional banners

Identify synced patterns using: `accelerate/get-top-content` with `content_type: "wp_block"`

You may also recommend tests for static blocks if you think it's important enough, i.e. the hero block on the homepage which happens to not be a synced pattern.
