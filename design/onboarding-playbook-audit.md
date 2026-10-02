# Onboarding playbook audit: both Accelerate routes

29 September 2026 · revision of the isolated prototypes on `growth/onboarding-flow`

## Source and verdict

Read the entire 375-line **Onboarding Playbook**, including its research ledger, 14 plays, copy bank, instrumentation, audit checklist and state-mapping method. Master source: `/Users/noeltock/dev/life/intel/design/Onboarding Playbook.md`. Supporting research read: `projects/intel/raw/onboarding/round2/agent-setup.md`, `voices.md` and `ai-referral.md` in the same vault. The existing site-aware onboarding brief and `PRINCIPLES.md` supply the Accelerate-specific job.

**Reshape both flows around the first useful draft, then optional launch setup.** The previous version had the right ambition but too much setup-shaped interaction. A asked people to confirm a business profile and select an opportunity before reaching their result. B put a capable canvas in front of people but asked them to choose before it demonstrated enough value. Both needed more than “Save & exit” to make setup skippable, and neither showed enough of the actual proposed mutation at approval.

The master is not proof that every borrowed tactic will improve Accelerate. It labels verified primary claims, reported findings, anecdotes and heuristics separately. Its PostHog numbers are self-selected; its permission-education lift is anecdotal; its survey response figures concern surveys. No such number has been transferred into an Accelerate forecast. The under-60-second target is a design goal, not a measured provider or production latency.

## What now happens

**A — Accelerate prepares; the owner steers.** The entry screen shows a labelled example and explains assisted reading. One action begins preparation. Completed or already-available content leads directly to the prepared draft. Business understanding, direction and page selection are optional refinements after value. Original-content manual editing is available without assistance. Then comes a distinct, optional setup: connection, precise change review, approval, verified publishing, and eligible exposure.

**B — The website is the workspace.** It opens on a recommended prepared example. The first interaction can be comparing it with the original, selecting a different section, or changing the treatment. There is a manual starting point and an explicit opt-in for further assisted suggestions. Review, permissions, recovery and results stay beside the page. The canvas is still the organising object; it has not become A's questionnaire in a different layout.

Both retain ambitious section treatments, targeting, testing and the return loop. Neither promises that low traffic can produce a statistically useful answer on a fixed date.

## Audit of the master's 16 checks

“Pass” below means the **prototype design/behaviour** demonstrates the check. “Partial” means the design exists but the meaningful runtime or empirical requirement remains unproven. This is not a production readiness score.

