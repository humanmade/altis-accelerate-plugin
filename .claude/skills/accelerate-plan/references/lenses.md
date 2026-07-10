# Planning lenses — the distilled alpha

Deep reference for `/accelerate-plan`. Load when running the brief. The mechanics
here are blended operator judgment — **apply them, never cite them**. The brief
gets the applied call in plain language, not framework names or thinker footnotes.

These three lenses sit *on top of* the product North Star. Read `PRINCIPLES.md`
(repo root) first — that is the compass. These lenses are how you pressure-test a
specific feature against it.

---

## 1. Worth lens — should this exist at all?

The first question is never "how do we build it" — it's "should we, and would a
founder call it unnecessary." Pressure-test in plain words, rate each high/med/low
with one line of reasoning:

- **Want** — will anyone actually use this? Whose day gets better, and would they
  notice if it vanished? A "nice to have" that no real user has asked for is a no.
- **Usable** — can they figure it out without being told? Accelerate's surfaces
  are already dense; new capability that needs a manual usually loses.
- **Feasible** — can we ship it cleanly on what exists? (see Reuse lens) A feature
  that needs net-new infra is a different, larger decision than it looks.
- **Viable** — does the business survive it? Support load, maintenance drag, the
  surface area it permanently adds. Every feature is a forever-cost.

A **high** on *Want* or *Viable* usually decides the whole thing.

**Scenarios, then a pick.** Lay out 2–3 routes *including "do nothing"*, each with
effort / risk / impact / what it forecloses. Then commit to one — "it depends" is
banned as a final answer. If it depends, say on what, pick the likeliest branch,
and make the call for that branch.

**Cheapest test first.** Before a multi-week build on an uncertain bet, name the
step that produces real evidence in ~72 hours: a throwaway prototype in front of
a few users, a fake-door, one round of "would you use this." Watch behaviour, not
opinions. Scale the build to what the test returns.

**Pre-mortem.** One sentence: the most likely way this fails, and the concern
nobody is voicing. Say the uncomfortable thing about the weakest part of the plan
— that is the whole point of the lens.

**Don't guess facts.** Where a route hinges on something external — does a competitor
already ship this, is the library still maintained, is there a real benchmark — send
it to `/research` if that skill is available, and fold the finding in. If it isn't,
mark the point as a labelled assumption and move on. Never present an unverified
external fact as settled; this lens trades in judgment, not invented evidence.

---

## 2. Traction lens — does it move the number?

The product North Star (`PRINCIPLES.md`) is about what Accelerate *is*. The
traction North Star is about whether the business is *growing*. A feature can be
beautifully on-principle and still not move traction. Both must hold.

**The number that matters:** Accelerate toward **~100 active users** (Q1 2026
target — verify it's still current; pull live if the tooling is available, don't
quote a stale figure as if current). It is a *users* metric, not revenue.

**The growth thesis (respect it):** *fix the leak → measure the fix → add volume
→ the number goes up.* Retention/activation comes before acquisition. Pouring
awareness onto broken activation wastes installs.

**The known leak:** activation drop-off at (1) creating the first test —
blank-canvas paralysis, and (2) waiting for results — no timeline or feedback.
A feature that *narrows this leak* earns priority over one that doesn't.

**The planning questions:**

- Does this move users / activation / retention / momentum — or is it adjacent
  polish? Name the mechanism, honestly.
- Is this the **one constraint** actually blocking growth, or a symptom that's
  louder? The named ask is often not the real problem — reframe to the real one
  before planning against it.
- **Shiny-object check.** "We want to build feature X" → would real users notice
  it's missing, or is this ideas-rich / execution-light churn? The failure mode
  to guard against is building the interesting thing instead of the needed thing.
- Heuristics worth applying verbatim: *"Is this Tier 1?"* · *"Am I planning or
  doing?"* · *"Ship one thing before starting another."* · *"Embrace asymmetry —
  1% of the work delivers 50% of the value."*

This lens is allowed to say: *"on-principle, but it won't move the number — do the
smaller activation fix first."* That is often the highest-value thing the brief
can surface.

---

## 3. Reuse & robustness lens — build it on what exists

Accelerate already has the primitives. The default is to **ride them**, not invent
parallel machinery. Building bespoke when an existing seam fits is the most common
and most expensive planning mistake here.

**Ride these before inventing anything:**

- **The analytics events table** — new metrics ride it. Don't build bespoke
  tables, materialized views, or flags for a metric the existing pipeline can
  already express. (This is a hard-won repo lesson — PR #638.)
- **The bandit / experiments model** — self-optimization, variant selection,
  reward signals already have a home. Wire into it, don't fork it.
- **Blocks & editor-native surfaces** — put power where the change happens; a new
  control usually belongs in the editor, not a separate admin screen.
- **Audiences / personalization rules** — targeting primitives exist; extend them.

If the plan genuinely needs net-new infra, **say so explicitly and justify it** —
that's a real decision, not an implementation detail to slip past review.

**Enterprise robustness — calibrated, not maximal:**

- Must be enterprise-grade: no orphaned or ghost data, no half-migrated state, no
  silent truncation. Migrations need a backfill story.
- But **don't over-guardrail mid-flow.** Log hardening gaps deliberately (a
  findings ledger) and tackle them as their own work rather than bloating every
  feature with defensive ceremony. Robustness ≠ paranoia in the happy path.

**Privacy / consent (non-negotiable):** visitor analytics is privacy-sensitive.
No PII in logs or events. Respect consent and preview gates. If the feature
touches visitor data, the brief must name how consent is honoured.

---

## How the lenses combine

A feature has to clear **all three** to earn a clean "proceed":

1. **Worth** — someone needs it; the business survives it.
2. **Traction** — it moves the number, or narrows the known leak.
3. **Reuse** — it rides existing infra (smallest diff), or net-new infra is justified.

…and it has to sit honestly inside the **North Star** (`PRINCIPLES.md`): serving
the delta and the response loop, not fighting them.

When they conflict, surface the conflict — don't average it away. The most useful
brief often says *reshape* ("the goal is right, the approach buys complexity the
reuse lens won't forgive — do it this smaller way instead") rather than a flat yes.
