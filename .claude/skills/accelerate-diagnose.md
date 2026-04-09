---
description: "Accelerate Diagnose - diagnose analytics, experiments, and tracking issues from a live customer URL"
---

# Accelerate Diagnose

Comprehensive diagnostic tool for troubleshooting Accelerate installations on customer sites. Examines script loading, configuration, custom elements, variant templates, analytics pipeline, consent, caching, and more.

## Required Tools

**Always available (source-only mode):**
- `WebFetch` — fetch raw HTML source and response headers
- `WebSearch` — only if needed to check cloud service status

**When browser is available (enhanced mode):**
- `mcp__claude-in-chrome__*` — Chrome MCP tools for runtime JS diagnostics

## Input

Accepts a URL as the skill argument:
- `/debug playstation.com`
- `/debug https://business.yell.com/`
- `/debug example.com/landing-page`

---

## Workflow

### Step 1: Detect Mode & Normalize URL

1. **Normalize the URL**: Add `https://` if no protocol provided. Trim trailing slashes.
2. **Detect browser availability**: Try calling `mcp__claude-in-chrome__tabs_context_mcp`. If it succeeds, use **Browser-Enhanced Mode**. If it fails or is unavailable, fall back to **Source-Only Mode** silently — just note the mode in the report header.

### Step 2: Source Analysis (Both Modes)

Use `WebFetch` to retrieve the full HTML source of the target URL.

Extract and evaluate ALL of the following signals from the raw HTML:

#### A. Script Detection

Search the HTML for these `<script>` tags:

| Script | What to look for | Significance |
|--------|-----------------|--------------|
| **Analytics SDK** | `src` containing `eu.accelerate.altis.cloud/accelerate` | Core analytics library — without this, nothing works |
| **Experiments** | `src` containing `/build/experiments.` from the plugin dir | Custom element definitions (ab-test-block, etc.) |
| **Consent API** | `src` containing `wp-consent-api` | GDPR consent gating |

For the SDK script, extract the **version number** from the URL pattern: `accelerate.{VERSION}.js` (e.g., `accelerate.4.1.1.js` → version 4.1.1).

#### B. Inline Configuration

Look for inline `<script>` blocks containing `Altis.Analytics` or `window.Altis`. Extract these values:

| Config Key | Expected Value | What it means |
|------------|---------------|---------------|
| `Config.LogEndpoint` | `https://eu.accelerate.altis.cloud/log` | Where events are sent |
| `Config.AppId` | Non-empty string | Site identifier (REDACT in output — show only first 4 chars) |
| `Config.ExcludeBots` | `true` | Bot traffic filtering |
| `Consent.Enabled` | `true` or `false` | Whether consent gate is active |
| `Consent.Allowed` | Array of categories | Which consent categories allow tracking |
| `Noop` | `false` | If `true`, ALL analytics is disabled (preview/noop mode) |
| `Experiments.Goals` | Object with goal names | Registered conversion goals |
| `Experiments.BuildURL` | URL path | Plugin build directory |
| `Data.Attributes` | Object | Page-level attributes (postType, postId, etc.) |

#### C. Custom Elements in Markup

Search the HTML body for these elements and collect their attributes:

| Element | Key Attributes | What it represents |
|---------|---------------|-------------------|
| `<global-block>` | `block-id` | Standard synced pattern |
| `<ab-test-block>` | `block-id`, `goal`, `traffic-percentage`, `paused`, `winner`, `attributes` | A/B test block |
| `<personalization-block>` | `block-id`, `audience` | Personalized content block |
| `<broadcast-block>` | `client-id`, `broadcast-id` | Broadcast block |

#### D. Variant Template Integrity

For each custom element found, search for corresponding `<template>` elements:

- `<template data-parent-id="{block-id}">` — variant content templates
- Check attributes: `data-fallback`, `data-weight`, `data-goal`, `data-audience`, `data-title`
- Check for `<noscript>` fallback after the control (fallback) template

**Flag these issues:**
- Block found with **zero** matching templates → variant rendering is broken
- Template with `__PARENT_BLOCK_ID__` literal → placeholder was never replaced (render pipeline failure)
- A/B test block with only 1 template → test can't actually split traffic
- Template without `data-fallback` among siblings → control variant may be missing

#### E. WordPress & Plugin Version Detection

