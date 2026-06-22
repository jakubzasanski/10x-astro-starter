# Account Access — Password Reset + Auth Verification — Plan Brief

> Full plan: `context/changes/account-access-recovery/plan.md`

## What & Why

Add the one missing auth flow — **self-serve password reset (FR-006)** — and **verify** the live
sign-up, email-verify, sign-in, and sign-out flows against the PRD's acceptance criteria, including the
**7-day default session (FR-005)**. This is roadmap slice **S-05** (Stream C — account lifecycle),
implementing PRD FR-003..FR-007 and §Access Control. Without password reset the "no data loss" guardrail
is hollow — a forgotten password means a lost deck. Reset rides Supabase's existing email channel (signup
confirmation already works in prod), so there is **no new email infrastructure**. The slice has **no
prerequisites** and is **parallel-safe** with every other slice.

## Starting Point

A working auth baseline: `src/lib/supabase.ts` (SSR cookie client), `src/middleware.ts` (resolves
`locals.user`; `PROTECTED_ROUTES = /dashboard,/generate,/review`), three API routes
(`signin/signup/signout.ts`, all `formData → supabase.auth.* → ?error=` redirect), three auth pages, and
a reusable component kit (`FormField`/`PasswordToggle`/`SubmitButton`/`ServerError`/`SignInForm`/
`SignUpForm`). **Password reset is absent**, and there is **no email/recovery callback route** anywhere.
A mature 3-layer test harness (Vitest unit+integration, Playwright e2e on the production build) with a
cookbook is already in place; local Supabase has Mailpit/Inbucket at `:54324`.

## Desired End State

A user who forgot their password visits `/auth/forgot-password`, gets a neutral "if an account exists,
we've sent a link" confirmation, clicks the emailed link to `/auth/reset-password`, sets a new password,
and signs in with it. The four existing flows are confirmed against the PRD, the 7-day session is
documented + configured to hold, and the reset happy path is covered by an E2E that reads the link from
Mailpit.

## Key Decisions Made

| Decision                          | Choice                                                          | Why (1 sentence)                                                                                  | Source |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| Password reset mechanism          | `resetPasswordForEmail` + `/auth/reset-password` + `updateUser`| PRD-specified Supabase path; reuses the existing email channel, no new infra.                     | Plan   |
| Recovery-session handoff          | Server-side `verifyOtp({ type:"recovery", token_hash })` on the page | Works with the SSR cookie client; keeps the whole flow server-side, no fragment session.    | Plan   |
| New routes/pages                  | `forgot-password` + `reset-password` (page + API each)         | Mirrors the existing `form → API route → ?error=` + `searchParams error → client:load` pattern.   | Plan   |
| Reset pages visibility            | Public (NOT added to `PROTECTED_ROUTES`)                       | A user who can't log in must reach them; matches the other public `/auth/*` pages.                | Plan   |
| Component reuse                   | Reuse the existing auth kit; new `ForgotPasswordForm`/`ResetPasswordForm` | Consistent UX/validation; `ResetPasswordForm` is `SignUpForm`'s password half.            | Plan   |
| Account enumeration               | Always neutral "if an account exists" confirmation             | Supabase `resetPasswordForEmail` is non-enumerating; never reveal whether the email is registered.| Plan   |
| Server-side validation            | Add zod (email shape; password `min(6)`) to the **new** routes only | Don't trust the client solely; gives handler tests a contract. Existing routes left as-is.    | Plan   |
| 7-day session (FR-005)            | Rely on Supabase's default refresh-token lifetime (≥7d); verify in prod dashboard; no `[auth.sessions]` cap | The 7-day window is the refresh-token TTL, a prod project setting, not `jwt_expiry`. | Plan   |
| Email confirmation (FR-004)       | Verify prod has confirmations ON; keep local `enable_confirmations=false` | Verify-before-use is a prod behavior; local stays frictionless for dev.                     | Plan   |
| Reset E2E                         | One happy-path Playwright spec reading the link from Mailpit (`:54324`) | Highest-value FR-006 coverage; the only way to exercise the emailed link automatically.    | Plan   |
| Test scope                        | Handler-property (both new routes) + one reset E2E             | Cheap validation contract at the handler; one real end-to-end for the link/recovery handoff.      | Plan   |

