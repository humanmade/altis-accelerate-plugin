# shadcn/ui Components

These are shared components used across all Accelerate admin pages (Content Explorer, Audiences, Broadcasts, Settings). They are based on shadcn/ui but modified for this project.

## Design Principles

1. **Speed is the product.** Sub-200ms perceived response for every interaction. Optimistic UI updates, skeleton placeholders, and smooth transitions — never a blank screen or spinner.
2. **Disciplined density.** A consistent 4px-grid spacing system. Dense enough for professionals, clear enough through typographic hierarchy.
3. **State is always visible.** Every data-backed component has exactly four states: `loading → loaded → empty → error`.
4. **Motion with purpose.** Standardized durations and easing — never decorative animation.
5. **One way to do each thing.** A single Button, a single Table, a single Modal. Eliminate parallel systems.

## Critical: WordPress CSS Overrides

WordPress admin has global styles for `button`, `input`, `a`, etc. that override Tailwind classes. When Tailwind styles don't apply, use the `!` prefix to add `!important`:

```tsx
// BAD - WordPress overrides these
<span className="text-sm font-semibold">Title</span>

// GOOD - Forces styles through
<span className="!text-sm !font-semibold">Title</span>
```

Common overrides needed:
- `!font-semibold`, `!font-bold` - WordPress sets `font-weight: 400` on buttons
- `!text-sm`, `!text-base` - WordPress sets font sizes on form elements
- `!text-foreground` - WordPress link colors

## Critical: Tailwind Scoping

All Tailwind styles are scoped to `.tailwind` containers. Components must be **descendants** of a `.tailwind` wrapper:

```tsx
// BAD - utilities on same element don't work
<div className="tailwind px-4">

// GOOD - utilities on descendant
<div className="tailwind">
  <div className="px-4">
```

## Critical: Portal Containers

Components with portals (DropdownMenu, Popover, Dialog) render to `document.body` by default, losing Tailwind styles. Portal handling is centralized in `@/lib/portal`:

```tsx
import { getPortalContainer } from '@/lib/portal';

<DropdownMenuContent container={getPortalContainer()}>
```

All 4 portal components (dialog, dropdown-menu, popover, select) already use this internally — you only need to import it yourself if building a custom portal component.

## Reference Styles

Content Explorer's standard text styles (match these for consistency):

| Element | Classes | Result |
|---------|---------|--------|
| Clickable title | `!text-sm !font-semibold` | 14px, weight 600 |
| Secondary text | `text-xs text-muted-foreground` | 12px, gray |
| Column header | `text-sm font-medium text-muted-foreground` | 14px, weight 500, gray |

## Don't Modify These Components

Changes here affect the entire app. If you need different styling for one page:
1. Pass className prop to override
2. Create a wrapper component in your feature folder
3. Use `!` prefix for style overrides

## Component Examples

### Button
```tsx
import { Button } from '@/components/ui/button';

// Primary (dark)
<Button>Add New</Button>

// Outline
<Button variant="outline">Cancel</Button>

// With icon
<Button>
  <ChevronDown className="ml-2 h-4 w-4" />
  Dropdown
</Button>
```

### SearchField
```tsx
import { SearchField } from '@/components/SearchField';

<SearchField
  placeholder="Search pages..."
  onChange={ value => setSearch( value ) }
/>

// With custom debounce (default 500ms)
<SearchField debounce={300} placeholder="Filter..." onChange={onFilter} />
```
Includes search icon, clear (X) button, and built-in debounce. Replaces the old inline Input + Search icon pattern.

### Switch with Label
```tsx
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

<div className="flex items-center gap-3">
  <Switch id="status" checked={isActive} onCheckedChange={setIsActive} />
  <Label htmlFor="status">{isActive ? 'Active' : 'Inactive'}</Label>
</div>
```

