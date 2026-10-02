# Accelerate onboarding routes: capability pressure test

29 September 2026 · product and capability pressure test · private design exploration

**Verdict: keep both routes for testing. The outcome is credible; the safe preparation layer is the shared build.** Hosted crawling and reasoning make the site understanding and creative work plausible. They do not prove editability, successful delivery, attribution or user demand. We have source evidence for several primitives, but no production cohort evidence establishing the onboarding bottleneck or which route wins.

The strongest version of the idea is an opinionated first experience already shaped around the customer's business, rendered in their design, approved for a specific placement, delivered to eligible visitors, and revisited when evidence supports a useful decision. Both routes aim at exactly that outcome.

The subsequent [master-playbook audit](onboarding-playbook-audit.md) pressure-tests both experiences against the full research document. It moves the prepared result before optional setup and records the revised state and measurement contracts. The source-capability findings below still apply.

A third, deliberately lighter route now offers **candidate discovery → existing block location → editor handoff**. It removes automated block creation from onboarding. Its [separate scope and pressure test](onboarding-finder.md) distinguishes screenshot evidence, editable-block identity and downstream activation. The A/B comparison below retains their original equal preparation ambition.

## Two prepared-experience routes, equal ambition

| | A — Guided discovery | B — Experience studio |
|---|---|---|
| Opening question | Let Accelerate find the opportunity | Point to the moment you want to improve |
| Organising object | A prepared recommendation | The customer's page, always visible |
| Interaction | Site input to prepared draft; optional refinement before approval | Recommended draft already on the canvas; compare and refine in place |
| Creative output | A complete section treatment, with alternative approaches | Three complete treatments of the selected section |
| User expertise assumed | Knows the business goal; may not know where to start | Recognises an opportunity when looking at their own site |
| Website entry | Analyse public URL, preserve proposal through authenticated plugin handoff | Proposed read-only public draft, then connect to resolve safe editable sections before launch |
| Return | A useful next step informed by collected data | Return to the same page with its experience and evidence |
| Main risk | The user approves a plausible but wrong recommendation | The user cannot choose a meaningful section or audience |

The studio prototype models plugin entry. Its proposed website entry is documented, not implemented. Route A includes a simulated website-to-plugin handoff. Neither route is a reduced-scope fallback. Both include preparation, contextual preview, explicit approval, delivery evidence, recovery and a return visit. Both can support testing or personalisation. Personalisation provides targeting, not evidence of uplift.

## What the implementation actually supports

Source review of this checkout, not a WordPress runtime or production audit:

| Capability | Evidence | Implication for both routes |
|---|---|---|
| Connected installation identity | `inc/admin/namespace.php:708–714` matches and registers `home_url()` | An entered public URL is an analysis target, not editing authority. Production mismatch must block launch. |
| Site design and content | `inc/abilities/discovery.php:1523` site context; `content.php:60` content read; `fuzzy-selector.php:66` block selection | Can ground copy and discover existing blocks. Does not provide reliable semantic hero detection or arbitrary rendered-page-to-template mapping. |
| Execution availability | `inc/abilities/namespace.php:15` registration prerequisites and opt-in | Check capabilities per installation. An internal onboarding service can use underlying functions without assuming MCP is enabled. |
| Block-level goals | `inc/experiments/namespace.php:70–87`; `src/experiments.js:594` binds events in the block | Use supported in-section clicks by default. Finding a form elsewhere does not provide downstream attribution. A submit event is not verified business success. |
| A/B creation | `inc/abilities/execution.php:961–962` starts and unpauses | Need a genuine prepare/draft contract. Do not call create and hope to pause quickly enough. |
| Pattern recovery | `inc/abilities/ab-test-recovery.php` hashes, request IDs and conflict checks | Useful building block. Does not cover the entire inline conversion, reference swap or personalisation recovery transaction. |
| Pattern scope | Experiments operate on synced `wp_block` content | Enumerate every placement. Isolate the selected use when the pattern is shared. Changing a global pattern is not “only this placement”. |
| Preview | `inc/api/namespace.php:1644` block thumbnail preview | Not proof of faithful unpublished full-page preview. Theme, dynamic blocks and responsive rendering need a separate contract. |
| Exposure | `src/experiments.js:567` records block views; intersection handling determines visibility | Count eligible exposure separately from configuration, page visits and unique people. Exclude previews/admin and respect consent. Validate deduplication before a person-level claim. |
| Pause | A/B handler checks paused at `src/experiments.js:798`; personalisation handler has no equivalent check | Do not expose a working personalisation pause based on an API success response. The prototypes offer a proposed restore instead; complete restore remains new work. |
| Campaign audience | `inc/audiences/namespace.php:213`; history accumulation in `src/accelerate.js:433` | State an exact campaign criterion and its remembered-visit semantics. “Arriving right now from a campaign” is a different promise. |
| Return data | Top content query `inc/api/namespace.php:1338`; audience results `inc/abilities/execution.php:1926` | Structure can suggest initial pages; actual traffic can revise them later. Audience results are not a causal comparison. |
| Activation telemetry | `inc/telemetry/namespace.php` feature activation records creation; `src` onboarding currently has an unfinished results step | Existing feature activation is not the proposed valid-exposure metric. Opt-in telemetry can bias a funnel. |

