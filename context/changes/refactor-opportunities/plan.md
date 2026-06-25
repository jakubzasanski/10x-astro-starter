# Password-length single source of truth (C1) + CI enforcement — Implementation Plan

## Overview

Collapse the duplicated `MIN_PASSWORD_LENGTH` policy constant (today 3 independent TS copies) into one shared module, pin the one mirror that cannot be a TS import (`supabase/config.toml`) with a drift-guard test, and then turn that guard into a real merge gate by wiring the Docker-free `npm test` project into CI. This is the 🥇-ranked refactor opportunity from `research.md` (candidate C1), chosen as the single safe change, plus its companion cheap win (CI wiring).

## Current State Analysis

`MIN_PASSWORD_LENGTH = 8` is declared independently in three TypeScript modules and mirrored as a raw integer in TOML and in four i18n strings:

- `src/components/auth/SignUpForm.tsx:9` — `const MIN_PASSWORD_LENGTH = 8;` (used at `:35`, `:59`).
- `src/components/auth/ResetPasswordForm.tsx:9` — same const (used at `:28`, `:52`).
- `src/pages/api/auth/reset-password.ts:7` — same const (used at `:13` in `z.string().min()`, `:28` in the error string). A **rotten comment at `:9` still says "minimum_password_length = 6"**.
- `supabase/config.toml:190` — `minimum_password_length = 8` (the real enforcement authority via GoTrue; not importable by TS).
- `src/i18n/en.ts:99,105` + `src/i18n/pl.ts:98,104` — four prose strings hardcoding "8".
- `test/handlers/reset-password.test.ts:8` — a header comment also says "password min 6" (rotten).

The duplication was a deliberate-but-soft decision (`account-access-recovery/plan.md:167-169`: "reuse/duplicate the value as SignUpForm does"); the 6→8 raise (commit `dc056b0`, impl-review F3) was exactly the manual fan-out a single source would prevent. No shared constants module exists in `src/lib/` (only `config-status.ts`, `supabase.ts`, `utils.ts`, `services/`) — verified by ast-grep + grep (research §⑥ V4).

**CI gate reality (research §②, §⑥ V10):** `.github/workflows/ci.yml` runs only `astro sync` → `lint` → `build`. `package.json` defines `test` = `vitest run --project unit` (Docker-free; globs `src/**/*.test.ts` + `test/handlers/**/*.test.ts`), but **no workflow runs it**. So any guard added is local-only until a `npm test` step is added to CI.

## Desired End State

- A single exported `MIN_PASSWORD_LENGTH` lives in `src/lib/constants.ts`; the 3 TS sites import it; the 2 rotten "min 6" comments are gone.
- A unit test (`src/lib/constants.test.ts`) reads `supabase/config.toml` and fails if its `minimum_password_length` ever drifts from the constant.
- `ci.yml` runs `npm test`, so the drift guard and all existing handler/unit tests gate every PR to master.
- Verify: `npm run build` + `npm run lint` green; `npm test` green locally; a CI run on the PR shows the new `npm test` step passing.

### Key Discoveries:

- Unit project globs (`vitest.config.ts`): `src/**/*.test.ts` + `test/handlers/**/*.test.ts` — so `src/lib/constants.test.ts` lands in the unit project automatically; no config change needed.
- `npm test` needs **no Supabase secrets** (unit project mocks Supabase via `test/stubs/astro-env-server.ts`), so the CI step is a bare `- run: npm test`.
- No uncovered code is touched: the reset handler is covered by `test/handlers/reset-password.test.ts`; the two React components are build-/type-checked. Therefore **no characterization test is required** before refactoring (that need belonged to C2, which is out of scope).
- `@/*` → `src/*` path alias (tsconfig + vitest alias), so imports are `@/lib/constants`.

## What We're NOT Doing

- **C2** (reset-link URL contract symbol) — deferred; enters the sensitive auth/runtime zone and needs a D1 characterization test first.
- **D1 / D5 characterization tests** (F1 expired-session guard, GUEST_ONLY exclusion) — out of scope; logged in `research.md` for a future change.
- **D6** (production Supabase config drift) — out of repo, nothing to refactor.
- **Touching the `token_hash`/`type=recovery` mechanism** — a load-bearing decision, not debt.
- **Parameterizing the 4 i18n "8" strings and adding a server-side length floor in `signup.ts`** — the "Full" scope option was not chosen; the TOML guard covers the highest-risk mirror (the security floor). The i18n strings remain manual mirrors (noted for a future change).