## Scope

**In scope:** `/auth/forgot-password` page + `POST /api/auth/forgot-password` route;
`/auth/reset-password` page (recovery-session handoff) + `POST /api/auth/reset-password` route;
`ForgotPasswordForm` + `ResetPasswordForm` React components; a "forgot password?" link + a `?reset=1`
success banner on sign-in; verification of FR-003/004/005/007 with config gap-fixes (7-day session,
email-confirmation gating documented for prod); handler-property tests + a Mailpit-reading reset E2E.

**Out of scope:** new email infra; magic-link/OTP/social/phone auth; in-session "change password";
CAPTCHA; rewriting the working flows; custom email templates; middleware changes; retrofitting zod onto
the existing signin/signup routes.

## Architecture / Approach

Net-new reset first, bottom-up: **request half** (`forgot-password` page + route — email →
`resetPasswordForEmail` → neutral "sent") before the **completion half** (`reset-password` page does the
one genuinely new thing — `verifyOtp` to mint the recovery session into cookies, then the form POSTs to a
route that calls `updateUser({ password })` → `signOut` → `/auth/signin?reset=1`). Then **verify** the
four existing flows + close the 7-day-session and email-confirmation config gaps. Then **prove** the
happy path E2E reading the recovery link from Mailpit. Every new route mirrors the existing
`formData → supabase.auth.* → ?error=` pattern; every new page mirrors `searchParams error →
client:load form`; the recovery handoff is isolated to the reset-password page/route.

## Phases at a Glance

| Phase                                          | What it delivers                                                         | Key risk                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1. Password-reset request                      | `forgot-password` page + route; neutral non-enumerating confirmation     | Must not leak account existence; `redirectTo` must be allow-listed.      |
| 2. Password-reset completion                   | `reset-password` page (recovery handoff) + route; sign-in success notice | The `verifyOtp` recovery-session handoff is new; expired-link UX.        |
| 3. Verify FR-003/004/005/007 + config gaps     | Auth-criteria checklist; 7-day session + confirmation gating settled     | 7-day window is a prod dashboard setting, not code.                      |
| 4. Tests                                       | Handler-property tests + reset happy-path E2E (Mailpit)                  | E2E needs local Supabase; rate limit `email_sent=2`/hr; no `waitForTimeout`. |

**Prerequisites:** none (auth baseline already live). Local Supabase (Docker) required for the reset E2E.
**Estimated effort:** ~2–3 sessions (Phases 1–2 are the bulk; 3 is checklist+config; 4 is one e2e + two
handler tests).

## Open Risks & Assumptions

- **[highest, needs human review] 7-day session = refresh-token lifetime, a prod dashboard setting**, not
  `jwt_expiry` (which is the short access-token TTL). Assumption: Supabase's default refresh-token TTL is
  ≥7 days and we add no `[auth.sessions]` cap; a human must confirm the prod project's actual value.
- **[needs human review] The reset E2E is local-only** — it reads the link from the local Mailpit/Inbucket
  API (`:54324`), so it needs local Supabase and cannot validate a real prod mailbox; prod email arrival
  stays a manual checklist item.
- **Recovery handoff** assumes the default recovery email surfaces a `token_hash` to the server page; if
  it delivers a PKCE `code`/fragment instead, switch to `exchangeCodeForSession` (verify in Phase 2).
- **Local email confirmation is OFF** by design (FR-004 is a prod behavior; confirmed in Phase 3).
- Existing signin/signup routes keep no zod (out of scope); local rate limit `email_sent=2`/hr can throttle
  heavy reset testing (not a bug).

## Success Criteria (Summary)

- A user can request a reset link, complete it via the emailed link, and sign in with the new password;
  the old password is rejected.
- The forgot-password flow never reveals whether an email is registered.
- FR-003/004/005/007 are verified against the PRD; the 7-day session and prod email-confirmation gating
  are documented and configured to hold.
- `lint` + `build` + `npm test` (handler validation) + the reset E2E (Mailpit link read) all pass.
