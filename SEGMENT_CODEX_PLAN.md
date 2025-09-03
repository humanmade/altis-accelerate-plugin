SEGMENT Analytics: Tactical Plan (Tasks)

Objectives
- Ensure strict compliance: no telemetry for opted-out users; consent honored.
- Stabilize foundation: correct ordering, standardized schema, externalized config.
- Expand coverage: instrument high-value product flows with reliable, useful events.
- Improve quality: add tests, validation, monitoring, and safe rollout controls.

Why These Objectives
- Compliance protects user privacy and legal posture; data gathered without consent cannot be trusted or used safely.
- Foundation work prevents silent data corruption (mis-identified users, out-of-order events) and reduces maintenance risk.
- Coverage expansion focuses on the highest leverage signals for product decisions (engagement, activation, errors).
- Quality gates ensure we don’t regress when the product evolves.

Scope
- Affects admin telemetry (Segment) in PHP and JS for this plugin only.
- Does not change the separate Altis analytics pipeline beyond consent reuse.

Assumptions
- We will treat telemetry as opt-in only (no anonymous tracking without explicit consent).
- We will integrate with the WordPress Consent API using the same categories as Altis Analytics.
- Separate Segment write keys per environment (dev/staging/prod) are available.

Phase Plan Overview
- Sprint 0 (Days 1–3): Compliance & gating fixes (must-pass blockers)
- Sprint 1 (Days 4–7): Schema standardization, ordering, and configuration hardening
- Sprint 2 (Week 2): Block Portal interactions + core error events
- Sprint 3 (Week 3): Block Editor lifecycle + validation errors
- Sprint 4 (Week 4): Activation/onboarding + performance telemetry
- Sprint 5 (Week 5): Advanced features + journey optimization

Sprint 0 — Compliance & Gating (Critical)
- Goals:
  - Do not load or send Segment for opted-out users or without consent.
  - Ensure identify/group precede first page/track.
 - Why:
   - Prevents privacy violations and restores user trust; avoids unusable/tainted datasets.
   - Guarantees downstream analysis ties events to the correct user and environment.
- Tasks:
  - PHP: Guard telemetry initialization
    - Update `inc/telemetry/namespace.php::initialize()` to return false when `! is_user_opted_in()` or consent is false; skip `Segment::init`, `identify`, `group` entirely.
    - Update `track(array $message)` to early-return when `! initialize()`.
  - PHP: Gate snippet load and pageview
    - Update `load_segment_js()` to bail for `! is_user_opted_in()` or missing consent; only `analytics.load()` when permitted.
    - Move first `analytics.page()` to run after identity (see JS ordering task) or wrap inside `analytics.ready`.
  - PHP: Alias only on opt-in
    - Ensure `opt_in(true)` triggers `Segment::alias` once and only when moving from anon → known.
  - JS: Client gating + readiness
    - Expose `Altis.Analytics.OptedIn` and `Altis.Analytics.ConsentOK` flags via inline script in `inc/analytics/namespace.php` (same envelope as existing Altis.Analytics object).
    - Update `src/utils/admin.ts::trackEvent()` to return early if flags are false and to wrap sends in `analytics.ready`.
  - Consent integration
    - Reuse WP Consent API config from `inc/analytics/namespace.php` and add a shared utility to read consent status for telemetry.
  - Tests (wp-phpunit)
    - Opted-out admin page output contains no Segment snippet or `analytics.page`.
    - Server calls: mock `Segment\Segment` to assert no `init/identify/group/track` when opted-out.
    - Ordered output: when opted-in, verify identity output precedes first page/track.
- Acceptance Criteria:
  - Zero client/server telemetry for opted-out users.
  - Consent toggle disables telemetry immediately.
  - First page/track occurs after identify/group and within `analytics.ready`.
 - What Changes In Code:
   - Conditional early returns in `initialize()` and `track()`; conditional snippet injection in `load_segment_js()`.
   - Identity rendered before first page/track; client wrapper enforces readiness and gating.
 - KPIs:
   - 0 events from opted-out sessions; 0 events before identify; error rate unchanged.

