# Content Explorer Dashboard - Technical Documentation

## Executive Summary

The Content Explorer is the primary analytics dashboard for the Accelerate plugin. It provides real-time traffic visualization, content performance metrics, and management tools for synced patterns, broadcasts, and standard WordPress content. Built with React and Redux, it integrates with ClickHouse analytics via WordPress REST API.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTENT EXPLORER UI                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  App.tsx (containers/App.tsx)                                                │
│  └── Routes: 'accelerate' (Content Explorer) | 'broadcast' (Manager)        │
│                                                                              │
│  Dashboard.tsx (content-explorer/Dashboard.tsx)                              │
│  ├── Welcome.tsx           → First-time user introduction                   │
│  ├── HeroChart.tsx         → Main traffic visualization (visx)              │
│  └── List.tsx              → Content table with analytics                   │
│      ├── ListFilters.tsx   → Period, search, type filters                   │
│      └── ListItem.tsx      → Row with sparkline, thumbnail, metrics         │
│          ├── SparkChart.tsx    → Inline histogram visualization             │
│          └── Image.tsx         → Thumbnail with skeleton loader             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                           REDUX STATE (WordPress Data API)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Store: 'accelerate' (src/data/index.ts)                                     │
│  ├── State                                                                   │
│  │   ├── posts: { [id]: Post }        → Cached content items                │
│  │   ├── queries: { [key]: id[] }     → Query result cache                  │
│  │   ├── stats: { [key]: StatsResult } → Traffic statistics cache           │
│  │   ├── diffs: { [key]: DiffResult }  → Period comparison cache            │
│  │   └── pagination: { total, pages }  → List pagination state              │
│  ├── Selectors: getPosts, getStats, getDiffs, getPagination                 │
│  ├── Resolvers: Async data fetching with caching                            │
│  └── Controls: FETCH_FROM_API, RESPONSE_TO_JSON                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                           REST API LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  /accelerate/v1/stats      → Global traffic statistics                      │
│  /accelerate/v1/top        → Top performing content                         │
│  /accelerate/v1/diff       → Period-over-period comparison                  │
│  /accelerate/v1/xbs/{id}/views → Block-specific analytics                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                           CLICKHOUSE DATABASE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Table: analytics                                                            │
│  ├── event_type: pageView, blockView, conversion                            │
│  ├── blog_id, post_id, url, referer                                         │
│  ├── endpoint_id (unique visitor)                                           │
│  ├── event_timestamp (DateTime64)                                           │
│  └── attributes, metrics (JSON)                                             │
│                                                                              │
│  Aggregation Functions                                                       │
│  ├── uniqCombined64() → Unique visitor counting                             │
│  ├── WITH ROLLUP      → Summary row generation                              │
│  └── WITH FILL        → Missing interval interpolation                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Entry Points

### Frontend Bootstrap

**File**: `src/accelerate/index.tsx` (lines 1-44)

```typescript
import { register } from '@wordpress/data';
import store from '../data';

// Register Redux store
register(store);

// Render into WordPress admin container
const container = document.getElementById('altis-analytics-root');
if (container) {
    const root = createRoot(container);
    root.render(<App {...config} />);
}
```

**Features**:
- Hot module reloading for development
- Config data from `window.AltisAccelerateDashboardData`
- React 18 concurrent rendering

### PHP Bootstrap

**File**: `inc/dashboard/namespace.php` (lines 1-170)

```php
function bootstrap() {
    // Replace WordPress dashboard with Accelerate dashboard
    add_action('load-index.php', __NAMESPACE__ . '\\load_dashboard');

    // Localize script data
    add_action('admin_enqueue_scripts', __NAMESPACE__ . '\\enqueue_assets');
}

function load_dashboard() {
    // Set up dashboard replacement
    add_action('admin_notices', __NAMESPACE__ . '\\render_dashboard_container');
}
```

**Localized Data**:
```php
wp_localize_script('altis-accelerate', 'AltisAccelerateDashboardData', [
    'user' => wp_get_current_user(),
    'postTypes' => get_post_types(['public' => true]),
    'permissions' => [
        'canManageOptions' => current_user_can('manage_options'),
        'canEditPosts' => current_user_can('edit_posts'),
    ],
    'features' => [
        'broadcasts' => is_broadcasts_enabled(),
        'experiments' => is_experiments_enabled(),
    ],
]);
```

---

## 3. Component Architecture

### App Container

**File**: `src/accelerate/containers/App.tsx` (lines 1-48)