### Dropdown Menu
```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Compound Component Organization

When combining multiple shadcn primitives into reusable components:

### Where to put them

```
src/components/
├── ui/                    # Pure shadcn primitives (don't modify)
│   ├── button.tsx
│   ├── input.tsx
│   ├── skeleton.tsx
│   ├── typography.tsx
│   └── switch.tsx
├── FadeIn.tsx             # Compound: mount animation wrapper
├── EmptyState.tsx         # Compound: icon + title + description + CTA
├── DataContainer.tsx      # Compound: loading/loaded/empty/error states
├── SearchField.tsx        # Compound: input + search icon + clear button
└── modal.tsx              # Legacy: audience editor modal (do not use as pattern)
```

**Rules:**
1. `src/components/ui/` - Only pure shadcn primitives, don't add compounds here
2. `src/components/` - Shared compound components used across multiple features
3. `src/[feature]/ui/components/` - Feature-specific compounds (e.g., `src/audiences/ui/components/`)

### When to promote

Keep components in feature folders until needed elsewhere. When a second feature needs it:
1. Move to `src/components/`
2. Make it generic (props for customization)
3. Update imports

### Naming

- Primitives: lowercase (`button.tsx`, `input.tsx`)
- Compounds: PascalCase (`SearchField.tsx`, `EmptyState.tsx`)
- Exports: Always use **named exports** (`export { Button }`, `export function SearchField`)
- Exception: `modal.tsx` is legacy (lowercase, default export, class component) — do not use as a pattern

## Theme Colors

Defined in `src/tailwind.css` under `@theme`. Key semantic colors:
- `text-foreground` - Primary text (#1d2327, WP admin dark)
- `text-muted-foreground` - Secondary/gray text
- `border-border` - Standard border color
- `bg-background` - Page background
- `bg-muted` - Subtle background for hover states
- `text-destructive` - Red for delete/error actions
- `text-brand` / `bg-brand` - Accelerate purple (#9332FF) — brand accent color for logos, switch checked state, links

## StepIndicator

10 vertical rounded bars showing a 0–100% value. Used for audience traffic coverage in list rows and edit sidebar. Uses inline styles for colors/dimensions so it works outside `.tailwind` scope.

```tsx
import { StepIndicator } from '@/components/ui/step-indicator';

<StepIndicator percent={42} />                    // 4 filled bars, light→dark purple
<StepIndicator percent={100} />                   // 10 filled bars, full ramp
<StepIndicator percent={0} isLoading />           // All gray, pulsing
```

Props: `percent` (0–100), `isLoading?` (pulse animation), `className?`.

## Skeleton

Loading placeholder that pulses. Use for content that hasn't loaded yet:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

<Skeleton className="h-4 w-48" />       // Text line
<Skeleton className="h-10 w-full" />     // Input field
<Skeleton className="h-32 w-full rounded-lg" />  // Card
```

## Typography

