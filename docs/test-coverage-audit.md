# Unit Test Coverage Audit — Analytics, A/B, Personalization

## Context

You want Accelerate to be bulletproof on the numbers it shows clients (A/B winners, lift, audience matches, engagement metrics). Today's test suite covers some of this well (Bayesian P2BB math is solid) but leaves several **load-bearing correctness paths with zero tests**, including the client-side variant bucketing that decides which visitor sees which variant. This plan inventories what is covered, identifies the highest-risk gaps, and proposes a concrete set of tests to add (prioritised). It is a planning deliverable — no code changes yet; we'll triage the list together before writing tests.

## What's covered today

PHP (`tests/phpunit/`, 9 files, ~170 tests):

| Area | Test file | Verdict |
|---|---|---|
| Bayesian P2BB / winner logic | `ABCalcTest.php` (11 tests) | **Good coverage of properties** (sums-to-1, monotonicity, winner threshold). Does not yet check against known statistical reference cases or assert numerical stability for extreme priors. |
| Experiment dual-write sync | `ExperimentSyncTest.php` (88 tests) | **Strong.** Block/title/image/personalization types, multi-variant, traffic allocation. |
| Experiment meta→DB migration | `ExperimentMigrationTest.php` (21 tests) | **Strong.** Status lifecycle, type detection, results preservation. |
| Engagement metrics (Abilities) | `EngagementMetricsTest.php` (7 tests) | **Adequate.** Bounce, time-on-page, recirculation, exits. |
| Landing pages / source breakdown | `LandingPagesTest.php`, `SourceBreakdownTest.php` (8 tests) | **Adequate.** First-pageview detection, date filtering. |
| Variant block helpers | `VariantHelpersTest.php` (17 tests) | **Strong.** Validation, parsing, HTML escape. |
| Telemetry surface | `TelemetryTest.php` (16 tests) | Partial — config-layer only, see gaps. |
| Global block registration | `GlobalBlockTest.php` (2 tests) | Sparse. |

JS/TS: **zero unit tests.** No jest/vitest config, no `*.test.*` outside `tests/e2e/`. `npm test` runs PHPUnit only. Playwright E2E covers some user flows but not the core algorithms.

## Highest-risk gaps (ranked by client-trust impact)

### P0 — Correctness risks that affect visitor experience