```typescript
interface AppProps {
    postTypes: PostType[];
    user: User;
    showWelcome?: boolean;
}

const App: React.FC<AppProps> = ({ postTypes, user, showWelcome }) => {
    const [screen, setScreen] = useState<'accelerate' | 'broadcast'>('accelerate');

    return (
        <div className="accelerate-app">
            {screen === 'accelerate' && (
                <Dashboard
                    postTypes={postTypes}
                    user={user}
                    showWelcome={showWelcome}
                />
            )}
            {screen === 'broadcast' && <BroadcastManager />}
        </div>
    );
};
```

### Dashboard Component

**File**: `src/accelerate/content-explorer/Dashboard.tsx` (lines 1-38)

```typescript
const Dashboard: React.FC<DashboardProps> = ({ postTypes, user, showWelcome }) => {
    const [period, setPeriod] = usePersistentState<Period>('period', 'P7D');

    return (
        <div className="content-explorer">
            {showWelcome && <Welcome />}
            <HeroChart period={period} />
            <List
                period={period}
                setPeriod={setPeriod}
                postTypes={postTypes}
                user={user}
            />
        </div>
    );
};
```

**State**:
- `period`: P7D, P14D, P30D, P90D (persisted to localStorage)

---

## 4. HeroChart Component

### Overview

**File**: `src/accelerate/content-explorer/HeroChart.tsx` (lines 1-448)

The main traffic visualization displaying views and unique visitors over time.

### Data Structure

```typescript
interface Datum {
    time: Date;
    uniques: number;
    views: number;
}

interface StatsResult {
    by_interval: {
        [isoDate: string]: {
            views: number;
            visitors: number;
            returning: number;
            bounce: number;
        };
    };
    stats: {
        summary: { views, visitors, returning, bounce };
        by_browser: Record<string, number>;
        by_country: Record<string, number>;
        // ... other breakdowns
    };
}
```

### Visualization Libraries

```typescript
import { AxisLeft, AxisBottom } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { GridRows, GridColumns } from '@visx/grid';
import { Group } from '@visx/group';
import { scaleLinear, scaleTime } from '@visx/scale';
import { LinePath, AreaClosed, Bar } from '@visx/shape';
import { TooltipWithBounds, useTooltip } from '@visx/tooltip';
import { extent, max, bisector } from 'd3-array';
```

### Chart Features

1. **Dual Lines**:
   - Views (solid line with gradient fill)
   - Unique visitors (dashed line)

2. **Interactive Tooltip**:
   - Shows date, views, uniques on hover
   - Follows mouse position with bounds checking

3. **Resolution Selector**:
   - 7D: Hourly or Daily
   - 90D: Daily or Weekly

4. **Responsive Sizing**:
   ```typescript
   useEffect(() => {
       setOuterWidth(document.getElementById('hero-chart')?.offsetWidth || 600);
   }, [data]);
   ```

5. **Bounce Rate Display**:
   ```typescript
   const bounceRate = (stats.bounce / stats.visitors) * 100;
   ```

### Scale Configuration

```typescript
const xScale = scaleTime({
    domain: extent(data, d => d.time),
    range: [margin.left, width - margin.right],
});

const yScale = scaleLinear({
    domain: [0, max(data, d => Math.max(d.views, d.uniques))],
    range: [height - margin.bottom, margin.top],
    nice: true,
});
```

---

## 5. List Component

### Overview

**File**: `src/accelerate/components/List.tsx` (lines 1-260)

Content table with filtering, pagination, and nested block expansion.

### State Management

```typescript
const [customFilter, setCustomFilter] = usePersistentState('filter', 'all');
const [search, setSearch] = usePersistentState('search', '');
const [type, setType] = usePersistentState('type', 'post');
const [user, setUser] = usePersistentState('user', 0);
const [page, setPage] = useState(1);
```

### Filter Options

| Filter | Description |
|--------|-------------|
| `all` | All content of selected type |
| `blocks` | Synced patterns only (`wp_block`) |
| `mine` | Current user's content |
| `selected` | Single selected item |

### Pagination

- 25 items per page
- Maximum 300 items (12 pages)
- Headers: `X-WP-Total`, `X-WP-TotalPages`

### Query Parameters

```typescript
const queryArgs = {
    period,
    search,
    type,
    user,
    page,
    include: selectedIds,
    refresh: Date.now(),  // Cache bust
};
```

---

## 6. ListItem Component

### Overview

