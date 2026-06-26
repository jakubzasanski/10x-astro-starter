# Opportunity Map

## Context

- **Project / context**: Sage Flashcards repo — carries both the product (Astro SSR app) and the 10xDevs AI toolkit in `.claude/` (31 skills + 23 lesson prompts), plus a maturing CI/CD pipeline tracked in `context/foundation/ci-automation-roadmap.md`. Internal-builder lens.
- **Data constraint**: mock / local / read-only / non-sensitive (git, CI logs, `gh` API, in-repo markdown — no customer/production data). First versions can stay light: no access control or auditing up front.
- **Date**: 2026-06-26

## Map

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| ① AI artifacts copied between repos by hand (`.claude/`: 31 skills + 23 prompts, no source of truth) | Copy-paste, wiki; generically private npm registry / git submodule. `10x-cli get` fetches lessons, not your customized artifacts | One installable package (skills + rules + prompts) — the `m5l4` path (CodeArtifact / GitHub Packages) | Repo with a test pack + manual install into one project | mock / local | Internal tool → **Shared artifact registry** |
| ② No single view of "what blocks merge/release" (cross-check CI run + roadmap slice + change.md + live deploy by hand) | PR checks, branch protection, CI dashboard, roadmap doc. Native "required checks" cover *part* after S-01/S-02 | Read-only digest joining CI run + PR review state + roadmap slice status + deploy state | Local script: `gh` API + `ci.yml` run + roadmap markdown → Markdown digest (mocked JSON exports first) | read-only | Internal tool → **Async digest / Review-CI gate** |
| ③ Roadmap/status drifts from reality (slice status hand-maintained vs git + PRs + deploy) | GitHub Projects, Linear/Jira status, manual roadmap doc. **Partly essential complexity** — ready/blocked is a human judgment | Reconciler flagging drift: "done" with no merged PR; "blocked" with blocker gone | Script comparing slice statuses vs `git log` / PR state → list of mismatches | read-only | Internal tool → Async/CI check (watch essential complexity) |
| ④ Review feedback not a hard gate (recurring findings dumped to per-change markdown) | CODEOWNERS, required reviews, status checks, **existing `10x-impl-review-ci` skill** — largely covered | Encode recurring findings as automated checks (lint rules / impl-review-ci gate) | Already exists — run `10x-impl-review-ci` on a few PRs | read-only | Review / CI gate — **mostly solved → wait / use existing** |
| ⑤ `lessons.md` not surfaced at the right moment | docs/wiki, CLAUDE.md rules, `10x-lesson` writes to `lessons.md` | Inject relevant lessons into plan/implement/review context | A plan/review step that greps `lessons.md` for relevant entries (prompt/skill tweak, not a new tool) | local | **Feature** in existing skills / Wait |

## Recommended First Candidate

```text
Candidate:
  Release-readiness digest (read-only)

Reads:
  - gh API: open PRs, review state + ci.yml run result (pass/fail)
  - .github/workflows/ci.yml — latest run on the PR branch
  - context/foundation/ci-automation-roadmap.md — slice status (ready/blocked/done)
  - wrangler / `gh release` — what is on live master vs last deploy
  (start with mocked JSON exports from these sources)

Returns:
  Markdown digest — sections:
  - Risky PRs (red CI / no review / touches a "blocked" slice)
  - Status<->code drift (slice "done" with no merge; PR merged, slice still "ready")
  - Release readiness (what blocks the next deploy on green master)
  - Decisions for today (links back to sources)

Does not do:
  - own database, login, deployment, scheduling
  - persist any status — only reads and links to GitHub / the roadmap
  - replace GitHub Projects or the roadmap as system of record

Data risk:
  read-only; mocked exports first -> then `gh` API (own/non-sensitive repo)

Direction if it proves valuable:
  Internal tool → Async digest (cron / PR comment), possibly composed with a Review-CI gate
```

## Why This Candidate

② scores highest on "combines >=2 sources" — its value is the **local join of signals no single SaaS sees** (GitHub does not know a slice's status in `ci-automation-roadmap.md` nor the live Worker state). It is the lesson's flagship "complement" example, fully read-only/mockable, and deliberately does not pretend to be the system of record.

- **①** is strong but the project is **already executing it** (`m5l4-*` prompts + `pack-init`/`setup-cicd`/`tf-registry` skills) — an in-flight build, not an open decision; and its join is one-dimensional.
- **④** is mostly solved natively + by `10x-impl-review-ci` → wait / use existing.
- **③** carries essential complexity (status is human judgment) — easy to build a reconciler that mistakes a decision for drift.
- **⑤** is a feature inside existing skills, not a separate tool.

## Next Direction If Valuable

Chosen next move: **validate, then shape** — `/10x-mom-test` → `/10x-shape` → `/10x-prd` → `/10x-roadmap`.

Cheapest first step before any code: a short conversation with the people who live with the friction (here: whoever cuts releases / maintains the roadmap) — they often know *why* the friction exists and whether the picture is complete. Then pressure-test with The Mom Test: ask about the last concrete time release readiness was unclear, current workarounds, and the real cost — not whether they'd "use such a tool".
