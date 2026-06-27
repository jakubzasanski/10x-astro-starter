<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: CI — Full Test Pyramid

- **Plan**: context/changes/ci-test-pyramid/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-27
- **Verdict**: NEEDS ATTENTION (no blockers; all fixes LOW-impact) → F1 fixed, rest accepted
- **Findings**: 0 critical · 2 warnings · 3 observations
- **Evidence**: green pipeline run 28283339958 (lint-unit-build + integration + e2e + AI Code Review)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (4 deliberate, documented, green deviations) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → fixed (F1) |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Plan deviations (all deliberate, documented in-file, verified green)

1. E2E recipe extracted to reusable `e2e.yml` (`workflow_call`) shared by ci.yml + nightly-e2e.yml — replaces the plan's inline-e2e + duplicated-nightly. DRY improvement.
2. E2E job sets local-demo `SUPABASE_URL/KEY` env AND writes `.dev.vars` — the previewed app on Cloudflare workerd reads runtime vars from `.dev.vars`, not process.env; plan's "no SUPABASE_* for e2e" conflated GitHub prod secrets with env vars. Integration job correctly stays env-free (vitest uses test/support/config.ts fallback).
3. `supabase/setup-cli` pinned to `2.107.0` (lockfile parity) — config.toml uses keys older CLIs reject. Deterministic gate.
4. Artifact upload `if: failure()` (not plan's `!cancelled()`) — green-run reports are cost/noise. Trade-off: a flaky-but-passed test leaves no trace (re-run to reproduce).

## Findings

### F1 — New workflows declare no permissions: block

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: ci.yml, e2e.yml, nightly-e2e.yml (top-level)
- **Detail**: None of the three new workflows set a top-level `permissions:` block, so GITHUB_TOKEN inherits the repo default (often read/write). They only need `contents: read`. review.yml/review-run.yml already pin explicit minimal permissions — the real intra-repo inconsistency.
- **Fix**: Add `permissions: { contents: read }` to all three (in e2e.yml the reusable file caps what callers grant).
- **Decision**: FIXED (added `permissions: contents: read` to all three workflows)

### F2 — Pinned Supabase CLI version duplicated in two files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency / Maintainability
- **Location**: ci.yml:48 (integration) + e2e.yml:33 (reusable)
- **Detail**: `version: 2.107.0` hardcoded in two places that must stay in lockstep with package-lock.json. A future bump risks updating one and not the other → silent config-parse divergence.
- **Fix**: Acceptable as-is (adjacent); document the coupling or let S-04/Dependabot track it.
- **Decision**: SKIPPED (user)

### F3 — Playwright cache has no restore-keys

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Cost / Reliability
- **Location**: e2e.yml:35-39
- **Detail**: Any package-lock.json change invalidates the whole browser cache → full `playwright install`. A `restore-keys: ${{ runner.os }}-playwright-` fallback would reuse near-miss binaries.
- **Fix**: Add `restore-keys`.
- **Decision**: SKIPPED (user)

### F4 — nightly/e2e declare no concurrency group

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Cost
- **Location**: nightly-e2e.yml
- **Detail**: A manual dispatch during a scheduled run would double-run. Harmless (nightly is a safety net, not a gate).
- **Fix**: Optional concurrency group on nightly-e2e.yml.
- **Decision**: SKIPPED (user)

### F5 — Floating action tags vs SHA-pinned in review.yml

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: ci.yml/e2e.yml @v4/@v1
- **Detail**: Deliberate per plan (Dependabot/S-04 will bump). review.yml SHA-pins because it handles a secret; pyramid jobs don't.
- **Fix**: None needed; add github-actions Dependabot ecosystem in S-04 to make "Dependabot bumps" real.
- **Decision**: SKIPPED (user)

## Post-merge manual checklist (Progress rows still open)

- 1.3 concurrency-cancel on overlapping pushes
- 2.2 job time acceptable
- 3.3 HTML report opens with traces
- 3.4 flake rate across runs
- 4.2 Nightly E2E manual dispatch green
