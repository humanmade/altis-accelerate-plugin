# Global Blocks / Synced Patterns System - Technical Documentation

## Executive Summary

The Global Blocks system extends WordPress synced patterns (`wp_block` post type) with analytics tracking, A/B testing, and personalization capabilities. It provides a comprehensive editor portal UI, server-side block wrapping with custom HTML elements, and client-side variant selection with conversion tracking.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BLOCK EDITOR (Gutenberg)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  React Portal (injected above editor content)                               │
│  ├── Header.tsx           → Analytics dashboard, period selector            │
│  ├── VariantRow.tsx       → Per-variant metrics, thumbnails, actions        │
│  ├── ABTestResult.tsx     → Winner/loser banner for completed tests         │
│  └── AdvancedControls.js  → Sidebar: goals, traffic %, pause controls       │
│                                                                              │
│  Block Registration                                                          │
│  ├── altis/variant        → Variant wrapper block (A/B test, personalization)│
│  └── altis/static-global  → Fallback block for Widget areas                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                           SERVER SIDE (PHP)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  inc/global-blocks/namespace.php                                             │
│  ├── render_block()       → Wraps blocks in custom HTML elements            │
│  ├── save_variants()      → Persists variant configuration to post meta     │
│  └── register_test()      → Registers with experiments framework            │
│                                                                              │
│  inc/global-blocks/connections.php                                           │
│  └── Shadow taxonomy      → Tracks block → post usage relationships         │
│                                                                              │
│  inc/global-blocks/variant/                                                  │
│  └── block.json + render  → Server-side variant template generation         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                           FRONTEND (Client-Side)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Custom HTML Elements (src/experiments.js)                                   │
│  ├── <global-block>           → Standard synced pattern tracking            │
│  ├── <ab-test-block>          → A/B test variant selection + tracking       │
│  └── <personalization-block>  → Audience-based variant selection            │
│                                                                              │
│  Event Tracking                                                              │
│  ├── blockLoad   → Recorded on element connection                           │
│  ├── blockView   → Recorded when 75% visible (IntersectionObserver)         │
│  └── conversion  → Recorded on goal trigger (click, form, etc.)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                          ClickHouse Analytics Database
```

---

## 2. Post Type & Data Model

### Post Type: `wp_block`

The system extends WordPress core's `wp_block` post type (synced patterns) with additional metadata.

**Core Registration** (`inc/global-blocks/namespace.php:138-154`):
```php
// Menu integration
'show_in_menu' => 'accelerate'
'menu_position' => 24
'menu_icon' => '../assets/gb_icon.svg'
```

### Post Meta Schema

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `_xb_type` | string | `'standard'` | Block type: `standard`, `abtest`, `personalization` |
| `_xb_type_standard` | boolean | — | Flag for standard type |
| `_xb_type_abtest` | boolean | — | Flag for A/B test type |
| `_xb_type_personalization` | boolean | — | Flag for personalization type |
| `_goal` | string | `'engagement'` | Conversion goal for tracking |
| `shadow_term_id` | integer | — | Associated shadow taxonomy term |

### A/B Test Meta (via Experiments Framework)

| Key | Type | Description |
|-----|------|-------------|
| `_ab_test_block_variants` | serialized array | Variant block configurations |
| `_ab_test_block_start_time` | integer (ms) | Test start timestamp |
| `_ab_test_block_end_time` | integer (ms) | Test end timestamp (90-day default) |
| `_ab_test_block_traffic_percentage` | integer (0-100) | Traffic routed to test |
| `_ab_test_block_variant_traffic_percentage` | serialized array | Per-variant traffic weights |
| `_ab_test_block_paused` | boolean | Test paused flag |
| `_ab_test_block_started` | boolean | Test started flag |
| `_ab_test_block_results` | serialized object | Statistical results |

### Variant Block Attributes (`altis/variant`)

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `audience` | number | `0` | Audience post ID (0 = fallback) |
| `fallback` | boolean | `false` | Whether this is the fallback variant |
| `title` | string | `''` | Custom variant name |
| `goal` | string | `''` | Override goal from parent |
| `percentage` | number | — | Traffic weight (0-100) |
| `isValid` | boolean | `true` | Validation flag |

---

## 3. Server-Side Rendering

### Block Wrapping Pipeline

**Function**: `render_block()` (`inc/global-blocks/namespace.php:355-509`)

**Hook Registration**:
```php
add_filter('render_block_core/block', 'render_block', 10, 3);      // Standard synced blocks
add_filter('render_block_altis/static-global', 'render_block', 10, 3); // Widget fallback
```

**Processing Steps**:

1. **Duplicate Prevention** (WordPress 6.9+ fix):
   ```php
   // Lines 375-380
   if (preg_match('/<(global-block|ab-test-block|personalization-block)\s/', $block_content)) {
       return $block_content;  // Skip if already wrapped
   }
   ```

2. **Block Type Determination**:
   ```php
   // Lines 382-389
   $block_type = get_post_meta($block_post->ID, '_xb_type', true) ?: 'standard';
   $block_tags = [
       'abtest' => 'ab-test-block',
       'personalization' => 'personalization-block',
       'standard' => 'global-block',
   ];
   ```

3. **Feed Handling** (RSS shows fallback only):
   ```php
   // Lines 391-395
   if (is_feed()) {
       $altis_block_preview = $block_post->ID;
       $altis_block_preview_variant = 0;
   }
   ```

4. **Alignment Propagation** (lines 435-452):
   - Extracts `align` class from first inner block
   - Applies to wrapper: `alignfull`, `alignwide`, `aligncenter`

5. **Event Attributes Injection** (lines 467-484):
   ```php
   $block_event_attributes = apply_filters('altis.analytics.block_event_attributes', [
       'blockAuthorID' => (string) $block_post->post_author,
       'blockAuthor' => get_user_by('id', $block_post->post_author)->user_nicename,
   ], $block_post);
   ```

### HTML Output Structures

**Standard Block**:
```html
<noscript>[fallback-content]</noscript>
<global-block
    block-id="123"
    goal="engagement"
    attributes='{"blockAuthorID":"1","blockAuthor":"admin"}'
    metrics='{}'
    class="wp-core-block altis-global-block alignfull">
    <!-- Content loaded by JS -->
