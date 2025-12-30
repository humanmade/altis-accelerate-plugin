# Accelerate Broadcasts - Technical Documentation

## Executive Summary

Broadcasts are a **content distribution system** that allows grouping and rotating multiple synced patterns together across a website. Unlike individual synced patterns, broadcasts act as containers that reference multiple blocks, providing unified management and analytics tracking for promotional content campaigns.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      BROADCAST CREATION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Broadcast Manager (React Admin UI)                                      │
│  ├── Create broadcast post (post_type: 'broadcast')                     │
│  ├── Select multiple synced patterns via BlockSelector                  │
│  ├── Drag-and-drop reordering                                           │
│  └── Save block IDs to post meta                                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      DATA STORAGE                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  WordPress Database                                                      │
│  ├── wp_posts: broadcast post type                                      │
│  └── wp_postmeta: 'blocks' key with multiple wp_block IDs               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      RENDERING                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  PHP: render_block() or Broadcast\render()                               │
│  ├── Fetch all referenced wp_block posts                                │
│  ├── Wrap each in <template> element                                    │
│  ├── Run through do_blocks() for rendering                              │
│  └── Output <broadcast-block> custom element                            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      FRONTEND ROTATION                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  JavaScript: BroadcastBlock custom element                               │
│  ├── Round-robin rotation via localStorage                              │
│  ├── Clone and display selected template                                │
│  └── Track view when 75% visible                                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      ANALYTICS                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Events: blockView with broadcastId attribute                            │
│  Storage: ClickHouse analytics database                                  │
│  Display: Content Explorer dashboard                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Broadcasts vs Synced Patterns

| Aspect | Synced Pattern (wp_block) | Broadcast |
|--------|---------------------------|-----------|
| **Purpose** | Individual reusable content block | Container for multiple blocks |
| **Storage** | Post content with block markup | Post meta with block ID references |
| **Variants** | Can have A/B test or personalization variants | No variants (references blocks that may have variants) |
| **Rotation** | Single block displayed | Round-robin rotation of multiple blocks |
| **Analytics** | Per-block tracking | Per-broadcast + per-block tracking |
| **Use Case** | Reusable content anywhere | Promotional campaigns, content distribution |

---

## 3. Post Type Definition

```php
const POST_TYPE = 'broadcast';

register_extended_post_type(
    POST_TYPE,
    [
        'public' => false,
        'show_ui' => true,
        'block_editor' => false,
        'supports' => ['title', 'author'],
        'show_in_rest' => true,
        'rest_base' => 'broadcasts',
        'rest_controller_class' => Posts_Controller::class,
        'menu_position' => 25,
        'show_in_menu' => 'accelerate',
    ]
);
```

**Key Characteristics:**
- Not publicly accessible
- No block editor (managed via custom UI)
- Only title and author supported
- REST API enabled with custom controller
- Appears in Accelerate admin menu

---

## 4. Data Storage

### Post Meta Structure

```php
// Multiple block IDs stored as separate meta entries
add_post_meta($broadcast_id, 'blocks', $block_id_1);
add_post_meta($broadcast_id, 'blocks', $block_id_2);
add_post_meta($broadcast_id, 'blocks', $block_id_3);

// Retrieval returns array
$block_ids = get_post_meta($broadcast_id, 'blocks'); // [123, 456, 789]
```

### REST API Fields

| Field | Type | Description |
|-------|------|-------------|
| `blocks` | array[int] | Array of wp_block post IDs |
| `thumbnails` | array[string] | Generated preview URLs for each block |

```php
register_rest_field(POST_TYPE, 'blocks', [
    'get_callback' => function($post) {
        return get_post_meta($post['id'], 'blocks') ?: [];
    },
    'update_callback' => function($value, $post) {
        delete_post_meta($post->ID, 'blocks');
        foreach ($value as $block_id) {
            add_post_meta($post->ID, 'blocks', $block_id);
        }
    },
]);
```

---

## 5. REST API

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/accelerate/v1/broadcast` | GET | List broadcasts with search |
| `/accelerate/v1/broadcast` | POST | Create new broadcast |
| `/accelerate/v1/broadcast/{id}` | GET | Get single broadcast |
| `/accelerate/v1/broadcast/{id}` | PATCH | Update broadcast |
| `/accelerate/v1/broadcast/{id}` | DELETE | Delete broadcast |

### Request/Response Examples

**Create Broadcast:**
```json
// POST /accelerate/v1/broadcast
{
    "title": "Holiday Campaign",
    "status": "publish"
}

// Response
{
    "id": 120,
    "title": { "rendered": "Holiday Campaign" },
    "blocks": [],
    "thumbnails": []
}
```

**Update Blocks:**
```json
// PATCH /accelerate/v1/broadcast/120
{
    "blocks": [123, 456, 789]
}