Provider integration patterns have also been inspected outside this repository: bounded Firecrawl fetching and server-side OpenAI Responses calls with structured, validated output exist. Credentials were not read into artifacts, copied, used or tested. Configuration/source availability is not a production service receipt.

## The assumption ledger

| Assumption | Status | Consequence if wrong | Cheapest useful test |
|---|---|---|---|
| The main drop-off is choosing/preparing an experience | Unknown; no production funnel queried | A beautiful flow sits behind the actual connection bottleneck | Instrument connection start, completion, first useful draft, approval and eligible exposure; inspect dropout and errors |
| Most target sites have a valuable editable section | Partly supported by block primitives; coverage unknown | A mostly read-only experience disappoints after the creative work | Inventory 20 permissioned sites across block themes, classic themes, shared patterns and page builders; report editable coverage and exact blockers |
| Generated treatments are specific enough to use | Feasible inference; not measured | Users spend more time correcting them than creating their own | Generate bounded proposals for the same site set; owners assess truth, specificity and willingness to use; record edits and invented claims |
| A user can confidently choose a moment on their page | Route B hypothesis | Canvas-first feels like being asked to do Accelerate's job | Observe unassisted first selection; record hesitation, wrong selection and requests for a default |
| A user trusts a recommendation chosen for them | Route A hypothesis | Easy completion hides unexamined agreement | Before launch, ask users to explain why this page, what changes, who sees it and what is measured |
| Enough eligible activity arrives for a useful return | Unknown; aggregate visits are insufficient | No learning arrives, or personalisation is presented as statistical success | Segment actual block exposure and goal-event distributions; show no-data and low-evidence paths without forecasting a winner |
| Hosted work fits an acceptable cost and wait | Keys exist; measured budget/latency absent | Retry storms or long waits destroy the first session | Replay a bounded representative corpus; log latency, provider usage, cache hits, failures and recovery |
| Prepare, publish and restore can be safe across supported content | Some primitives; end-to-end contract missing | Wrong placements change or recovery overwrites a later edit | Private WordPress fixture with shared patterns, concurrent edit, partial failure and repeat request; inspect content and render before/after |

## The strongest counterarguments

1. **Recommendation quality may be a distraction from connection friction.** Both designs assume that users have reached a useful surface. Do not spend the entire first release on generation until the connection funnel has been observed. Keep public-site exploration available as an earlier value moment, with an honest handoff.
2. **A beautiful preview can manufacture trust.** A generated page can look coherent while mapping to the wrong WordPress object. Route A encourages automation bias; Route B's canvas can create an illusion of editability. The authoritative boundary is the plugin's capability and placement map, with a revision check at approval.
3. **Neither route solves low traffic.** Bolder treatments may create a larger signal; targeting can deliver a relevant experience immediately. Neither produces statistical evidence on demand. A seven-day return is a check-in opportunity, not a promised conclusion or automatic reason to abandon a test.
4. **A complete creative treatment can still invent the business.** Crawled claims can be stale, deceptive or instructions embedded in untrusted content. Keep source excerpts and explicit inferences with each proposal; validate block structure and require owner review of claims. Do not manufacture testimonials, customers or guarantees.
5. **Two flows can disguise the same product risk.** If both depend on the same broken preparation layer, a usability preference tells us little about deliverability. Test that shared layer first, then compare understanding and real activation under the same capabilities and budgets.