</global-block>
```

**A/B Test Block**:
```html
<ab-test-block
    block-id="123"
    goal="conversion"
    attributes="..."
    metrics="..."
    traffic-percentage="50"
    class="wp-core-block altis-global-block">
    <template data-parent-id="123" data-title="Variant A" data-goal="conversion" data-weight="50">
        [variant-a-content]
    </template>
    <template data-parent-id="123" data-title="Variant B" data-goal="conversion" data-weight="50">
        [variant-b-content]
    </template>
    <template data-fallback data-parent-id="123" data-title="Fallback" data-weight="0">
        [fallback-content]
    </template>
</ab-test-block>
```

**Personalization Block**:
```html
<personalization-block
    block-id="123"
    goal="engagement"
    attributes="..."
    class="wp-core-block altis-global-block">
    <template data-parent-id="123" data-audience="45" data-title="VIP Customers">
        [vip-content]
    </template>
    <template data-parent-id="123" data-audience="46" data-title="New Visitors">
        [new-visitor-content]
    </template>
    <template data-fallback data-parent-id="123" data-title="Fallback">
        [default-content]
    </template>
</personalization-block>
```

### Variant Template Rendering

**File**: `inc/global-blocks/variant/namespace.php:35-62`

```php
// Fallback variant
<template data-fallback data-parent-id="__PARENT_BLOCK_ID__"
          data-title="Fallback" data-goal="engagement" data-weight="50">
    [inner_content]
</template><noscript>[inner_content]</noscript>

// Regular variant
<template data-parent-id="__PARENT_BLOCK_ID__"
          data-title="Variant A" data-goal="engagement"
          data-weight="50" data-audience="123">
    [inner_content]
