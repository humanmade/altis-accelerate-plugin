# Frontend Development (src/)

This file contains patterns specific to frontend React/TypeScript development in the `src/` directory.

## Block Portal Architecture

The plugin uses React portals with scoped Tailwind CSS to inject analytics dashboards into the WordPress block editor.

```javascript
// Main portal injection (src/global-blocks/index.js)
useEffect(() => {
  const waitForTarget = () => {
    const el = document.querySelector('.interface-interface-skeleton__content');
    if (el) {
      el.insertBefore(portalNode.current, el.firstChild);
      setContainer(el);
    } else {
      requestAnimationFrame(waitForTarget);
    }
  };
  waitForTarget();
}, []);

return createPortal(
  <div className="tailwind" style={{ width: '100%' }}>
    <Header />
  </div>,
  portalNode.current
);
```

## Key Components

- **Header Component** (`Header.tsx`): Main analytics dashboard with period selection (7D/30D/90D), conversion tracking, A/B test controls
- **Variant Row Component** (`VariantRow.tsx`): Individual variant entries with thumbnails, metrics, probability calculations
- **Static Global Block** (`index.tsx`): Placeholder blocks with edit links and thumbnails
- **Modal Component** (`modal.tsx`): Legacy WordPress-style overlay for audience editing (class component, styled-components — do not refactor without careful planning)
- **Broadcast Manager** (`src/accelerate/broadcast-manager/`): Admin UI for managing broadcasts with block selection

## Content Generation Guidelines

- **Portal Injection**: Always wait for WordPress editor skeleton (`.interface-interface-skeleton__content`) before injecting
- **Tailwind Scoping**: Wrap all portal content in `<div className="tailwind">` for CSS isolation
- **Data Integration**: Use `useSelect` hooks to fetch analytics from Redux store
- **Dynamic Rendering**: Render different interfaces based on block type (standard/abtest/personalization)
- **WordPress API**: Leverage WordPress Data API and editor hooks for seamless integration

## Technical Guardrails

- Portal nodes must be created with `document.createElement('div')`
- Always use `requestAnimationFrame` for DOM element waiting
- Scoped Tailwind prevents style conflicts with WordPress admin
- Analytics data should be real-time using Redux store updates
- Modal portals should target `document.body` for proper z-index stacking
- **WordPress Modal**: Do NOT wrap `@wordpress/components` Modal with `styled-components` - it breaks portal rendering. Use SCSS with className instead

## Spark Charts & Mini Visualizations

Small inline charts for quick metric visualization within portal headers and variant rows.

**Common Uses:**
- Variant performance trend lines next to conversion rates
- 7-day sparklines in header summary cards
- A/B test confidence intervals
- Audience reach trend indicators

**Technical Requirements:**
- Use minimal visx components (LinePath, scaleLinear, scaleTime)
- Responsive design adapting to portal container width
- Aggregate data points for performance (max 20 points)
- Include ARIA labels for accessibility
- Fetch data via Redux store: `select('accelerate').getSparklineData(blockId, '7D')`

**Performance Considerations:**
- Lightweight rendering to avoid bundle bloat
- Cache sparkline data to prevent excessive API calls
- Use CSS transforms for hover interactions instead of re-renders

## Variant Selection Integration

When implementing variant switching in portal interfaces, coordinate with WordPress block editor state:

**Index Mapping Issue**: WordPress block indices don't always match filtered array indices. Convert between them:
```javascript
// Convert WordPress block index to UI array index
const selectedVariant = useSelect((select) => {
  const blockIndex = select(PreferencesStore).get('scope', `${postId}:variant`) || 0;
  const { getBlockIndex } = select(BlockEditorStore);
  const arrayIndex = variants.findIndex(v => getBlockIndex(v.clientId) === blockIndex);
  return arrayIndex >= 0 ? arrayIndex : 0;
}, [postId, variants]);
```

**Block Selection Strategy**: Use `selectBlock(clientId)` to trigger variant switching, let WordPress handle preference updates automatically rather than manually setting preferences. **Key insight**: Empty variants need default inner blocks (e.g., `createBlock('core/paragraph')`) to be immediately editable - `createBlock` creates empty blocks while `cloneBlock` preserves existing content structure.

## Common Patterns

```javascript
// Wait for DOM element pattern
const waitForTarget = () => {
  const el = document.querySelector(selector);
  if (el) {
    // Inject portal
  } else {
    requestAnimationFrame(waitForTarget);
  }
};

// Scoped Tailwind container
<div className="tailwind">
  {/* All Tailwind styles scoped here */}
</div>
```

## Shared Libraries (`src/lib/`)

Utility modules imported via `@/lib/...`:

- **`utils.ts`** — `cn()` (Tailwind class merging) and `cx()` (Tremor classnames)
- **`hooks.ts`** — Shared React hooks
- **`motion.ts`** — Animation tokens: `duration`, `easing`, `transition` constants for consistent motion
- **`portal.ts`** — `getPortalContainer()` — creates/reuses `#tailwind-portal-root` for Radix portals. All shadcn portal components (dialog, dropdown-menu, popover, select) use this internally.

## Shared Types (`src/types/`)

- **`component-states.ts`** — `DataState` type (`'loading' | 'loaded' | 'empty' | 'error'`) and `DataStateProps` interface for consistent async UI state handling

## Shared Components (`src/components/`)

Compound components that combine shadcn primitives. Imported via `@/components/...`:

- **`SearchField.tsx`** — Input + search icon + clear button with built-in debounce. Use this instead of inline Input+Search patterns.
- **`FadeIn.tsx`** — Mount animation wrapper (opacity + translateY). Respects `prefers-reduced-motion`.
- **`EmptyState.tsx`** — Centered empty/error display with optional icon, title, description, and action CTA.
- **`DataContainer.tsx`** — Unified state wrapper: renders skeleton (loading), children with fade-in (loaded), EmptyState (empty), or error with retry button (error). Uses `DataState` type.
- **`modal.tsx`** — **Legacy** audience editor modal. Class component with styled-components and default export. Does not follow current conventions — leave as-is until a dedicated refactor.

Pure primitives live in `src/components/ui/` — see `src/components/ui/CLAUDE.md` for details.

## Build Configuration

- `webpack.config.dev.js` - Development build with hot reload
- `webpack.config.prod.js` - Production optimized build
- `tailwind.config.js` - CSS framework configuration
- `tsconfig.json` - TypeScript configuration
- `.eslintrc` - JavaScript linting rules