// Response
{
    "id": 120,
    "blocks": [123, 456, 789],
    "thumbnails": ["url1", "url2", "url3"]
}
```

---

## 6. Server-Side Rendering

### Block Registration

```json
{
    "name": "altis/broadcast",
    "title": "Broadcast",
    "category": "altis-experience-blocks",
    "supports": {
        "align": true,
        "alignWide": true
    },
    "attributes": {
        "clientId": { "type": "string" },
        "broadcast": { "type": "number" }
    }
}
```

### Render Function

```php
function render_block(array $attributes): string {
    $broadcast_id = $attributes['broadcast'];
    $client_id = $attributes['clientId'];

    // Fetch referenced blocks
    $block_ids = get_post_meta($broadcast_id, 'blocks') ?: [];
    $blocks = new WP_Query([
        'post_type' => 'wp_block',
        'post__in' => $block_ids,
        'post_status' => 'publish',
    ]);

    // Add broadcast ID to analytics
    add_filter('altis.analytics.block_event_attributes', function($attrs) use ($broadcast_id) {
        $attrs['broadcastId'] = $broadcast_id;
        return $attrs;
    });

    // Wrap each block in template
    $templates = array_map(function($block) use ($client_id) {
        return sprintf(
            '<template data-id="%d" data-parent-id="%s">%s</template>',
            $block->ID,
            $client_id,
            do_blocks(sprintf('<!-- wp:block {"ref":%d} /-->', $block->ID))
        );
    }, $blocks->posts);

    // Return custom element
    return sprintf(
        '%s<broadcast-block client-id="%s" broadcast-id="%d"></broadcast-block>',
        implode('', $templates),
        $client_id,
        $broadcast_id
    );
}
```

### Template Function

```php
// For use in theme templates
function render(int $broadcast_id, string $client_id = ''): string {
    return do_blocks(sprintf(
        '<!-- wp:altis/broadcast %s /-->',
        wp_json_encode([
            'clientId' => $client_id,
            'broadcast' => $broadcast_id,
        ])
    ));
}

// Usage in theme
echo Altis\Accelerate\Broadcast\render(120, 'footer-hero-broadcast');
```

---

## 7. Frontend Custom Element

### BroadcastBlock Class

```javascript
class BroadcastBlock extends HTMLElement {
    get clientId() {
        return this.getAttribute('client-id');
    }