Sprint 1 — Schema, Ordering, Config
- Goals:
  - Standardize event naming and properties; enrich with shared context.
  - Externalize Segment write keys; ensure per-environment separation.
 - Why:
   - Consistent schemas reduce analyst friction, accelerate dashboards, and avoid rework.
   - External keys simplify rotation, isolate environments, and reduce incident blast radius.
- Tasks:
  - Event schema & catalog
    - Add `/docs/analytics-events.md` with canonical schema, required properties, and examples.
    - Adopt event naming: “<Module> <Action>” (e.g., “Experiments Start”).
    - Standard properties: `module`, `action`, `site_id`, `environment`, `plugin_version`.
  - Client enrichment
    - Add a small helper to append standard properties to every `track` call.
    - Deprecate raw `trackEvent(module, action, params)` over time; keep adapter for BC.
  - Ordering & readiness
    - Ensure client calls `analytics.identify` and optional `group` before first `page`/`track`.
    - Wrap initial sends in `analytics.ready(() => ...)`.
  - Config externalization
    - Update `get_segment_id()` to resolve from site option or env (`ALTIS_SEGMENT_ID`), with a non-production fallback only in local.
    - Add Admin note or README docs on write key rotation and environment keys.
  - CI checks
    - Add JSON Schema for events; include a dev script to validate payload shape in tests.
    - Add a simple PII detection check in dev (flag `email` in properties).
- Acceptance Criteria:
  - Schema documented and used by all new events.
  - Identify/group always precede page/track.
  - Separate keys per environment; production never uses the hardcoded default.
 - What Changes In Code:
   - New docs catalog; enrichment helper wrapping `analytics.track`/`trackEvent`.
   - `get_segment_id()` resolves via env/option; docs on rotation.
 - KPIs:
   - 100% new events pass schema validation; no prod usage of default key; analyst onboarding time reduced.

Sprint 2 — Block Portal + Core Errors
- Goals:
  - Instrument high-engagement portal interactions; capture core error states.
 - Why:
   - Portal is the highest-usage surface; these events drive insight into value delivery.
   - Error telemetry reveals friction and reliability gaps early.
- Tasks:
  - Events:
    - Portal period change: event “Block Portal Period Change” with `from_period`, `to_period`, `block_id`, `block_type`.
    - Variant switch: event “Block Portal Variant Switch” with `block_id`, `variant_index`, `total_variants`, `block_type`.
    - Test controls: “Experiments Start/Pause/Cancel” (existing) — align with schema.
    - Goal selection/update: “Block Portal Goal Change” with `from_goal`, `to_goal`.
  - Errors:
    - “Analytics Load Failed”, “Portal API Error” with `error_type`, `status`, `retry_count`.
  - Tests:
    - Verify events fire with required properties; schema validator passes.
    - Simulated error paths emit error events.
- Acceptance Criteria:
  - Coverage of period/variant/goal/test controls; error events present and consistent.
 - What Changes In Code:
   - Add `trackEvent` calls in portal components; add error hooks around API fetch and render.
 - KPIs:
   - % sessions with portal interactions; variant switch rates; error rate by endpoint; time-to-first-insight.

Sprint 3 — Block Editor Lifecycle + Validation Errors
- Goals:
  - Capture how users create/configure blocks; track validation issues.
 - Why:
   - Understanding creation and configuration patterns informs UX and documentation.
   - Validation error visibility reduces support load and speeds fixes.
- Tasks:
  - Events:
    - Block inserted/removed/duplicated; type switched (standard ↔ abtest ↔ personalization).
    - Block configuration change (specific settings keys summarized).
    - Audience assignment to blocks.
  - Errors:
    - Validation errors on save; config conflicts.
  - Tests: UI event paths generate valid payloads; error cases covered.