| Master §7 check | Previous A / B | Revised A / B | Concrete evidence and remaining limit |
|---|---|---|---|
| Fast first output, or a labelled preview with an honest real-value expectation | Partial / Partial | Partial / Partial | A `connect`, `scan`, `preview`: result before profiling; available-content exit. B `draft`: recommended result on first render. All site content is labelled fictional. Actual provider latency and real-site value are unmeasured; eligible exposure, not elapsed time, gates learning. |
| First meaningful screen does the user's task in context | Partial / Partial | Partial / Partial | Both use a complete site-section proposal. A offers immediate example then preparation; B opens in the actual work surface. Still a fixture rather than a real customer site. |
| ≤3 profile questions, single-choice, progress visible | Partial / Partial | Pass / Pass | A has one optional three-way direction choice; business correction is optional. B has no profile survey, with a recommended treatment and audience. The reviewer navigation is separate from actual completion state. |
| Every question visibly changes something | Partial / Partial | Pass / Pass | See answer-to-change table below. No role, company size or team invitation invented for segmentation. Attribution is an explicit optional exception after value/connection, for a separate research purpose. |
| Optional post-signup attribution, AI follow-up | Partial / Not included | Pass / Deliberately deferred | A connected scan/setup hub includes eight options, Other, assistant selector and optional prompt. Public unauthenticated analysis does not show it. B has no unavoidable wait or account capture; do not insert a survey before its immediate value. Reuse the account-side question in a real deployment. |
| AI referrers and UTM-only sessions classified in analytics | Not implemented / Not implemented | Partial / Partial | Documented production requirement; no analytics pipeline altered. Self-reported discovery remains separate from measured referral source. No fabricated AI channel data in the UI. |
| Mac permissions explained, skippable and repeatable | N/A / N/A | N/A, adapted / N/A, adapted | These are WordPress experiences, not native Mac setup. The applicable equivalent is site-scoped access with an explanation, admin-pending and failure recovery. No OS permissions added. |
| Integrations after value, skippable and resumable | Partial / Partial | Pass / Pass for modelled entry | A website entry reaches draft before WordPress connection. B starts from a connected fixture; reconnect/access can be deferred with its draft saved. General OAuth/account creation remains outside this prototype. |
| Waits designed, no bare spinner | Pass / No wait | Pass / Pass | A shows named preparation milestones, original/proposed site preview, optional attribution and an immediate available-content exit. B uses a prepared result without a forced animation. Its provider failure has cached/manual recovery. A timed sequence is explicitly simulated, not an implementation model for progress. |
| Recommended defaults instead of questions | Partial / Partial | Pass / Pass | A defaults to homepage and a complete migration invitation, with optional override. B defaults to mapped introduction and a prepared treatment. Both explain test versus personalisation without implying a statistically guaranteed default. |
| Short, optional, endowed, resumable checklist | Missing / Missing | Pass / Pass | Four milestones: connection, first draft/review, verified publish, valid exposure. Only established fixture milestones are marked done. Skip/hide does not bypass launch authority. No reward for social follows. |
| Visible skip, resume, re-entry | Partial / Partial | Pass / Pass | A “Save & do this later”, optional setup hub, checklist hide/show, reopen introduction and last-step resume. B save/skip overview, resume and rerun draft setup. Approval cannot be skipped. Browser storage failure means session-only persistence; no server sync implied. |
| High-intent moment has celebration and useful next action | Partial / Partial | Pass design / Pass design | Verified publish and first valid exposure have different messages. Collection checks, restore and optional notification preference are present. No actual email delivery, notification service or retention evidence claimed. |
| Events and a retention-predictive activation metric | Missing / Missing | Partial / Partial | Bounded local event/activity receipts added. Proposed activation is valid non-preview exposure of an intentionally approved experience. Whether it predicts retention still needs a cohort study. No production telemetry was added. |
| Agent setup is opt-in, diff, approval, scoped identity, receipt, undo | Partial / Partial | Partial / Partial | Assisted/manual paths, actual changes, cleared approvals, scoped connection explanations, failed attempts in local receipt, restore controls. A fixture cannot prove server identity isolation, transaction atomicity or real recovery. |
| Every applicable state mapped | Partial / Partial | Pass at prototype scope / Pass at prototype scope | See state matrix. Includes draft/no draft, access pending/denied, unavailable analysis, conflicts, mapping failure, publish failure, no data and consent. Work/personal email, team invite and payment flows are not owned by these routes; they must be joined to account onboarding later. |

## Every question earns its place

| Input | Route | Visible consequence | Who uses it / boundary |
|---|---|---|---|
| Public site URL | A | Identifies the analysis target and mismatched-installation connection gate | Future hosted job. In the prototype it changes the label only; sample content does not pretend to be a real scrape. |
| Conversations / clearer journey / familiar team | A, optional after draft | Changes the proposed headline and CTA | Draft generation; measurement remains link clicks, not a guessed business conversion. |
| Correct the business description | A, optional | Updated working brief travels with the draft and is visible in preview | Future inference context. The deterministic demo does not regenerate arbitrary content from prose. |
| Candidate page | A, optional | Changes source heading, placement and preview | Placement selection. Reasons are structural guesses until measured. |
| Canvas section | B | Changes the only section that the proposal will modify | Capability map; incompatible content has an explicit recovery. |
| Treatment | B | Changes section heading, body/steps and invitation | Creative choice constrained to supplied services. |
| Audience / experience type | Both | Different proposed copy, allocation/targeting rule and result interpretation | Registered audience capability; campaign criterion includes remembered campaign history. |
| Assisted or manual | Both | Original-content editing versus a prepared assisted treatment | Assistance opt-in; no API calls in the demo. |
| Optional discovery source | A, after connection/value | Inline thanks; AI and Other reveal relevant optional follow-ups | Attribution research, not activation gating. Do not mix raw prompt with event telemetry. |
| Useful-update preference | Both, after value | Persists whether the optional email invitation is requested | Future lifecycle channel; no email address or delivery in this demo. |
| Publish approval | Both | Enables exactly the reviewed action only when prerequisite checks pass | Site mutation authority. This is intentionally not skippable. |

