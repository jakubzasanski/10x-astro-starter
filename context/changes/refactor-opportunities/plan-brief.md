# Password-length single source of truth (C1) + CI enforcement — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

`MIN_PASSWORD_LENGTH = 8` is duplicated across three TypeScript files and mirrored (un-importably) in `supabase/config.toml` and four i18n strings. Drift has already started — a comment still says "min 6", and the 6→8 raise was a manual fan-out across every copy. We collapse the importable copies into one shared constant, pin the security-floor mirror (`config.toml`) with a test, and make that test a real merge gate. This is the 🥇-ranked refactor opportunity (C1) — highest debt-reduction-per-risk — plus its companion cheap win.

## Starting Point

Three private `const MIN_PASSWORD_LENGTH = 8` copies (`SignUpForm.tsx:9`, `ResetPasswordForm.tsx:9`, `reset-password.ts:7`); no shared constants module in `src/lib/`; two rotten "min 6" comments. CI runs `lint` + `build` only — the Docker-free `npm test` (vitest `unit` project) exists but never gates a merge.

## Desired End State

One `MIN_PASSWORD_LENGTH` in `src/lib/constants.ts` imported by the three sites; a unit test that fails if `config.toml` drifts from it; and a `ci.yml` that runs `npm test` on every PR, so the guard (and all existing handler/unit tests) finally enforce.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Which opportunity | C1 + wire `npm test` into CI | Highest debt-reduction-per-risk refactor plus the multiplier that makes any guard real | Plan |
| C1 scope | 3 TS consts unified + TOML-drift guard | Collapse the importable copies and pin the one mirror that silently weakens the security floor | Plan |
| i18n strings / signup floor | Excluded | "Full" scope would turn a pure refactor into a behavior change; deferred | Plan |
| Enforcement shape | 3 phases, green-then-enforce | Each phase independently revertible; CI flip is a deliberate, separate step | Plan |
| C2 / D1 / D5 / D6 | Out of scope | Keep this a tight, safe, single-purpose change matching the ranking | Research + Plan |
| Characterization test | Not needed | C1 touches only build-checked / test-covered code; that need was C2's | Research |

## Scope

**In scope:** shared constant module; repoint 3 TS sites; remove 2 rotten comments; `config.toml` drift-guard test; `npm test` CI step.

**Out of scope:** C2 (URL contract), D1/D5 characterization tests, D6 (prod config), the `token_hash` mechanism, i18n-string parameterization, `signup.ts` server floor.

## Architecture / Approach

`src/lib/constants.ts` becomes the single source for the importable copies. `config.toml` (GoTrue's authority) and the i18n strings cannot import TS, so the TOML mirror is pinned by a unit test that reads the file and compares; the i18n strings stay manual mirrors (noted for later). Enforcement is layered on last by adding one CI step — no secrets needed, since the unit project mocks Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extract constant | One shared `MIN_PASSWORD_LENGTH`, 3 sites repointed, rotten comments gone | Trivial — value unchanged, build-checked |
| 2. TOML-drift guard (green) | Unit test pinning `config.toml` to the constant | Regex must match the exact TOML line |
| 3. Wire `npm test` into CI | The guard + existing tests gate every PR | CI step must run without Supabase secrets (it does) |

**Prerequisites:** none — all touched code is covered or build-checked.
**Estimated effort:** ~1 session, 3 small commits.

## Open Risks & Assumptions

- The TOML guard reads `config.toml` with a regex, not a TOML parser — assumes the `minimum_password_length = N` line stays single-line (it is).
- The i18n "8" strings remain un-guarded mirrors; a future change may parameterize them (logged in research).
- CI step assumes `npm test` stays Docker-free (`--project unit`); if someone later folds integration into `test`, CI would need Docker — out of scope here.

## Success Criteria (Summary)

- `MIN_PASSWORD_LENGTH = 8` defined exactly once; build/lint/tests green; no "min 6" comment remains.
- Drift guard fails on a deliberate `config.toml` change and passes when restored.
- The PR's CI run shows `npm test` executing and passing — the gate is real.
