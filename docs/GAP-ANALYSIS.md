# Accelerate Gap Analysis
## Competitive Positioning vs Parse.ly, Chartbeat, Adobe Analytics & Piano.io

*Analysis Date: January 2026*

---

## Executive Summary

Accelerate possesses unique block-level analytics capabilities that no competitor offers. However, the platform under-surfaces its rich data in the UI, missing opportunities for user attachment through **Validation** (author metrics), **Situational Awareness** (real-time/velocity), and **Strategic Intelligence** (taxonomy insights). Most high-value competitor features can be approximated with existing ClickHouse data and frontend changes.

---

## 1. What Accelerate Already Does Well

| Area | Accelerate Strength | Competitor Equivalent |
|------|---------------------|----------------------|
| **Block-level Analytics** | Unique - no competitor tracks at block granularity | None |
| **Native A/B Testing** | Built into WordPress editor with statistical rigor | Requires external tools |
| **Personalization** | Audience rules + variant selection + coverage metrics | Piano propensity (partial) |
| **Privacy-First** | GDPR-compliant, EU hosting, 90-day retention | Varies widely |
| **WordPress Integration** | Zero external dependencies for core analytics | All require integration work |
| **Synced Pattern Analytics** | Track reusable content across entire site | None |

**Key Differentiator**: The Block Performance Portal (`Header.tsx`) is already a signature experience - editors see analytics directly in the block editor. No competitor offers this level of integration.

---

## 2. Competitor Signature Reports & Psychological Drivers

### Parse.ly

| Signature Report | User Attachment | Psychological Driver |
|------------------|-----------------|---------------------|
| **Pulse Dashboard** | Real-time ranking, source filtering, engaged time toggle | **Situational Awareness** - "What is winning now?" |
| **Author Detail** | Personal metrics, historical analysis, loyalty stats | **Validation** - "How am I performing?" |
| **Topic/Tag Report** | Taxonomy performance, supply/demand gaps | **Strategic Planning** - "What should we write?" |

### Chartbeat

| Signature Report | User Attachment | Psychological Driver |
|------------------|-----------------|---------------------|
| **Heads Up Display (HUD)** | Overlay on live site, colored pins, scroll depth | **Control** - "I can fix the page layout" |
| **Big Board** | Newsroom wall display, leaderboard, shared reality | **Gamification** - "We are beating yesterday" |
| **Recirculation Rate** | Next-click metric, device benchmarks | **Depth** - "Are visitors staying?" |

### Adobe Analytics

| Signature Report | User Attachment | Psychological Driver |
|------------------|-----------------|---------------------|
| **Flow Visualization** | Non-linear journey mapping, inter-dimensional | **Discovery** - "I can trace exact steps" |
| **Fallout Visualization** | Funnel analysis, segment comparison | **Forensics** - "Where do we lose them?" |
| **Attribution Panel** | Model comparison (First/Last/Linear/Algorithmic) | **Justification** - "My ad spend works" |

### Piano.io

| Signature Report | User Attachment | Psychological Driver |
|------------------|-----------------|---------------------|
| **Likelihood to Subscribe (LtS)** | Propensity scoring, "moveable middle" targeting | **Prediction** - "Who will pay?" |
| **Content Profiles** | Revenue per topic, automated enrichment | **Value** - "This topic makes money" |
| **Subscription Funnel** | Meter stop rate, paywall optimization | **Conversion** - "How many convert?" |

---

## 3. Gap Analysis: What Accelerate is Missing

### Gap 1: No Real-Time "Pulse" Experience

**Competitor Feature**: Parse.ly Pulse, Chartbeat HUD provide instant "what's winning now" with velocity indicators and concurrent visitors.

**Accelerate Current State**:
- 1-minute cache on stats queries (`inc/api/namespace.php`)
- No concurrent visitors metric
- No velocity/trending indicators (↑↓ arrows)
- No "what's hot right now" view

**Data Available**: ✅ All required data exists in ClickHouse

**Psychological Driver Missing**: **Situational Awareness**

---

### Gap 2: No Author/Creator Attribution

**Competitor Feature**: Parse.ly Author Detail drives attachment through personal performance metrics.

**Accelerate Current State**:
- `authorId` tracked in every event (`inc/analytics/namespace.php`)
- `blockAuthor` and `blockAuthorID` in block events
- **Never surfaced in UI** - no author filter, no author view

**Data Available**: ✅ Complete author data in ClickHouse

**Psychological Driver Missing**: **Validation**

---

### Gap 3: No Topic/Taxonomy Intelligence

