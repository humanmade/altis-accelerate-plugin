# CLAUDE.md for Accelerate WordPress Plugin

## Project Overview

**Accelerate** is a sophisticated WordPress plugin that extends the block editor with marketing capabilities including analytics, A/B testing, and personalization. Developed by Human Made, it integrates with a cloud analytics service to provide block-level insights and content optimization tools.

### Key Features
- Synced Patterns/Blocks with analytics
- Native block-level A/B testing
- Content personalization with audience targeting
- Broadcast blocks for content promotion
- Content Explorer dashboard
- GDPR-compliant analytics with EU data hosting

## Architecture & Tech Stack

### Backend (PHP)
- **Framework**: WordPress 6.4+ plugin architecture
- **PHP Version**: 7.4+ with modern type hints
- **Namespace**: `Altis\Accelerate`
- **Dependencies**: Composer managed (Guzzle, Math-PHP, Segment Analytics)
- **Standards**: WordPress-VIP-Go coding standards

### Frontend (JavaScript/TypeScript)
- **Framework**: WordPress React (via `@wordpress/element`) + TypeScript
- **State Management**: WordPress Data API (@wordpress/data)
- **UI Components**: WordPress Components (@wordpress/components)
- **Build System**: Webpack with Human Made helpers
- **Styling**: SCSS + Tailwind CSS with scoped preflight

### Development Environment
- **Local Setup**: Docker Compose (WordPress + ClickHouse + Grafana)
- **Database**: ClickHouse for analytics data
- **Testing**: PHPUnit + Playwright E2E tests
- **Linting**: PHPCS + ESLint

## File Structure

```
accelerate/
├── plugin.php                 # Main plugin file
├── inc/                       # PHP source code
│   ├── namespace.php          # Bootstrap functions
│   ├── admin/                 # Admin interface
│   ├── analytics/             # Analytics integration
│   ├── audiences/             # Audience management
│   ├── blocks/                # Block functionality
│   ├── dashboard/             # Analytics dashboard
│   ├── experiments/           # A/B testing
│   └── global-blocks/         # Synced patterns
├── src/                       # Frontend source (React/TS)
│   ├── accelerate/            # Main admin interface
│   ├── audiences/             # Audience management UI
│   ├── components/            # Shared compound components (SearchField, EmptyState, etc.)
│   │   └── ui/                # shadcn primitives (button, input, skeleton, typography, etc.)
│   ├── dashboard/             # Analytics dashboard UI
│   ├── global-blocks/         # Block editor extensions
│   ├── lib/                   # Shared utilities (utils, motion tokens, portal helper)
│   └── types/                 # Shared TypeScript types (DataState, etc.)
├── build/                     # Compiled assets
├── .config/                   # Build configuration
├── tests/                     # Test suites
└── vendor/                    # PHP dependencies
```

## Development Workflow

### Local Development Setup
```bash
# Start development environment
composer start

# Install dependencies and build
composer build-deps

# Development server with hot reload
npm start

# Run tests
composer phpunit
npm run playwright
```

### Build Commands
```bash
# Development build with watch
npm start

# Production build
npm run build

# Linting
npm run lint          # JS + PHP
npm run lint:php      # PHP only
npm run lint:js       # JS only

# Auto-fix linting issues (recommended after code changes)
npx eslint ./src --fix
```

## Tailwind v4 + shadcn/ui Guide

**CRITICAL**: Tailwind is scoped to `.tailwind` containers via `postcss-prefix-selector`. All styles only work inside `.tailwind` wrappers.

