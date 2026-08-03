# PHP backend (`inc/`)

Subsystem-specific guardrails for the Accelerate PHP layer. Loads when Claude enters `inc/`.

## Hard rules

- **ClickHouse: never interpolate untrusted values.** Use `Utils\query()` with typed placeholders (`{post_id:String}`, `{since:UInt64}`). String concatenation into SQL is forbidden.
- **Asset loading: never enqueue manually.** Use `Utils\register_assets( $entrypoint, $options, $enqueue )`. Manifest-driven, integrates with the Asset_Loader plugin and WP externals/runtime.
- **Experiments stability is locked.**
  - The Bayesian P2BB ≥ 0.95 significance threshold is load-bearing — do **not** change significance logic without explicit approval.
  - `<ab-test>` element attributes and AB-related post-meta keys are part of the public contract — keep them stable.
- **Consent and preview gates must be honored.**
  - Respect `altis.analytics.noop` in previews (no events fire).
  - Check `altis.analytics.consent_enabled` before tracking.
  - Keep CDN override behavior intact in non-local environments.
- **Telemetry vs visitor analytics are separate.** Segment/PostHog product telemetry is for admin/dev signals only; visitor analytics is the ClickHouse pipeline. **No PII in either.** Don't add user emails, IPs, or content to events without an explicit privacy review.

## Conventions

- **Namespace.** Every module is `Altis\Accelerate\<Module>`. Each module has a `namespace.php` (bootstrap functions, hook registrations) and may add `class-*.php` (ORM models) or `rest_api/` subdirs.
- **Bootstrapping.** New modules wire in via `inc/namespace.php` → `bootstrap()`, gated by `Utils\is_feature_enabled( $feature )` where appropriate.
- **REST controllers.** Extend `WP_REST_Controller` (or `WP_REST_Posts_Controller` for post-backed resources). Namespace is `accelerate/v1`. Always supply a `permission_callback` — never `__return_true` on mutating routes.
- **Sanitization & nonces.** Standard WP: `sanitize_text_field`, `esc_html`, `esc_url`, `wp_verify_nonce`. Capability checks (`current_user_can`) on every admin action.

## Key helpers (`inc/utils/namespace.php`)

| Function | Purpose |
|----------|---------|
| `Utils\register_assets( $entrypoint, $options, $enqueue )` | Register/enqueue a webpack entrypoint via the asset manifest |
| `Utils\query( $sql, $params, $return, $body )` | ClickHouse query with typed placeholders; `$return` ∈ `'array'`, `'object'`, … |
| `Utils\is_feature_enabled( $feature )` | Check feature toggle (`audiences`, `experiments`, `export`, `blocks`, `dashboard`, `insights`) |
| `Utils\milliseconds()`, `Utils\date_in_milliseconds()` | Time helpers used throughout the analytics layer |

Call as namespaced functions (`Utils\query( … )`), **not** as static methods.

## Where to dig

- `inc/namespace.php` — plugin bootstrap, feature gating, ClickHouse constants (`ALTIS_CLICKHOUSE_HOST/PORT`)
- `inc/analytics/namespace.php` — event pipeline, consent/preview gates, client-side data shaping
- `inc/experiments/` — A/B test ORM (`class-experiment.php`), `Experiment_Query`, significance math (Math-PHP), cron backfill
- `inc/audiences/` — segmentation: custom post type, comparison operators, field maps
- `inc/global-blocks/` — synced patterns + variant storage; works with `inc/experiments/`
- `inc/abilities/` — WordPress Abilities API integration (MCP exposure). Discovery, execution, and integration abilities. Three-tier permissions: `can_view_analytics()` / `can_create_experiments()` / `can_manage_experiments()`
- `inc/admin/notices.php` — onboarding notice system (heading/body/image/CTA)