</template>
```

The `__PARENT_BLOCK_ID__` placeholder is replaced with the actual block post ID during rendering (line 419).

---

## 4. Client-Side Custom Elements

### Element Definitions (`src/experiments.js`)

#### GlobalBlock (line 585)
```javascript
class GlobalBlock extends Global(HTMLElement) {}
window.customElements.define('global-block', GlobalBlock);
```

**Inherited Behavior (Global mixin, lines 446-583)**:
- Shadow DOM with `<slot></slot>` for content projection
- `blockLoad` event on `connectedCallback`
- `blockView` event via IntersectionObserver (75% threshold)
- `conversion` event on goal trigger

#### ABTestBlock (lines 677-780)
```javascript
class ABTestBlock extends Global(Test(HTMLElement)) {}
window.customElements.define('ab-test-block', ABTestBlock);
```

**Additional Attributes**:
- `paused` - Boolean, pauses variant selection
- `winner` - Integer variant index (if test concluded)
- `traffic-percentage` - Decimal percentage for test traffic

**Variant Selection** (lines 704-712):
- Queries `template[data-parent-id="{blockId}"]` elements
- Uses `Test` mixin for weighted random selection
- Persists selection in localStorage: `_altis_ab_tests`

#### PersonalizationBlock (lines 590-672)
```javascript
class PersonalizationBlock extends Global(HTMLElement) {}
window.customElements.define('personalization-block', PersonalizationBlock);
```

**Audience Targeting** (lines 609-671):
- Listens for `updateAudiences` event from analytics
- Queries templates by `data-audience` attribute
- Falls back to `data-fallback` template if no match
- Re-evaluates on audience changes

### Variant Selection Algorithm (Test Mixin)

**File**: `src/experiments.js:13-134`

```javascript
// 1. Check for existing assignment in localStorage
const stored = localStorage.getItem('_altis_ab_tests');
const assignments = stored ? JSON.parse(stored) : {};

// 2. Check if user is in test traffic
if (Math.random() * 100 > trafficPercentage) {
    return fallbackVariantIndex;  // Exclude from test
}

// 3. Weighted random selection
const weights = variants.map(v => v.dataset.weight);
const totalWeight = weights.reduce((a, b) => a + b, 0);
let random = Math.random() * totalWeight;
for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i;
}
```

### Event Recording

**File**: `src/experiments.js:192-202`

```javascript
window.Altis.Analytics.record('conversion', {
    attributes: {
        blockId: this.blockId,
        type: this.type,  // 'standard', 'abtest', 'personalization'
        goal: this.goal,
        ...this.attributes,
    },
    metrics: this.metrics,
}, false);
```

---

## 5. Block Editor Portal

### Portal Injection

**File**: `src/global-blocks/index.js:20-85`

```javascript
// Target WordPress editor skeleton
const waitForTarget = () => {
    const el = document.querySelector('.interface-interface-skeleton__content');
    if (el) {
        // Insert after notices (if any)
        const notices = el.querySelectorAll('.components-notice-list');
        const lastNotice = notices[notices.length - 1];
        if (lastNotice) {
            lastNotice.after(portalNode.current);
        } else {
            el.insertBefore(portalNode.current, el.firstChild);
        }
        setContainer(el);
    } else {
        requestAnimationFrame(waitForTarget);
    }
};

// Render with scoped Tailwind
return createPortal(
    <div className="tailwind" style={{ width: '100%' }}>
        <Header />
    </div>,
    portalNode.current
);
```

### Header Component

**File**: `src/global-blocks/blocks/global/components/Header.tsx:25-420`

**UI Sections**:
1. Block type badge (Standard / A/B Test / Personalization)
2. Period selector: 7D, 30D, 90D
3. Views count with sparkline
4. Conversion rate display
5. Convert buttons (for standard blocks)
6. Variants table with thumbnails

**Data Sources**:
```javascript
// Analytics histogram
const histogram = useSelect(
    select => select(store).getDiffs({ ids: [postId] }),
    [postId, period, startTime, blockType]
);

