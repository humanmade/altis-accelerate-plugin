# Accelerate Analytics Solution - Technical Documentation

## Executive Summary

The Accelerate analytics system is a **cloud-based, GDPR-compliant solution** that provides block-level performance tracking, A/B testing, and audience personalization for WordPress sites. Data flows from client-side JavaScript to a EU-hosted ClickHouse database, with WordPress serving as the configuration and display layer.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT SIDE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Browser                                                                 │
│  ├── altis-accelerate-accelerate.js (async)                             │
│  ├── altis-accelerate-experiments.js (goals tracking)                   │
│  └── Custom Elements: <global-block>, <ab-test-block>, <personalization>│
│                              │                                           │
│                              ▼                                           │
│                    POST events to cloud                                  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        CLOUD SERVICE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Endpoint: https://eu.accelerate.altis.cloud/log                        │
│  Database: ClickHouse (eu.db.accelerate.altis.cloud:443)                │
│  Location: Frankfurt, Germany (EU)                                       │
│  Retention: 90 days                                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        WORDPRESS BACKEND                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PHP Layer                                                               │
│  ├── inc/analytics/     → Script loading, client data injection         │
│  ├── inc/api/           → REST endpoints for dashboard queries          │
│  ├── inc/utils/         → ClickHouse query builder                      │
│  ├── inc/experiments/   → A/B test processing (hourly cron)             │
│  └── inc/audiences/     → Audience rule → SQL translation               │
│                                                                          │
│  REST API: /accelerate/v1/                                               │
│  ├── /stats         → Aggregate statistics                               │
│  ├── /top           → Top performing content                             │
│  ├── /diff          → Period comparisons                                 │
│  └── /xbs/{id}/views → Block-specific analytics                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        FRONTEND DASHBOARD                                │
├─────────────────────────────────────────────────────────────────────────┤
│  React/TypeScript                                                        │
│  ├── src/dashboard/         → Main analytics dashboard                  │
│  ├── src/accelerate/        → Content Explorer                          │
│  ├── src/global-blocks/     → Block editor portal (Header.tsx)          │
│  └── src/data/              → Redux store (accelerate, accelerate/xbs)  │
│                                                                          │
│  Visualization: Visx (D3-based), Recharts, React Sparklines             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Collection

### Events Tracked

| Event Type | Trigger | Data Captured |
|------------|---------|---------------|
| `pageView` | Page load | URL, referrer, user context |
| `blockView` | Synced pattern renders | Block ID, variant ID |
| `blockLoad` | Block appears in viewport | Block ID, load time |
| `conversion` | Goal completion | Goal type, block ID, variant |
| `testView` | A/B test impression | Test ID, variant ID |
| `testConversion` | A/B test goal hit | Test ID, variant ID, goal |

### Context Data (Every Event)

```javascript
{
  // User Context
  loggedIn: boolean,
  userId: number,
  userRoles: string[],

  // Page Context
  postType: string,
  postId: number,
  author: string,
  authorId: number,
  frontPage: boolean,
  is404: boolean,
  archive: boolean,
  archiveType: string,
  search: string,

  // Site Context
  blog: string,
  blogId: number,
  network: string,
  networkId: number,

  // Traffic Source
  referer: string,
  utm_campaign: string,
  utm_source: string,
  utm_medium: string,
  utm_term: string,
  utm_content: string
}
```

### ClickHouse Schema (Inferred)

| Column | Type | Purpose |
|--------|------|---------|
| `event_timestamp` | DateTime64(3) | Millisecond precision timing |
| `event_type` | String | Event classification |
| `endpoint_id` | String | Unique visitor identifier |
| `blog_id` | String | WordPress site ID |
| `post_id` | String | Content identifier |
| `url` | String | Page URL |
| `referer` | String | Traffic source |
| `attributes` | JSON | Page/user context |
| `metrics` | JSON | Custom metrics |
| `audience` | String | Matched audience ID |
| `test_variant_id` | String | A/B variant shown |
| `country` | String | Geo-location |
| `platform` | String | OS |
| `model` | String | Browser |

