# Accelerate A/B Testing (Experiments) - Technical Documentation

## Executive Summary

The A/B testing (experiments) system is a **statistically-rigorous, client-side traffic splitting solution** that enables block-level and post-metadata testing within WordPress. Tests run automatically with hourly result processing, binomial statistical analysis, and automatic winner application.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEST CREATION                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Block Editor                                                            │
│  ├── Convert synced pattern to A/B test (blockType: 'abtest')           │
│  ├── Add variant blocks (altis/variant)                                 │
│  ├── Configure goals, traffic %, duration                               │
│  └── Save → Post meta updated                                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                       FRONTEND RENDERING                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PHP: render_block()                                                     │
│  └── Outputs: <ab-test-block> wrapper + <template> per variant          │
│                                                                          │
│  JavaScript: Custom Element activates                                    │
│  ├── Check traffic percentage (default 35%)                             │
│  ├── Random variant selection (weighted)                                │
│  ├── Persist assignment in localStorage                                 │
│  └── Render selected variant, hide others                               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                       EVENT TRACKING                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Impressions: testView event when variant renders                       │
│  Conversions: Goal event (click, submit) on variant content             │
│  Data: test_id, test_post_id, test_variant_id, endpoint_id              │
│  Destination: ClickHouse (eu.accelerate.altis.cloud)                    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      HOURLY PROCESSING                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Cron: altis_post_ab_test_cron (every hour)                             │
│  ├── Query ClickHouse for aggregates per variant                        │
│  ├── Calculate conversion rates                                         │
│  ├── Binomial distribution p-value calculation (MathPHP)                │
│  ├── Winner detection (p < 0.01 = 99% confidence)                       │
│  └── Update post meta with results                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      WINNER APPLICATION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Automatic: Frontend renders winner to all visitors                     │
│  Callbacks: winner_callback() for titles/featured images                │
│  Notifications: Email sent to post author                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Test Types

### Block-Level A/B Tests (Synced Patterns)

| Attribute | Description |
|-----------|-------------|
| **Location** | `inc/global-blocks/`, `src/global-blocks/` |
| **Scope** | Individual synced pattern blocks |
| **Variants** | `altis/variant` inner blocks |
| **Goals** | engagement, click_any_link, submit_form, custom |
| **UI** | Block editor portal header |

### Post-Metadata A/B Tests

| Test Type | Location | What's Tested |
|-----------|----------|---------------|
| **Titles** | `inc/experiments/titles/` | Post title variations |
| **Featured Images** | `inc/experiments/featured-images/` | Thumbnail variations |
| **Custom** | Extensible via `register_post_ab_test()` | Any post attribute |

---

## 3. Data Storage

### Post Meta Keys

All test data stored with pattern `_altis_ab_test_{test_id}_{key}`:

| Key | Type | Purpose |
|-----|------|---------|
| `_variants` | array | Variant values/content |
| `_started` | bool | Test has been started |
| `_started_time` | int | Start timestamp (ms) |
| `_end_time` | int | Scheduled end timestamp (ms) |
| `_traffic_percentage` | int | % of visitors in test (default: 35) |
| `_variant_traffic_percentage` | array | Per-variant weights |
| `_paused` | bool | Test is paused |
| `_ended` | bool | Test has ended |
| `_results` | array | Current results (updated hourly) |
| `_completed` | array | Final results with winner |

### Variant Block Attributes

```json
{
  "audience": 0,
  "fallback": true,
  "goal": "engagement",
  "title": "Variant A",
  "percentage": 50,
  "isValid": true
}
```

---

## 4. Traffic Splitting

### Algorithm (Client-Side)

```javascript
// Stage 1: Is visitor in test?
const inTest = Math.random() * 100 < trafficPercentage;

// Stage 2: Which variant?
if (inTest) {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const [index, weight] of variantWeights.entries()) {
    cumulative += weight;
    if (rand < cumulative) {
      return index; // Selected variant
    }
  }
}
return 0; // Control (fallback)
```

### Persistence

| Storage | Key | Purpose |
|---------|-----|---------|
| localStorage | `_altis_ab_tests` | Sticky variant assignment |
| URL Override | `?set_test=test_block_123:1` | Force specific variant |
| URL Override | `?utm_campaign=test_block_123:1` | Alternative override |

### Default Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| Traffic % | 35% | Configurable per test |
| Variant Split | Equal | e.g., 50/50 for 2 variants |
| Duration | 30 days | Configurable |
| Min Duration | 14 days recommended | Warning shown if shorter |

---

## 5. Conversion Goals

### Built-in Goals

