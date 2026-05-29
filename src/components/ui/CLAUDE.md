# shadcn/ui primitives (`src/components/ui/`)

Pure shadcn primitives shared across all admin pages. Loads when Claude enters this directory.

## Hard rules

- **Don't modify these components.** Changes ripple through the whole app. If you need different styling for one page: pass a `className` prop, wrap in a feature-specific component, or use `!` overrides.
- **Add new shadcn components via `npx shadcn@latest add <name> --legacy-peer-deps`.** If the component uses a portal, swap its portal container to `getPortalContainer()` from `@/lib/portal`.
- **Compounds (combinations of primitives) live in `src/components/`, not here.** This folder is primitives only.
- **Naming.** Primitives are lowercase (`button.tsx`); compounds are PascalCase (`SearchField.tsx`). Always named exports.

## Critical: WordPress CSS overrides

WP admin's global styles for `button`, `input`, `a` override Tailwind. Use the `!` prefix on utilities that don't apply:

```tsx
<span className="!text-sm !font-semibold">Title</span>
```

The typography components (`PageTitle`, `CardTitle`, `Body`, etc.) already have `!important` baked in — prefer them over raw classes.

## Critical: Portal containers

`DropdownMenu`, `Popover`, `Dialog`, `Select` portal to `document.body` and lose Tailwind scope. The four shipped portal components already use `getPortalContainer()` internally. Only matters when adding a new portal component:

```tsx
import { getPortalContainer } from '@/lib/portal';
<DropdownMenuContent container={getPortalContainer()}>
```

## Design principles

1. **Speed is the product.** Sub-200ms perceived response. Optimistic updates, skeletons, smooth transitions — never blank screens or spinners.
2. **Disciplined density.** 4px-grid spacing. Dense for professionals, clear via typographic hierarchy.
3. **State is always visible.** Every data-backed component has four states: `loading → loaded → empty → error`.
4. **Motion with purpose.** Standardized durations and easing — never decorative.
5. **One way to do each thing.** A single Button, Table, Modal. No parallel systems.

## Theme colors (`src/tailwind.css` `@theme` block)

| Token | Use |
|-------|-----|
| `text-foreground` | Primary text (`#1d2327` — WP admin dark) |
| `text-muted-foreground` | Secondary / gray text |
| `border-border` | Default border (light gray) — **not** `currentColor` |
| `bg-background` | Page background |
| `bg-muted` | Subtle hover background |
| `text-destructive` | Red for delete/error actions |
| `text-brand` / `bg-brand` | Accelerate purple `#9332FF` — brand accent (logos, switch checked, links) |
| `text-accent` / `bg-accent` | shadcn hover gray — **NOT** the brand color |

Never hardcode `#9332FF`. Always use `--color-brand`.

## Typography (`src/components/ui/typography.tsx`)

| Component | Tag | Size | Weight | Color |
|-----------|-----|------|--------|-------|
| `PageTitle` | `h1` | 24px | 600 | foreground |
| `SectionTitle` | `h2` | 18px | 600 | foreground |
| `CardTitle` | `h3` | 14px | 600 | foreground |
| `Body` | `p` | 14px | 400 | foreground |
| `Caption` | `p` | 12px | 400 | muted |
| `Overline` | `span` | 12px | 500 | muted (uppercase tracking-wider) |

All accept `as` for polymorphism and `className` for overrides. `prefers-reduced-motion` is handled globally in `src/tailwind.css`.
