# Card Persistence Foundation — Plan Brief

> Full plan: `context/changes/card-persistence-foundation/plan.md`

## What & Why

Create 10xCards' first data-layer foundation — a user-owned `flashcards` table with row-level security and AI-vs-manual origin tracking. It's roadmap item **F-01**: a minimal enabler that unlocks the north star (S-01, save AI cards to deck) and the deck/manual slices (S-03, S-04), and it sets the project's migration + RLS conventions for every table that follows.

## Starting Point

The data layer is completely empty — no `supabase/migrations/` directory exists, the Supabase client is untyped, and there's no `src/types.ts`. Auth, middleware, and deploy are already live; queries run through the cookie-based SSR client as the authenticated user, so `auth.uid()` RLS will enforce per-user isolation without app-level filtering.

## Desired End State

A `flashcards` table exists in local Supabase with RLS and four granular per-operation policies scoping every row to its owner. The Supabase client is typed against a generated `Database` type, and `src/types.ts` exposes a `Flashcard` entity plus create/update DTOs. `astro sync` + `lint` + `build` pass, and a second user cannot see or touch the first user's cards.

## Key Decisions Made

| Decision               | Choice                                              | Why (1 sentence)                                                              | Source |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Origin modeling        | `source` text + CHECK `('ai','manual')`            | Powers the "75% via AI" metric and extends to new origins without enum churn. | Plan   |
| SRS schedule columns   | Defer to S-02                                       | The SRS library is unchosen (FR-015); columns now would be a guess.           | Roadmap + Plan |
| Type strategy          | Generated `Database` types + `src/types.ts` aliases | Compile-time safety against the real schema plus the CLAUDE.md entity/DTO convention. | Plan |
| Ownership & timestamps | FK→`auth.users` ON DELETE CASCADE + `moddatetime` trigger | No orphan cards; `updated_at` auto-maintained without app code (FR-013).      | Plan   |
| Rollout scope          | Apply locally + gen types; prod push human-gated, no seed | Keeps live-DB mutation human-approved per `deploy-plan.md`.              | Plan   |

## Scope

**In scope:** one migration (`flashcards` table + RLS + per-operation policies + owner/recency index + `updated_at` trigger); generated `Database` types; typed Supabase client; `src/types.ts` entity + DTOs.

**Out of scope:** SRS schedule columns; production `db push`; API/services/UI; seed data; a `decks` model; card-content length constraints.

## Architecture / Approach

Two phases with a verification boundary between them: (1) author and apply the SQL migration against local Postgres and prove RLS isolation; (2) generate TypeScript types *from the applied schema* (so types reflect reality), type the client, and expose entities/DTOs. Downstream slices consume `Flashcard`/`CreateFlashcardCommand` from `@/types` and the typed client.

## Phases at a Glance

| Phase                    | What it delivers                                   | Key risk                                              |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------- |
| 1. Schema migration & RLS | `flashcards` table, RLS policies, index, trigger   | RLS policy gaps — mitigated by `db lint` + 2-user check |
| 2. Typed entity surface   | Generated `Database` types, typed client, `src/types.ts` | Type drift — mitigated by generating from live schema |

**Prerequisites:** Docker running for local Supabase (`npx supabase start`); Supabase CLI v2 (already a dep).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Local verification requires Docker; without it the migration can be authored but not applied or type-generated (don't mark Phase 1 verified).
- Production schema lags until the separate human-gated `db push`.
- Single per-user deck is assumed (no `decks` table), matching the PRD's implicit model.

## Success Criteria (Summary)

- Migration applies cleanly (`supabase db reset`) and `db lint` flags no missing RLS on `flashcards`.
- A second authenticated user cannot read or mutate another user's cards.
- `Flashcard` + DTOs import from `@/types`; `astro sync` + `lint` + `build` are green.
