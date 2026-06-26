# Mom Test Validation Plan

## Input Idea

**Release-readiness digest (read-only)** — candidate ② from `context/team/opportunity-map.md`. A thin complement that reads `gh` API (open PRs, review state, `ci.yml` run result), the latest CI run, `context/foundation/ci-automation-roadmap.md` slice statuses, and live deploy state, then emits a Markdown digest: risky PRs, status↔code drift, release readiness, decisions for today. It does not persist state or replace GitHub/the roadmap as system of record.

**Context shift discovered during validation:** the repo is **single-maintainer** (no team). The candidate was framed as *team* friction; solo, the coordination half of that premise collapses.

## Hypotheses

- **User/role**: solo maintainer of Sage Flashcards (you), who cuts releases and hand-maintains `ci-automation-roadmap.md`. Proxy users: other solo 10xDevs maintainers running a comparable CI/CD pipeline.
- **Friction**: before merging/releasing, you cross-check several places by hand (CI run, roadmap slice status, change.md, live deploy state) to know what blocks the next release, and the roadmap doc drifts from actual git/PR state.
- **Current workaround**: holding state in your head + opening GitHub Actions, the roadmap markdown, and `git log` ad hoc; manually editing slice statuses after the fact.
- **Risky assumptions**:
  1. That "what blocks release" is a *recurring measurable cost* and not a ~30-second mental check one person already holds in their head.
  2. That the cross-system join saves real time when one person already knows the CI + deploy state from having done the work.
  3. That a digest built for an audience of one will actually get read — you already reload the context when you sit down to release.
  4. That status↔code drift hurts *you* (vs. only hurting a second person who trusts the doc).
  5. That the friction recurs often enough (releases are still infrequent — S-02 release automation isn't even built yet).
- **Evidence already present**:
  - *For*: the roadmap baseline audit was re-done by hand on 2026-06-26; statuses are maintained manually across git + PRs + deploy; CI is still one job with no native release gating.
  - *Against*: zero recorded incidents of a release going wrong because state was unclear; no teammate exists to be blocked; the strongest sub-signals (no owner / unnoticed PR / inter-person status drift) are team signals absent here.

## Critique

The opportunity map ranked ② first because it "combines ≥2 sources" — the strongest *complement* criterion. That ranking assumed a team. Solo, the join is still real (CI + roadmap + deploy are genuinely separate places), but the *coordination* value — the part that makes a digest worth reading every morning — largely evaporates. One person re-deriving their own state is annoyance, not a repeated coordination cost.

This is exactly the essential-vs-accidental check from the lesson: some of this friction is accidental (the roadmap doc *could* be auto-reconciled against git) and some is essential (deciding "ready/blocked" is your judgment; a tool can't make it). And it is the build-vs-buy trap in miniature: the moment release automation lands (S-02/S-03), GitHub's native required-checks + release UI answers most of "what blocks the release" for free — so building a digest now risks racing your own roadmap.

The honest danger: validating by asking yourself "would this be handy?" will return a polite yes. The Mom Test discipline here is to interrogate your **own past behavior** — count actual occurrences in git history, not imagined convenience — and to check whether peers feel a *recent, specific* version of the same pain without being led.

## Interview Guide (20–30 min)

Solo target = a structured **self-audit of past behavior** (treat git/PR/deploy history as the interview transcript). Proxy target = other solo 10xDevs maintainers. Keep every question about what already happened — never "would you use…".

**1. Context warm-up**
- Walk me through your last release end-to-end — what did you open, in what order, before you were confident to ship?
- How often do you actually cut a release right now? (look at tags / deploy history, not memory)

**2. Recent story (the core)**
- When was the last time you were unsure whether something was safe to merge or release? What exactly was unclear, and what did you do to resolve it?
- The last time you updated a slice status in `ci-automation-roadmap.md` — what triggered it, and how did you know the old status was wrong?

**3. Current workaround**
- Today, with no new tool, how do you find out which open PR is blocking the next release? Show me the actual clicks.
- How do you currently notice that the roadmap doc and git have drifted? Has drift ever survived more than a day?

**4. Cost of pain**
- The last time release state was unclear — how much time did it actually cost, and did it cause a wrong merge, a re-deploy, or just a pause?
- Has unclear release readiness ever caused a real problem (broken deploy, lost work, shipped regression)? Walk me through it. (If none → strong no-build signal.)

**5. Existing alternatives**
- What did GitHub's own checks / Actions tab / branch protection already tell you here? Where did they fall short?
- Did you ever start building something for this and stop? What made it not worth finishing?

**6. Decision signal**
- What would have to be true — how often, how costly — for you to spend a day building and then maintaining a digest for this?

**7. Closing**
- Can I look at your last 5 releases' PR/CI/deploy history to count how often state was genuinely unclear?

*Optional follow-ups:* if they mention drift → "did anyone (or future-you) ever act on the stale status?"; if they mention a manual ritual → "how long has that ritual existed and why hasn't it annoyed you into fixing it?"

## Survey (for the solo-maintainer 10xDevs cohort)

Screener first; behavior over opinion; no solution-rating.

1. **(Screener)** In the last 3 months, how many releases/deploys have you personally cut? — `0` / `1–2` / `3–5` / `6+`  *(0 → end survey)*
2. How many separate places do you check before merging/releasing to know what's blocking it? — `1` / `2` / `3` / `4+`
3. In the last month, how often were you unsure whether something was safe to release? — `Never` / `Once` / `2–3×` / `Weekly+`
4. The last time it was unclear, what did it cost? — `Nothing, resolved in seconds` / `A few minutes` / `A wrong merge or re-deploy` / `A shipped regression`
5. How do you track which work is done vs in-flight? — `In my head` / `Issues/Projects` / `A markdown/roadmap doc` / `I don't really`
6. Has your status tracker (doc/board) ever drifted from actual git state? — `Never` / `Rarely` / `Often` / `It's always a bit off`
7. **(Open)** Describe the last specific time you were unsure what blocked a release — what happened?
8. **(Open)** What, if anything, did you build or hack together for this — and do you still use it?

## Decision Criteria

- **Proceed**: across your last 5 releases (self-audit) you hit genuinely-unclear release state **≥3 times** AND it cost real time/rework at least once, **and** ≥40% of surveyed solo maintainers report it happening weekly+ with a concrete recent example. Start with the *mocked Markdown digest* — no live integration yet.
- **Narrow scope**: drift is real but only the **document↔code reconciliation** part recurs (statuses go stale), while live release-readiness is fine → build only a tiny `git log` vs roadmap-status drift checker, drop the rest.
- **Do not build yet**: fewer than 3 occurrences in the last 5 releases, no incident ever caused by unclear state, and the honest answer is "I already know this in my head" → the friction is annoyance, not a repeated cost. Revisit when a second contributor appears or release cadence rises.
- **Try existing tool/process first**: ship **S-01 (CI test pyramid)** + **S-02 (branch protection + release-please)** from the roadmap first. Native required-checks + the release UI may answer "what blocks the release" for free, and a habit/checklist covers the rest — making the digest unnecessary before it's built.