// Block-level analytics
const analytics = useSelect(
    select => select(AnalyticsStore).getViews(postId, args),
    [postId, period, startTime, blockType]
);
```

### Variant Selection Logic

**Critical: Index Mapping** (lines 83-98)

WordPress block indices don't always match filtered array indices:

```javascript
const selectedVariant = useSelect((select) => {
    const pref = select(PreferencesStore).get('altis/global-blocks', `${postId}:variant`) || 0;
    // Convert WordPress block index to array index
    const arrayIndex = variants.findIndex(v => {
        const blockIndex = getBlockIndex(v.clientId);
        return blockIndex === pref;
    });
    return arrayIndex >= 0 ? arrayIndex : 0;
}, [postId, variants]);
```

### Block Conversion

**Standard → A/B Test** (lines 127-144):
```javascript
const convertToAbTest = () => {
    setPeriod('P7D');
    registry.batch(() => {
        updateBlockPost({ blockType: 'abtest' });
        removeBlocks(blocks.map(b => b.clientId));
        const newVariant = createBlock(
            'altis/variant',
            { fallback: true, title: __('Variant A', 'altis') },
            blocks  // Preserve existing content as innerBlocks
        );
        insertBlock(newVariant, 0, '');
    });
};
```

**Add Blank Variant** (lines 165-185):
```javascript
const addBlankVariant = () => {
    // IMPORTANT: Empty variants need default innerBlocks to be editable
    const defaultParagraph = createBlock('core/paragraph');
    const newVariant = createBlock(
        'altis/variant',
        { fallback: false },
        [defaultParagraph]
    );
    insertBlock(newVariant, blocks.length, '');
    // Update preference after block is inserted
    setTimeout(() => {
        const actualBlockIndex = getBlockIndex(newVariant.clientId);
        setPreference('altis/global-blocks', `${postId}:variant`, actualBlockIndex);
        selectBlock(newVariant.clientId);
    }, 100);
};
```

### VariantRow Component

**File**: `src/global-blocks/blocks/global/components/VariantRow.tsx:27-276`

**Displays**:
- Thumbnail with variant-specific URL
- Title (editable for personalization)
- Audience selector (personalization only)
- Conversion rate with lift calculation
- Probability to be best (A/B tests)
- Duplicate/Delete actions

**Thumbnail URL Switching** (line 143):
```javascript
src={previewThumb.replace(/variant-id%3D0/, 'variant-id%3D' + index)}
```

---

## 6. Thumbnail Generation System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THUMBNAIL REQUEST FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Frontend requests thumbnail URL                                          │
│     └── REST API field: previewThumb                                        │
│                                                                              │
│  2. PHP generates preview URL with parameters                                │
│     └── get_block_preview_thumbnail() in inc/api/namespace.php              │
│                                                                              │
│  3. External service screenshots the preview                                 │
│     └── https://eu.accelerate.altis.cloud/block-image                       │
│                                                                              │
│  4. WordPress serves preview template                                        │
│     └── block_thumbnail_template_override() in inc/dashboard/namespace.php  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Thumbnail Generation Function

**File**: `inc/api/namespace.php:677-725`

```php
function get_block_preview_thumbnail(?int $post_id, int $variant_id = 0, $width = 210, $height = 94): string {
    $post = get_post($post_id);

    // For posts with featured images
    if (post_type_supports($post->post_type, 'thumbnail')) {
        $thumbnail_id = get_post_thumbnail_id($post) ?: 0;
        return wp_get_attachment_image_url($thumbnail_id, get_available_thumbnail_size());
    }

    // For wp_block posts - use external screenshot service
    if ($post->post_type === 'wp_block' && is_block_thumbnail_allowed($post->ID)) {
        $version = strtotime($post->post_modified_gmt);

        $preview_url = sprintf(
            '%s?preview-block-id=%d&key=%s&variant-id=%d&version=%s&width=%d&height=%d',
            get_home_url('/'),
            $post->ID,
            get_block_thumbnail_request_hmac($post->ID),
            $variant_id,
            $version,
            $width,
            $height,
        );

        return add_query_arg([
            'url' => urlencode($preview_url),
            'width' => $width,
            'height' => $height,
            'selector' => wp_is_block_theme() ? '.altis-block-preview > *' : '.altis-block-preview',
            'version' => $version,
        ], 'https://eu.accelerate.altis.cloud/block-image');
    }

    return '';
}
```

### Preview Template Override

**File**: `inc/dashboard/namespace.php:242-282`

```php
function block_thumbnail_template_override(): void {
    global $altis_block_preview, $altis_block_preview_variant;

    $target_width = (int) filter_input(INPUT_GET, 'width') ?? 210;
    $target_height = (int) filter_input(INPUT_GET, 'height') ?? 94;

    // Disable analytics for preview
    add_filter('altis.analytics.noop', '__return_true', 1000);

    // Theme-aware classes
    $classes = 'altis-block-preview';
    if (wp_is_block_theme()) {
        $classes .= ' is-layout-constrained has-global-padding';
    }

    get_header();
    echo '<div class="' . $classes . '">';
    echo do_blocks(sprintf('<!-- wp:block {"ref":%d} -->', get_the_ID()));
    echo '</div>';
    get_footer();
    exit;
}
```

### Security Controls

**HMAC Generation** (lines 228-235):
```php
function get_block_thumbnail_request_hmac(int $block_post_id): string {
    $auth_key = defined('AUTH_KEY') ? AUTH_KEY : get_site_option('auth_key', '');
    return hash_hmac('md5', $block_post_id, $auth_key);
}
```

**Permission Filter** (lines 212-219):
```php
function is_block_thumbnail_allowed(int $block_id = null): bool {
    return (bool) apply_filters('altis.accelerate.allow_block_thumbnails', true, $block_id);
}
```

### Frontend Error Handling

**File**: `src/global-blocks/blocks/global/components/VariantRow.tsx:54, 149-152`

```javascript
const [imageError, setImageError] = useState(false);

