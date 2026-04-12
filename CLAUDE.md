# CLAUDE.md — Accelerate

WordPress plugin extending the block editor with analytics, A/B testing, and personalization. Owned by Human Made.

## Cross-cutting rules

These apply to **every** session in this repo. Subsystem-specific rules live in sub-CLAUDE.md files (see end of this file) and load only when you enter that directory.

- **Never commit, push, or open PRs without explicit approval.**
- **Plan before non-trivial changes.** Show the plan, get confirmation, then act.
- **Simplicity over cleverness.** Smallest diff that solves the problem. Don't refactor adjacent code, don't add abstractions for hypothetical futures, don't churn dependencies.
- **Don't introduce new `styled-components`.** Use Tailwind className strings. The handful of legacy styled-components (`modal.tsx`, `edit.tsx`, `estimate.tsx`) are exceptions — leave them alone unless explicitly refactoring them.
- **React comes from WordPress.** Never bundle React directly. Import from `@wordpress/element`.
- **Brand color is `#9332FF`** but **never hardcode it**. Use `text-brand` / `bg-brand` (Tailwind) or `$acc-brand` (SCSS). Token name is `--color-brand`. `--color-accent` is shadcn's hover gray — different thing, do not confuse.
- **Final newlines on all text files** (`.md`, `.yml`, `.json`, `.sh`, source files).
- **Visitor analytics is privacy-sensitive.** No PII in logs or events. Respect consent and preview gates (see `inc/CLAUDE.md`).

## Stack

PHP 7.4+ (`Altis\Accelerate` namespace, Composer, WP-VIP-Go standards) · React/TS via `@wordpress/element` · Webpack · SCSS + Tailwind v4 (scoped to `.tailwind` containers via `postcss-prefix-selector`) · ClickHouse for analytics · Docker Compose (WP on :8081, Grafana on :3600) · PHPUnit + Playwright.

## Where to start reading

| Concern | Entry point |
|---------|-------------|
| Plugin bootstrap, feature toggles | `plugin.php`, `inc/namespace.php` |
| PHP backend conventions | `inc/CLAUDE.md` |
| Frontend architecture, shared libs | `src/CLAUDE.md` |
| Admin app (Content Explorer, Audiences, etc.) | `src/accelerate/CLAUDE.md` |
| shadcn primitives + critical UI rules | `src/components/ui/CLAUDE.md` |
| Tests | `tests/CLAUDE.md` |
| Block editor portal injection | `src/global-blocks/index.js` |
| Analytics + ClickHouse pipeline | `inc/analytics/namespace.php` |
| A/B testing significance | `inc/experiments/` |

## Slash-command skills (`.claude/skills/`)

| Skill | Purpose |
|-------|---------|
| `/accelerate` | Analytics insights + A/B test & personalization recommendations |
| `/accelerate-brief` | Morning dashboard of site performance & opportunities |
| `/accelerate-diagnose <url>` | Diagnose a customer's Accelerate install from a live URL. **Keep updated** when analytics pipeline code changes. |
| `/create-site` | Spin up an InstaWP test site with Accelerate |

## Commands

```bash
composer start          # Start Docker stack
composer build-deps     # Install deps + build
npm start               # Dev build, watch
npm run build           # Production build
npm run lint            # JS + PHP
npx eslint ./src --fix  # Auto-fix JS lint after edits
composer phpunit        # PHP tests
npm run playwright      # E2E
```

3 pre-existing build warnings (pagination a11y, unused vars in `global-blocks/index.js`) — not new.

## External services

| | URL |
|---|---|
| Analytics API | `https://eu.accelerate.altis.cloud/` |
| Dashboard | `https://www.accelerateplugin.com/` |
| Data hosting | EU (Frankfurt) — 90-day retention |

## Sub-CLAUDE.md map

Progressive disclosure: these load only when you enter the directory. Don't duplicate their rules here.

- `inc/CLAUDE.md` — PHP backend (Utils helpers, ClickHouse safety, REST, experiments, consent)
- `src/CLAUDE.md` — Frontend architecture, shared libs/types/components, portal patterns
- `src/accelerate/CLAUDE.md` — Admin app SCSS conventions (`$acc-*`), `.accelerate-ui` scoping
- `src/components/ui/CLAUDE.md` — shadcn primitives, Tailwind scoping rules, WP CSS overrides
- `tests/CLAUDE.md` — PHPUnit + Playwright setup
