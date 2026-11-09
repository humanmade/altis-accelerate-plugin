# AGENTS.md — Accelerate

WordPress plugin extending the block editor with analytics, A/B testing, and personalization. Owned by Human Made.

## Cross-cutting rules

These apply to **every** session in this repo. Subsystem-specific rules live in scoped AGENTS.md files (see end of this file) and load only when you enter that directory.

- **Never commit, push, or open PRs without explicit approval.**
- **Plan before non-trivial changes.** Show the plan, get confirmation, then act.
- **Simplicity over cleverness.** Smallest diff that solves the problem. Don't refactor adjacent code, don't add abstractions for hypothetical futures, don't churn dependencies.
- **Don't introduce new `styled-components`.** Use Tailwind className strings. The handful of legacy styled-components (`modal.tsx`, `edit.tsx`, `estimate.tsx`) are exceptions — leave them alone unless explicitly refactoring them.
- **React comes from WordPress.** Never bundle React directly. Import from `@wordpress/element`.
- **Brand color is `#9332FF`** but **never hardcode it**. Use `text-brand` / `bg-brand` (Tailwind) or `$acc-brand` (SCSS). Token name is `--color-brand`. `--color-accent` is shadcn's hover gray — different thing, do not confuse.
- **Final newlines on all text files** (`.md`, `.yml`, `.json`, `.sh`, source files).
- **Visitor analytics is privacy-sensitive.** No PII in logs or events. Respect consent and preview gates (see `inc/AGENTS.md`).

## Stack

PHP 7.4+ (`Altis\Accelerate` namespace, Composer, WP-VIP-Go standards) · React/TS via `@wordpress/element` · Webpack · SCSS + Tailwind v4 (scoped to `.tailwind` containers via `postcss-prefix-selector`) · ClickHouse for analytics · Docker Compose (WP on :8081, Grafana on :3600) · PHPUnit + Playwright.

## Where to start reading

| Concern | Entry point |
|---------|-------------|
| Design principles, product North Star | `PRINCIPLES.md` |
| Plugin bootstrap, feature toggles | `plugin.php`, `inc/namespace.php` |
| PHP backend conventions | `inc/AGENTS.md` |
| Frontend architecture, shared libs | `src/AGENTS.md` |
| Admin app (Content Explorer, Audiences, etc.) | `src/accelerate/AGENTS.md` |
| shadcn primitives + critical UI rules | `src/components/ui/AGENTS.md` |
| Tests | `tests/AGENTS.md` |
| Block editor portal injection | `src/global-blocks/index.js` |
| Analytics + ClickHouse pipeline | `inc/analytics/namespace.php` |
| A/B testing significance | `inc/experiments/` |

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

### Local tester zip

`bin/make-zip.sh` (git-ignored, local-only) builds a distributable `dist/altis-accelerate.zip` from **tracked files only** via `git archive`, then strips internal docs (`AGENTS.md`, `HANDOVER.md`, `PRINCIPLES.md`, `docs/`, `.claude/`, `.mcp.json`). This mirrors how the plugin ships — a source package, no `vendor/`/`build/`. Add `--runnable` to also bundle prod `vendor/` + built assets for an install-ready zip. **Never package a zip by rsyncing the working tree** — that leaks untracked personal/AI files; `git archive` is the only safe base.

## External services

| | URL |
|---|---|
| Analytics API | `https://eu.accelerate.altis.cloud/` |
| Dashboard | `https://www.accelerateplugin.com/` |
| Data hosting | EU (Frankfurt) — 90-day retention |

## Scoped AGENTS.md map

Progressive disclosure: these load only when you enter the directory. Don't duplicate their rules here.

- `inc/AGENTS.md` — PHP backend (Utils helpers, ClickHouse safety, REST, experiments, consent)
- `src/AGENTS.md` — Frontend architecture, shared libs/types/components, portal patterns
- `src/accelerate/AGENTS.md` — Admin app SCSS conventions (`$acc-*`), `.accelerate-ui` scoping
- `src/components/AGENTS.md` — Shared compounds (`MetricTile`, `CompactSelect`, row-treatment contract)
- `src/components/ui/AGENTS.md` — shadcn primitives, Tailwind scoping rules, WP CSS overrides
- `tests/AGENTS.md` — PHPUnit + Playwright setup
