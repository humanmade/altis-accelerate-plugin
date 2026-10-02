# Route C — Opportunity finder

29 September 2026 · isolated design prototype · `growth/onboarding-flow`

## The smaller first win

“Show me where to start.” Identify promising **existing** sections, give a reason to consider each, then help the owner locate the right block in the existing editor. No new block, generated variant, rewritten copy, conversion or launch is part of this onboarding route.

A and B prepare a substantial experience. C prepares a decision: **this location, this reason, this next move**. The existing editor owns the subsequent work. Its ambition is useful site-specific guidance with much less automation to build and trust.

Open `onboarding-finder.html` from `onboarding-routes.html`. It uses the same fictional Northstar site and local-only state as the other explorations. Highlighted page regions are HTML representations of an original page, not a Firecrawl capture or a generated proposal. Every connection, block match and editor handoff is simulated.

## Journey

1. See up to three candidates immediately, with one recommended starting point. Pick a candidate in the list or its matching numbered page highlight.
2. Read what was observed, why that region might be worth changing, and a single next move. These are hypotheses from content and structure, not claims of weak performance or forecast uplift.
3. Locate the existing block in WordPress. Inspect its original excerpt, page and block path, edit permission and whether it is shared. Screenshot-only evidence cannot skip this step.
4. If the match is uncertain, use List View and explicitly confirm the existing content. Keep manual confirmation distinct from a machine-verified match. If access is missing, save the candidate and resume after connection/admin recovery.
5. Open a simulated editor with the existing block selected and short contextual guidance. No mutation occurs. Return to candidates or save the place for later.

The source switch and reviewer scenarios expose screenshot-only, unavailable capture, no candidates, access pending, connection failure, shared pattern, stale source and unmapped-content paths. The normal route does not require a source choice or a questionnaire.

## Why this is a plausible smaller build

| Work | C needs it? | Boundary |
|---|---|---|
| Public-page content or screenshot | Optional augmentation | Helps recognise visual prominence and grouping; connected WordPress content can work without it |
| A bounded ranking/reasoning pass | Potentially | At most three candidates grounded in supplied text and structure; deterministic heuristics/manual browsing remain possible |
| Generate or reconstruct a block | No | Existing page content remains the source |
| Full-page preview of generated content | No | Only the original page with annotations |
| Map screenshot region to existing block | Yes for precise handoff | Text/anchor/type, correct post or template, ambiguity check and current source revision |
| Authenticated access and capability check | Yes for editor handoff | A public screenshot is not site ownership or editing authority |
| Create test, variant or personalisation | No automatic action | User may choose existing editor setup later; generic editable groups are not necessarily experiment-ready |
| Publish transaction and undo | Outside this route | No new mutations; existing editor actions retain their own review and recovery contracts |
| Funnel measurement | Yes in production | Separate candidate viewed, candidate located, editor opened, user-authored change and eventual valid exposure |

Firecrawl's first-party [advanced scraping documentation](https://github.com/firecrawl/firecrawl-docs/blob/main/advanced-scraping-guide.mdx) documents screenshot actions with full-page and viewport options. This establishes a possible input source, not a tested integration, latency guarantee or a mapping from pixels to WordPress block IDs. No provider calls or keys were used here.

Source inspected locally: `inc/abilities/fuzzy-selector.php` supports matching parsed post blocks by type, text, anchor and occurrence. It returns the requested occurrence (default first); **it does not establish uniqueness**. A reliable handoff needs an explicit ambiguity check, revision validation and correspondence to the live editor's block tree. Client IDs are not durable screenshot identifiers. Template parts, dynamic output, shared patterns and page builders need supported mappings or manual fallback.

`src/global-blocks/index.js` registers Accelerate variations for `core/block` synced patterns. `src/global-blocks/blocks/global/components/Header.tsx` exposes conversion and variant insertion in that editor. Those are mutation steps, not part of this read-only finder. Opening an ordinary existing group must not imply it is already test-ready.

## Bounded hosted service, if implemented