- **Accelerate version**: From SDK URL pattern `accelerate.{X.Y.Z}.js`
- **WordPress version**: From `<meta name="generator" content="WordPress X.Y.Z">`

#### F. Response Headers & Caching

Note these headers from the WebFetch response:

| Header | What to check |
|--------|--------------|
| `Cache-Control` | Is the page cached? For how long? |
| `X-Cache`, `CF-Cache-Status`, `X-Varnish` | CDN/proxy cache status |
| `Age` | How old is the cached response? |
| `Vary` | Does it vary by Cookie? (needed for consent-dependent content) |
| `Server` | Hosting environment hints |

**Flag**: Long cache TTLs on pages with A/B tests (visitors may get stale variant assignments from server-side cache).

### Step 3: Cloud Health Check (Both Modes)

Verify the Accelerate cloud service is reachable:

1. **SDK JS**: Fetch the full SDK URL found in Step 2A. Expect HTTP 200.
2. **Log Endpoint**: Fetch `https://eu.accelerate.altis.cloud/log` with a HEAD or GET request. Confirm it's reachable (any non-error response).

If the SDK URL wasn't found in Step 2, use the default: `https://eu.accelerate.altis.cloud/accelerate.js`

### Step 4: Browser-Enhanced Checks (If Available)

**Skip this entire step if browser is not available.** Note "Browser checks skipped — source-only mode" in the report.

1. **Create a new tab** via `tabs_create_mcp` and navigate to the target URL.
2. Wait for the page to finish loading.
3. Run the following JavaScript diagnostics:

#### G. Analytics Runtime State

```javascript
// Run this as a single JS check
{
  altisExists: typeof window.Altis !== 'undefined',
  analyticsExists: typeof window.Altis?.Analytics !== 'undefined',
  ready: window.Altis?.Analytics?.Ready,
  loaded: window.Altis?.Analytics?.Loaded,
  noop: window.Altis?.Analytics?.Noop,
  endpointId: window.Altis?.Analytics?.getEndpoint?.()?.Id,
  endpointAttributes: Object.keys(window.Altis?.Analytics?.getEndpoint?.()?.Attributes || {}),
  configAppId: window.Altis?.Analytics?.Config?.AppId?.substring(0, 4) + '...',
  configLogEndpoint: window.Altis?.Analytics?.Config?.LogEndpoint
}
```

#### H. Consent State

```javascript
{
  consentEnabled: window.Altis?.Analytics?.Consent?.Enabled,
  consentAllowed: window.Altis?.Analytics?.Consent?.Allowed,
  consentAPILoaded: typeof window.wp_has_consent !== 'undefined',
  consentCookies: document.cookie.split(';')
    .filter(c => c.trim().startsWith('wp_consent'))
    .map(c => c.trim())
}
```

#### I. Custom Element Registration & Upgrade

```javascript
// Check each element type
['global-block', 'ab-test-block', 'personalization-block', 'broadcast-block'].map(tag => ({
  tag,
  defined: customElements.get(tag) !== undefined,
  instanceCount: document.querySelectorAll(tag).length,
  upgraded: Array.from(document.querySelectorAll(tag))
    .every(el => el.constructor.name !== 'HTMLElement')
}))
```

For each instance found, also check:
```javascript
// Per-element diagnostics
{
  blockId: el.getAttribute('block-id') || el.getAttribute('client-id'),
  logEvents: el.logEvents,
  paused: el.hasAttribute('paused'),
  winner: el.getAttribute('winner'),
  childCount: el.children.length,
  hasShadowRoot: el.shadowRoot !== null
}
```

#### J. Variant Assignment & Storage

```javascript
{
  storedTests: JSON.parse(localStorage.getItem('_altis_ab_tests') || '{}'),
  endpointUUID: localStorage.getItem('accelerate.uuid'),
  // For each ab-test-block element:
  variants: el.variants ? el.variants.length : 0,  // queries template elements
  variantWeights: el.variantWeights
}
```

#### K. IntersectionObserver Threshold Analysis

For **every** `global-block`, `ab-test-block`, `personalization-block`, and `broadcast-block` element:

