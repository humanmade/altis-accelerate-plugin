---
name: accelerate-plan
description: |
  Pre-planning lens for Accelerate features. Runs BEFORE the implementation plan
  and produces a tight "Plan Brief" that pressure-tests a feature against the
  product North Star (PRINCIPLES.md), product-worth, business traction, and reuse of
  existing infra — then hands the brief into normal planning so the plan has to
  honour it. Use for any non-trivial feature, larger change, or
  "should we build X" moment in the Accelerate repo. Self-contained — depends on no
  other skill.
  Triggers: "/accelerate-plan", "/accelerate-plan <feature>", "plan this feature",
  "before we build X", "is this worth building" (in the Accelerate repo).
  NOT for trivial edits / bugfixes (just plan them), and NOT a replacement for the
  implementation plan itself — it frames the plan, it doesn't write it.
user-invocable: true
argument-hint: "<feature or change to plan> [--brief extra context]"
allowed-tools: Read, Glob, Grep, Bash
---

## Purpose

Accelerate has a real North Star (`PRINCIPLES.md`) and hard-won product/traction
judgment, but none of it loads automatically when planning — so larger features get
designed against the engineering guardrails alone, with the *why* left on the shelf.
This skill is the forcing function: a short structured pass that pulls the North
Star, product-worth, traction reality, and reuse discipline into one **Plan Brief**
before any implementation plan is written. The brief becomes the framing the plan
must satisfy.

It frames the plan; it does **not** write it. After the brief, planning continues as
normal (plan mode / the implementation plan), now anchored.

## When to use

Run it for **non-trivial** work: a new feature, a larger change, a consolidation, or
any "should we build X" moment. The test is: *would a wrong call here be expensive
to undo?* If yes, run the brief.