| Goal | Event | Selector | Description |
|------|-------|----------|-------------|
| `engagement` | click | `a, button, input[type="button"], input[type="submit"], area` | Any interactive element |
| `click_any_link` | click | `a` | Link clicks only |
| `submit_form` | submit | `form` | Form submissions |

### Goal Registration

```php
register_goal('custom_goal', [
    'label' => 'Custom Goal',
    'event' => 'click',
    'selector' => '.cta-button',
    'closest' => 'a',
    'validation_message' => 'CTA button not found'
]);
```

### Frontend Goal Tracking

```javascript
// Goals exposed to frontend
window.Altis.Analytics.Experiments.Goals = {
  engagement: { event: 'click', selector: '...', closest: '...' },
  // ...
};

// Event binding
variant.querySelectorAll(goal.selector).forEach(el => {
  el.addEventListener(goal.event, () => {
    trackConversion(testId, variantId);
  });
});
```

---

## 6. Statistical Analysis

### Algorithm

Uses **Binomial Distribution** from MathPHP library:

```php
use MathPHP\Probability\Distribution\Discrete\Binomial;

function analyse_ab_test_results($aggregations, $test_id, $post_id) {
    $control = $variants[0];

    foreach ($aggregations as $id => $agg) {
        $size = $agg['impressions'];
        $hits = $agg['conversions'];
        $rate = $size ? $hits / $size : 0;

        // Binomial p-value: probability of observing this many
        // conversions given control's conversion rate
        $binomial = new Binomial($size, $control['rate']);
        $p_value = $binomial->pmf($hits);

        $variants[$id] = [
            'size' => $size,
            'hits' => $hits,
            'rate' => $rate,
            'p' => $p_value
        ];
    }

    // Winner detection
    if ($winning_variant['p'] < 0.01) { // 99% confidence
        $winner = $winning_id;
    }
}
```

### Winner Criteria

| Criterion | Threshold | Purpose |
|-----------|-----------|---------|
| P-value | < 0.01 | 99% statistical confidence |
| Sample Size | ≥5 successes AND ≥5 failures | Rule of 5 for validity |
| Conversion Rate | Highest among variants | Must outperform others |

### Result Structure

```php
[
    'winning' => 1,        // Currently leading variant
    'winner' => 1,         // Statistically confirmed winner (or null)
    'variants' => [
        0 => ['value' => '...', 'size' => 1000, 'hits' => 50, 'rate' => 0.05, 'p' => null],
        1 => ['value' => '...', 'size' => 1000, 'hits' => 75, 'rate' => 0.075, 'p' => 0.003],
    ]
]
```

---

## 7. Frontend Components

### Custom Elements

| Element | Purpose |
|---------|---------|
| `<ab-test-block>` | Synced pattern A/B test wrapper |
| `<ab-test>` | Post-metadata A/B test wrapper |

### Element Attributes

```html
<ab-test-block
  block-id="123"
  goal="engagement"
  traffic-percentage="35"
  paused="false"
  attributes='{"authorId":1}'
  metrics='{}'>
  <template data-variant-id="0"><!-- Variant A content --></template>
  <template data-variant-id="1"><!-- Variant B content --></template>
  <!-- Fallback content shown initially -->
</ab-test-block>
```

### Web Component Lifecycle

```javascript
class ABTestBlock extends HTMLElement {
  connectedCallback() {
    this.setup();
    this.variantId = this.getVariantId();
    this.setContent();
    this.setupGoal();
    this.trackImpression();
  }

  getVariantId() {
    // Check localStorage for existing assignment
    // Or perform random selection
  }

  setContent() {
    const template = this.querySelector(`template[data-variant-id="${this.variantId}"]`);
    this.innerHTML = template.content.cloneNode(true);
  }

  setupGoal() {
    // Bind conversion tracking to goal elements
  }
}
```

---

## 8. Block Editor UI

### Header Portal (`Header.tsx`)

| Section | Content |
|---------|---------|
| **Metrics Bar** | Views, Conversion Rate, Sparklines |
| **Period Selector** | 7D / 30D / 90D buttons |
| **Actions** | Convert to A/B, Add Variant |
| **Variants Table** | Collapsible list of variants |

### Variant Row (`VariantRow.tsx`)

| Column | Data |
|--------|------|
| Thumbnail | Block preview image |
| Title | Variant name or "Variant A/B/C" |
| Conversion Rate | `(conversions / views) * 100%` |
| Lift | `((current - baseline) / baseline) * 100%` |
| P2BB | Probability to be Best |
| Actions | Duplicate, Delete |

### Variant Selection