**File**: `src/accelerate/components/ListItem.tsx` (lines 1-321)

Individual content row with metrics, sparkline, and actions.

### Display Columns

1. **Expand Button** (broadcasts only)
2. **Thumbnail** (image or placeholder)
3. **Title + Metadata**
   - Post type badge
   - Parent reference (for blocks)
   - Date published
4. **Traffic**
   - SparkChart histogram
   - View count (formatted)
   - Period change indicator
5. **Conversion** (if applicable)
   - Percentage with goal type
6. **Actions**
   - Edit link
   - View link
   - Custom actions

### Metrics Calculation

**Period Change**:
```typescript
const previous = histogramDiffs[post.id]?.previous?.views || 0;
const current = histogramDiffs[post.id]?.current?.views || 0;
const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
```

**Conversion Rate**:
```typescript
const conversionRate = views > 0 ? (conversions / views) * 100 : 0;
```

### Nested Block Expansion

```typescript
const [expanded, setExpanded] = useState(false);
const [nestedPosts, setNestedPosts] = useState([]);

const loadNestedBlocks = async () => {
    const blocks = await select('accelerate').getPosts({
        include: post.blocks,
    });
    setNestedPosts(blocks);
};
```

### Variant Thumbnail Display

For blocks with multiple variants:
```typescript
{post.variants?.length > 2 && (
    <span className="variant-badge">+{post.variants.length - 2}</span>
)}
{[0, 1].map(index => (
    <Image
        src={post.thumbnail.replace(/variant-id%3D0/, `variant-id%3D${index}`)}
        width={105}
    />
))}
```

---

## 7. SparkChart Component

### Overview

**File**: `src/accelerate/components/SparkChart.tsx` (lines 1-132)

Inline histogram for per-item traffic visualization.

### Configuration

```typescript
interface SparkChartProps {
    data: Array<{ index: number; count: number }>;
    period: Period;
}

const dimensions = {
    P7D: { width: 100, barWidth: 12 },
    P14D: { width: 120, barWidth: 8 },
    P30D: { width: 140, barWidth: 4 },
    P90D: { width: 150, barWidth: 1.5 },
};
```

### Scale Configuration

```typescript
// Categorical X-axis for bar positions
const xScale = scaleBand<number>({
    domain: data.map(d => d.index),
    range: [0, width],
    padding: 0.1,
});

// Logarithmic Y-axis for varying magnitudes
const yScale = scaleLog<number>({
    domain: [1, maxViews || yMax],
    range: [height, 0],
});
```

### Logarithmic Scaling Rationale

Linear scale issues:
- High-traffic pages dominate visualization
- Low-traffic pages appear flat

Logarithmic benefits:
- All data points visible
- Relative changes more apparent
- Handles 10x-1000x variations

---

## 8. REST API Integration

### Endpoints

#### GET `/accelerate/v1/stats`

**File**: `inc/api/namespace.php` (lines 259-330)

**Purpose**: Global traffic statistics with time series data.

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start` | ISO datetime | Yes | — | Period start |
| `end` | ISO datetime | Yes | — | Period end |
| `interval` | string | No | `'1 day'` | Time bucket size |
| `tz` | string | No | — | Timezone for grouping |
| `filter` | object | No | — | Audience/path filters |

**Response**:
```json
{
    "by_interval": {
        "2025-12-25T00:00:00Z": {
            "views": 1234,
            "visitors": 567,
            "returning": 89,
            "bounce": 234
        }
    },
    "stats": {
        "summary": { "views": 1234, "visitors": 567, "returning": 89, "bounce": 234 },
        "by_browser": { "Chrome": 500, "Firefox": 200 },
        "by_country": { "US": 300, "UK": 150 },
        "by_device": { "Desktop": 600, "Mobile": 300 },
        "by_os": { "Windows": 400, "macOS": 200 },
        "by_referer": { "google.com": 250 },
        "by_url": { "/page-1": 100, "/page-2": 80 }
    }
}
```

**ClickHouse Query Pattern**:
```sql
SELECT
    toStartOfInterval(event_timestamp, INTERVAL 1 day) as interval,
    count() as views,
    uniqCombined64(endpoint_id) as visitors,
    countIf(returning = 1) as returning,
    countIf(bounce = 1) as bounce
FROM analytics
WHERE blog_id = {blog_id}
  AND event_type = 'pageView'
  AND event_timestamp BETWEEN {start} AND {end}
