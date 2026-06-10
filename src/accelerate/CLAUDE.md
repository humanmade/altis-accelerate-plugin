# Admin app (`src/accelerate/`)

The Accelerate admin surface — Content Explorer, Audiences, Broadcasts, Settings. SCSS-first with `$acc-*` tokens. Loads when Claude enters this directory.

## Hard rules

- **All SCSS variables in this project use the `$acc-*` prefix.** Defined in `src/accelerate/variables.scss`. Don't introduce new bare `$gray-*`, `$brand-*`, etc. — they collide with WordPress Gutenberg's globals which are also imported in this file.
- **`$acc-slate-*` is intentionally blue-tinted (HSL 218°) — NOT neutral gray.** It's for editor UI only. If you need neutral gray, use `$acc-gray-*` (HSL 0°, 0% saturation). Mixing them up is the most common mistake here.
- **`$acc-charcoal` / `$acc-charcoal-hover`** are the primary action colors (`#1d2327` / `#2c3338`). They align with Tailwind's `--color-primary`. Never hardcode these hex values — use the tokens.
- **Use shadcn `Button` here, never `@wordpress/components` Button.** This is admin land, not block-editor land.
- **Use the typography components** (`@/components/ui/typography`) for text. The admin app inherits WP admin's aggressive base styles, so raw `text-*` classes often fail without `!`.

## Token reference (`src/accelerate/variables.scss`)

| Group | Tokens | Notes |
|-------|--------|-------|
| Brand | `$acc-brand`, `$acc-brand-hover`, `$acc-brand-light`, `$acc-brand-lighter` | Purple `#9332FF` — links, toggles, brand accents |
| Charcoal | `$acc-charcoal`, `$acc-charcoal-hover` | Primary action / button color |
| Slate (blue) | `$acc-slate-10/25/50/75/200/300` | Editor UI only — `$acc-slate-300` is **dark navy**, not gray |
| Gray (neutral) | `$acc-gray-50/100/150/200/400/600` | Pure neutral grays |
| Semantic | `$acc-positive`, `$acc-positive-light`, `$acc-negative`, `$acc-negative-light` | Success / error |

## Sub-files

This module's SCSS lives alongside the React. The `$acc-*` token rules above are the only admin-specific rules — everything else inherits from `src/CLAUDE.md` and `src/components/ui/CLAUDE.md`.