    get broadcastId() {
        return this.getAttribute('broadcast-id');
    }

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                ::slotted(*) { margin-inline: 0; }
            </style>
            <slot></slot>
        `;
        this.setContent();
    }

    setContent() {
        const templates = document.querySelectorAll(
            `template[data-parent-id="${this.clientId}"]`
        );

        // Round-robin rotation
        const index = this.getTemplateToShow(templates.length);
        const template = templates[index];

        // Render selected template
        this.innerHTML = '';
        this.appendChild(template.content.cloneNode(true));

        // Track view at 75% visibility
        this.trackView(index);
    }

    getTemplateToShow(count) {
        const key = `altis.broadcast.${this.broadcastId}.lastViewed`;
        let index = parseInt(localStorage.getItem(key) || '0', 10) + 1;

        if (index >= count) index = 0;

        localStorage.setItem(key, index);
        return index;
    }

    trackView(index) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    window.Altis.Analytics.record('blockView', {
                        attributes: {
                            clientId: this.clientId,
                            blockId: this.broadcastId,
                            selected: index,
                            type: 'broadcast',
                        },
                    });
                    observer.disconnect();
                }
            },
            { threshold: 0.75 }
        );
        observer.observe(this);
    }
}
```

### Rotation Algorithm

```javascript
// Round-robin rotation using localStorage
getTemplateToShow(count) {
    const key = `altis.broadcast.${this.broadcastId}.lastViewed`;

    // Get last viewed index
    const lastViewed = localStorage.getItem(key);
    let index = lastViewed ? parseInt(lastViewed, 10) + 1 : 0;

    // Wrap around
    if (index >= count) index = 0;

    // Store for next visit
    localStorage.setItem(key, index);

    return index;
}
```

---

## 8. Admin UI Components

### Component Hierarchy

```
BroadcastManager (index.tsx)
├── List
│   ├── ListFilters (period, search)
│   ├── ListItem (expandable rows)
│   │   └── ImageGroup (block thumbnails)
│   └── Pagination
└── ManageModal
    ├── Upsert (create/rename)
    └── Edit
        └── BlockSelector
            └── BlockSelectorList (drag-and-drop)
```

### Broadcast Manager

```typescript
function BroadcastManager({ postTypes, user, id }) {
    const [period, setPeriod] = usePersistentState('period', 'P7D');
    const [broadcastId, setBroadcastId] = useState(id);
    const [managingItem, setManagingItem] = useState(null);

    return (
        <div className="Dashboard">
            <List
                postType={postTypes.find(t => t.name === 'broadcast')}
                period={period}
                actions={{
                    'Edit Broadcast': (post) => setManagingItem(post),
                }}
            />
            {managingItem && (
                <ManageModal
                    item={managingItem}
                    onClose={() => setManagingItem(null)}
                />
            )}
        </div>
    );
}
```

### BlockSelector with Drag-and-Drop

```typescript
function BlockSelectorList({ blocks, selected, onSelect }) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = selected.indexOf(active.id);
            const newIndex = selected.indexOf(over.id);
            onSelect(arrayMove(selected, oldIndex, newIndex));
        }
    };

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={selected}>
                {blocks.map(block => (
                    <SortableItem
                        key={block.id}
                        block={block}
                        isSelected={selected.includes(block.id)}
                        onToggle={() => toggleSelection(block.id)}
                    />
                ))}
            </SortableContext>
        </DndContext>
    );
}
```

---

## 9. Analytics Integration

### Event Tracking

| Event | Trigger | Attributes |
|-------|---------|------------|
| `blockView` | 75% visible | broadcastId, clientId, selected, type |
| `blockLoad` | Element connected | broadcastId, clientId |
| `conversion` | Goal achieved | broadcastId, goal, blockId |

### Analytics Filter

```php
// Add broadcast ID to all inner block events
add_filter('altis.analytics.block_event_attributes', function($attrs) use ($broadcast_id) {
    $attrs['broadcastId'] = $broadcast_id;
    return $attrs;
});
```

### Content Explorer Query

```php
// Filter for broadcast type
if ($filter->type === 'broadcast') {
    return "event_type = 'blockView'";
}

// Include blocks array in response
if ($post->post_type === 'broadcast') {
    $response['blocks'] = get_post_meta($post->ID, 'blocks') ?: [];
}
```

---

## 10. Content Explorer Integration

### Broadcast Display

| Column | Data |
|--------|------|
| Thumbnail | First block's preview |
| Title | Broadcast name |
| Views | Total view count |
| Blocks | Expandable list of referenced blocks |
| Author | Creator |
| Actions | Edit, View |

### Expandable Block List

```typescript
function ListItem({ post, isNestable }) {
    const [expanded, setExpanded] = useState(false);
    const blocks = useSelect(select =>
        expanded ? select('accelerate').getPosts({
            type: 'wp_block',
            include: post.blocks,
        }) : []
    );

    return (
        <div className="ListItem">
            {isNestable && (
                <button onClick={() => setExpanded(!expanded)}>
                    {expanded ? '▼' : '▶'}
                </button>
            )}
            <ImageGroup blockIds={post.blocks} />
            <span>{post.title}</span>
            <span>{post.views} views</span>
            {expanded && blocks.map(block => (
                <NestedBlockRow key={block.id} block={block} />
            ))}
        </div>
    );
}
```

---

## 11. Block Editor Integration

### Broadcast Block Edit Component

```javascript
function BroadcastEdit({ attributes, setAttributes }) {
    const [broadcasts, setBroadcasts] = useState([]);
    const [search, setSearch] = useState('');

    // Debounced search
    useEffect(() => {
        const fetch = debounce(async (keyword) => {
            const results = await apiFetch({
                path: `/accelerate/v1/broadcast?search=${keyword}`,
            });
            setBroadcasts(results);
        }, 1000);

        fetch(search);
    }, [search]);

    return (
        <div className="broadcast-block-edit">
            <TextControl
                placeholder="Search broadcasts..."
                value={search}
                onChange={setSearch}
            />
            {broadcasts.map(broadcast => (
                <BroadcastOption
                    key={broadcast.id}
                    broadcast={broadcast}
                    selected={attributes.broadcast === broadcast.id}
                    onSelect={() => setAttributes({ broadcast: broadcast.id })}
                />
            ))}
        </div>
    );
}
```

---

## 12. Data Flow Diagram

```
CREATION
========
1. Admin opens Broadcast Manager
   └── GET /accelerate/v1/broadcast (list)

2. Clicks "Add New"
   └── POST /accelerate/v1/broadcast { title }

3. Selects blocks via BlockSelector
   ├── GET /accelerate/v1/xbs (search wp_block)
   └── Drag-and-drop to reorder

4. Saves broadcast
   └── PATCH /accelerate/v1/broadcast/{id} { blocks: [123, 456] }


RENDERING
=========
1. Theme calls Broadcast\render(120, 'footer-cta')
   └── Creates <!-- wp:altis/broadcast {...} /-->

2. do_blocks() triggers render_block()
   ├── Fetch block IDs from post meta
   ├── Query wp_block posts
   ├── Wrap each in <template data-id="..." data-parent-id="...">
   └── Output <broadcast-block client-id="..." broadcast-id="...">

3. Frontend JavaScript activates
   ├── BroadcastBlock.connectedCallback()
   ├── getTemplateToShow() - round-robin from localStorage
   ├── Clone and append selected template
   └── IntersectionObserver tracks visibility


ANALYTICS
=========
1. Block becomes 75% visible
   └── Altis.Analytics.record('blockView', {
         blockId: 120,
         selected: 1,
         type: 'broadcast'
       })

2. Event sent to ClickHouse
   └── Stored with broadcast_id, selected index

3. Content Explorer queries
   └── Aggregates views by broadcast_id


MANAGEMENT
==========
1. Edit broadcast in manager
   └── ManageModal → Edit → BlockSelector

2. Reorder/add/remove blocks
   └── PATCH /accelerate/v1/broadcast/{id}

3. Delete broadcast
   └── DELETE /accelerate/v1/broadcast/{id}?force=true
```

---

## 13. Integration with A/B Testing & Personalisation

### Block-Level Variants Only

Broadcasts themselves don't have variants. However, referenced blocks can be:

| Block Type | Behavior in Broadcast |
|------------|----------------------|
| Standard | Same content for all visitors |
| A/B Test | Each visitor sees their assigned variant |
| Personalisation | Variant based on audience matching |

### Event Hierarchy

```
Broadcast Event
├── broadcastId: 120
├── selected: 1 (rotation index)
└── Inner Block Events
    ├── blockId: 456
    ├── blockType: 'abtest'
    ├── test_variant_id: 0
    └── goal: 'engagement'
```

---

## 14. Known Challenges

### Technical Issues

| Issue | Impact |
|-------|--------|
| No broadcast-level A/B testing | Cannot test different block combinations |
| Round-robin only rotation | No weighted distribution |
| localStorage dependency | Rotation resets on clear |

### UX Challenges

| Issue | Description |
|-------|-------------|
| Block ordering | Must use drag-and-drop |
| Preview limitations | No live preview of rotation |
| Analytics attribution | Complex multi-level tracking |

---

## 15. Opportunities

### Short-Term

| Opportunity | Benefit |
|-------------|---------|
| Weighted rotation | Prioritize certain blocks |
| Preview mode | See all blocks in editor |
| Bulk block management | Faster editing |

### Medium-Term

| Opportunity | Benefit |
|-------------|---------|
| Broadcast-level A/B testing | Test block combinations |
| Scheduling | Time-based block rotation |
| Frequency capping | Limit impressions per visitor |

### Strategic

| Opportunity | Benefit |
|-------------|---------|
| Cross-broadcast analytics | Campaign comparison |
| Smart rotation | ML-based optimization |
| External integrations | Sync with ad platforms |

---

## 16. File Reference

### Backend (PHP)

| File | Purpose |
|------|---------|
| `inc/broadcast/namespace.php` | Post type, REST fields, render function |
| `inc/broadcast/class-posts-controller.php` | REST API controller |
| `inc/blocks/broadcast/register.php` | Block rendering |
| `inc/blocks/broadcast/block.json` | Block definition |

### Frontend (JS/TS)

| File | Purpose |
|------|---------|
| `src/accelerate/broadcast-manager/index.tsx` | Manager container |
| `src/accelerate/broadcast-manager/modals/Manage.tsx` | Edit modal |
| `src/accelerate/broadcast-manager/modals/Edit.tsx` | Block selection |
| `src/accelerate/components/BlockSelector.tsx` | Block picker |
| `src/accelerate/components/BlockSelectorList.tsx` | Drag-and-drop list |
| `src/experiments.js` | BroadcastBlock custom element |

---

## 17. Configuration

### Feature Flag

```php
// Broadcasts can be disabled
if (Utils\is_feature_enabled('broadcast')) {
    Broadcast\setup();
}
```

### Rotation Storage Key

```javascript
// localStorage key format
`altis.broadcast.${broadcastId}.lastViewed`
```

---

## 18. Summary Statistics

| Metric | Value |
|--------|-------|
| PHP Broadcast Code | ~300 LOC |
| Frontend Broadcast Code | ~800 LOC |
| REST Endpoints | 5 (CRUD + list) |
| Rotation Method | Round-robin |
| Analytics Events | blockView, blockLoad, conversion |
| Storage | Post meta (blocks key) |
