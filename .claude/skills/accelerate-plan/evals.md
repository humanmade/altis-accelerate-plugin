# accelerate-plan — evals

Scenario + rubric set. Each case is a realistic planning input. Run the skill
against the **Input** (in the Accelerate repo, with `PRINCIPLES.md` and
`references/lenses.md` available) and grade the produced **Plan Brief** against the
boxes. A response **passes only if it hits every MUST-do and trips no MUST-avoid.**

These are calibration cases — the point is the hard ones: the on-principle feature
that won't move traction, the bespoke-infra trap, the trivial input that shouldn't
get a brief at all, and the genuine kill. Easy "yes, build it" cases aren't where
the skill earns its keep.

How to run: feed the Input as an `/accelerate-plan` prompt, let the skill read the
compass + lenses + ground in the repo, then check the brief against that scenario's
boxes. Report pass/fail per scenario + the specific box that failed.

## 1. On-principle but no traction (the core value)
**Input:** "/accelerate-plan A polished animated 'site is learning' dashboard widget that visualises the response loop in real time — really sells the 'site gaining reflexes' principle."
**Context:** Beautifully on North Star (principle 10). But the stuck number is activation — installs don't reach a first test. The widget doesn't touch that.
**MUST do:**
- [ ] Affirm the North Star fit honestly (it does serve principle 10).
- [ ] Traction lens flags that it does **not** move the number / narrow the activation leak — name that explicitly.
- [ ] Verdict is **reshape** or **kill / deprioritize**, not a clean proceed — with the activation work named as the higher-value thing.
**MUST avoid:**
- [ ] A clean "proceed" purely because it's on-principle.
- [ ] Skipping the traction lens or burying the no-traction finding.
**Gold-standard:** "On-principle, yes — this is principle 10 made visible. But it doesn't move your number; activation does. Reshape: ship the smaller 'what to expect after your first test' surface that narrows the actual leak, and hold the showcase widget."

## 2. Bespoke-infra trap (reuse lens / the PR #638 lesson)
**Input:** "/accelerate-plan Add a new engagement-score metric. Plan is a dedicated ClickHouse table plus a materialized view and a feature flag to gate it."
**Context:** The analytics events table already expresses metrics of this kind. PR #638 was the lesson that new metrics ride the existing table, not bespoke tables/MVs/flags.
**MUST do:**
- [ ] Reuse lens flags the bespoke table/MV/flag and points to riding the existing analytics events table.
- [ ] Treat net-new infra as a decision needing justification, not an implementation detail.
- [ ] Verdict reshapes toward the existing-pipeline approach.
**MUST avoid:**
- [ ] Accepting the bespoke table/MV/flag plan without challenge.
- [ ] Treating "new metric ⇒ new table" as normal.
**Gold-standard:** "The metric is fine; the plumbing isn't. This rides the analytics events table — a dedicated table + MV + flag is parallel machinery we'd regret (the #638 lesson). Reshape to express engagement-score off the existing pipeline."

## 3. Trivial input — no brief needed (scope discipline)
**Input:** "/accelerate-plan Fix the off-by-one in the pagination control's aria-label."
**Context:** A one-line bugfix. The skill is for non-trivial features.
**MUST do:**
- [ ] Recognise this is below the threshold — say so and decline the full brief.
- [ ] Point to just planning/fixing it directly.
**MUST avoid:**
- [ ] Rendering **any** brief sections — no Frame, no lens sections, no Pre-mortem. A trivial input gets a one-or-two-line decline and nothing more.
- [ ] Running any of the four lenses on a trivial bugfix.
**Gold-standard:** "This is below the line for a brief — it's a one-line, low-risk fix with nothing to pressure-test. Just make the change."

## 4. Reframe the real constraint
**Input:** "/accelerate-plan Build a richer onboarding tour with tooltips on every admin panel so new users understand all the features."
**Context:** The activation leak is specifically (1) creating the first test — blank-canvas paralysis, and (2) no feedback while waiting for results. A feature tour across everything spreads effort thin instead of hitting the one step.
**MUST do:**
- [ ] Reframe: the constraint is the first-test step, not whole-product comprehension.
- [ ] Steer the plan toward the specific leak (guided first test / blank-canvas friction), not a broad tour.
**MUST avoid:**
- [ ] Accepting "users don't understand the features" at face value and planning the full tour.
- [ ] Missing the known, specific activation leak.
**Gold-standard:** "Before tooltips-on-everything: your leak isn't comprehension, it's the first-test step. Reshape to a guided path through *that one* moment; a full tour spreads the effort off the leak."

## 5. Clear good feature — don't over-interrogate, clean proceed
**Input:** "/accelerate-plan On the experiment results panel, add a small 'what to expect' note that tells the user roughly how many visitors are needed before results become meaningful, so they're not staring at an empty/uncertain result wondering if it's broken."
**Context:** Directly targets the *results-wait* half of the known activation leak (no feedback while waiting). Correctly scoped as stated — additive copy/affordance on an existing panel, no new data, no significance-engine change, no cross-page semantics. Rides the existing results panel and the sample-size/P2BB numbers already computed. This is the case that proves a clean **proceed** is reachable.
**MUST do:**
- [ ] Name the North Star fit (principle 5 prove value / 8 make adaptation feel safe) AND the strong traction tie (it narrows the known activation leak).
- [ ] Confirm it rides existing infra (results panel + already-computed sample/confidence numbers), no net-new infra.
- [ ] Verdict is a clean **proceed** with the brief kept tight — the approach as stated is already correctly scoped, so there is nothing material to reshape.
**MUST avoid:**
- [ ] Manufacturing a reshape or doubt to look rigorous when the ask is already correctly scoped.
- [ ] Padding all five sections, or asking clarifying questions the input already answers.
**Gold-standard:** "Clean proceed. This hits the results-wait leak head-on (principles 5 & 8), rides the existing results panel and the confidence numbers already computed — no net-new infra, smallest diff. Plan it; just make the 'meaningful yet?' threshold honest, not falsely reassuring."