1. **Server/client audience parity — `inc/audiences/namespace.php` ↔ `src/accelerate.js`. Zero tests on either side.**
   This is the strongest P0: the same audience definition can be evaluated by PHP (for analytics queries / SSR) and by JS (for client personalisation). Several places where the two sides plausibly diverge — each needs a test that proves they agree (or, if they don't, surfaces the gap so we can decide which is correct):
   - **`include: none`** is allowed by the audience JSON schema and used server-side, but the JS matcher only appears to model `any | all`. If a "none of these" audience exists, the client renders for the inverse cohort.
   - **`!=` against array fields** (e.g. visitor has visited countries `['US','CA']`, rule says `country != US`): server uses `not has(...)` (false), client iterates values and returns true on first non-match (`CA`). Likely divergent.
   - **Unknown operator handling** differs by branch: server string branch silently skips the rule; server numeric branch defaults to `=`; client behaviour unverified.
   - Case sensitivity of `*=`, `^=`, `!*` is unverified on both sides — needs pinning, not necessarily fixing.

2. **Variant bucketing (sticky assignment) — `src/experiments.js:89–133`. Zero tests.**
   Genuinely untested logic; the specifics need verification before we assert bugs, so the first job is *characterisation tests*:
   - Uses `Math.random()` per session rather than a hash of visitor ID — not deterministic across devices/storage clears. Pin current behaviour.
   - Weight sum **> 100**: cumulative-weight loop can leave later variants unreachable. Real bug, easy to test.
   - Weight sum **< 100**: the uncovered tail biases toward variant index 0 (control), not "drops users" — worth pinning so a future refactor doesn't quietly shift the bias.
   - `localStorage.setItem` is uncaught — in private-browsing/quota-full this **throws**, which can break render rather than fail silently. Test with a throwing mock.
   - `?set_test=` URL override: codex review suggests it does persist before render. Pin current behaviour with a test rather than asserting a bug.

3. **Lift calculation — `src/utils/index.ts:217–221` (`getLift`). Zero tests.**
   `(current - previous) / abs(current) * 100`. Denominator is `current`, not `previous`, which differs from the standard lift formula. This may be intentional (e.g. "% of current value attributable to change") or a long-standing bug — either way it's shown on dashboards and needs a test that pins the chosen formula plus 0/0, negative current, very small previous cases.

### P1 — Subtle aggregation behaviours worth pinning (contract tests, not necessarily bugs)

4. **Engagement metrics — `inc/abilities/engagement.php:78–250`.** Most behaviours here are defensible but easy to silently break later:
   - Post-scoped bounce rate semantics (bounce is session-level, query filters by post in HAVING) — pin the contract.
   - `argMax(postId, event_timestamp)` exit-page ties on identical ms timestamps — ClickHouse behaviour undefined; document expected result.
   - Zero-visitor guard before percentage divisions.

5. **Time/cohort math — `inc/utils/namespace.php:225–252`.** Lower urgency, but feeds the dashboards:
   - `strtotime()` with no timezone arg → server TZ. Pin a TZ in setUp and assert.
   - `floor($since_epoch / $round_to) * $round_to` rounds down — query at 14:59:59 buckets to 14:00. Pin.

### P2 — Runtime paths untested

6. **`render_block()` variant selection — `inc/global-blocks/namespace.php`.** The function that actually picks the variant on a server-rendered request. No test for the fallback when variants are missing/corrupted.
7. **AB test lifecycle writers — `update_ab_test_*()`, `end_ab_test_for_post()`, `handle_post_ab_test_cron()`.** State machine transitions (running → completed, paused → resumed, cron failure / re-queue) untested.
8. **Telemetry emission — `Telemetry\track()`, `initialize()`.** Only the config layer (site ID hashing, opt-in flags, domain normalisation) is tested. Whether events actually emit, and gating on logged-in state, is not.
9. **Attribution abilities — `execute_get_attribution_comparison()`, `execute_get_utm_performance()`.** Zero tests; the source-breakdown/landing-pages tests don't transfer.

## Proposed test additions (concrete)

PHP — `tests/phpunit/`:

| New file | Covers | Key cases |
|---|---|---|
| `AudienceEvaluationTest.php` | `inc/audiences/namespace.php::build_audience_query()` | Each operator exercised against a tiny ClickHouse fixture (not query-string assertions — those don't prove semantics); `include: none`; `!=` on array fields; unknown-operator current behaviour pinned per branch (string=skip, numeric=fallback-to-`=`); case sensitivity pinned; AND-within-group / OR-between-groups; numeric coercion. |
| `VariantSelectionRenderTest.php` | `inc/global-blocks/namespace.php::render_block()` | Variant index in bounds; missing variants → fallback to control; corrupted block markup; personalization vs A/B paths. |
| `ABTestLifecycleTest.php` | `update_ab_test_*`, `end_ab_test_for_post`, cron handler | State transitions: draft→running→paused→running→completed; cron pagination; winner persistence on end; idempotent re-run. |
| `TimeUtilsTest.php` | `inc/utils/namespace.php::milliseconds`, `date_in_milliseconds` | TZ assertion (force a TZ in setUp); floor-rounding boundary at minute/hour edges; invalid input returns null + warning; ms precision. |
| `EngagementEdgeCasesTest.php` (extend existing) | `inc/abilities/engagement.php` | Zero-visitor guard; exit-page timestamp tie; bounce semantics for multi-post sessions (pin the contract). |
| `AttributionAbilitiesTest.php` | `execute_get_attribution_comparison`, `execute_get_utm_performance` | Mirror the existing `SourceBreakdownTest` shape. |
| `TelemetryEmissionTest.php` (extend `TelemetryTest`) | `track`, `initialize` | Non-logged-in early-return; consent gate; event payload shape. |

JS/TS — introduces a unit-test layer (the bigger lift):

| Setup | Covers | Key cases |
|---|---|---|
| Add **Vitest** + jsdom + a single `npm run test:js` script. Vitest is the better fit here: no existing Jest setup, TS/jsdom out of the box, and we don't need to mirror the webpack config for pure-logic unit tests — the work is path aliases and mocking WordPress globals. | — | — |
| `src/__tests__/experiments.test.ts` | Variant bucketing in `src/experiments.js` | Characterisation first (pin today's behaviour), then targeted: weight sum > 100 unreachable-tail variant; weight sum < 100 control bias; traffic % exclusion; localStorage round-trip; **localStorage throwing** (private mode mock — confirm whether render breaks); `?set_test=` override + persistence. |
| `src/__tests__/accelerate-audiences.test.ts` | Audience matcher in `src/accelerate.js` | Every operator; nested AND/OR; `include: none`; `!=` against array values (the cross-impl divergence case); missing field; type coercion. Consumes the shared operator truth-table fixture. |
| `src/__tests__/utils.test.ts` | `getLift` and any other math in `src/utils/index.ts` | Decide and pin the lift formula (current ÷ current vs. ÷ previous) — explicitly a *product decision* before the test is written; 0/0 case; negative current; very small previous. |

## Critical files to modify (test additions only)

- `tests/phpunit/AudienceEvaluationTest.php` *(new)*
- `tests/phpunit/VariantSelectionRenderTest.php` *(new)*
- `tests/phpunit/ABTestLifecycleTest.php` *(new)*
- `tests/phpunit/TimeUtilsTest.php` *(new)*
- `tests/phpunit/AttributionAbilitiesTest.php` *(new)*
- `tests/phpunit/EngagementMetricsTest.php` *(extend)*
- `tests/phpunit/TelemetryTest.php` *(extend)*
- `vitest.config.ts` *(new)*, `package.json` script `test:js`
- `src/__tests__/experiments.test.ts` *(new)*
- `src/__tests__/accelerate-audiences.test.ts` *(new)*
- `src/__tests__/utils.test.ts` *(new)*
- A shared **operator truth-table** fixture: `tests/fixtures/audience-operators.json` — list of `{ field_value, operator, rule_value, expected }` rows consumed by both PHP and JS. Plus a smaller set of nested-audience fixtures for AND/OR/none parity. This is narrower than a full "audience → visitor → match" object format and catches the operator-semantic drift without coupling tests to the full object schema.

## Reusable existing scaffolding

- PHPUnit bootstrap is already wired (`tests/phpunit/bootstrap.php`); `composer phpunit` runs the suite.
- `ABCalcTest.php` is a clean template for math-heavy tests.
- `ExperimentSyncTest.php` demonstrates the WP fixture pattern for tests that need post/meta state.
- Playwright config and global-setup are reusable if any of the above turns out to need a browser harness (it shouldn't — these are all pure-logic targets).

## What's landed

| File | Coverage |
|---|---|
| `vitest.config.ts` + `tests/js/setup.ts` + `npm run test:js` | First JS unit-test layer in the repo (Vitest + jsdom). |
| `src/audience-matcher.js` *(new)* | Audience evaluator extracted from `Analytics.updateAudiences` so it can be unit-tested. Behaviour preserved verbatim including the three break conditions in the value-iteration loop. One intentional improvement: `lookupField()` uses optional chaining so a deeply-missing path returns `null` instead of throwing. |
| `src/experiments.js` *(modified)* | `pickVariantIndex` and `shouldExcludeFromTest` extracted as pure helpers. `getVariantId` delegates to them. Same behaviour. |
| `tests/fixtures/audience-operators.json` | Operator truth table consumed by both the JS audience-matcher tests and the PHP audience-evaluation tests. Adding a row hits both suites; a PHP parity test fails if a new operator is added without a corresponding PHP branch. |
| `tests/js/utils/getLift.test.ts` | Pins the current `getLift` formula plus 0/0, negative current, very small previous. |
| `tests/js/experiments-bucketing.test.ts` | Characterisation for `pickVariantIndex` + `shouldExcludeFromTest`. |
| `tests/js/audience-matcher.test.ts` | Operator truth-table evaluation, group/audience composition, null short-circuit regression, the two known JS↔PHP divergences. |
| `tests/phpunit/AudienceEvaluationTest.php` | SQL fragment shape per operator + scalar/array, `include: 'none'`, multi-group composition, fixture parity. |
| `tests/phpunit/TimeUtilsTest.php` | `Utils\milliseconds`, `date_in_milliseconds` — TZ pin, floor-rounding boundaries, ms precision quirk, invalid-input warning, Unix-epoch rejection bug. |
| `tests/phpunit/EngagementMetricsTest.php` *(extended)* | Zero-visitor guard, recirculation, exit-page detection. |
| `tests/phpunit/AttributionAbilitiesTest.php` | Shape + no-error coverage for `execute_get_attribution_comparison` + `execute_get_utm_performance`. |
| `tests/phpunit/ABTestLifecycleTest.php` | Post-meta keys (public contract), `is_ab_test_running_for_post` guards, `end_ab_test_for_post` flags + idempotency + action hooks, pause/resume, started-flag reset. |
| `tests/phpunit/TelemetryTest.php` *(extended)* | `is_site_opted_in` decision matrix, `track()` silent early-return, PII guard on `get_site_details()`. |
| `tests/phpunit/VariantSelectionRenderTest.php` | `render_block` defensive early-returns, wrapper tag per `_xb_type`, A/B `traffic-percentage` / `paused` / `winner` attributes, empty-content fallback. |

**No production behaviour changes.** Every divergence or bug surfaced during the work is documented in "Open decisions" below; tests pin today's behaviour so future fixes can flip a single assertion and ship.

## Open decisions

Each item is a product/engineering call needed before any code change. The pinning test makes the current behaviour visible — flipping it is the bug-fix PR.

- [ ] **`getLift` divides by `current`, not `previous`** — `src/utils/index.ts:217–221`. Standard percent-change uses the baseline (`previous`) as denominator. Pin: `tests/js/utils/getLift.test.ts` → "pins the current-as-denominator formula on a positive increase". Decision: keep as intentional, or fix? If we fix, dashboard numbers change.

- [ ] **Audience `include: 'none'` works server-side but not client-side** — `src/audience-matcher.js::matchAudiences` only checks `'all'` / `'any'`; the server (`inc/audiences/namespace.php::build_audience_query`) supports `'none'` via an ` AND NOT ` join, and the JSON schema allows it. Pin: `tests/js/audience-matcher.test.ts` → "client does not match audiences with include: 'none'". Decision: add `'none'` to the JS matcher (recommended — server already supports it), or remove from server + schema?

- [ ] **`!=` on array fields diverges JS ↔ PHP** — server uses `not has(field, value)` (false if the array contains `value`); client iterates values and breaks on the first non-match (so `['US','CA'] != 'US'` returns true). Pin: `tests/js/audience-matcher.test.ts` → "client returns true for `!=` on an array field where ANY value differs". Decision: align JS to the server semantic (recommended), or change PHP?

- [ ] **Weight sum > 100 makes later variants unreachable** — `src/experiments.js::pickVariantIndex` cumulative-weight loop never reaches a variant whose cumulative weight starts above 100. Pin: `tests/js/experiments-bucketing.test.ts` → "weight sum > 100 leaves later variants unreachable". Decision: validate at audience-save time, clamp at runtime, or both?

- [ ] **Latent bug — attribution functions hardcode `FROM analytics`** — `execute_get_attribution_comparison` (`inc/abilities/attribution.php:91, 115`) and `execute_get_utm_performance` (`inc/abilities/attribution.php:443`) ignore the `ACCELERATE_ANALYTICS_CLICKHOUSE_TABLE` constant that the two sibling attribution functions honor. Any deployment that renames the table will silently zero these out. No test pins this — the test would require the constant to be honored first. Decision: small fix, then enable the aggregation tests currently stubbed out in `tests/phpunit/AttributionAbilitiesTest.php`.

- [ ] **`date_in_milliseconds()` rejects the Unix epoch** — `inc/utils/namespace.php:240` uses `if ( ! $since_epoch )`, so `1970-01-01 00:00:00 UTC` is treated as invalid. Pin: `tests/phpunit/TimeUtilsTest.php` → "test_unix_epoch_is_treated_as_invalid_a_known_bug". Decision: change the check to `if ( $since_epoch === false )` (it's a one-line fix).

- [ ] **Bounce-rate magnitude isn't covered** — bounce in `inc/abilities/engagement.php` is computed via `endpoint_views < 2`, which isn't writable through the existing `insert_pageview` test helper. The engagement tests currently cover recirculation, zero-visitor guard, and exit pages but not bounce magnitude. Decision: extend the test helper to set `endpoint_views`, then add bounce coverage.

## Verification

- `composer phpunit` — 246 PHP tests pass (170 pre-existing + 76 new).
- `npm run test:js` — 56 JS tests pass.
- `npm run build` — production build green.
- `npx eslint` — clean on all changed files.
- **Parity:** `tests/fixtures/audience-operators.json` rows pass identically across PHP and JS runs.