```typescript
// Store selected variant in WordPress preferences
setPreference('altis/global-blocks', `${postId}:variant`, blockIndex);

// Retrieve and map to array index
const pref = select('core/preferences').get('altis/global-blocks', `${postId}:variant`);
const arrayIndex = variants.findIndex(v => getBlockIndex(v.clientId) === pref);
```

---

## 9. Test Lifecycle

```
┌─────────────┐
│   Created   │  Variants configured, not started
└──────┬──────┘
       │ Start Test
       ▼
┌─────────────┐
│   Running   │◄──────┐ Resume
└──────┬──────┘       │
       │              │
       ├─── Pause ────┤
       │              │
       ▼              │
┌─────────────┐       │
│   Paused    │───────┘
└──────┬──────┘
       │ Time expires OR Winner found
       ▼
┌─────────────┐
│    Ended    │  Results finalized
└──────┬──────┘
       │ Winner callback
       ▼
┌─────────────┐
│  Completed  │  Winner applied (e.g., title updated)
└─────────────┘
```

### State Functions

```php
is_ab_test_running_for_post($test_id, $post_id)
  = has_variants
    && is_started
    && !is_paused
    && start_time <= now
    && end_time > now

end_ab_test_for_post($test_id, $post_id)
  → set paused = true
  → set ended = true
  → update end_time to now
  → do_action('altis.experiments.test.ended')
```

---

## 10. REST API

### Fields on Posts

| Field | Type | Purpose |
|-------|------|---------|
| `ab_tests` | object | All test configurations and results |
| `ab_test_{test_id}` | array | Variant values for specific test |

### `ab_tests` Structure

```json
{
  "titles": {
    "started": true,
    "start_time": 1703980800000,
    "end_time": 1706572800000,
    "traffic_percentage": 35,
    "variant_traffic_percentage": [50, 50],
    "paused": false,
    "ended": false,
    "results": {
      "winning": 1,
      "winner": null,
      "variants": [...]
    }
  }
}
```

### Block Analytics Endpoint

```
GET /accelerate/v1/xbs/{block_id}/views
Parameters: start, end, interval
Returns: Variant-level analytics
```

---

## 11. Cron Processing

### Schedule

| Event | Frequency | Batch Size |
|-------|-----------|------------|
| `altis_post_ab_test_cron` | Hourly | 50 posts |

### Process Flow

```php
function handle_post_ab_test_cron($test_id, $page = 1) {
    // Query posts with active tests
    $posts = new WP_Query([
        'meta_query' => [
            ['key' => "_altis_ab_test_{$test_id}_variants", 'compare' => 'EXISTS'],
            ['key' => "_altis_ab_test_{$test_id}_completed", 'compare' => 'NOT EXISTS'],
        ],
        'posts_per_page' => 50,
        'paged' => $page
    ]);

    foreach ($posts->posts as $post_id) {
        process_post_ab_test_result($test_id, $post_id);
    }

    // Queue next batch if more posts
    if ($posts->found_posts > $page * 50) {
        wp_schedule_single_event(time(), 'altis_post_ab_test_cron', [$test_id, $page + 1]);
    }
}
```

### ClickHouse Query

```sql
SELECT
    test_variant_id,
    event_type,
    uniqCombined64(endpoint_id) as uniques
FROM analytics
WHERE
    blog_id = {blog_id}
    AND event_timestamp > {start_time}
    AND event_type IN ('testView', 'engagement')
    AND test_id = {test_id}
    AND test_post_id = {post_id}
GROUP BY test_variant_id, event_type
```

---

## 12. Winner Callbacks

### Titles Test

```php
'winner_callback' => function($post_id, $winning_title) {
    wp_update_post([
        'ID' => $post_id,
        'post_title' => $winning_title
    ]);
}
```

### Featured Images Test

```php
'winner_callback' => function($post_id, $winning_image_id) {
    update_post_meta($post_id, '_thumbnail_id', $winning_image_id);
}
```

### Block Tests

Winner stored in results; frontend automatically renders winner to all visitors.

---

## 13. Notifications

```php
function send_post_ab_test_notification($test_id, $post_id) {
    $recipients = apply_filters(
        'altis.experiments.test.notification.recipients',
        [$post->post_author],
        $test_id,
        $post_id
    );

    wp_mail(
        $user->email,
        "Your test {$test['label']} on \"{$post->post_title}\" has ended",
        "Click to view results: {$edit_link}#experiments-{$test_id}"
    );
}
```

---

## 14. Extensibility

### Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `altis.experiments.test.options` | Filter | Modify test configuration |
| `altis.experiments.features.titles` | Filter | Enable/disable titles test |
| `altis.experiments.features.featured_images` | Filter | Enable/disable images test |
| `altis.experiments.test.notification.recipients` | Filter | Customize email recipients |
| `altis.experiments.test.registered` | Action | After test type registered |
| `altis.experiments.test.winner_found` | Action | When winner detected |
| `altis.experiments.test.ended` | Action | When test completes |

### Custom Test Registration

```php
Experiments\register_post_ab_test('custom_test', [
    'label' => 'Custom Test',
    'singular_label' => 'Custom',
    'goal' => 'click',
    'closest' => 'a',
    'post_types' => ['post', 'page'],
    'variant_callback' => function($value, $post_id, $args) {
        return $value;
    },
    'winner_callback' => function($post_id, $winning_value) {
        update_post_meta($post_id, 'custom_field', $winning_value);
    },
    'show_ui' => true,
]);
```

---

## 15. Known Challenges

### Technical Issues

| Issue | Location | Impact |
|-------|----------|--------|
| Variant validation disabled | `src/global-blocks/blocks/variant/edit.js:13` | Data integrity |
| P2BB calculation is simplified | `src/utils/admin.ts:407` | Accuracy of display |
| Hourly processing delay | Cron-based | Results not real-time |
| Client-side only | No server fallback | Requires JavaScript |

### Statistical Limitations

| Limitation | Current State | Impact |
|------------|---------------|--------|
| Frequentist approach | Binomial PMF | May require larger samples |
| Fixed confidence | 99% (p < 0.01) | Cannot adjust per test |
| Control comparison only | Variant 0 is baseline | Multi-variant comparison limited |
| No sequential testing | Fixed sample | Cannot stop early safely |

---

## 16. Opportunities

### Short-Term

| Opportunity | Benefit | Effort |
|-------------|---------|--------|
| Re-enable variant validation | Data integrity | Low |
| Real-time results | Better UX | Medium |
| Configurable confidence levels | Flexibility | Low |

### Medium-Term

| Opportunity | Benefit |
|-------------|---------|
| Bayesian A/B testing (PR #454) | Faster, more accurate winner detection |
| Sequential testing | Early stopping when winner clear |
| Multi-armed bandit | Automatic traffic optimization |
| Server-side rendering | SEO benefits, no JS dependency |

### Strategic

| Opportunity | Benefit |
|-------------|---------|
| Experiments Overview dashboard | Centralized test management |
| Cross-test analysis | Portfolio optimization |
| Predictive sample size calculator | Better test planning |

---

## 17. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| MathPHP | ^0.51.0 | Statistical calculations |
| ClickHouse | Cloud | Event storage and aggregation |
| WordPress Cron | Core | Hourly processing |
| localStorage | Browser | Variant persistence |

---

## 18. Configuration Reference

### Default Values

| Setting | Value |
|---------|-------|
| Test Duration | 30 days |
| Traffic Percentage | 35% |
| Confidence Threshold | 99% (p < 0.01) |
| Min Sample (Rule of 5) | 5 successes + 5 failures |
| Cron Frequency | Hourly |
| Batch Size | 50 posts per cron |

---

## 19. File Reference

### Backend (PHP)

| File | Purpose |
|------|---------|
| `inc/experiments/namespace.php` | Core A/B engine (~1,236 LOC) |
| `inc/experiments/titles/namespace.php` | Title testing |
| `inc/experiments/featured-images/namespace.php` | Image testing |
| `inc/global-blocks/namespace.php` | Block rendering with tests |

### Frontend (JS/TS)

| File | Purpose |
|------|---------|
| `src/experiments/index.js` | Sidebar panel registration |
| `src/experiments/components/panel.js` | Test panel UI |
| `src/experiments/components/settings.js` | Test configuration |
| `src/experiments/components/results.js` | Results display |
| `src/experiments/data/with-test-data.js` | Data HOC |
| `src/global-blocks/blocks/variant/edit.js` | Variant block |
| `src/global-blocks/blocks/global/components/Header.tsx` | Block editor portal |
| `src/global-blocks/blocks/global/components/VariantRow.tsx` | Variant row UI |

---

## 20. Summary Statistics

| Metric | Value |
|--------|-------|
| PHP A/B Code | ~1,500 LOC |
| Frontend A/B Code | ~2,500 LOC |
| Test Types | 3 (blocks, titles, featured images) |
| Built-in Goals | 3 |
| Statistical Method | Binomial Distribution |
| Confidence Level | 99% |
| Processing Frequency | Hourly |
| Default Test Duration | 30 days |
| Default Traffic Split | 35% |