---

## 3. Feature Touchpoints

### A/B Testing (Experiments)

| Component | Role |
|-----------|------|
| `inc/experiments/namespace.php` | Goal registration, cron processing |
| `src/experiments/` | Frontend goal tracking |
| Cron: `altis_post_ab_test_cron` | Hourly result processing |
| MathPHP | Statistical significance (binomial) |

**Flow:**
1. Goals registered (engagement, click, form submit)
2. Frontend tracks variant impressions and conversions
3. Hourly cron queries ClickHouse for aggregates
4. Statistical analysis determines winner (99% confidence)
5. Results stored in post meta

**Conversion Goals Available:**
- `engagement` - Any click on links/buttons/forms (default)
- `click_any_link` - Link clicks only
- `submit_form` - Form submissions
- Custom goals via `register_goal()`

---

### Audiences

| Component | Role |
|-----------|------|
| `inc/audiences/namespace.php` | Rule → SQL translation |
| `build_audience_query()` | Generates ClickHouse WHERE clause |
| `get_estimate()` | Real-time audience size |

**Audience Fields:**
- User: logged-in status, roles
- Traffic: referrer, UTM parameters
- Device: browser, OS, locale
- Location: country
- Engagement: sessions, page views
- Temporal: hour, day, month, year

**Operators:** `=`, `!=`, `*=` (contains), `!*` (not contains), `^=` (starts with), `>`, `>=`, `<`, `<=`

---

### Synced Patterns (Global Blocks)

| Component | Role |
|-----------|------|
| `inc/global-blocks/namespace.php` | Render wrapper injection |
| Custom Elements | `<global-block>`, `<ab-test-block>`, `<personalization-block>` |
| `src/global-blocks/Header.tsx` | Analytics portal in editor |

**Tracking Wrapper:**
```html
<ab-test-block
  block-id="123"
  goal="engagement"
  traffic-percentage="100"
  attributes='{"authorId":1}'
  metrics='{}'>
  <!-- Block content -->
</ab-test-block>
```

---

### Content Explorer Dashboard

| Component | Role |
|-----------|------|
| `src/accelerate/content-explorer/` | Main dashboard UI |
| `HeroChart.tsx` | Traffic visualization |
| `List.tsx` | Content listing with sparklines |
| REST: `/accelerate/v1/top` | Data source |

---

### Broadcast Blocks

- Renders synced patterns with custom `clientId` for tracking context
- Inherits all standard block analytics
- Managed via `src/accelerate/broadcast-manager/`

---

## 4. Data Flow Diagram

```
VISITOR ACTION                    WORDPRESS                         CLOUD
─────────────────────────────────────────────────────────────────────────────

Page Load ──────────────────────► enqueue_scripts()
                                  ├── Load analytics.js (async)
                                  ├── Inject client data
                                  └── Configure audiences
                                           │
                                           ▼
                                  Browser executes JS
                                  ├── Evaluate audience rules
                                  ├── Select variant (if A/B/personalization)
                                  └── Track pageView ──────────────► /log endpoint
                                                                          │
Block Renders ──────────────────► render_block()                          │
                                  ├── Wrap in custom element              │
                                  └── Include tracking attributes         │
                                           │                              │
                                           ▼                              ▼
                                  Track blockView ─────────────────► ClickHouse
                                                                          │
User Clicks Goal ───────────────► Goal event listener                     │
                                  └── Track conversion ────────────► ClickHouse
                                                                          │
                                                                          │
HOURLY CRON ◄─────────────────────────────────────────────────────────────┘
     │
     ▼
process_post_ab_test_result()
     │
     ├── Query ClickHouse for aggregates
     ├── Calculate conversion rates
     ├── Statistical significance test
     └── Store results in post meta
              │
              ▼
         Admin Dashboard ◄── REST API ◄── ClickHouse queries
```

---

## 5. Caching Strategy