If the input is trivial — a bugfix, a copy tweak, a rename, a mechanical change, a
one-line edit — **do not run the brief.** Decline in one or two lines ("below the
line for a brief — just plan/fix it directly") and stop. Do **not** render a
scaled-down brief, a frame, or any lens sections for trivial work; a mini-brief on a
one-liner is the ceremony this skill is meant to avoid. Scaling down (below) is for
*small-but-real* features, never for trivial edits.

## Usage

```
/accelerate-plan <feature or change>            # full brief, then proceed to plan
/accelerate-plan <feature> --brief <context>    # add constraints/background to weigh
/accelerate-plan                                 # asks what we're planning, then runs
```

## Procedure

1. **Frame it.** Restate the feature in one sentence: who it's for, the job it does,
   what success measurably looks like. If that's genuinely unclear, ask **up to 3**
   sharp questions — once. If unanswered or told "just take a view," proceed on
   stated assumptions and label them. Don't get stuck here.

2. **Read the compass.** Read `PRINCIPLES.md` (repo root) — the product North Star,
   the delta, the response loop. This is non-negotiable; it is the document this
   skill exists to keep in the loop.

3. **Load the lenses.** Read [references/lenses.md](references/lenses.md) — the
   distilled worth / traction / reuse judgment. Apply it; never cite it.

4. **Ground in the repo (silently).** Before the reuse call, check what already
   exists for this problem — the analytics events table, the bandit/experiments
   model, blocks, audiences/personalization. Use `Glob`/`Grep` to confirm whether a
   seam already fits. Don't narrate the search; fold the finding into the brief.

   If the brief leans on an **external fact you can't settle from the repo** — does a
   competitor already do this, is a library/approach viable or still maintained, is
   there a real benchmark — delegate it: invoke the `/research` skill if it's
   available. If `/research` isn't installed (a teammate may not have it), **skip it
   silently, label the unverified point as an assumption, and proceed** — never guess
   a fact as if confirmed, and never block the brief on it. Research is an optional
   accelerant, not a dependency.

5. **Run the four lenses** (in this order — North Star anchors, the rest test):
   - **North Star** — which 1–2 principles this serves; which it risks violating;
     where it sits in the loop (instrument → detect → interpret → target → test →
     propagate → learn).
   - **Worth** — the four risks (want / usable / feasible / viable), routes incl.
     "do nothing," the cheapest 72h test, the pre-mortem.
   - **Traction** — does it move the number (~100 active users) or narrow the known
     activation leak? Or is it on-principle polish that won't move growth? Reframe
     to the real constraint; run the shiny-object check.
   - **Reuse & robustness** — does it ride existing infra, or is net-new justified?
     Enterprise-grade (no orphan/ghost data) without over-guardrailing the happy
     path. Privacy/consent if it touches visitor data.

6. **Render the Plan Brief** (contract below). Keep it tight — it's decision-support
   feeding a plan, not an essay.

7. **Hand off.** End on a verdict — **proceed / reshape / kill**. On *proceed* or
   *reshape*, move into the implementation plan (plan mode), carrying the brief's
   constraints as the frame the plan must honour. On *kill*, stop and say why; don't
   plan something the brief just argued against.

## Plan Brief — output contract

Render the brief in **exactly this format** — verdict as a blockquote callout, Frame
as a table, Worth's risks and routes as tables, the gates and pre-mortem as GitHub
alert blocks. The formatting is part of the contract: it makes the brief scannable.

```markdown
## Plan Brief: <feature>

> **Verdict — <proceed / reshape as X / kill>.** <one or two sentences carrying the call>

**Frame**

| | |
|---|---|
| **Who** | <who it's for> |
| **Job** | <the job it does> |
| **Success** | <what success measurably looks like> |
| **Assumption** *(labelled)* | <any assumption the brief rests on — drop this row if none> |

### 🧭 North Star fit
- **Serves** — <1–2 principles, named from PRINCIPLES.md, with how>
- **Risks violating** — <principle + how, or "none material">
- **In the loop** — <where it sits: instrument → … → learn>

### ⚖️ Worth

| Risk | Rating | Why |
|---|:---:|---|
| **Want** | <H/M/L> | <one line> |
| **Usable** | <H/M/L> | <one line> |
| **Feasible** | <H/M/L> | <one line> |
| **Viable** | <H/M/L> | <one line> |

| Route | Call | What it is |
|---|:---:|---|
| **A — <name>** | <✅/❌/—> | <one line> |
| **B — <name>** | <✅/❌/—> | <one line> |
| **Do nothing** | — | <what it costs or preserves> |

**Cheapest test first** — <the ~72h evidence step, if the bet is uncertain — else "n/a, low-risk">

### 📈 Traction
- **Moves the number?** — <how it touches users / activation / retention — or honestly, "no, it's polish">
- **Real constraint** — <the reframe, if the named ask isn't the real blocker>
- **Shiny-object check** — <needed thing vs interesting thing>

### ♻️ Reuse & robustness
- **Rides** — <existing infra it should sit on — analytics table / bandit / blocks / audiences>
- **Net-new infra** — <none / justified because …>

> [!WARNING]
> **Gates.** <orphan-data / migration / cardinality / consent / privacy notes — only if relevant; drop the whole alert if none apply>

> [!CAUTION]
> **Pre-mortem.** <most likely failure / the concern nobody's voicing — one or two lines>
```

Scale it to the work: a small-but-real feature keeps the Verdict + Frame and only the
two or three lenses that actually bite — drop the lenses that don't apply rather than
padding them, but keep the table/callout formatting for the ones you do render. Scale
up only when the decision is genuinely consequential.

### Choosing the verdict (all three must be reachable)

Reshape is the most common outcome, but it is not the *default* — don't reshape
reflexively to avoid a harder call. Pick deliberately:

- **Proceed** — clears all four lenses cleanly: serves a principle, moves the number
  (or narrows the leak), rides existing infra, smallest diff. Say proceed plainly;
  do **not** manufacture a reshape to look rigorous. A good feature gets a clean yes
  and a tight brief.
- **Reshape** — the *goal* is right but the *approach* fails a lens (bespoke infra,
  wrong constraint, too big a diff, on-principle-but-off-traction). Keep the intent,
  change the route. This is where most real features land.
- **Kill** — the *thing itself* is wrong: serves no principle, doesn't move the
  number, and is off-product or a permanent net-cost. Say kill plainly and why.
  Salvage at most one sentence if a sliver of intent is genuinely reusable — but do
  **not** reshape a dead idea back to life with a fake-door just because one
  principle gives it a toehold. If the core artifact shouldn't exist, kill it.

## Key principles

- **Frame the plan, don't write it.** The brief precedes planning; it never becomes
  the implementation plan. Hand off cleanly.
- **End on a call.** Every brief closes on proceed / reshape / kill. "It depends" is
  banned — say on what, pick the branch, make the call.
- **Apply, don't cite.** Deliver applied judgment in plain language. No framework
  names, no thinker footnotes, no "best practice says."
- **On-principle is necessary, not sufficient.** A feature must clear the North Star
  *and* move traction *and* survive the reuse lens. Surface conflicts between them —
  don't average them into a mushy yes.
- **Reuse is the default.** Net-new tables / MVs / flags / admin screens are a real
  decision that must be justified, never an implementation detail slipped past.
- **Self-contained, with one optional accelerant.** The lens itself requires no other
  skill — a teammate with only this one installed gets the full brief. The single
  exception is `/research`, used *only* to verify external facts and *only if present*;
  it degrades to a labelled assumption when absent. Never add a hard dependency on
  another skill.
- **Delegate facts, don't guess them.** Repo questions you answer with `Glob`/`Grep`;
  external facts (competitors, benchmarks, library viability) go to `/research` if
  available, else become a labelled assumption. Opinion and judgment are this skill's
  job; inventing evidence is not.