```javascript
{
  blockId: el.getAttribute('block-id'),
  elementHeight: el.getBoundingClientRect().height,
  viewportHeight: window.innerHeight,
  requiredAt75pct: el.getBoundingClientRect().height * 0.75,
  maxPossibleVisible: Math.min(el.getBoundingClientRect().height, window.innerHeight),
  canReachThreshold: Math.min(el.getBoundingClientRect().height, window.innerHeight) >= el.getBoundingClientRect().height * 0.75,
  bestAchievable: (Math.min(el.getBoundingClientRect().height, window.innerHeight) / el.getBoundingClientRect().height * 100).toFixed(1) + '%'
}
```

Flag any element where `canReachThreshold` is `false` — the `blockView` event can never fire for that element.

#### L. Network Request Monitoring

Use `mcp__claude-in-chrome__read_network_requests` filtered on `accelerate.altis.cloud`:

- Check for POST to `/log`
- Record status code (expect 2xx)
- Note if no request was made at all

If no requests were captured (monitoring started after page load), reload the page and check again.

#### M. Console Error Check

Use `mcp__claude-in-chrome__read_console_messages` with pattern `altis|accelerate|Altis|ab-test|global-block|personalization|broadcast`:

- Report any errors
- Report any warnings
- Note if console is clean

#### N. Event Verification

To verify which analytics events actually fire:

1. Inject an interceptor:
```javascript
window._debugEvents = [];
const origRecord = window.Altis.Analytics.record;
window.Altis.Analytics.record = function(type, data) {
  window._debugEvents.push({ type, timestamp: Date.now() });
  return origRecord.apply(this, arguments);
};
```

2. Reload the page (navigate to the same URL again)
3. Wait for load, then read captured events:
```javascript
window._debugEvents  // expect: blockLoad, blockView, etc.
```

Report which event types fired and which are absent.

---

### Step 5: Assemble Diagnostic Report

Present findings in this structured format:

```
============================================================
  ACCELERATE SITE DIAGNOSTIC
  URL:  [tested URL]
  Mode: [Source-Only / Browser-Enhanced]
  Date: [current date]
============================================================

--- SITE INFO ---

  Accelerate Version:  [from SDK URL, or "Not detected"]
  WordPress Version:   [from meta generator, or "Not detected"]
  Log Endpoint:        [value or "Not found"]
  App ID:              [present (first 4 chars) / missing]
  Environment:         [Production / Noop (preview mode)]

--- INSTALLATION CHECKLIST ---

  [PASS]  Analytics SDK loaded
  [FAIL]  Experiments script loaded
  [PASS]  App ID configured
  [WARN]  Log endpoint: custom value (not default EU endpoint)
  [PASS]  Not in Noop mode
  [PASS]  Bot exclusion enabled
  [INFO]  Consent API: enabled, categories: [functional, statistics-anonymous]

--- CLOUD HEALTH ---

  [PASS]  SDK JS reachable at CDN (200, 45ms)
  [PASS]  Log endpoint reachable (200)

--- BLOCKS FOUND ---

  Global Blocks: 3  |  A/B Tests: 1  |  Personalized: 0  |  Broadcasts: 1

  A/B Test: block-id=176298
    Goal: submit_form | Traffic: 100% | Status: running
    Variants: 2 templates found
    Fallback: present | Weights: 50/50
    [PASS] Template integrity OK

  Broadcast: client-id=abc, broadcast-id=456
    Templates: 3 found
    [PASS] Template integrity OK

--- BROWSER RUNTIME ---  (or "Skipped — source-only mode")

  [PASS]  Analytics object initialized
  [PASS]  Ready: true | Loaded: true
  [PASS]  Endpoint ID exists (84947853...)
  [PASS]  Custom elements: ab-test-block, global-block, broadcast-block registered
  [PASS]  All instances upgraded (not bare HTMLElement)
  [PASS]  POST to /log: 202 Accepted
  [PASS]  Console: clean (no errors)
  [WARN]  Consent: enabled but no consent cookie found
  [WARN]  IntersectionObserver: block 176298 unreachable
           Element: 2141px | Viewport: 1276px | Best: 59.6% (need 75%)
           blockView events will NOT fire for this block
  [INFO]  Events captured: blockLoad (x1)
  [INFO]  Events missing: blockView (see IO threshold warning above)
  [INFO]  Variant assignments: { block_176298: 0 }

--- CACHING & DELIVERY ---

  [INFO]  Cache-Control: max-age=300, public
  [INFO]  X-Cache: HIT
  [WARN]  Page is cached (5 min TTL) — A/B test variant assignment
          happens client-side so this is OK, but server-side
          rendered content will be identical for all visitors

--- ISSUES & RECOMMENDATIONS ---

  1. [WARN] Consent gate active but no cookie
     Visitors who haven't granted consent won't generate any
     analytics events. Check consent banner implementation.

  2. [WARN] IntersectionObserver threshold unreachable for block 176298
     The hero A/B test block is 2141px tall but the viewport is 1276px.
     The blockView event requires 75% visibility (1606px), which is
     physically impossible. This is a known issue in versions <= 4.1.x.
     Recommendation: Update to latest Accelerate version.

--- RAW CONFIG ---

  LogEndpoint:    https://eu.accelerate.altis.cloud/log
  AppId:          9c4c...
  ExcludeBots:    true
  Consent:        { Enabled: false, Allowed: [functional, statistics-anonymous] }
  Noop:           false
  BuildURL:       /content/plugins/accelerate/build/
  Goals:          { engagement: {...}, click_any_link: {...}, submit_form: {...} }

============================================================
```