Prefer the authenticated plugin's existing content inventory. If public-page capture improves candidate quality, scope it to the connected site's approved public origin, validate redirects and block private-network destinations, limit pages/bytes/runtime and cache by site/revision. Keep provider credentials server-side, enforce account/site quotas, and send no admin sessions or private pages to a public crawler.

Treat extracted content as untrusted input. A reasoning call returns a small structured candidate list, observed excerpts, suggested task and evidence references; it has no editor or publishing tools. Validate references against the inventory and reject invented content. Screenshot capture time, viewport and page URL belong to the restricted source record, not general analytics. Do not infer visible-on-screen exposure from a screenshot's pixel position or claim that a prominent CTA is underperforming without data.

## Pressure test

| Risk | Design response | Cheapest proof |
|---|---|---|
| Generic advice merely shifts work onto the user | A specific existing location, grounded reason and one next move | Observe whether owners can explain the recommendation and start a useful edit without help |
| Wrong block selected because text repeats | Match excerpt and tree location; ambiguous results need confirmation | Fixtures with duplicate headings/buttons, nested groups and repeated patterns; never silently pick first |
| Screenshot and editor differ | Refresh stale source and discard the previous match | Concurrent-edit, cache, responsive and dynamic-render fixtures |
| Shared pattern affects more pages | Visible scope warning; no automatic isolation or conversion | Confirm the linked pattern and all known uses before editor handoff |
| Good candidate is not experiment-ready | Explain that native setup may still be required | Verify supported existing patterns separately from ordinary groups and builder content |
| No crawl result or no convincing candidate | Browse existing blocks or retry; do not invent a ranked winner | Screenshot failure and no-candidate branches |
| Fast handoff does not become real use | Editor-open is a handoff metric, not activation | Track user-authored change, approved test and eligible exposure after handoff, plus return and abandonment |

The key question is whether a useful recommendation removes enough uncertainty to motivate the user's own edit. C reduces the first engineering scope; it does not prove a faster end-to-end path to a running experiment.

## Master-playbook fit

The first task is choosing where to act in context (P1), with labelled example data while real-site value is unproven (P2). No profile survey or attribution interrupt is needed (P3/P4). Access is explained at editor handoff after the candidate is visible (P5/P9); there is no artificial scan delay (P6). One default candidate reduces decisions (P8). Save/resume and short dismissible guidance replace a setup checklist (P7/P12). The useful output is a located original block, not a new AI artifact (P10/P13). No cinematic intro or payment step is relevant (P11/P14).

The activation metric and all production authority checks remain unproven. This prototype tests the journey and its failure states; real-site candidate quality, correct editor selection and downstream adoption require separate validation.

## Verification

Verified in the Codex in-app browser on the local static server:

- Default candidates, changing the highlighted section, locator and simulated existing-editor handoff; changing the suggested edit focus; save/reload/resume preserves it.
- Screenshot-only access explanation and simulated connection; unmapped region through List View selection and explicit manual confirmation.
- Pending-admin recovery; shared-pattern handoff gated by scope acknowledgement, with the pattern title/warning retained. Changing candidate clears the scope acknowledgement.
- No-candidate and failed-capture states hide ranked actions and hotspots. Explicit browsing recovers to existing content; a screenshot-only source connects before that inventory is available.
- Stale source requires a new selection; refreshed excerpts and the unselected state survive reload.
- Desktop candidate and locator layouts at 1440 × 1000 and mobile candidate/locator/editor views at 390 × 844 inspected. No document-level horizontal overflow in checked mobile views. Mobile locator puts the action before the long original-page preview.
- Keyboard interaction checked; no browser JavaScript errors observed. This is not a full accessibility or pointer audit.
- JS syntax, local links/assets, final newlines and whitespace checks passed. The design detector retains two shared miniature/backdrop findings: small text and compact WordPress-bar padding. No claim of full accessibility compliance.

Local evidence: `/tmp/accelerate-finder-desktop.png` and `/tmp/accelerate-finder-mobile.png`. These are session screenshots, not committed assets. The unchanged A/B interactions were not rerun for this additive route.

No real WordPress installation, live provider or customer was used. Browser proof establishes this isolated flow, not real-site candidate quality, provider reliability, or correct native-editor selection.