## State map and recovery contract

| State / trigger | Route A | Route B | Exit and invariant |
|---|---|---|---|
| First entry | Site input + example | Recommended treatment on canvas | First output is reachable without a mandatory profile survey |
| Preparation | Named progress, preview, optional attribution | Prepared fixture; opt-in further assistance | No required theatrical delay |
| Reading/generation unavailable | Retry or use original content | Cached draft or no-cache manual branch | Do not pretend a failed generation succeeded |
| No change in manual draft | Review explains missing change | Review blocks unchanged proposal | Edit first; do not launch an A/B test of identical content |
| Optional refine | Brief, direction, page and headline | Section, treatment, audience and heading | Content/scope edits clear approval |
| Website handoff | Explanation, draft retained, connect later | Connected fixture only | URL ownership does not confer edit authority |
| Administrator pending / denial | Permission review and saved draft | Distinct pending and denied scenarios | No launch until scoped authority is granted |
| Connection failed / staging mismatch | Retry/target installation, keep draft | Failed production connection, keep draft | Public page readability is not a successful connection |
| Shared pattern | Isolate selected use then re-review | Isolate selected use then re-review | Other placements remain outside approval |
| Unmapped template | Use mapped homepage section | Use mapped introduction | Keep idea; never imply arbitrary frontend editability |
| Stale source revision | Refresh source and compare again | Refresh source and re-review | Approval invalidated; no silent overwrite |
| Awaiting approval | Exact change table + scope | Before/after and details beside canvas | Publishing stays disabled without approval |
| Publish verification fails | Simulated rollback, draft retained, approval cleared | Unknown status blocks changes until installation check, then fresh approval | No claimed live success from a failed verification |
| Verified publish, no exposure | Milestone message + collection check | Live controls + collection check | Published is distinct from valid exposure |
| Consent withheld / no eligible traffic | Diagnose connection, consent, visibility and targeting | Consent/no-traffic return and collection result | Never ask users to defeat consent or count admin previews |
| Exposure received | Activation milestone and example events | Activity on the same canvas | Events are not unique people or successful enquiries |
| Early return | In-app next action, optional email example | Same page with example evidence | No calendar deadline to call a winner |
| New opportunity | Separate services draft; original live snapshot retained | Current experience stays locked until explicit restore | New editing must not silently change the running experience |
| Pause / restore | Test pause; restore either type | Test pause; restore either type | No presumed working personalisation pause |
| Skip / close / reload | Optional setup hub and saved last step | Saved overview and resume | Nothing publishes by skipping; storage is local only |
| Re-entry | Settings, checklist and introduction reopened | Rerun draft setup after restore or from a draft | Do not erase an active experience to restart a tour |

## What we deliberately did not copy

The master supplies patterns, not a requirement to reproduce every reference app. There is no compulsory role quiz, team invite, paid-feature paywall, cinematic intro, social-credit reward, Mac permission helper or new email/password form here. They would add friction unrelated to the first Accelerate experience. Existing account signup should own work/personal email and authentication; the draft must survive that handoff in implementation.

Plan entitlements are a real prerequisite, but this checkout does not establish a current pricing contract for this concept. The prototype explains the need to check access after value. It does not invent a price, trial limit or included tier.

## Pressure test of the revisions

| Assumption | Evidence status | If wrong | Falsifying test |
|---|---|---|---|
| Earlier draft value improves intent to launch | P1/P13 design rationale; no Accelerate experiment | Users may see a polished generic draft and leave sooner | Compare current flow with draft-first; measure accepted/corrected drafts, valid exposure and D7, not just faster completion |
| Defaults reduce uncertainty without hiding an unsuitable choice | P8 heuristic | Users approve an arbitrary section or unfinishable test | Ask owners to explain why the section and mode were chosen; observe how often they override them |
| Exact change review creates understanding | P10 agent ownership concern | Approval checkbox becomes a reflex | Before approval ask what changes, who sees it, what gets measured and how to restore |
| Optional setup still leads to delivery | P7/P12 rationale | Skips become permanent abandonment | Measure resume, approved publish and valid exposure by skipped milestone; do not make the checklist mandatory based on completion alone |
| Collection diagnosis is actionable for an owner | Inference from real pipeline boundaries | Honest no-data copy still strands the user | Give owners blocked/consent/low-traffic scenarios; see if they identify the next safe action unaided |