GROUP BY interval WITH ROLLUP
ORDER BY interval WITH FILL
    FROM toStartOfInterval({start}, INTERVAL 1 day)
    TO toStartOfInterval({end}, INTERVAL 1 day)
    STEP INTERVAL 1 day
```

#### GET `/accelerate/v1/top`

**File**: `inc/api/namespace.php` (lines 434-458)

**Purpose**: Top performing content with analytics.

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | ISO datetime | Yes | Period start |
| `end` | ISO datetime | Yes | Period end |
| `type` | string | No | Post type filter |
| `search` | string | No | Title search |
| `author` | integer | No | Author ID filter |
| `page` | integer | No | Pagination (1-indexed) |
| `include` | array | No | Specific post IDs |

**Response**:
```json
{
    "items": [
        {
            "id": 123,
            "title": "Page Title",
            "type": "post",
            "thumbnail": "https://...",
            "views": 1000,
            "unique_views": 800,
            "conversions": 50,
            "variants": [...]
        }
    ]
}
```

**Response Headers**:
- `X-WP-Total`: Total items matching query
- `X-WP-TotalPages`: Total pages (max 12)

**Event Type Handling**:
| Post Type | Event Types | Grouping |
|-----------|-------------|----------|
| `post`, `page` | `pageView` | `post_id` |
| `wp_block` | `blockView`, `conversion` | `block_id` |
| `broadcast` | `blockView` | `block_id` |

#### GET `/accelerate/v1/diff`

**File**: `inc/api/namespace.php` (lines 461-520)

**Purpose**: Period-over-period comparison for sparklines.

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | array | Yes | Post IDs to compare |
| `start` | ISO datetime | Yes | Current period start |
| `end` | ISO datetime | Yes | Current period end |
| `interval` | string | No | Time bucket |
| `tz` | string | No | Timezone |

**Response**:
```json
{
    "123": {
        "previous": {
            "views": 500,
            "by_date": [
                { "date": "2025-12-18", "views": 70 },
                { "date": "2025-12-19", "views": 80 }
            ]
        },
        "current": {
            "views": 600,
            "by_date": [
                { "date": "2025-12-25", "views": 85 },
                { "date": "2025-12-26", "views": 90 }
            ]
        }
    }
}
```

---

## 9. Redux Store

### Store Definition

**File**: `src/data/index.ts` (lines 585-595)

```typescript
import { createReduxStore, register } from '@wordpress/data';

const store = createReduxStore('accelerate', {
    actions,
    controls,
    initialState,
    reducer,
    resolvers,
    selectors,
});

register(store);
```

### State Structure

```typescript
interface AccelerateState {
    isLoading: boolean;
    isLoadingStats: boolean;
    isLoadingDiffs: boolean;
    isUpdating: boolean;
    pagination: {
        total: number;
        pages: number;
    };
    posts: Record<number, Post>;
    queries: Record<string, number[]>;
    stats: Record<string, StatsResult>;
    diffs: Record<string, DiffResult>;
}
```

### Actions

| Action | Purpose |
|--------|---------|
| `refreshPosts()` | Clear posts cache |
| `setPosts(posts, key)` | Store posts with cache key |
| `setPost(post)` | Update single post |
| `removePost(id)` | Delete from store |
| `setStats(stats, key)` | Store stats with cache key |
| `setDiffs(diffs, key)` | Store diffs with cache key |
| `setIsLoading(bool)` | Update loading state |

### Selectors

```typescript
// Get posts for query
select('accelerate').getPosts(queryArgs)

// Get single post by ID
select('accelerate').getPost(id)

// Get traffic statistics
select('accelerate').getStats(queryArgs)

// Get period diffs for sparklines
select('accelerate').getDiffs(queryArgs)

// Get pagination metadata
select('accelerate').getPagination()