## Implementation Approach

Three independently reversible commits, ordered cheapest-and-most-independent first, following "mechanisms land green, enforcement is turned on as a separate explicit step": (1) pure refactor, build-checked; (2) add the guard test and see it green locally — no CI change; (3) flip enforcement on by adding the CI step. Each phase is a clean revert if it misbehaves.

## Phase 1: Extract the password-length constant to a single source

### Overview

Introduce `src/lib/constants.ts` and repoint the three TS declaration sites at it; remove the two rotten "min 6" comments. Pure structural change — no behavior change (value stays 8).

### Changes Required:

#### 1. New shared constant module

**File**: `src/lib/constants.ts`

**Intent**: Create the single source of truth for the minimum password length so the three TS sites stop each owning a private copy.

**Contract**: Export `export const MIN_PASSWORD_LENGTH = 8;`. Plain module under `src/lib/` (per CLAUDE.md, helpers live in `src/lib/`), importable as `@/lib/constants`.

#### 2. Repoint the three consumers

**File**: `src/components/auth/SignUpForm.tsx`, `src/components/auth/ResetPasswordForm.tsx`, `src/pages/api/auth/reset-password.ts`

**Intent**: Replace each local `const MIN_PASSWORD_LENGTH = 8;` (lines `:9`, `:9`, `:7`) with an import of the shared constant. Existing use-sites (`SignUpForm:35,59`; `ResetPasswordForm:28,52`; `reset-password.ts:13,28`) are unchanged — they keep referencing the same identifier.

**Contract**: Add `import { MIN_PASSWORD_LENGTH } from "@/lib/constants";`; delete the local declaration. No signature or value change.

#### 3. Kill the rotten comments

**File**: `src/pages/api/auth/reset-password.ts:9`, `test/handlers/reset-password.test.ts:8`

**Intent**: Both comments say the floor is "6" when the real contract is 8 — remove or correct them so the only "6" in the tree is gone (the drift the prior analysis flagged).

**Contract**: Comment-only edits; no code/behavior change.

### Success Criteria:

#### Automated Verification:

- Type check + generated types resolve: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Existing unit + handler tests pass locally: `npm test`
- No remaining rotten "min 6" comment (both sites — the `minimum_password_length = 6` in `reset-password.ts:9` AND the `password min 6` in `reset-password.test.ts:8`): `grep -rniE "minimum_password_length = 6|password min 6" src test` returns nothing
- Constant is defined exactly once: `grep -rn "MIN_PASSWORD_LENGTH = 8" src` returns only `src/lib/constants.ts`

#### Manual Verification:

- Sign-up and reset-password forms still reject a 7-char password and accept an 8-char one in the running app (`npm run dev`).

**Implementation Note**: After Phase 1 automated verification passes, pause for human confirmation of the manual check before Phase 2.

---

## Phase 2: Add the config.toml drift guard (green locally)

### Overview

Add a unit test that pins the un-importable TOML mirror to the TS constant. This phase adds the mechanism and proves it green locally — it does **not** change CI.

### Changes Required:

#### 1. Drift-guard unit test

**File**: `src/lib/constants.test.ts`

**Intent**: Fail the unit suite if `supabase/config.toml`'s `minimum_password_length` ever diverges from `MIN_PASSWORD_LENGTH`, closing the one drift surface that the type system cannot see and that weakens the security floor if it slips.

**Contract**: A vitest in the `unit` project (matches glob `src/**/*.test.ts`). It (a) asserts `MIN_PASSWORD_LENGTH === 8` (lock the value), and (b) reads `supabase/config.toml` from disk (Node `fs` in the node test environment), extracts `minimum_password_length` via a regex (`/^minimum_password_length\s*=\s*(\d+)/m`), and asserts it equals `MIN_PASSWORD_LENGTH`. No new dependency — plain `fs.readFileSync` + regex, not a TOML parser. Resolve the path anchored to the test file, not cwd: `fileURLToPath(new URL("../../supabase/config.toml", import.meta.url))` (from `src/lib/` → repo root is two levels up; mirrors how `vitest.config.ts` resolves its alias paths) so the read is robust regardless of the working directory `vitest` is invoked from.

### Success Criteria:

#### Automated Verification:

- New test runs in the unit project and passes: `npm test`
- Guard actually bites (sanity, revert after): temporarily change `config.toml:190` to `7` → `npm test` fails on the new test; restore to `8` → green.
- Linting passes on the new file: `npm run lint`

#### Manual Verification:

- Confirm the failure message names the drift clearly (config value vs constant) when the sanity tweak is applied.

**Implementation Note**: After Phase 2 automated verification passes, pause for human confirmation before Phase 3. CI is intentionally untouched in this phase.

---

## Phase 3: Turn on enforcement — wire `npm test` into CI

### Overview

Add the Docker-free `npm test` step to the CI workflow so the drift guard and all existing unit/handler tests gate every PR. Separate, reversible commit — the deliberate enforcement flip.

### Changes Required:

#### 1. CI test step

**File**: `.github/workflows/ci.yml`

**Intent**: Make the unit project a merge gate, converting every guard (this one and future) from local courtesy into enforcement — the cross-cutting fix research §② identified as highest leverage.

**Contract**: Add `- run: npm test` to the `ci` job after `- run: npm run lint`. No `env:` block needed (unit project mocks Supabase, needs no secrets). Leaves `astro sync`, `lint`, `build` steps intact.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is valid and the step appears: `grep -n "npm test" .github/workflows/ci.yml`
- The CI run triggered by the PR shows the `npm test` step executing and passing (check the Actions run / `gh run watch`).
- `lint` and `build` steps still pass in the same run.

#### Manual Verification:

- On the PR, confirm the new step is present in the Actions log and that a deliberately-introduced guard failure (local trial) would block merge — i.e. the gate is real, not skipped.

**Implementation Note**: This is the enforcement step. After it lands green on the PR, the change is complete.

---

## Testing Strategy

### Unit Tests:

- `src/lib/constants.test.ts` — value lock + `config.toml` drift guard (the new mechanism).
- Existing `test/handlers/*.test.ts` and `src/**/*.test.ts` — must stay green after the refactor (regression check that repointing the import didn't change behavior).

### Integration Tests:

- None added. The integration project (RLS) is unrelated to this change and stays out of CI (needs Docker).

### Manual Testing Steps:

1. `npm run dev`, open `/auth/signup` and `/auth/reset-password`; verify a 7-char password is rejected and 8-char accepted.
2. Apply the Phase 2 sanity tweak (`config.toml` → 7), run `npm test`, confirm a clear failure, restore to 8.
3. On the PR, confirm the CI `npm test` step runs and passes.

## Performance Considerations

None. Constant extraction and a single file-read test have no runtime impact; the CI step adds a few seconds of Docker-free test execution.

## Migration Notes

No data or API migration. The value stays 8 throughout, so there is no behavioral change for existing users; each phase is a clean `git revert`.

## References

- Related research: `context/changes/refactor-opportunities/research.md` (candidate C1; §② CI fact; §⑥ verification V1–V5, V10)
- Prior decision (duplicate-the-value): `context/archive/2026-06-21-account-access-recovery/plan.md:167-169`; raise 6→8: `reviews/impl-review.md:47-56` (F3)
- Pattern for unit/handler tests: `test/handlers/reset-password.test.ts`, `vitest.config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract the password-length constant to a single source

#### Automated

- [x] 1.1 Type check + generated types resolve (`astro sync && astro check`) — c6ef279
- [x] 1.2 Linting passes (`npm run lint`) — c6ef279
- [x] 1.3 Production build passes (`npm run build`) — c6ef279
- [x] 1.4 Existing unit + handler tests pass locally (`npm test`) — c6ef279
- [x] 1.5 No remaining "min 6" comment (both sites) in src/test — c6ef279
- [x] 1.6 `MIN_PASSWORD_LENGTH = 8` defined only in `src/lib/constants.ts` — c6ef279

#### Manual

- [x] 1.7 Forms reject 7-char / accept 8-char password in running app — c6ef279

### Phase 2: Add the config.toml drift guard (green locally)

#### Automated

- [x] 2.1 New test runs in unit project and passes (`npm test`) — eeed2fa
- [x] 2.2 Guard bites on a deliberate `config.toml` tweak, green when restored — eeed2fa
- [x] 2.3 Linting passes on the new test file — eeed2fa

#### Manual

- [x] 2.4 Failure message clearly names config-vs-constant drift — eeed2fa

### Phase 3: Turn on enforcement — wire `npm test` into CI

#### Automated

- [x] 3.1 `npm test` step present in `.github/workflows/ci.yml` — cb703de
- [x] 3.2 PR CI run shows `npm test` executing and passing — cb703de
- [x] 3.3 `lint` and `build` steps still pass in the same run — cb703de

#### Manual

- [x] 3.4 Confirm the gate is real (a guard failure would block merge) — cb703de
