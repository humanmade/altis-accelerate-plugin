# Accelerate Audiences & Personalisation - Technical Documentation

## Executive Summary

The Audiences and Personalisation system enables **visitor segmentation and content targeting** based on behavioral and demographic data. Audiences are defined through a hierarchical rule builder, stored as a custom post type, and evaluated client-side to select which variant content to display. Analytics track coverage and conversion performance per audience segment.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AUDIENCE DEFINITION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  WordPress Admin                                                         │
│  ├── Audience post type ('audience')                                    │
│  ├── Rule builder UI (groups + rules with boolean logic)                │
│  ├── Field mappings to ClickHouse columns                               │
│  └── Real-time size estimation                                          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                    PERSONALISATION BLOCK                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Block Editor                                                            │
│  ├── Convert synced pattern → blockType: 'personalization'             │
│  ├── Add variant blocks (altis/variant) with audience targeting         │
│  ├── Fallback variant for non-matching visitors                         │
│  └── Coverage and lift metrics display                                  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     SERVER RENDERING                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PHP: render_block()                                                     │
│  └── Outputs: <personalization-block> wrapper                           │
│       ├── <template data-audience="123">Variant A</template>            │
│       ├── <template data-audience="456">Variant B</template>            │
│       ├── <template data-fallback>Default</template>                    │
│       └── <noscript>Fallback for no-JS</noscript>                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                    CLIENT-SIDE MATCHING                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  JavaScript: Analytics.updateAudiences()                                 │
│  ├── Load audience configs from Altis.Analytics.Audiences               │
│  ├── Evaluate visitor against each audience's rules                     │
│  ├── Build array of matching audience IDs                               │
│  └── Trigger 'updateAudiences' event                                    │
│                                                                          │
│  PersonalizationBlock custom element:                                    │
│  ├── Find template matching first audience ID                           │
│  ├── Fall back to data-fallback template if no match                    │
│  ├── Clone and render selected template                                 │
│  └── Bind conversion goal handlers                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      ANALYTICS TRACKING                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Events: blockView, conversion                                           │
│  Attributes: blockId, type: 'personalization', audience ID              │
│  Metrics: Coverage %, lift vs fallback, conversion rates                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Audience Data Model

### Post Type Registration

```php
register_extended_post_type(
    'audience',
    [
        'public' => false,
        'show_ui' => false,
        'show_in_rest' => true,
        'rest_base' => 'audiences',
        'capability_type' => ['audience', 'audiences'],
    ]
);
```

### Audience Configuration Schema

```json
{
  "include": "any | all | none",
  "groups": [
    {
      "include": "any | all | none",
      "rules": [
        {
          "field": "endpoint.Location.Country",
          "operator": "=",
          "value": "US"
        }
      ]
    }
  ]
}
```

**Boolean Logic:**
- `include: 'all'` - AND logic (all must match)
- `include: 'any'` - OR logic (at least one must match)
- `include: 'none'` - NOT logic (none must match)

**Example:** `(US AND iOS) OR (GB)`:
```json
{
  "include": "any",
  "groups": [
    {
      "include": "all",
      "rules": [
        { "field": "endpoint.Location.Country", "operator": "=", "value": "US" },
        { "field": "endpoint.Demographic.Platform", "operator": "=", "value": "iOS" }
      ]
    },
    {
      "include": "all",
      "rules": [
        { "field": "endpoint.Location.Country", "operator": "=", "value": "GB" }
      ]
    }
  ]
}
```

---

## 3. Comparison Operators

| Operator | Name | String | Numeric | Array |
|----------|------|--------|---------|-------|
| `=` | Equals | ✓ | ✓ | `has()` |
| `!=` | Not equals | ✓ | ✓ | `not has()` |
| `*=` | Contains | ✓ | - | `position() > 0` |
| `!*` | Does not contain | ✓ | - | `position() = 0` |
| `^=` | Starts with | ✓ | - | `position() = 1` |
| `gt` | Greater than | - | ✓ | - |
| `gte` | Greater or equal | - | ✓ | - |
| `lt` | Less than | - | ✓ | - |
| `lte` | Less or equal | - | ✓ | - |