The strongest counterarguments remain: the actual bottleneck may be before connection; better-looking outputs may increase automation bias; low traffic still constrains learning; and generated copy can be wrong despite a coherent preview. The revisions expose assumptions and scope but cannot eliminate those risks through UI alone.

Most likely failure: a user likes the draft but defers connection or launch forever. Highest-impact failure: a shared or stale placement is changed incorrectly in the real plugin. The first needs observed funnel evidence; the second needs the transactional WordPress proof described in `onboarding-pressure-test.md`.

## Measurement contract

Keep first value, setup and activation separate:

- **First value:** owner reaches a useful, site-specific draft they can inspect. Track acceptance/correction alongside time-to-first-draft median and p75; rendering any sample is not automatically useful.
- **Setup:** target installation connected, draft reviewed, scope approved, publish verified. Track errors and permission denials, not only successful milestones.
- **Activation candidate:** first valid eligible non-preview exposure of an intentionally approved experience within seven days. Validate its relationship with D7/D30 retention before calling it the activation definition.
- **Guardrails:** wrong-placement changes, source conflicts, failed verification, restore/reversal rate, correction effort, consent gating and provider budget.
- **Attribution:** source and assistant enums may enter approved analytics; optional free text needs a separate restricted retention policy. Do not put URLs, content, emails or raw prompts in general event properties. Self-report versus referrer cohorts stay separate.

The local activity receipts demonstrate bounded event names, state transitions and failure logging; they are not a production SDK or an audit-grade server log. Future events need stable anonymous journey identity, entry/route assignment, elapsed time, capability cohort, source revision and server-verified publish/exposure receipts, with appropriate consent and minimisation. Do not let refreshes or reviewer jumps count as production conversions.

## Acceptance and next experiment

The meaningful next engineering proof remains one private, realistic WordPress section through prepare → preview → approve → publish → verify render → valid exposure → conflict-aware restore, including shared-pattern and concurrent-edit failures. Separately, counterbalance A/B order with a small owner sample to test comprehension and correction effort. Then randomise a larger eligible cohort against existing onboarding. No opt-in agent users versus non-users comparison should be called causal.

This revision has no customer-study result, provider latency/cost receipt, real analytics attribution implementation, email delivery or production WordPress acceptance. Browser/static verification is recorded in `onboarding-flow.md`.


## Route C addendum: a lighter first task

Route C deliberately changes the first win from a prepared experience to a **specific existing block and a reason to act**. It honours the latest request for less creation work. Its complete flow, source evidence and pressure test are in `onboarding-finder.md`.

| Master audit check | C design response / limit |
|---|---|
| Fast first output | Candidates immediately visible on a labelled fixture; real ranking latency unmeasured |
| First task in context | Numbered highlights on the original page, each tied to a concrete existing-content task |
| Minimal profile questions | None; recommended candidate selected |
| Questions change the output | Candidate changes highlight/reason/handoff; source changes certainty and connection needs |
| Attribution | Deferred to account-side research; no artificial wait inserted for a survey |
| AI referral analytics | Outside the isolated prototype; remains a production analytics requirement |
| Permission education | Explain site access before editor handoff; blocked access preserves selection |
| Integrations after value | Candidate first, connection before exact editing authority |
| Designed waiting/failure | No theatrical wait; capture failure and no-candidate states offer existing-content browsing |
| Recommended defaults | One recommended candidate with alternatives and stated reasoning |
| Short optional checklist | No checklist needed for this short journey; contextual guidance is dismissible |
| Skip/resume/re-entry | Save selection and current place locally; return to candidates |
| Success next action | Existing block selected; guidance for the owner's next editor action |
| Events/activation | Local receipt only; editor opened is not a published experience or activation |
| Agent authority | Suggestions only; no generation, mutation, publish tool or new block; existing editor retains its authority |
| State coverage | Access, uncertain/manual mapping, shared pattern, stale source, no result, save/resume and editor handoff modelled |

C still needs real-site validation that users find the advice useful and can complete the next step. A read-only recommendation can be technically cheaper and still fail to remove the user's real bottleneck.