| Cache Type | TTL | Purpose |
|------------|-----|---------|
| Stats queries | 1 minute | Dashboard freshness |
| Top content | 1 minute | Content Explorer |
| Post diffs | 5 minutes | Period comparisons |
| Audience estimates | 1 hour | Audience size calculations |

**Cache Keys:** SHA1 hash of (function + query + parameters)

**Cache Group:** `altis`, `altis-audiences`

---

## 6. Security & Privacy

### Implemented Measures

| Measure | Implementation |
|---------|----------------|
| GDPR Compliance | EU data hosting (Frankfurt) |
| Consent API | WordPress Consent API integration |
| Data Retention | 90-day automatic deletion |
| Access Control | `edit_posts` capability required |
| Input Sanitization | `sanitize_text_field()`, type casting |
| SQL Injection Prevention | Parameterized ClickHouse queries |
| CSRF Protection | Nonce verification on forms |
| Bot Filtering | Configurable bot exclusion |
| Preview Exclusion | No tracking during `is_preview()` |

### Consent Categories

- `functional` - Always allowed
- `statistics-anonymous` - Always allowed
- Others require explicit consent

---

## 7. Known Challenges

### Technical Debt

| Issue | Location | Impact |
|-------|----------|--------|
| Variant validation disabled | `src/global-blocks/blocks/variant/edit.js:13` | Data integrity risk |
| Incomplete input validation | `inc/api/namespace.php:140` | Security concern |
| P2BB calculation placeholder | `src/utils/admin.ts:407` | Accuracy of probability calculations |

### Architectural Concerns

| Challenge | Details |
|-----------|---------|
| **Cloud Dependency** | All analytics require external service availability |
| **Hourly Processing** | A/B test results not real-time (cron-based) |
| **Cache Invalidation** | 1-minute cache means slightly stale dashboard data |
| **JavaScript Dependency** | Analytics requires JS execution (no server-side fallback) |

### Integration Challenges

| Challenge | Details |
|-----------|---------|
| JS Blocks | Third-party blocks with JS init need `altisBlockContentChanged` hook |
| Image API vs BlockPreview | Current thumbnail generation uses external API |
| Frequentist vs Bayesian | Current P2BB is simplified; Bayesian upgrade pending |

---

## 8. Opportunities

### Short-Term Improvements

| Opportunity | Benefit | Effort |
|-------------|---------|--------|
| **Real-time A/B results** | Remove hourly delay | Medium |
| **BlockPreview API** | Eliminate external thumbnail dependency | Medium |
| **Bayesian A/B testing** | More accurate winner detection | High |
| **Re-enable variant validation** | Data integrity | Low |
| **Complete input validation** | Security hardening | Low |

### Medium-Term Enhancements

| Opportunity | Benefit |
|-------------|---------|
| **Page/Post-level analytics bar** | Analytics visibility outside synced patterns |
| **Experiments Overview dashboard** | Centralized A/B test management |
| **JS block integration improvements** | Better third-party compatibility |
| **Offline analytics fallback** | Resilience during cloud outages |

### Strategic Opportunities

| Opportunity | Benefit |
|-------------|---------|
| **Server-side variant selection** | SEO benefits, no JS dependency |
| **Webhook integrations** | Push analytics to external systems |
| **Custom event API** | User-defined conversion events |
| **Multi-site analytics rollup** | Network-level insights |

---

## 9. External Dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| `eu.accelerate.altis.cloud` | Event logging | Service availability |
| `eu.db.accelerate.altis.cloud` | ClickHouse database | Data access |
| `accelerateplugin.com` | OAuth, dashboard | Authentication |
| Segment.io | Plugin telemetry | Usage tracking |
| MathPHP | Statistical calculations | None (bundled) |

---

## 10. Configuration Reference

### PHP Constants

