# shadcn/ui Components

These are shared components used across all Accelerate admin pages (Content Explorer, Audiences, Broadcasts, Settings). They are based on shadcn/ui but modified for this project.

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

Components with portals (DropdownMenu, Popover, Dialog) render to `document.body` by default, losing Tailwind styles. Use `getPortalContainer()`:

```tsx
import { getPortalContainer } from '@/components/ui/dropdown-menu';

<DropdownMenuContent container={getPortalContainer()}>
```

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

### Input with Search Icon
```tsx
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input className="w-80 pl-9" placeholder="Search..." />
</div>
```

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
  getPortalContainer,
} from '@/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent container={getPortalContainer()}>
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
│   └── switch.tsx
├── ListRow.tsx            # Compound: combines primitives
├── SearchBar.tsx          # Compound: input + icon + styling
└── StatusToggle.tsx       # Compound: switch + label + states
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
- Compounds: PascalCase (`ListRow.tsx`, `SearchBar.tsx`)

## Theme Colors

Defined in `src/tailwind.css` under `@theme`. Key semantic colors:
- `text-foreground` - Primary text (#1d2327, WP admin dark)
- `text-muted-foreground` - Secondary/gray text
- `border-border` - Standard border color
- `bg-background` - Page background
- `bg-muted` - Subtle background for hover states
- `text-destructive` - Red for delete/error actions