---

## 4. Available Audience Fields

### User Data
| Field | ClickHouse Column | Description |
|-------|-------------------|-------------|
| `attributes.loggedIn` | `attributes['loggedIn']` | User login status |

### Location
| Field | ClickHouse Column | Description |
|-------|-------------------|-------------|
| `endpoint.Location.Country` | `country` | Two-letter country code |

### Device Demographics
| Field | ClickHouse Column | Description |
|-------|-------------------|-------------|
| `endpoint.Demographic.Model` | `model` | Browser name |
| `endpoint.Demographic.ModelVersion` | `model_version` | Browser version |
| `endpoint.Demographic.Platform` | `platform` | Operating system |
| `endpoint.Demographic.PlatformVersion` | `platform_version` | OS version |
| `endpoint.Demographic.Locale` | `locale` | Browser locale |

### Traffic Source
| Field | ClickHouse Column | Description |
|-------|-------------------|-------------|
| `endpoint.Attributes.initialReferer` | `initial_referer` | First referrer |
| `endpoint.Attributes.referer` | `referers` (array) | All referrers |
| `attributes.referer` | `referer` | Current referrer |

### UTM Parameters
| Field | ClickHouse Column | Type |
|-------|-------------------|------|
| `endpoint.Attributes.initial_utm_campaign` | `initial_utm_campaign` | First campaign |
| `endpoint.Attributes.utm_campaign` | `utm_campaign` | All campaigns (array) |
| `endpoint.Attributes.initial_utm_source` | `initial_utm_source` | First source |
| `endpoint.Attributes.utm_source` | `utm_source` | All sources (array) |
| `endpoint.Attributes.initial_utm_medium` | `initial_utm_medium` | First medium |
| `endpoint.Attributes.utm_medium` | `utm_medium` | All mediums (array) |

### Temporal
| Field | ClickHouse Column | Values |
|-------|-------------------|--------|
| `metrics.hour` | `metrics['hour']` | 0-23 |
| `metrics.day` | `metrics['day']` | 1-7 (Sunday=1) |
| `metrics.month` | `metrics['month']` | 1-12 |
| `metrics.year` | `metrics['year']` | Year |

### Engagement Metrics
| Field | ClickHouse Column | Description |
|-------|-------------------|-------------|
| `endpoint.Metrics.sessions` | `endpoint_sessions` | Total sessions |
| `endpoint.Metrics.pageViews` | `endpoint_views` | Total page views |

---

## 5. Audience Query Building

### Function: `build_audience_query()`

Converts audience configuration to ClickHouse SQL WHERE clause:

```php
function build_audience_query(array $audience, bool $with_join = false): array {
    // Returns: [SQL_WHERE_CLAUSE, QUERY_PARAMETERS]
}
```

### Query Generation Example

**Input:**
```json
{
  "include": "any",
  "groups": [
    {
      "include": "all",
      "rules": [
        { "field": "endpoint.Location.Country", "operator": "=", "value": "US" },
        { "field": "endpoint.Demographic.Platform", "operator": "=", "value": "iOS" }
      ]
    }
  ]
}
```

**Output:**
```sql
WHERE (
    (country = {audience_0_0:String} AND platform = {audience_0_1:String})
)

-- Parameters:
-- audience_0_0 = 'US'
-- audience_0_1 = 'iOS'
```

### Array Field Handling

For array fields (e.g., `utm_campaign`):
```sql
-- Equals: has(utm_campaign, {value:String})
-- Contains: position(arrayStringConcat(utm_campaign), {value:String}) > 0
-- Starts with: position(arrayStringConcat(utm_campaign), {value:String}) = 1
```

---

## 6. Audience Estimation

### Function: `get_estimate()`

Queries ClickHouse to estimate audience size:

```sql
SELECT
    uniqCombined64(endpoint_id) as uniques,
    histogram(42)(toUnixTimestamp64Milli(event_timestamp)) as histogram
FROM analytics
WHERE blog_id = {blog_id:String}
    AND event_type = 'pageView'
    AND event_timestamp >= toDateTime64(intDiv({since:UInt64},1000),3)
    AND {audience_where_clause}
```

### Response Structure

```php
[
    'count' => 1234,      // Unique visitors matching audience
    'total' => 5678,      // Total unique visitors
    'histogram' => [...]  // 28-day distribution
]
```

### Caching

| Data | TTL | Purpose |
|------|-----|---------|
| Audience estimates | 1 hour | Size calculations |
| Total uniques | 1 minute | Baseline for percentages |
| Field data | 1 hour | UI dropdowns |

---

## 7. Personalisation Block Structure

### Block Type Detection

```php
$types = [
    'standard' => 'Synced Pattern',
    'abtest' => 'A/B Test',
    'personalization' => 'Personalized Content',
];
```

### Variant Block Attributes

```json
{
  "audience": 123,
  "fallback": false,
  "goal": "engagement",
  "title": "Mobile Users",
  "percentage": 100
}
```

### Server-Side Rendering

```php
function render_block($attributes, $inner_content) {
    // Personalization variant with audience
    return sprintf(
        '<template data-parent-id="%s" data-audience="%d" data-goal="%s">%s</template>',
        $parent_id,
        $audience_id,
        $goal,
        $inner_content
    );

    // Fallback variant
    return sprintf(
        '<template data-fallback data-parent-id="%s">%s</template>
         <noscript>%s</noscript>',
        $parent_id,
        $inner_content,
        $inner_content
    );
}
```

### Rendered HTML Structure

```html
<personalization-block block-id="456" goal="engagement">
    <template data-audience="123" data-parent-id="456">
        <!-- US audience content -->
    </template>
    <template data-audience="789" data-parent-id="456">
        <!-- UK audience content -->
    </template>
    <template data-fallback data-parent-id="456">
        <!-- Default content -->
    </template>
    <noscript>
        <!-- Fallback for no-JS -->
    </noscript>
</personalization-block>
```

---

## 8. Client-Side Audience Matching

### Matching Algorithm

```javascript
// Analytics.updateAudiences()
function evaluateAudience(config, visitorData) {
    let audienceMatched = config.include === 'all';

    for (const group of config.groups) {
        let groupMatched = group.include === 'all';

        for (const rule of group.rules) {
            const fieldValue = getFieldValue(visitorData, rule.field);
            const ruleMatch = compareValue(fieldValue, rule.operator, rule.value);

            if (group.include === 'any' && ruleMatch) {
                groupMatched = true;
                break;
            }
            if (group.include === 'all' && !ruleMatch) {
                groupMatched = false;
                break;
            }
        }

        if (config.include === 'any' && groupMatched) {
            audienceMatched = true;
            break;
        }
        if (config.include === 'all' && !groupMatched) {
            audienceMatched = false;
            break;
        }
    }

    return audienceMatched;
}
```

### PersonalizationBlock Custom Element

```javascript
class PersonalizationBlock extends Global(HTMLElement) {
    setup() {
        window.Altis.Analytics.on('updateAudiences', this.setContent.bind(this));
    }

    setContent() {
        const audiences = window.Altis.Analytics.getAudiences() || [];
        let template = null;

        // Find first matching audience template
        for (const audienceId of audiences) {
            template = this.querySelector(
                `template[data-audience="${audienceId}"][data-parent-id="${this.blockId}"]`
            );
            if (template) break;
        }

        // Use fallback if no match
        if (!template) {
            template = this.querySelector(
                `template[data-fallback][data-parent-id="${this.blockId}"]`
            );
        }

        // Render selected template
        if (template) {
            this.innerHTML = '';
            this.appendChild(template.content.cloneNode(true));
            this.setupGoal();
        }
    }
}
```