### Rules
1. **Wrap components**: Any component using Tailwind/shadcn MUST be inside `<div className="tailwind">`
2. **Portals**: Radix portals (dropdowns, modals) render to body. All shadcn portal components use `getPortalContainer()` from `@/lib/portal` internally. Only import it yourself if building a custom portal component.
3. **Theme colors**: Defined in `src/tailwind.css` `@theme` block using oklch or hex
4. **Border color**: Default is `var(--color-border)` (light gray), NOT `currentColor`
5. **Foreground color**: Use `#1d2327` (WP admin dark) for text, not pure black
6. **Brand color**: Use `text-brand` / `bg-brand` for Accelerate purple (#9332FF). Never hardcode `#9332FF` — use the `--color-brand` token

### Adding shadcn Components
```bash
npx shadcn@latest add [component] --legacy-peer-deps
```
Then update the component's Portal (if any) to use `getPortalContainer()`.

### Files
- `src/tailwind.css` - Theme variables + scoped preflight
- `src/components/ui/` - shadcn components (see [`src/components/ui/CLAUDE.md`](src/components/ui/CLAUDE.md) for full component guide)
- `postcss.config.js` - Scoping config (don't touch)

### Docker Services
- **WordPress**: Main application (port 8081)
- **ClickHouse**: Analytics database
- **Grafana**: Analytics visualization (port 3600)

## Key Components

### Plugin Bootstrap (`inc/namespace.php`)
- Loads asset-loader plugin, configures cloud service constants, conditionally loads feature modules

### Admin Interface (`src/accelerate/`)
- React-based admin dashboard with Redux store, content explorer, block management

### Analytics System (`inc/analytics/`)
- Event tracking, ClickHouse connection, GDPR-compliant data collection

### Block Extensions (`src/global-blocks/`)
- Enhanced synced patterns, A/B testing variants, personalization controls, broadcast functionality

### Onboarding (`inc/admin/notices.php`)
- Dismissible page notifications, centralized notice system with heading/body/image/CTA support

## API Integration

### External Services
- **Analytics API**: `https://eu.accelerate.altis.cloud/`
- **Dashboard**: `https://www.accelerateplugin.com/`
- **Data Hosting**: EU (Frankfurt, Germany)
- **Retention**: 90-day automatic deletion

### Authentication
- OAuth2 integration with Accelerate dashboard
- Token-based API authentication
- Admin capability checks for WordPress users

## Security Considerations

### WordPress Security
- Nonce verification for forms (`wp_nonce_field`, `wp_verify_nonce`)
- Input sanitization (`sanitize_text_field`, `esc_html`, `esc_url`)
- Capability checks for admin functions
- CSRF protection on critical operations

### Data Privacy
- GDPR compliant (EU data hosting)
- No third-party data sharing
- Visitor consent handling
- Business-to-business data processing agreements

## Common Development Tasks

### Adding New Features
1. Create PHP namespace in `inc/[feature]/`
2. Add React components in `src/[feature]/`
3. Register webpack entry point in build config
4. Add feature toggle in `configure_features()`
5. Include in plugin bootstrap

### Block Development
1. Create block definition in `inc/blocks/[name]/`
2. Add React edit component in `src/blocks/[name]/`
3. Register block in `block.json`
4. Add to webpack entries

### API Endpoints
1. Create controller in `inc/[module]/rest_api/`
2. Extend `WP_REST_Controller`
3. Register routes in namespace bootstrap
4. Add permission callbacks

## Implementation Guardrails

- Assets: use `Utils::register_assets($entrypoint, $options, $enqueue)`; avoid manual enqueues; rely on WP externals/runtime.
- ClickHouse: use `Utils::query($sql, $params, $return)` with typed placeholders (e.g., `{since:UInt64}`); do not interpolate untrusted values.
- Consent/preview: respect `altis.analytics.noop` in previews and `altis.analytics.consent_enabled`; keep CDN override in non‑local.
- Experiments: keep `<ab-test>` attributes and AB meta keys stable; do not change significance logic (binomial p < 0.01) without approval.
- Telemetry: Segment (admin/product) is separate from visitor analytics; avoid adding PII logging.
- Portals: insert after last `.components-notice-list` when present; always wrap in `.tailwind`; remove portal node on unmount.
- React: do not bundle React; import from WordPress via `@wordpress/element`.
- Shared UI: reuse `PeriodChips`, `HeaderRow`, and `ViewsMetric` for header UIs; do not reimplement chips or metrics per-surface. Chips intentionally use native `<button>` for spacing parity.
- Buttons: use shadcn `Button` (`@/components/ui/button`) in admin surfaces; `@wordpress/components` Button is only OK inside the block editor. Do not mix both in the same file.
- Typography: use `CardTitle`, `SectionTitle`, `Caption`, etc. (`@/components/ui/typography`) instead of inline text classes like `text-sm font-semibold`. Typography components have `!important` overrides baked in for WP admin protection.
- Empty states: use `EmptyState` (`@/components/EmptyState`) or `DataContainer` for loading/empty/error states. No inline "No results found" text.
- Styling: do not introduce new `styled-components`. Use Tailwind className strings instead. Existing styled-components in `modal.tsx`, `edit.tsx`, and `estimate.tsx` are legacy exceptions.
- Color tokens: `--color-brand` (#9332FF) is Accelerate purple; `--color-accent` is shadcn's hover gray — do not confuse them. See `src/components/ui/CLAUDE.md` for the full theme color reference.