// Loading states
select('accelerate').getIsLoading()
select('accelerate').getIsLoadingStats()
select('accelerate').getIsLoadingDiffs()
```

### Resolvers (Data Fetching)

**getPosts Resolver** (lines 492-521):
```typescript
function* getPosts(queryArgs, isMainQuery = true) {
    yield actions.setIsLoading(true);

    const response = yield controls.FETCH_FROM_API({
        path: '/accelerate/v1/top',
        query: resolveQueryArgs(queryArgs),
    });

    const posts = yield controls.RESPONSE_TO_JSON(response);
    const key = mapToKey(queryArgs);

    yield actions.setPosts(posts, key);

    if (isMainQuery) {
        yield actions.setPagination({
            total: parseInt(response.headers.get('X-WP-Total')),
            pages: parseInt(response.headers.get('X-WP-TotalPages')),
        });
    }

    yield actions.setIsLoading(false);
}
```

### Cache Key Generation

**Function**: `mapToKey(queryArgs)` (lines 57-62)

```typescript
function mapToKey(queryArgs: QueryArgs): string {
    // Remove timestamp fields for stable keys
    const { start, end, ...rest } = queryArgs;

    // Sort keys for deterministic ordering
    const sorted = Object.keys(rest).sort();

    // Build key string
    return sorted.map(k => `${k}:${JSON.stringify(rest[k])}`).join(';');
}
```

### Controls (Side Effects)

```typescript
const controls = {
    FETCH_FROM_API: ({ path, query }) => {
        return apiFetch({
            path: addQueryArgs(path, query),
            parse: false,  // Return raw Response
        });
    },
    RESPONSE_TO_JSON: (response) => {
        return response.json();
    },
};
```

---

## 10. Data Flow

### Full Request Cycle

```
1. Component renders
   └── useSelect(select => select('accelerate').getPosts(args))

2. Selector checks cache
   └── state.queries[mapToKey(args)] exists?
       ├── Yes: Return cached posts
       └── No: Trigger resolver

3. Resolver executes
   └── yield controls.FETCH_FROM_API(...)
       └── apiFetch → WordPress REST API

4. PHP endpoint processes
   └── inc/api/namespace.php::get_top_data()
       └── Utils\query() → ClickHouse

5. Response flows back
   └── JSON response → controls.RESPONSE_TO_JSON
       └── actions.setPosts → reducer → state update

6. Component re-renders
   └── Selector returns new data
```

### Period Selection Flow

```
User clicks "30D" button
  ↓
ListFilters.onChange(period)
  ↓
setPeriod('P30D') → localStorage + state
  ↓
List component re-renders
  ↓
useSelect dependencies change → [period]
  ↓
Resolver triggers for new period
  ↓
API fetch with new date range
  ↓
Stats, posts, diffs all refresh
```

---

## 11. Caching Strategy

### Frontend Cache

| Cache Type | Key Pattern | Location |
|------------|-------------|----------|
| Query results | `mapToKey(args)` | Redux state.queries |
| Statistics | `mapToKey(args)` | Redux state.stats |
| Period diffs | `mapToKey(args)` | Redux state.diffs |
| Individual posts | `post.id` | Redux state.posts |

### Backend Cache

| Cache Type | TTL | Group |
|------------|-----|-------|
| Stats queries | 1 minute | `altis` |
| Top content | 1 minute | `altis` |
| Post diffs | 5 minutes | `altis` |

**Cache Key Format**: `SHA1(function + query + params)`

### Invalidation

**Frontend**:
```typescript
// Clear all posts cache
dispatch('accelerate').refreshPosts();

// Force refetch with cache bust
getPosts({ ...args, refresh: Date.now() });
```

**Backend**:
```php
// Automatic TTL expiration
// No manual invalidation hooks
```

---

## 12. Custom Hooks

### usePersistentState

**File**: `src/data/hooks.ts`

```typescript
function usePersistentState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const storageKey = `altis-state-${key}`;

    const [value, setValue] = useState<T>(() => {
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : defaultValue;
    });

    const setPersistentValue = useCallback((newValue: T) => {
        localStorage.setItem(storageKey, JSON.stringify(newValue));
        setValue(newValue);
    }, [storageKey]);

    return [value, setPersistentValue];
}
```

**Used For**:
- Period selection
- Filter preferences
- Search query
- Post type filter
- Resolution setting

### usePost

**File**: `src/data/hooks.ts`

```typescript
function usePost(id: number) {
    const post = useSelect(select => select('accelerate').getPost(id), [id]);
    const { updatePost } = useDispatch('accelerate');
    const isUpdating = useSelect(select => select('accelerate').getIsUpdating(), []);

    const onUpdatePost = useCallback(async (changes: Partial<Post>) => {
        await updatePost(id, changes);
    }, [id, updatePost]);

    return { post, onUpdatePost, isUpdating };
}
```

---

## 13. Known Challenges

### 1. Timezone Handling

**Issue**: Different timezone handling across frontend/backend can cause date misalignment.

**Solution** (index.ts, lines 44-54):
```typescript
function resolveSelectedDate(period: Period, diff: number = 0) {
    const end = moment().subtract(diff, 'days').endOf('day');
    const start = moment(end).subtract(moment.duration(period)).add(1, 'day');
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { start: start.toISOString(), end: end.toISOString(), tz };
}
```

### 2. Logarithmic Scale Readability

**Issue**: Log scale makes exact comparisons difficult.

**Trade-off**: Visibility of all data points vs. precision.

**Mitigation**: Tooltips show exact values on hover.

### 3. Cache Key Stability

**Issue**: Object key ordering affects cache hits.

**Solution**: Sort keys before serialization:
```typescript
const sorted = Object.keys(rest).sort();
```

### 4. Pagination Limits

**Issue**: Maximum 300 items can be retrieved.

**Rationale**: Performance and UI constraints.

**Impact**: Very large sites may not see all content.

### 5. Nested Block Loading

**Issue**: Broadcast block expansion requires additional API calls.

**Solution**: Lazy loading on expand:
```typescript
const [canFetch, setCanFetch] = useState(false);