---

## Checklist Logic Reference

Use these rules to determine PASS / FAIL / WARN for each check:

| # | Check | PASS | FAIL | WARN |
|---|-------|------|------|------|
| 1 | SDK loaded | `<script>` with `eu.accelerate.altis.cloud/accelerate` found | No such script | Script from unexpected domain |
| 2 | Experiments script | Build path script with `experiments` found | Not found | — |
| 3 | App ID | Non-empty string in config | Missing or empty | — |
| 4 | Log endpoint | Matches `https://eu.accelerate.altis.cloud/log` | Missing entirely | Present but custom/different value |
| 5 | Noop mode | `false` | `true` | — |
| 6 | Bot exclusion | `true` | — | `false` (bots will inflate data) |
| 7 | Cloud SDK | HTTP 200 | Unreachable / error | Slow response (>2s) |
| 8 | Cloud log | Reachable | Unreachable | — |
| 9 | Templates | Count > 0 per block, attributes valid | 0 templates for any block | Unreplaced `__PARENT_BLOCK_ID__` or single template for A/B test |
| 10 | IO threshold | All block elements can reach 0.75 ratio | — | Any element where `viewportHeight / elementHeight < 0.75` |
| 11 | Consent | Disabled, or enabled with cookie present | — | Enabled but no consent cookie detected |
| 12 | Cache | No-cache or short TTL, or client-side variant assignment | — | Long TTL on pages with server-rendered dynamic content |
| 13 | Analytics init | `Altis.Analytics` exists, Ready + Loaded both true | Object missing | Ready or Loaded is false |
| 14 | Endpoint | `getEndpoint()` returns object with ID | No endpoint ID | — |
| 15 | Elements | All tags defined via `customElements.get()` | Any tag undefined | Any instance not upgraded |
| 16 | Network | POST to `/log` with 2xx status | No request fired | Non-2xx status |
| 17 | Console | No matching errors | Errors found | Warnings found |
| 18 | Events | `blockLoad` + `blockView` both fire for blocks in viewport | Neither fires | `blockLoad` fires but not `blockView` |

---

## Error Handling

- **Site unreachable**: Report the fetch error. Suggest checking the URL, DNS, or if the site requires authentication/VPN.
- **Accelerate not installed**: If no SDK script, no inline config, and no custom elements are found, report: "Accelerate does not appear to be installed on this site." and stop.
- **Partial installation**: If some signals are present but others missing, continue with a partial report and flag the gaps clearly.
- **Browser tab errors**: If any Chrome MCP tool fails for a specific check, skip that check with a note (e.g., "[SKIP] Console check — browser tool error") rather than failing the entire report.
- **Redirects**: If WebFetch follows redirects, note the final URL if different from the input URL.

## Security Rules

- **NEVER** display the full AppId — always redact to first 4 characters + `...`
- **NEVER** display full endpoint UUIDs — truncate to first 8 characters
- **Read-only**: Do not modify anything on the target site. No form submissions, no localStorage writes, no cookie changes.
- **No credentials**: Do not attempt to log in or access authenticated areas.

## Language Style

- Be factual and direct — this is a diagnostic tool, not a marketing piece
- Use technical language appropriate for a developer or technical support person
- Lead each finding with the status indicator ([PASS], [FAIL], [WARN], [INFO])
- In the Recommendations section, be specific and actionable
- Reference the check number or signal that triggered each recommendation
