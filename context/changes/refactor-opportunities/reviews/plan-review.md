<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Password-length single source of truth (C1) + CI enforcement

- **Plan**: context/changes/refactor-opportunities/plan.md
- **Mode**: Deep
- **Date**: 2026-06-25
- **Verdict**: SOUND (one quick fix recommended)
- **Findings**: 0 critical · 1 warning · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS (2 observations) |
| Plan Completeness | WARNING |

## Grounding

7/7 paths ✓ (`constants.ts` correctly absent), 3/3 symbol declarations ✓ (`SignUpForm.tsx:9`, `ResetPasswordForm.tsx:9`, `reset-password.ts:7`), `config.toml:190` = 8 ✓, `ci.yml` runs `astro sync → lint → build` with no `npm test` ✓, `package.json` test = `vitest run --project unit` ✓, brief↔plan ✓, Progress↔Phase 1.1–3.4 all map and format valid ✓.

Deep verification (sub-agent) confirmed all risky claims: unit project runs in `node` environment (`vitest.config.ts:20,36`) so `fs.readFileSync`/`fileURLToPath` work; `../../supabase/config.toml` from `src/lib/` correctly resolves to repo root; `npm test` needs no Supabase secrets (handler tests `vi.mock("@/lib/supabase")`); CI build step's secret `env:` block is build-only; blast radius is exactly the 3 declared TS sites — no hidden importers.

## Findings

### F1 — Phase 1 grep check misses the second rotten comment

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria (check 1.5)
- **Detail**: Phase 1 step 3 removes both rotten comments (`reset-password.ts:9` "minimum_password_length = 6" and `reset-password.test.ts:8` "password min 6"), and Desired End State promises "the 2 rotten 'min 6' comments are gone." But check 1.5's grep pattern `minimum_password_length = 6` matches only the first comment — the test-file comment ("password min 6") slips through, so the check can pass green with comment #2 left behind.
- **Fix**: Broaden 1.5 to `grep -rniE "minimum_password_length = 6|password min 6" src test` returns nothing.
- **Decision**: FIXED (broadened grep in Success Criteria + Progress 1.5)

### F2 — "Single source of truth" is partial: i18n prose unguarded

- **Severity**: ◽ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Desired End State / What We're NOT Doing
- **Detail**: `en.ts:99,105` (+ `pl.ts`) hardcode "8" in user-facing prose; the drift guard pins `config.toml` but not these strings. If the floor ever changes, the 3 consts + config.toml move together but the prose silently lies. The plan explicitly scopes this out and logs it for a future change — acknowledged, not a gap. Noting only that the title's "single source of truth" stays aspirational for display strings.
- **Decision**: ACCEPTED (explicitly scoped out and logged in research)

### F3 — TOML guard's no-match path is unspecified

- **Severity**: ◽ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 2 — drift-guard contract
- **Detail**: The regex `/^minimum_password_length\s*=\s*(\d+)/m` handles value drift (8→7). But if the key is deleted/renamed, `match` returns null and the test throws a raw TypeError instead of a clear "config key missing" message. Still red (correct), but the message won't name the drift. Cheap to harden: assert the match is non-null with an explicit message before comparing.
- **Decision**: ACCEPTED (functionally still fails red; message clarity is a Phase 2 implementation detail)