const handleExpand = () => {
    setExpanded(true);
    setCanFetch(true);
};
```

### 6. Search Debouncing

**Issue**: Too many API calls on rapid typing.

**Solution**: 500ms debounce:
```typescript
useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
}, [search]);
```

---

## 14. Performance Optimizations

### Frontend

| Optimization | Implementation |
|--------------|----------------|
| Lazy loading | Nested blocks load on expand |
| Debounced search | 500ms delay before API call |
| Skeleton loaders | Visual feedback during load |
| Memoized selectors | Redux selector caching |
| Responsive charts | Resize on container change |

### Backend

| Optimization | Implementation |
|--------------|----------------|
| Query caching | 1-5 minute TTL on results |
| Pagination | Max 25 items per request |
| Total limits | Max 300 items overall |
| ClickHouse indexes | blog_id, event_timestamp |
| WITH FILL | Efficient interval generation |

---

## 15. File Reference

### Frontend Components

| File | Purpose | Lines |
|------|---------|-------|
| `src/accelerate/index.tsx` | App entry point | 44 |
| `src/accelerate/containers/App.tsx` | Route container | 48 |
| `src/accelerate/content-explorer/Dashboard.tsx` | Main dashboard | 38 |
| `src/accelerate/content-explorer/HeroChart.tsx` | Traffic chart | 448 |
| `src/accelerate/content-explorer/Welcome.tsx` | Onboarding | ~50 |
| `src/accelerate/components/List.tsx` | Content table | 260 |
| `src/accelerate/components/ListItem.tsx` | Table row | 321 |
| `src/accelerate/components/ListFilters.tsx` | Filter controls | 144 |
| `src/accelerate/components/SparkChart.tsx` | Sparkline | 132 |
| `src/accelerate/components/Image.tsx` | Thumbnail | 65 |

### State Management

| File | Purpose | Lines |
|------|---------|-------|
| `src/data/index.ts` | Redux store | 595 |
| `src/data/reducer.ts` | State updates | ~150 |
| `src/data/hooks.ts` | Custom hooks | ~100 |
| `src/data/periods.ts` | Period definitions | ~50 |

### Backend API

| File | Purpose | Lines |
|------|---------|-------|
| `inc/api/namespace.php` | REST endpoints | 725 |
| `inc/dashboard/namespace.php` | Dashboard setup | 291 |
| `inc/utils/namespace.php` | ClickHouse queries | ~500 |

---

## 16. Legacy Dashboard

A standalone dashboard exists at `src/dashboard/` with additional features:

| Component | Purpose |
|-----------|---------|
| `TopUrls.tsx` | URL breakdown table |
| `Browsers.tsx` | Browser statistics |
| `Devices.tsx` | Device breakdown |
| `Country.tsx` | Geographic data |
| `Searches.tsx` | Search term analytics |
| `Referrers.tsx` | Traffic sources |

This is accessed separately from the Content Explorer and provides deeper analytics drill-down.

---

## 17. Summary

The Content Explorer Dashboard is a React-based analytics interface that:

- **Visualizes** traffic data with visx charts and sparklines
- **Lists** content with filtering, search, and pagination
- **Compares** performance across time periods
- **Integrates** with ClickHouse via WordPress REST API
- **Caches** results at both frontend (Redux) and backend (WP Object Cache) layers

**Key Strengths**:
- Responsive visualization
- Efficient caching strategy
- WordPress Data API integration
- Graceful loading states

**Key Limitations**:
- 300 item maximum
- 5-minute cache staleness
- Logarithmic scale trade-offs
- Single-site focus (no multisite rollup)
