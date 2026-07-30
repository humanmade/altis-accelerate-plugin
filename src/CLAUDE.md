# Frontend (`src/`)

React/TypeScript frontend conventions. Loads when Claude enters `src/`.

## Hard rules

- **All Tailwind/shadcn output must live inside a `<div className="tailwind">` wrapper.** Tailwind is scoped via `postcss-prefix-selector`; utilities outside `.tailwind` do nothing. Utilities on the wrapper element itself also don't apply — always put them on a descendant.
- **Use shadcn `Button` (`@/components/ui/button`) in admin surfaces.** `@wordpress/components` Button is only OK inside the block editor. Never mix both in the same file.
- **Use the typography components** (`PageTitle`, `SectionTitle`, `CardTitle`, `Body`, `Caption`, `Overline` from `@/components/ui/typography`) instead of inline `text-sm font-semibold`. They have `!important` baked in to survive WP admin styles.
- **Use `EmptyState` / `DataContainer`** for loading/empty/error states. No inline "No results found".
- **Use shared compounds before reinventing.** `SearchField`, `EmptyState`, `DataContainer`, `FadeIn` already exist in `src/components/`.
- **Reuse `PeriodChips`, `HeaderRow`, `ViewsMetric`** for header UIs. Chips intentionally use native `<button>` for spacing parity.
- **Portals: insert after the last `.components-notice-list`** when present; always wrap in `.tailwind`; remove the portal node on unmount.

## Block editor portal pattern

Block-editor surfaces inject via React portals into `.interface-interface-skeleton__content`. Wait for the element to exist, then insert:

```js
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
```

Always use `requestAnimationFrame` (not `setTimeout`) for DOM polling. **Do not** wrap `@wordpress/components` Modal in `styled-components` — it breaks portal rendering.

## Variant index gotcha

WordPress block indices and filtered variant array indices don't match. Convert via `getBlockIndex(clientId)`:

```js
const arrayIndex = variants.findIndex(v => getBlockIndex(v.clientId) === blockIndex);
```

When creating empty variants, use `createBlock('core/paragraph')` (creates editable empty block), not `cloneBlock` (preserves existing structure).

## Shared modules

| Path | Contents |
|------|----------|
| `src/lib/utils.ts` | `cn()` (Tailwind class merging), `cx()` (Tremor classnames) |
| `src/lib/hooks.ts` | Shared React hooks |
| `src/lib/motion.ts` | Animation tokens — `duration`, `easing`, `transition` constants |
| `src/lib/portal.ts` | `getPortalContainer()` — creates/reuses `#tailwind-portal-root` for Radix portals. All shadcn portal components use this internally; you only import it for custom portal components. |
| `src/types/component-states.ts` | `DataState` (`'loading' \| 'loaded' \| 'empty' \| 'error'`) and `DataStateProps` |
| `src/components/SearchField.tsx` | Input + search icon + clear button + debounce |
| `src/components/EmptyState.tsx` | Centered empty/error display with icon, title, description, CTA |
| `src/components/DataContainer.tsx` | Unified loading/loaded/empty/error wrapper using `DataState` |
| `src/components/FadeIn.tsx` | Mount animation; respects `prefers-reduced-motion` |
| `src/components/modal.tsx` | **Legacy** audience editor modal (class component, styled-components, default export) — leave alone |

## Sub-files

- `src/components/ui/CLAUDE.md` — shadcn primitives, WP CSS overrides, theme colors, typography
- `src/accelerate/CLAUDE.md` — admin app SCSS conventions (`$acc-*` tokens), `.accelerate-ui` scope