- Acceptance Criteria:
  - Editor lifecycle events captured with minimal noise; validation errors tracked.
 - What Changes In Code:
   - Hook into editor actions (insert/remove/switch/duplicate) and settings panels; emit validation failures.
 - KPIs:
   - Time-to-first-block; configuration change frequency; validation error rate and common fields.

Sprint 4 — Activation/Onboarding + Performance
- Goals:
  - Illuminate activation funnel; add basic performance telemetry.
 - Why:
   - Activation drives retention and monetization; performance issues erode both.
- Tasks:
  - Activation:
    - One-time milestones via `maybe_track_activation_event` (e.g., first audience/test/broadcast created; first publish using feature X).
    - Onboarding steps completion and drop-off points.
  - Performance:
    - Track slow loads (threshold-based), long tasks count, and key API latency buckets (non-PII).
  - Tests: Milestones dedupe correctly; performance events bounded and sampled.
- Acceptance Criteria:
  - Clear activation milestones; basic performance indicators available without over-collection.
 - What Changes In Code:
   - Extend `maybe_track_activation_event`; instrument onboarding steps; add lightweight perf timings/sampling.
 - KPIs:
   - Time-to-first-audience/test/broadcast; onboarding completion; p75 load time of key views.

Sprint 5 — Advanced Features + Journey Optimization
- Goals:
  - Measure deep feature usage; stitch journeys to identify value paths.
 - Why:
   - Reveals which advanced capabilities create outsized value and how users navigate to them.
- Tasks:
  - Advanced usage:
    - Personalization setup flow, broadcast pattern usage, audience rule editing sessions.
  - Journey signals:
    - Content Explorer deep interactions, cross-feature navigation sequences.
  - Tests: Representative flows emit complete, schema-compliant events.
- Acceptance Criteria:
  - Insightful coverage of advanced features and cross-feature journeys.
 - What Changes In Code:
   - Add events to personalization and audience-rule editors; add navigation trail identifiers.
 - KPIs:
   - Adoption and success rates of advanced features; common journey paths; drop-off points.

Risk Mitigation & Rollout
- Feature flag:
  - Add `altis.telemetry.strict_mode` (default on). When enabled, telemetry bails if gating or consent cannot be confirmed.
- Parallel validation:
  - In staging, optionally emit to a shadow Segment source for comparisons before promoting to production.
- Monitoring:
  - Add dev-only console logger for events; set up a simple Segment dashboard to watch volumes, required property presence, and error rates.
 - Why:
   - Flags enable safe rollback; shadowing prevents surprises; monitoring catches regressions quickly.

Testing Strategy (CI)
- Compliance tests: opt-out yields no client/server telemetry; consent gating enforced.
- Schema validation: JSON Schema validation for representative events.
- PII detection: dev-only checks for email/user_login in properties.
- Key rotation: ensure production builds resolve write key from env/option (not fallback).
 - Why:
   - Prevents silent regressions and enforces the guarantees that make analytics trustworthy.

Deliverables & Artifacts
- Updated PHP/JS code:
  - `inc/telemetry/namespace.php`: initialize, track, opt_in, load_segment_js changes.
  - `inc/analytics/namespace.php`: expose consent flags in Altis.Analytics; reuse consent config.
  - `src/utils/admin.ts`: gated, enriched `trackEvent` with `analytics.ready`.
- Docs:
  - `/docs/analytics-events.md` (schema + catalog).
  - README update: configuration (write keys), consent, and development notes.
- Tests:
  - wp-phpunit suite additions; optional lightweight schema validator.
 - Why:
   - Clear ownership and documentation reduce churn; tests lock in behavior.

Timeline Summary
- Days 1–3: Sprint 0 (compliance)
- Days 4–7: Sprint 1 (schema/ordering/config)
- Weeks 2–5: Sprints 2–5 (coverage expansion)

Acceptance Gates (per sprint)
- Sprint 0: All compliance tests pass; no telemetry when opted-out.
- Sprint 1: Schema finalized; enrichment active; ordering fixed; keys externalized.
- Sprints 2–5: Each sprint ships with passing schema validation and targeted tests.