**Competitor Feature**: Parse.ly Topic Report answers "what should we write?"

**Accelerate Current State**:
- WordPress categories/tags exist on posts
- Analytics don't aggregate by taxonomy
- No supply/demand gap identification

**Data Available**: ⚠️ Partial - requires joining WP taxonomy data with analytics

**Psychological Driver Missing**: **Strategic Planning**

---

### Gap 4: No Engagement Depth Metrics

**Competitor Feature**: Chartbeat Recirculation, Parse.ly Engaged Minutes.

**Accelerate Current State**:
- Only views/conversions tracked as primary metrics
- No "Engaged Time" calculation
- No recirculation rate (% viewing 2+ pages)
- No pages-per-session metric
- No scroll depth tracking

**Data Available**: ✅ `endpoint_sessions` and `endpoint_views` exist

**Psychological Driver Missing**: **Quality Assessment**

---

### Gap 5: No Journey/Path Analysis

**Competitor Feature**: Adobe Flow visualization shows user paths.

**Accelerate Current State**:
- No "what did they do next?" analysis
- No funnel visualization outside A/B tests
- No path/flow visualization

**Data Available**: ⚠️ Would require new queries on sequential events

**Psychological Driver Missing**: **Discovery**

---

### Gap 6: No Attribution Model Comparison

**Competitor Feature**: Adobe Attribution Panel compares First/Last/Linear models.

**Accelerate Current State**:
- `initial_referer` and `referer` both tracked
- `initial_utm_*` and `utm_*` arrays tracked
- **Never compared** - no first vs last touch view

**Data Available**: ✅ All attribution data exists

**Psychological Driver Missing**: **Justification**

---

### Gap 7: No Predictive Intelligence

**Competitor Feature**: Piano Likelihood to Subscribe, Content Profiles.

**Accelerate Current State**:
- No propensity scoring
- No "moveable middle" identification
- No revenue/subscription correlation

**Data Available**: ❌ Would require ML model + revenue integration

**Psychological Driver Missing**: **Prediction**

---

## 4. Opportunity Matrix

### 🟢 Quick Wins (1-5 days each)

| Opportunity | Existing Data | Implementation | Impact |
|-------------|---------------|----------------|--------|
| **Velocity Arrows** | ✅ diff data in getDiffs() | Add ↑↓ icons in `ListItem.tsx` based on % change | High |
| **Author Filter** | ✅ authorId in events | Add dropdown in `ListFilters.tsx`, use existing API param | High |
| **Author Column** | ✅ authorId in events | Display author in `ListItem.tsx` | Medium |
| **Top by Source** | ✅ referer, UTM tracked | Filter tabs: All/Google/Facebook/Direct | Medium |
| **Period Comparison Badge** | ✅ diff endpoint | Show "+15% vs last period" badge | Medium |

**Code Locations**:
- `src/accelerate/components/ListItem.tsx` - velocity arrows, author column
- `src/accelerate/components/ListFilters.tsx` - author filter, source filter
- `inc/api/namespace.php` - already has author parameter support

---

### 🟡 Medium Effort (1-3 weeks each)

| Opportunity | What's Needed | Impact |
|-------------|---------------|--------|
| **Recirculation Rate** | New ClickHouse query: `countIf(endpoint_views > 1) / count()` | High |
| **Engaged Time Metric** | Calculate from timestamp diffs between pageView events | High |
| **Real-Time Mode** | Reduce cache TTL, optional WebSocket updates | Very High |
| **Topic/Tag Analytics** | Join WP taxonomy with ClickHouse, group-by queries | Medium |
| **Author Leaderboard** | New endpoint aggregating metrics by author | High |
| **First vs Last Touch** | Compare initial_referer to last referer | Medium |
| **Concurrent Visitors** | Query visitors in last 5 minutes | High |

---

### 🔴 Strategic Investments (1-3 months)

| Opportunity | Requirements | Competitor Parity |
|-------------|--------------|-------------------|
| **Propensity Scoring** | ML model, training data, scoring pipeline | Piano LtS |
| **Flow Visualization** | Path analysis queries, D3/visx visualization | Adobe Flow |
| **HUD Overlay** | Browser extension or bookmarklet architecture | Chartbeat HUD |
| **Revenue Attribution** | Payment system integration, value tracking | Piano Content Profiles |
| **Big Board Mode** | TV-optimized display, auto-refresh | Chartbeat Big Board |

---

## 5. Recommended Implementation Phases

### Phase 1: "Validation" (Week 1-2)