<Image
    src={previewThumb.replace(/variant-id%3D0/, 'variant-id%3D' + index)}
    onError={() => setImageError(true)}
/>
{imageError && <div className="absolute inset-0 bg-gray-200" />}
```

---

## 7. Shadow Taxonomy (Usage Tracking)

### Purpose

Track which posts use which synced patterns without custom database tables.

**File**: `inc/global-blocks/connections.php` (341 lines)

### Taxonomy Definition

```php
const RELATIONSHIP_TAXONOMY = 'wp_block_to_post';

// Registered for all post types supporting synced patterns
// Hidden from UI: show_ui = false
```

### Synchronization Process

**Function**: `synchronize_associated_terms()` (lines 230-274)

**Trigger**: `post_updated` action

```php
// 1. Parse post_content for core/block references
$blocks = parse_blocks($post->post_content);

// 2. Extract block post IDs from attributes
$block_ids = array_filter(array_map(function($block) {
    return $block['attrs']['ref'] ?? null;
}, $blocks));

// 3. Get shadow term IDs for each block
$term_ids = array_map('get_shadow_term_id', $block_ids);

// 4. Set post object terms
wp_set_object_terms($post_id, $term_ids, RELATIONSHIP_TAXONOMY);

// 5. Clear usage count cache
wp_cache_delete(sprintf(BLOCK_USAGE_COUNT_CACHE_KEY_FORMAT, $block_id));
```

### Shadow Term Lifecycle

**Creation** (lines 66-127):
```php
// On block post insert/publish
$term = wp_insert_term($post->post_title, RELATIONSHIP_TAXONOMY, [
    'slug' => $post->post_name,
]);
update_term_meta($term['term_id'], 'shadow_post_id', $post->ID);
update_post_meta($post->ID, 'shadow_term_id', $term['term_id']);
```

**Deletion** (lines 136-152):
```php
// Before block post delete
$term_id = get_post_meta($post->ID, 'shadow_term_id', true);
wp_delete_term($term_id, RELATIONSHIP_TAXONOMY);
```

### Usage Count Display

**Column Output** (lines 297-340):
- Cached with 8-hour TTL
- Displays as link to block edit screen
- Format: `block_usage_count_{post_id}`

---

## 8. REST API Endpoints

### Block Analytics

**Endpoint**: `GET /accelerate/v1/xbs/{id}/views`

**File**: `inc/blocks/rest_api/namespace.php:183`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Block post ID |
| `start` | ISO datetime | Yes | Start of date range |
| `end` | ISO datetime | No | End of date range (default: now) |
| `post_id` | integer | No | Filter by specific post |

**Response**:
```json
{
    "start": "2025-12-01",
    "end": "2025-12-30",
    "loads": 1000,
    "views": 800,
    "conversions": 120,
    "unique": {
        "loads": 500,
        "views": 400,
        "conversions": 60
    },
    "variants": [
        {
            "id": 0,
            "loads": 400,
            "views": 300,
            "conversions": 50,
            "unique": {...}
        }
    ]
}
```

### Block Relationships

**Endpoint**: `GET /altis-global-blocks/v1/relationships`

**File**: `inc/global-blocks/rest-api/relationships/class-rest-endpoint.php`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `block_id` | integer | Yes | Block post ID |
| `page` | integer | No | Pagination (10 per page) |

**Response Headers**:
- `X-WP-Total` - Total posts using block
- `X-WP-TotalPages` - Total pages

### Block Search

**Endpoint**: `GET /altis-global-blocks/v1/search`

**File**: `inc/global-blocks/rest-api/search/class-rest-endpoint.php`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchID` | integer | Yes | Post ID to search within |