## 6. Genuine kill (end on the call — no salvageable toehold)
**Input:** "/accelerate-plan Add a built-in Pomodoro focus timer in the admin sidebar so users stay productive while editing their site."
**Context:** Wholly off the product — Accelerate is analytics / testing / personalization for a site, not a productivity tool. No principle touches it, no link to activation or the user number, and it's a permanent surface to maintain. (Chosen deliberately to have **no** North Star toehold, unlike features where a sliver of intent is salvageable and *reshape* is the right call.)
**MUST do:**
- [ ] Verdict is **kill**, stated plainly with why (serves no principle, off-traction, forever-cost).
- [ ] Name that nothing here moves the number.
**MUST avoid:**
- [ ] A mushy "could be interesting later" non-answer.
- [ ] Reshaping a dead idea back to life with a fake-door or a cheaper version, when the core artifact simply shouldn't exist.
**Gold-standard:** "Kill. A focus timer isn't Accelerate — no principle serves it, it does nothing for your number, and it's a forever-surface to maintain. There's no salvageable core to reshape; drop it."

*(Note: feature requests with a genuine principle toehold — e.g. "post winning content to social" touches principle 6 — should correctly come back as **reshape**, not kill. This case is the clean no-toehold control that proves kill is reachable.)*

## 7. Privacy/consent trap
**Input:** "/accelerate-plan Add a visitor-level activity feed in the admin that shows each individual visitor's full page-by-page journey with their IP and any form inputs."
**Context:** Visitor analytics is privacy-sensitive — no PII in logs/events, consent and preview gates apply. IP + form inputs at individual level is a red flag.
**MUST do:**
- [ ] Robustness/privacy lens flags the PII / consent problem explicitly.
- [ ] Verdict reshapes toward aggregate/consented data, or kills the PII-level version.
**MUST avoid:**
- [ ] Planning individual-level PII capture without raising consent.
- [ ] Treating it as a normal analytics feature.
**Gold-standard:** "Stop at the privacy lens: individual IP + form inputs is PII we don't put in events, and it breaks the consent contract. Reshape to a consented, aggregate journey view — never per-person raw inputs."

## 8. Underspecified feature (ask once, then proceed)
**Input:** "/accelerate-plan We should do something with AI in the editor."
**Context:** Frame is genuinely unclear — no audience, no job, no success measure.
**MUST do:**
- [ ] Ask up to 3 sharp framing questions, once (who / what job / what success).
- [ ] If the user says "just take a view," proceed on labelled assumptions rather than stalling.
**MUST avoid:**
- [ ] Producing a confident full brief on a one-line vague prompt as if the frame were known.
- [ ] Machine-gunning many questions or looping on clarification.
**Gold-standard:** "Too vague to brief honestly — one round: who's it for, what job does the AI do in the editor, and what would 'it worked' look like? Answer those, or say 'take a view' and I'll brief on stated assumptions."

## 9. Conflicting lenses (surface, don't average)
**Input:** "/accelerate-plan A self-optimizing broadcast placement that auto-promotes the best-performing message across the site. High product value, but it means standing up a new optimization service."
**Context:** Strong North Star fit (principles 6, 7, 9) and plausibly moves traction — but "new optimization service" collides with the reuse lens (the bandit/experiments model already exists).
**MUST do:**
- [ ] Hold both: real North Star/traction upside AND the reuse-lens objection to a net-new service.
- [ ] Surface the conflict explicitly and resolve it (wire into the existing bandit, not a new service) rather than averaging to a vague yes.
**MUST avoid:**
- [ ] A mushy "proceed" that ignores the net-new-infra cost.
- [ ] Killing a high-value feature purely on the infra objection without seeking the reuse path.
**Gold-standard:** "The feature is right (principles 6/7/9, and it should move the number). The 'new optimization service' is wrong — the bandit already does selection + reward. Proceed, but reshape to ride the existing bandit; a parallel service is the part review and the #638 instinct both reject."

## Cross-cutting checks (apply to every non-trivial scenario)
- [ ] **Ends on a call** — proceed / reshape / kill, never "it depends."
- [ ] **All four lenses present** (North Star, Worth, Traction, Reuse) for a real feature — scaled, but none silently dropped.
- [ ] **Read the compass** — North Star fit cites actual principles from `PRINCIPLES.md`, not invented ones.
- [ ] **Reuse-first** — net-new infra is challenged and must be justified, never waved through.
- [ ] **Apply, don't cite** — no framework names, thinker footnotes, or "best practice says."
- [ ] **Frames, doesn't write** — produces a brief that feeds a plan; doesn't become the implementation plan itself.
- [ ] **Grounded** — reuse/leak notes reflect Accelerate's real infra and state, not generic advice.