---

## 9. Performance Metrics

### Coverage Calculation

```javascript
// What % of visitors see personalized content
const fallbackViews = analytics.variants.find(v => v.id === 0)?.unique?.views || 0;
const totalViews = analytics.unique?.views || 0;
const coverage = 100 - ((fallbackViews / totalViews) * 100);
```

### Lift Calculation

```javascript
// Improvement vs fallback variant
const fallbackRate = fallbackAnalytics.unique.conversions / fallbackAnalytics.unique.views;
const variantRate = variantAnalytics.unique.conversions / variantAnalytics.unique.views;
const lift = ((variantRate - fallbackRate) / fallbackRate) * 100;
```

### Metrics Display

| Metric | Formula | Description |
|--------|---------|-------------|
| Coverage | `100 - (fallback_views / total_views * 100)` | % seeing personalized content |
| Conversion Rate | `(conversions / views) * 100` | Per-variant conversion |
| Lift | `((variant_rate - fallback_rate) / fallback_rate) * 100` | Improvement vs default |

---

## 10. REST API

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/accelerate/v1/audiences` | GET | List all audiences |
| `/accelerate/v1/audiences/{id}` | GET/PUT/DELETE | Manage audience |
| `/accelerate/v1/audiences/fields` | GET | Available targeting fields |
| `/accelerate/v1/audiences/estimate` | GET | Estimate audience size |

### Audience Response

```json
{
    "id": 123,
    "title": { "rendered": "US Mobile Users" },
    "status": "publish",
    "audience": {
        "include": "all",
        "groups": [...]
    },
    "estimate": {
        "count": 1234,
        "total": 5678,
        "histogram": [...]
    }
}
```

### Fields Response

```json
[
    {
        "name": "endpoint.Location.Country",
        "label": "Country",
        "type": "string",
        "data": [
            { "value": "US", "count": 5420, "percent": 45 },
            { "value": "GB", "count": 2100, "percent": 17 }
        ]
    },
    {
        "name": "endpoint.Metrics.sessions",
        "label": "Sessions",
        "type": "number",
        "stats": {
            "count": 12000,
            "min": 1,
            "max": 500,
            "avg": 3.5
        }
    }
]
```

---

## 11. Block Editor UI

### Header Portal (Personalisation Mode)

| Section | Content |
|---------|---------|
| Metrics Bar | Views, Conversion Rate, Coverage % |
| Period Selector | 7D / 30D / 90D |
| Variants Table | Audience name, metrics, actions |

### Variant Row (Personalisation)

| Column | Data |
|--------|------|
| Thumbnail | Block preview |
| Audience | Audience name with picker |
| Coverage | `(estimate.count / estimate.total) * 100%` |
| Conversion Rate | `(conversions / views) * 100%` |
| Lift | vs fallback variant |
| Actions | Duplicate, Delete |

### Audience Picker

- Modal-based audience selector
- Shows all published audiences
- Quick-create new audience option
- Error states for deleted audiences

---

## 12. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SETUP: Create Personalisation Block                          │
├─────────────────────────────────────────────────────────────────┤
│ Admin creates wp_block → Sets blockType='personalization'       │
│ Adds variants with audience targeting                            │
│ One variant has fallback=true                                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AUDIENCES: Define Rules                                       │
├─────────────────────────────────────────────────────────────────┤
│ Admin creates Audience posts with rule groups                    │
│ Rules map to ClickHouse columns for estimation                   │
│ Audiences passed to frontend via Altis.Analytics.Audiences      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SERVER RENDER: Embed Templates                               │
├─────────────────────────────────────────────────────────────────┤
│ render_block() outputs <personalization-block> with:            │
│   - <template data-audience="123"> per targeted audience        │
│   - <template data-fallback> for non-matching visitors          │
│   - <noscript> for no-JS fallback                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FRONTEND LOAD: Audience Matching                             │
├─────────────────────────────────────────────────────────────────┤
│ Analytics.updateAudiences():                                     │
│   1. Load audience configs                                       │
│   2. Get visitor data (country, device, UTM, etc.)              │
│   3. Evaluate each audience's rules                              │
│   4. Build matched audience IDs array                            │
│   5. Trigger 'updateAudiences' event                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. RENDER VARIANT: Template Selection                           │
├─────────────────────────────────────────────────────────────────┤
│ PersonalizationBlock.setContent():                               │
│   - Query DOM for template matching first audience ID           │
│   - If no match, use fallback template                          │
│   - Clone and render selected template                          │
│   - Bind goal handlers for conversion tracking                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. TRACK PERFORMANCE                                            │
├─────────────────────────────────────────────────────────────────┤
│ Events: blockView (75% visible), conversion (goal achieved)     │
│ Attributes: blockId, type, audience ID                          │
│ Metrics: Coverage %, lift vs fallback, per-variant rates        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Capability System

### Permission Mapping

```php
$cap_map = [
    'edit_audiences' => 'edit_pages',
    'edit_others_audiences' => 'edit_others_pages',
    'publish_audiences' => 'publish_pages',
    'delete_audiences' => 'delete_pages',
    // ... other mappings
];
```

Users with `edit_pages` capability can manage audiences by default.

---

## 14. Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|------|-----------|-----|--------------|
| Audience configs | `audiences` | Until save | On audience save |
| Estimates | SHA1 hash | 1 hour | Automatic |
| Field data | SHA1 hash | 1 hour | Automatic |
| Total uniques | SHA1 hash | 1 minute | Automatic |

---

## 15. Known Challenges

### Technical Issues

| Issue | Impact |
|-------|--------|
| Client-side only matching | Requires JavaScript |
| First-match priority | Audience order matters |
| No server-side fallback | SEO limitations |

### UX Challenges

| Issue | Description |
|-------|-------------|
| Audience ordering | Priority determined by menu_order |
| Deleted audience handling | Shows error in variant row |
| Coverage estimation | Based on 7-day window only |

---

## 16. Opportunities

### Short-Term

| Opportunity | Benefit |
|-------------|---------|
| Server-side audience matching | SEO, no-JS support |
| Audience priority UI | Drag-and-drop ordering |
| Historical coverage trends | Performance over time |

### Medium-Term

| Opportunity | Benefit |
|-------------|---------|
| Audience overlap analysis | Identify conflicts |
| Predictive audience sizing | Before publishing |
| Cross-block audience reporting | Portfolio view |

### Strategic

| Opportunity | Benefit |
|-------------|---------|
| ML-based audience suggestions | Auto-segmentation |
| Third-party audience sync | CRM integration |
| Real-time audience streaming | Live updates |

---

## 17. File Reference

### Backend (PHP)

| File | Purpose |
|------|---------|
| `inc/audiences/namespace.php` | Core audience logic (~950 LOC) |
| `inc/audiences/rest_api/namespace.php` | REST endpoints |
| `inc/global-blocks/namespace.php` | Block rendering |
| `inc/global-blocks/variant/namespace.php` | Variant rendering |

### Frontend (JS/TS)

| File | Purpose |
|------|---------|
| `src/audiences/data/index.ts` | Redux store |
| `src/audiences/ui/manager.tsx` | Audience manager |
| `src/audiences/ui/edit.tsx` | Audience editor |
| `src/audiences/ui/components/rule.tsx` | Rule builder |
| `src/accelerate.js` | Audience matching |
| `src/experiments.js` | PersonalizationBlock element |
| `src/global-blocks/blocks/variant/edit.js` | Variant block |

---

## 18. Summary Statistics

| Metric | Value |
|--------|-------|
| PHP Audiences Code | ~950 LOC |
| Frontend Audiences Code | ~1,500 LOC |
| Available Fields | 20+ |
| Operators | 9 |
| Estimation Window | 7 days |
| Cache TTLs | 1 min - 1 hour |
