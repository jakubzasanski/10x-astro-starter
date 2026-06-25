<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Password-length single source of truth (C1) + CI enforcement

- **Plan**: context/changes/refactor-opportunities/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-06-25
- **Verdict**: APPROVED
- **Findings**: 0 critical · 0 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- **Plan-drift review** (independent sub-agent): every planned change verified MATCH; nothing MISSING or EXTRA. Out-of-scope boundaries all respected — `src/pages/api/auth/signup.ts`, `src/i18n/*`, `src/pages/auth/reset-password.astro`, and the token_hash/type=recovery mechanism were not touched. No C2 symbol, no D1/D5 characterization tests, no D6 prod config.
- **Safety/quality review** (independent sub-agent): clean. Empirically re-verified the drift guard bites on a deliberate `config.toml` tweak and restored the file; both new files lint clean (no non-null assertion — explicit `if (!match)` guard + `Number(match[1])`); regex matches the real config line; path resolution `src/lib/ → repo root` is correct and cwd-independent; the CI `npm test` step needs no secrets (unit project mocks Supabase).
- **Automated success criteria (re-run live at review time)**: `npm run lint` PASS · `npm run build` PASS · `npm test` 154 passed · `grep` for rotten "min 6" comments → none · `MIN_PASSWORD_LENGTH = 8` defined only in `src/lib/constants.ts` · `npm test` present in `.github/workflows/ci.yml`.
- **Manual criteria**: 1.7 (forms reject 7-char / accept 8-char), 2.4 (drift failure message names config-vs-constant), 3.4 (CI gate is real) — all confirmed by the user with observable evidence; CI green on the PR.
- Working tree confirmed clean after review (review agent's temporary `config.toml` tweak was restored to 8).

## Findings

### F1 — Drift guard couples to config.toml file location

- **Severity**: ◽ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/constants.test.ts:17
- **Detail**: The test reads `supabase/config.toml` from disk by relative path. If the file is moved/renamed the test fails loudly with the explicit "missing line" error rather than silently passing — the correct fail-safe direction. Acknowledged, not a defect.
- **Decision**: ACCEPTED (no action — correct fail-safe behavior)

### F2 — Belt-and-suspenders literal assertion

- **Severity**: ◽ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/constants.test.ts:12-14
- **Detail**: `it("is locked at 8")` hard-codes 8 alongside the config-vs-constant equality test. Intentional and defensible per the plan's contract (pins the constant AND pins config to it). Leave as-is.
- **Decision**: ACCEPTED (no action — intentional per plan contract)
