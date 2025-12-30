# CLAUDE.md for /docs

## Purpose

This folder contains technical audit documents. When asked to create, update, or reference documentation, use these guidelines.

## Existing Documents

| File | System | Key Directories |
|------|--------|-----------------|
| `analytics.md` | Analytics, ClickHouse, event tracking | `inc/analytics/`, `inc/api/`, `src/data/` |
| `experiments.md` | A/B testing, statistical analysis | `inc/experiments/`, `src/experiments.js` |
| `personalisation.md` | Audiences, targeting rules | `inc/audiences/`, `src/audiences/` |
| `broadcasts.md` | Broadcast post type, rotation | `inc/broadcast/`, `src/accelerate/broadcast-manager/` |
| `global-blocks.md` | Synced patterns, editor portal, thumbnails | `inc/global-blocks/`, `src/global-blocks/` |
| `content-explorer.md` | Dashboard UI, charts, Redux | `inc/dashboard/`, `src/accelerate/`, `src/data/` |

## Creating/Updating Documentation

### Exploration Strategy

Use 3 parallel Task agents with `subagent_type: Explore`:
1. **PHP backend**: `inc/[system]/` - namespace.php, REST controllers, hooks
2. **Frontend**: `src/[system]/` - React components, custom elements, state
3. **Integration**: Data flow, REST endpoints, ClickHouse queries

### Required Document Sections

1. **Executive Summary** (2-3 sentences)
2. **Architecture Overview** (ASCII diagram showing data flow)
3. **Data Model** (post meta keys, taxonomies, database schema)
4. **Server-Side Processing** (PHP functions with file:line references)
5. **Client-Side Components** (React hierarchy, custom elements)
6. **REST API Reference** (endpoints table with parameters/responses)
7. **State Management** (Redux stores, selectors, data flow)
8. **Integration Points** (connections to other Accelerate systems)
9. **Known Challenges** (bugs, technical debt, gotchas with file references)
10. **Extensibility** (hooks, filters with examples)
11. **File Reference** (table of key files with line counts)

### Code Reference Format

Always include file paths and line numbers:
```
**Function**: `render_block()` (`inc/global-blocks/namespace.php:355-509`)
```

### What to Look For

- Post type registrations and meta keys
- `add_action()` / `add_filter()` hooks
- REST endpoint registrations (`register_rest_route`)
- ClickHouse query patterns (`Utils\query()`)
- Custom HTML elements (`customElements.define`)
- Redux store definitions (`createReduxStore`)
- WordPress Data API usage (`useSelect`, `useDispatch`)
- Integration with experiments/audiences/analytics systems

## Systems Not Yet Documented

| System | Directories | Notes |
|--------|-------------|-------|
| Admin Settings | `inc/admin/`, `src/settings/` | Settings pages, notices |
| OAuth | `inc/oauth/` | Dashboard authentication |
| Security | Cross-cutting | Input validation, nonces, capabilities |
| Build System | `.config/`, `webpack.*.js` | Asset pipeline |

## Quality Checklist

Before finalizing a document:
- [ ] All major PHP files in system have file:line references
- [ ] All React components listed with hierarchy
- [ ] REST endpoints have parameter/response tables
- [ ] Data model includes all post meta keys
- [ ] Known challenges include specific file:line for each
- [ ] ASCII architecture diagram shows complete data flow
- [ ] Integration points to other systems documented