## Premortem

**Most likely failure:** users like the preview, then stop when asked to choose a goal, locate a compatible section or connect production. Mitigation: identify mapped placements early; carry the draft through authentication; keep measurable intent separate from business outcomes; preserve unfinished work.

**Highest-impact failure:** a shared pattern changes across the site, or a restore overwrites a newer editor change. Mitigation: immutable approved proposal, placement enumeration, exact revision/hash match, idempotent scoped mutation, render verification, and conflict-aware restoration. If prerequisites fail, keep the proposal and block launch.

**Second-order failure:** the team optimises wizard completion or “AI drafts generated” and calls it activation. This rewards polished busywork. Both routes must use the same valid-exposure outcome, with comprehension, correction effort, failed launches and reversals alongside it.

## Hosted analysis as the glue

Use an authenticated, site-scoped Accelerate job. The plugin provides the actual installation identity, editable content, registered goals, placements and revisions; a bounded public crawl supplies visible context; reasoning proposes a treatment inside that capability envelope. Return a typed proposal with sources, inferred business intent, selected block IDs, draft content, audience criteria, measurement, uncertainty and prerequisites.

Provider credentials stay on the service. A proposed initial proof budget is three same-site public pages, one bounded inference call and one explicit retry, with per-site/account quotas, byte/time/token limits, cache keys and usage receipts. These are proposed limits to measure, not proven sufficient values. Validate URLs and redirects against SSRF, restrict outputs to allowed block structures, treat page text as data, and give the proposal generator no publishing tool. Client authentication alone is not abuse prevention; enforce limits and verified site ownership on the server.

Firecrawl is useful for rendered context and content extraction ([scrape documentation](https://docs.firecrawl.dev/features/scrape)). Structured model output helps make proposals machine-checkable ([OpenAI documentation](https://developers.openai.com/api/docs/guides/structured-outputs)); it does not guarantee truth or safe mutations. These can bridge the understanding and creative gaps. The plugin must bridge the authority and execution gaps.

## What would make this decision-ready?

1. **Shared private proof:** prepare, preview, publish, verify eligible exposure and restore one realistic section. Include shared-pattern isolation, production mismatch, unsupported template, no consent, stale revision and partial failure. No wrong-placement changes or silent overwrites accepted. This is a proposed acceptance gate, not a test already passed.
2. **Same-site comparison:** use six owners initially, counterbalance A/B order, and use the same sites, proposal quality and capability outcomes. Treat this as qualitative discovery, not a powered experiment. Observe independent selection, corrections, what they think will happen, and whether they would actually approve.
3. **Comprehension gate:** before launch, each participant describes the changed placement, audience, measured event and recovery. Any dangerous misunderstanding is a design failure to resolve, even when the participant prefers the visual design.
4. **Budget receipt:** run approved provider requests on the fixed corpus and record p50/p95 wait, cost per accepted draft, rate limits and fallback quality. Agree tolerances from evidence before expanding.
5. **Instrumented pilot:** compare the chosen route against today's onboarding. Primary outcome: share of eligible new connections with an intentionally approved experience and valid non-preview exposure within seven days. Report all-connection and supported-installation denominators, entry surface, traffic eligibility and telemetry missingness. Guardrails: scope comprehension, failed mutations, undo/revert rate and owner correction effort. Do not declare a winner from six interviews.

**Current decision:** prototype both, build the shared preparation proof, then choose a default from observed owner behaviour. My hypothesis is A for owners unsure where to start and B for people arriving with a page or campaign in mind. That is a testable routing hypothesis, not a finding. Avoid asking every new user to choose an onboarding philosophy.

## Prototype coverage and limits

- A: guided journey, business correction, section treatments, website handoff, launch approval, capability blockers, exposure, return and save/resume.
- B: persistent page canvas, two selectable sections, three treatments, visitor context, copy editing, review, blockers/recovery, exposure, test pause, restore, return and save/resume.
- Both: fictional content and counts; browser-local persistence only; no provider calls, server state, WordPress mutation, production funnel query or customer validation. “Ready” represents the intended future contract.
- Restoring the original is simulated. Personalisation pause is deliberately absent until runtime support is verified or implemented. Email is an optional proposed channel; the in-app return does not depend on it.

See `onboarding-flow.md` for the browser verification receipt.
