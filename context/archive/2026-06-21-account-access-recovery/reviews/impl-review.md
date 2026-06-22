<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account Access — Password Reset + Auth Verification

- **Plan**: context/changes/account-access-recovery/plan.md
- **Scope**: Full plan (Phases 1–4 of 4)
- **Date**: 2026-06-22
- **Verdict**: NEEDS ATTENTION → RESOLVED (F1–F4 fixed, F5 accepted during triage)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Session-expired resubmit traps the user in the reset form

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence (+ Correctness)
- **Location**: src/pages/auth/reset-password.astro:14
- **Detail**: `let showForm = Boolean(error)` is only flipped false by a failed verifyOtp (needs a token_hash a POST-error redirect never carries). Plan Phase 2 §3 states "if the user took too long, updateUser will fail and we fall through to the expired message" — but once the recovery session expires, the route redirects to `?error=session expired`, and `error` alone forces `showForm=true`, so the page re-renders the form forever and never reaches the "request a new link" panel. Documented-intent divergence + UX dead-end (narrow: needs the 1h window to lapse with the form open).
- **Fix**: In the relayed-error branch (error present, no token_hash), confirm the recovery session is still active via `supabase.auth.getUser()` and show the form only if a user exists; else fall through to the expired panel.
  - Strength: Matches plan intent; reuses the SSR client; turns dead-end into correct expired UI.
  - Tradeoff: One extra getUser() call on the rare post-POST-error reload.
  - Confidence: HIGH — getUser is the middleware's own session check.
  - Blind spot: None significant; happy path and junk-token path unaffected.
- **Decision**: FIXED — added a getUser() session check to the relayed-error branch (reset-password.astro)

### F2 — E2E throwaway user never cleaned up

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/e2e/password-reset.spec.ts:20
- **Detail**: tests/e2e/CLAUDE.md requires afterEach cleanup. The happy-path test mints a timestamped throwaway user but never deletes it, so local auth users accumulate. Intent (collision-free re-runs) is met via the timestamp; hygiene-only deviation. No deleteUser helper exists, so the plan called cleanup "optional."
- **Fix**: Add an admin-API user-delete helper + afterEach, OR add a one-line comment documenting the deliberate exception.
- **Decision**: FIXED — added deleteUserByEmail admin helper (test/support/supabase.ts), re-exported for e2e, called in afterEach

### F3 — minimum_password_length = 6 below config's own "recommended 8+"

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/config.toml:189 (mirrored in both forms + reset-password.ts:7)
- **Detail**: Consistent across layers, but config.toml notes "recommended 8 or more." Consider raising to 8 in prod. Plan fixed the contract at 6 to match SignUpForm.
- **Fix**: Optionally raise to 8 across config + both forms + reset route (prod hardening).
- **Decision**: FIXED — raised to 8 in config.toml, SignUpForm, ResetPasswordForm, reset-password.ts (+ placeholder copy), kept coherent across signup & reset

### F4 — handler test asserts signOut called but not ordering after updateUser

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: test/handlers/reset-password.test.ts
- **Detail**: A refactor moving signOut before updateUser would keep the suite green. The e2e covers real ordering, so low risk.
- **Fix**: Optionally assert call order (invocationCallOrder) in the happy-path test.
- **Decision**: FIXED — added invocationCallOrder assertion pinning signOut after updateUser

### F5 — two cosmetic extras beyond the plan (plan-consistent)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/auth/ResetPasswordForm.tsx:50 (passwordHint), forgot/reset panels
- **Detail**: A "N more characters needed" hint (mirrors SignUpForm) and descriptive intro copy on panels. Cosmetic, in keeping with the UX kit — not drift.
- **Fix**: None needed; recorded for transparency.
- **Decision**: ACCEPTED — extras match the UX kit; not scope creep
