<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Card Persistence Foundation

- **Plan**: context/changes/card-persistence-foundation/plan.md
- **Scope**: Full plan (Phase 1 + 2 of 2)
- **Date**: 2026-06-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria re-verification

- RLS catalog: `relrowsecurity = true`, 4 policies, 4 authenticated DML grants (SELECT/INSERT/UPDATE/DELETE).
- `npm run lint` → exit 0. `npm run build` → exit 0 (Complete).
- All 13 Progress items `[x]`. Commits: 2fbc652 (p1), 25b6e69 (p2), 79072af (epilogue).

## Notable resolved-in-flight deviations (not findings)

- **Missing GRANT** — Phase 1 migration originally lacked table-level grants; RLS alone left the table inaccessible to `authenticated`. Caught by the live two-user PostgREST isolation test; fixed by adding `grant select, insert, update, delete on table public.flashcards to authenticated`. (Lesson captured in lessons.md.)
- **`gen types` token gate** — CLI v2.106 required a dummy `SUPABASE_ACCESS_TOKEN` for local generation; identical output, no contract change.
- **Generated-file lint** — `src/db/database.types.ts` excluded in `eslint.config.js` (approved 4th file).

## Findings

### F1 — RLS enabled, not forced

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260619123010_create_flashcards.sql:31
- **Detail**: `enable row level security` (not `force`). Table owner / postgres / service-role connections bypass RLS. Standard and correct for a Supabase app (writes go through the authenticated SSR-client path; service role is trusted). Relevant only if a future server-side path uses the service key to write user data — it would skip these policies.
- **Fix**: None now. If a service-key write path appears later, route user-data writes through the authenticated client, or add `force` + explicit service-role policies.
- **Decision**: ACCEPTED (no action)

### F2 — Generated types depend on regeneration after future migrations

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/types.ts, src/db/database.types.ts
- **Detail**: Flashcard/DTOs derive from the generated `Database` type, in sync now. It's a manual regen step: S-02's schedule-column migration must re-run `supabase gen types` or the types silently lag the schema.
- **Fix**: Regenerate types as part of S-02's migration change (already implied by the plan's Migration Notes).
- **Decision**: ACCEPTED (no action)