**Goal**: Give creators personal attachment through author metrics.

1. **Add velocity arrows** to Content Explorer list items
   - File: `src/accelerate/components/ListItem.tsx`
   - Logic: Render ↑↓↔ based on existing `change` calculation

2. **Add Author filter** to Content Explorer
   - File: `src/accelerate/components/ListFilters.tsx`
   - API: Already supports `author` parameter

3. **Add Author column** in list view
   - File: `src/accelerate/components/ListItem.tsx`
   - Display: Author name with link to filtered view

### Phase 2: "Situational Awareness" (Week 3-4)

**Goal**: Create real-time urgency and momentum visibility.

4. **Concurrent visitors widget**
   - New ClickHouse query for visitors in last 5 minutes
   - Display in `HeroChart.tsx` header area

5. **Reduce cache for "Live" mode**
   - Add toggle for real-time updates
   - Reduce TTL from 1 minute to 10 seconds when active

6. **Top by Source tabs**
   - Files: `ListFilters.tsx`, `List.tsx`
   - Tabs: All | Google | Facebook | Direct | Other

### Phase 3: "Depth Metrics" (Week 5-6)

**Goal**: Add engagement quality metrics beyond views.

7. **Recirculation rate metric**
   - New field in `/accelerate/v1/stats` response
   - Display in `HeroChart.tsx` summary cards

8. **Pages per session**
   - Calculate from existing session data
   - Add to stats response

9. **Topic/Tag view**
   - New grouping option in Content Explorer
   - Aggregate by WordPress taxonomy

---

## 6. Data Availability Summary

| Metric/Feature | ClickHouse Column | Currently Used? |
|----------------|-------------------|-----------------|
| Author ID | `attributes['authorId']` | ❌ Not surfaced |
| Author Name | `attributes['blockAuthor']` | ❌ Not surfaced |
| Initial Referrer | `initial_referer` | ❌ Not compared |
| All Referrers | `referers` (array) | ❌ Not analyzed |
| Sessions Count | `endpoint_sessions` | ⚠️ Audiences only |
| Page Views Count | `endpoint_views` | ⚠️ Audiences only |
| Country | `country` | ✅ Used |
| Device/Browser | `model`, `platform` | ✅ Used |
| UTM Parameters | `utm_*`, `initial_utm_*` | ⚠️ Audiences only |
| Event Timestamp | `event_timestamp` | ✅ Used |

**Key Insight**: Accelerate tracks significantly more data than it surfaces. Most gaps are **UI gaps**, not data gaps.

---

## 7. Competitive Positioning Recommendation

### Current Position
Accelerate is a **block-level optimization platform** with unique capabilities no competitor matches.

### Recommended Position
Accelerate should become the **"Creator's Analytics Dashboard"** - combining:

1. **Block-level precision** (unique differentiator)
2. **Author validation** (Parse.ly territory, easy to add)
3. **Real-time awareness** (Chartbeat territory, medium effort)
4. **Personalization coverage** (Piano territory, already exists)

### Avoid Competing On
- Complex journey/flow analysis (Adobe's deep moat)
- Revenue prediction (Piano's ML investment)
- Newsroom TV displays (Chartbeat's hardware play)

---

## 8. Success Metrics

After implementing Phase 1-3, measure:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard return rate | +20% | Users returning to Content Explorer |
| Time in dashboard | +30% | Session duration on analytics pages |
| Author filter usage | >15% of sessions | Feature adoption |
| A/B test creation | +25% | Conversion from viewing to testing |
| Support tickets | -15% | "Where do I see my performance?" questions |

---

## 9. Appendix: Competitor Signature Report Details

### Parse.ly Pulse Dashboard
- Auto-updating every 30 seconds
- Top 50 stories with source breakdown
- Engaged Minutes toggle (quality vs quantity)
- Velocity arrows showing acceleration/deceleration
- Thumbnail previews

### Chartbeat HUD
- Browser overlay on live site
- Colored pins: Green (rising), Yellow (stable), Red (falling)
- Scroll depth heatmap
- CTR per element
- Concurrent visitors in real-time

### Adobe Flow Visualization
- Drag-and-drop dimension selection
- Unlimited path depth
- "Other" bucket expansion
- Right-click to focus on node
- Export to segment

### Piano Likelihood to Subscribe
- 0-100 propensity score per visitor
- Segment breakdown: Cold (0-20), Warm (20-60), Hot (60-100)
- "Moveable Middle" targeting recommendations
- Churn prediction (LtC) for existing subscribers
- Revenue attribution per content piece