**Behavior**:
- If `wp_block`: Returns that block
- If other post type: Extracts and returns all `core/block` references

### REST Fields on `wp_block`

**File**: `inc/global-blocks/rest-api/namespace.php:26-71`

| Field | Type | Description |
|-------|------|-------------|
| `blockType` | string | `standard`, `abtest`, `personalization` |
| `goal` | string | Conversion goal |
| `previewThumb` | string | Thumbnail URL |
| `variants` | array | Variant configurations |

---

## 9. State Management

### Redux Stores

**Accelerate Store** (`src/data/index.ts`):
```javascript
// Namespace: 'accelerate'
wp.data.select('accelerate').getPosts(queryArgs)
wp.data.select('accelerate').getPost(id)
wp.data.select('accelerate').getDiffs(args)
```

**Block Analytics Store** (`src/blocks/data/index.js`):
```javascript
// Namespace: 'accelerate/xbs'
wp.data.select('accelerate/xbs').getViews(blockId, args)
wp.data.select('accelerate/xbs').getPost(blockId)
```

**WordPress Preferences Store**:
```javascript
// Namespace: 'altis/global-blocks'
wp.data.dispatch('core/preferences').set('altis/global-blocks', `${postId}:variant`, index)
```

### Data Flow

```
Header.tsx
  ↓
useSelect(PreferencesStore) → selected variant preference
  ↓
useSelect(BlockEditorStore) → all variant blocks
  ↓
Convert WordPress index to array index
  ↓
useSelect(AnalyticsStore) → getViews(postId, period)
  ↓
Render VariantRow for each variant with analytics
```

---

## 10. Integration Points

### Experiments Framework

**Registration** (`inc/global-blocks/namespace.php:558-571`):
```php
Experiments\register_post_ab_test('block', [
    'label' => 'A/B Test Block',
    'goal' => 'conversion',
    'view' => 'blockView',
    'query_filter' => "block_id = {block_id:String}",
    'post_types' => ['wp_block'],
]);
```

### Audiences Integration

Variant attribute `audience` links to audience post ID for personalization targeting.

### Analytics Events

```php
// Filters for custom tracking data
$attributes = apply_filters('altis.analytics.block_event_attributes', [...], $block_post);
$metrics = apply_filters('altis.analytics.block_event_metrics', [], $block_post);
```

---

## 11. Known Challenges

### 1. WordPress 6.9 Duplicate Rendering (FIXED)

**Issue**: WordPress 6.9 changed synced pattern resolution, causing render filter to run multiple times.