```php
// Endpoints
ALTIS_ACCELERATE_LOG_ENDPOINT    // Default: https://eu.accelerate.altis.cloud/log
ACCELERATE_ANALYTICS_URL         // Default: https://eu.accelerate.altis.cloud/
ACCELERATE_DASHBOARD_URL         // Default: https://www.accelerateplugin.com/

// ClickHouse
ALTIS_CLICKHOUSE_HOST            // Default: eu.db.accelerate.altis.cloud
ALTIS_CLICKHOUSE_PORT            // Default: 443
ALTIS_CLICKHOUSE_USER            // Default: u_{app_id}
ALTIS_CLICKHOUSE_DB              // Default: default

// Debug
ALTIS_ACCELERATE_CLICKHOUSE_DEBUG  // Enable query debug headers
```

### Filters (Extensibility)

| Filter | Purpose |
|--------|---------|
| `altis.analytics.data.endpoint` | Modify user endpoint data |
| `altis.analytics.data.attributes` | Add custom attributes |
| `altis.analytics.data.metrics` | Add custom metrics |
| `altis.analytics.consent_enabled` | Enable/disable consent API |
| `altis.analytics.exclude_bots` | Control bot filtering |
| `altis.analytics.noop` | Disable tracking entirely |
| `altis.analytics.feature.*` | Toggle individual features |

---

## 11. REST API Reference

### GET `/accelerate/v1/stats`

Returns aggregate statistics for a time period.

**Parameters:**
- `start` (string) - ISO 8601 start date
- `end` (string) - ISO 8601 end date
- `interval` (string) - Time bucket (default: '1 day')
- `tz` (int) - Timezone offset in minutes
- `filter` (object) - Optional filters

**Response:**
```json
{
  "by_interval": {
    "2025-12-25": {
      "views": 1234,
      "visitors": 567,
      "returning": 89,
      "bounce": 234
    }
  },
  "stats": {
    "summary": { "views": 1234, "visitors": 567 },
    "by_url": { "/page": 100 },
    "by_referer": { "google.com": 50 },
    "by_country": { "US": 200 },
    "by_browser": { "Chrome": 400 },
    "by_os": { "Windows": 300 }
  }
}
```

### GET `/accelerate/v1/top`

Returns top performing content.

**Parameters:**
- `type` (string) - Post type filter
- `author` (int) - Author ID filter
- `search` (string) - Search query
- `page` (int) - Pagination
- `include` (array) - Specific post IDs

### GET `/accelerate/v1/diff`

Returns period comparison data.

**Parameters:**
- `posts` (array) - Post IDs to compare
- `start` / `end` - Current period
- `prev_start` / `prev_end` - Previous period

---

## 12. WordPress Data Stores

### Main Store: `accelerate`

```javascript
// Selectors
wp.data.select('accelerate').getPosts(queryArgs)
wp.data.select('accelerate').getStats(queryArgs)
wp.data.select('accelerate').getDiffs(queryArgs)
wp.data.select('accelerate').getIsLoading()

// Actions
wp.data.dispatch('accelerate').invalidateResolution('getPosts', [args])
```

### Block Store: `accelerate/xbs`

```javascript
// Selectors
wp.data.select('accelerate/xbs').getViews(blockId, args)
wp.data.select('accelerate/xbs').getPost(blockId)
wp.data.select('accelerate/xbs').getIsLoading()
```

---

## 13. Summary Statistics

| Metric | Value |
|--------|-------|
| PHP Analytics Code | ~2,500 LOC |
| Frontend Analytics Code | ~4,000 LOC |
| REST Endpoints | 4 main + sub-routes |
| Event Types | 6 core types |
| Conversion Goals | 3 default + custom |
| Audience Fields | 15+ mappings |
| Cache TTLs | 1-60 minutes |
| Data Retention | 90 days |
| Processing Frequency | Hourly (cron) |

---

## 14. Recommendations

### Priority 1 (Security/Stability)
1. Complete input validation in API endpoints
2. Re-enable variant validation
3. Add error handling for cloud service failures

### Priority 2 (Accuracy)
4. Implement Bayesian A/B testing
5. Add real-time A/B result updates (reduce hourly delay)

### Priority 3 (UX)
6. Fix variant gap in block editor
7. Add hidden variant indicators

### Priority 4 (Architecture)
8. Switch to BlockPreview API
9. Improve JS block integration
10. Consider server-side variant selection for SEO