Pre-styled text components with `!important` overrides baked in (so WordPress admin styles don't interfere). Each accepts an `as` prop for polymorphism and `className` for overrides:

```tsx
import { PageTitle, SectionTitle, CardTitle, Body, Caption, Overline } from '@/components/ui/typography';

<PageTitle>Dashboard</PageTitle>          // h1, 24px semibold
<SectionTitle>Analytics</SectionTitle>    // h2, 18px semibold
<CardTitle>Conversion Rate</CardTitle>    // h3, 14px semibold
<Body>Description text here.</Body>       // p, 14px normal
<Caption>Last updated 2 hours ago</Caption>  // p, 12px muted
<Overline>Statistics</Overline>           // span, 12px uppercase tracking-wider muted

// Polymorphic: render as different element
<Body as="span">Inline text</Body>
```

| Component | Default Tag | Size | Weight | Color |
|-----------|-------------|------|--------|-------|
| `PageTitle` | `h1` | 24px (`text-2xl`) | 600 | foreground |
| `SectionTitle` | `h2` | 18px (`text-lg`) | 600 | foreground |
| `CardTitle` | `h3` | 14px (`text-sm`) | 600 | foreground |
| `Body` | `p` | 14px (`text-sm`) | 400 | foreground |
| `Caption` | `p` | 12px (`text-xs`) | 400 | muted-foreground |
| `Overline` | `span` | 12px (`text-xs`) | 500 | muted-foreground |

## Motion Tokens

Standardized animation values defined in both CSS vars (`src/tailwind.css`) and JS constants (`src/lib/motion.ts`):

```tsx
import { duration, easing, transition } from '@/lib/motion';

// Use transition utility classes directly
<div className={transition.colors}>Hover me</div>

// Or use CSS vars in tailwind.css
// --duration-instant (100ms), --duration-fast (150ms), --duration-normal (200ms), --duration-slow (300ms)
// --ease-standard, --ease-enter, --ease-exit
```

The `prefers-reduced-motion: reduce` media query is handled globally in `src/tailwind.css` — all animations and transitions inside `.tailwind` containers are automatically minimized.

## DataState Model

Standard type for representing async data states. Import from `@/types/component-states`:

```tsx
import type { DataState, DataStateProps } from '@/types/component-states';

// DataState: 'loading' | 'loaded' | 'empty' | 'error'
// DataStateProps: { state, errorMessage?, onRetry? }
```

Use this to standardize loading/empty/error handling across features.

## Content Explorer Table Pattern

All data tables across the plugin **must** reuse the Content Explorer's table structure from `src/accelerate/components/List.scss`. This ensures visual consistency (column widths, spacing, typography, thumbnail treatment) without duplicating styles.

### How to use (recommended: DataTable component)

Use the shared `DataTable` compound component (`src/components/DataTable.tsx`). It handles the `.List.tailwind` wrapper, imports `List.scss`, and renders `<thead>` from a `columns` array. Three optional slots allow composing controls, empty states, and pagination:

```tsx
import { DataTable } from '@/components/DataTable';
import type { ColumnDef } from '@/components/DataTable';

const MY_COLUMNS: ColumnDef[] = [
  { headerClass: 'thumbnail', label: '\u00A0' },
  { headerClass: 'name', label: '\u00A0' },
  { headerClass: 'meta', label: __( 'Actions', 'altis' ) },
];

// Minimal usage — just columns + rows:
<DataTable columns={ MY_COLUMNS }>
  {/* <tr> rows here */}
</DataTable>

// With slots:
<DataTable
  columns={ MY_COLUMNS }
  controls={ <div className="table-controls">...</div> }
  emptyContent={ <EmptyState title="No results" /> }
  footer={ <Pagination /> }
>
  {/* <tr> rows — when empty, emptyContent renders instead */}
</DataTable>
```

**Slot details:**
- `controls` — Rendered inside `.table-wrap` above `.table-content`. Consumer provides their own wrapper (e.g. `.table-controls`) for SCSS styling.
- `emptyContent` — Rendered as `<tr><td colSpan={columns.length}>` when `children` is empty. Headers stay visible.
- `footer` — Rendered inside `<div className="table-footer">` after `</table>` (matches `List.scss` `.table-footer` styling).

### Raw markup (reference only — used by Content Explorer's List.tsx)

```tsx
<div className="List tailwind">
  <div className="table-wrap">
    <div className="table-content">
      <table aria-live="polite">
        <thead>
          <tr>
            <th className="table-header-thumbnail">&nbsp;</th>
            <th className="table-header-name">&nbsp;</th>
            {/* Additional columns */}
            <th className="table-header-meta">Actions</th>
          </tr>
        </thead>
        <tbody>{/* rows */}</tbody>
      </table>
    </div>
  </div>
</div>
```

### Row class names

| Cell | Class | Width | Content |
|------|-------|-------|---------|
| Thumbnail | `record-thumbnail` | 125px | `.record-thumbnail-wrap` > `StandaloneBlockPreview` / `<img>` / `.record-thumbnail__empty` |
| Name | `record-name` | 18–28rem | `.record-cell-col` > `.record-name__title.record-cell-text-pri` + `.record-name__meta.record-cell-text-sec` |
| Conversion | `record-lift` | 140px | `.record-cell-col` > `.record-cell-text-pri` |
| Actions | `record-meta` | 10rem+ | `.record-meta__links.record-cell-text-pri` > `<a>` links |

### Cell utility classes

- `.record-cell-col` — flex column layout
- `.record-cell-row` — flex row layout
- `.record-cell-text-pri` — primary text (14px, weight 600)
- `.record-cell-text-sec` — secondary/meta text (small, uppercase, gray)

### Stacked thumbnail pattern (multi-variant blocks)

```tsx
<div className="record-thumbnail-group-wrap record-thumbnail-group-wrap--multiple">
  {extraCount > 0 && <span className="record-thumbnail-extra-variant-count">+{extraCount}</span>}
  <StandaloneBlockPreview className="stacked-preview stacked-preview--back" content={raw} variantIndex={1} />
  <StandaloneBlockPreview className="stacked-preview stacked-preview--front" content={raw} variantIndex={0} />
</div>
```

### Skeleton rows

Use `record-placeholder` as the `<tr>` class, with the same `<td>` class names and `<Skeleton>` components inside. See `ListItemPlaceholder.tsx` for the reference pattern.

### Don't

- Don't create custom table SCSS files — reuse `List.scss`
- Don't use Tailwind utility classes for table cell layout (e.g. `!py-3 !px-4`) — the SCSS handles it
- Don't invent new class names like `experiment-thumbnail` — use the `record-*` conventions