**Solution** (lines 375-380):
```php
if (preg_match('/<(global-block|ab-test-block|personalization-block)\s/', $block_content)) {
    return $block_content;  // Skip if already wrapped
}
```

### 2. Block Index Mapping

**Issue**: WordPress block indices don't match filtered variant array indices.

**Impact**: Wrong variant displayed if indices used directly.

**Solution**: Convert between index types via `getBlockIndex()` lookup.

### 3. Empty Variants Not Editable

**Issue**: `createBlock('altis/variant')` without innerBlocks cannot be selected in editor.

**Solution**: Always add default paragraph block:
```javascript
const defaultParagraph = createBlock('core/paragraph');
createBlock('altis/variant', {...}, [defaultParagraph]);
```

### 4. HMAC Verification Disabled

**Location**: `inc/dashboard/namespace.php:182`

```php
// || $hmac !== get_block_thumbnail_request_hmac($block_id)  // COMMENTED OUT
```

**Impact**: Thumbnail requests not authenticated; relies on WordPress post visibility.

### 5. Template Variable Injection

**Issue**: String replacement for `__PARENT_BLOCK_ID__` is fragile.

**Risk**: Could accidentally replace matching strings in block content.

### 6. Feed Handling Limitation

**Location**: Lines 391-395

**Impact**: RSS feeds always show first variant (variant 0), not A/B test winner.

---

## 12. Extensibility Hooks

### Filters

| Filter | Purpose |
|--------|---------|
| `altis.analytics.block_event_attributes` | Add custom tracking attributes |
| `altis.analytics.block_event_metrics` | Add custom metrics |
| `altis.accelerate.allow_block_thumbnails` | Enable/disable thumbnail generation |
| `altis.accelerate.block-image.preview-class` | Override preview container class |

### Actions

| Action | Trigger |
|--------|---------|
| `save_post_wp_block` | Variant configuration saved |
| `before_delete_post` | Shadow term cleanup |
| `post_updated` | Usage relationship sync |

---

## 13. File Reference

### PHP Backend

| File | Purpose | Lines |
|------|---------|-------|
| `inc/global-blocks/namespace.php` | Core rendering, variant saving | 588 |
| `inc/global-blocks/connections.php` | Shadow taxonomy, usage tracking | 341 |
| `inc/global-blocks/variant/namespace.php` | Variant block server rendering | 63 |
| `inc/global-blocks/rest-api/namespace.php` | REST fields registration | 71 |
| `inc/blocks/namespace.php` | Block analytics queries | 346 |
| `inc/dashboard/namespace.php` | Thumbnail preview handling | 291 |
| `inc/api/namespace.php` | Thumbnail generation function | 725 |

### Frontend (React/TypeScript)

| File | Purpose | Lines |
|------|---------|-------|
| `src/global-blocks/index.js` | Portal injection | 85 |
| `src/global-blocks/blocks/global/components/Header.tsx` | Analytics dashboard | 420 |
| `src/global-blocks/blocks/global/components/VariantRow.tsx` | Per-variant UI | 276 |
| `src/global-blocks/blocks/variant/edit.js` | Variant block editing | 163 |
| `src/experiments.js` | Custom elements, tracking | 796 |
| `src/blocks/data/index.js` | Block analytics store | ~200 |

---

## 14. Summary

The Global Blocks system provides a comprehensive content optimization layer for WordPress synced patterns:

- **Server-Side**: Wraps blocks in custom HTML elements with tracking attributes
- **Client-Side**: Custom elements handle variant selection and event tracking
- **Editor Portal**: React dashboard with analytics, variant management, conversion UI
- **Thumbnail System**: External screenshot service with preview template override
- **Relationship Tracking**: Shadow taxonomy for usage without custom tables
- **Framework Integration**: Connects to experiments and audiences systems

**Key Strengths**:
- Clean separation of concerns
- WordPress-native patterns (post meta, taxonomy, REST API)
- Comprehensive caching strategy
- Multiple fallback layers

**Areas for Improvement**:
- Re-enable HMAC verification for thumbnails
- More robust template variable injection
- Index mapping documentation/utilities
- Feed handling for A/B test winners
