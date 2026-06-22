# Deck Management — Plan Brief

> Full plan: `context/changes/deck-management/plan.md`

## What & Why

Give the logged-in user control over their deck: **browse** all their cards (paginated), **edit** any
card's question/answer, and **delete** a card permanently behind a confirmation prompt. This is roadmap
slice **S-03** (Stream B, deck authoring & management), implementing PRD **FR-012 / FR-013 / FR-014**.
Generation (S-01) fills the deck and review (S-02) drains it; without S-03 a user can't fix a typo'd
card or remove a bad one. The defining constraint is **FR-013**: editing content must NOT reset the
spaced-repetition schedule S-02 added — a typo fix can't cost a card its review history.

## Starting Point

F-01 and S-02 have shipped: a `flashcards` table with `id, user_id, question, answer, source,
created_at, updated_at` **plus** the S-02 FSRS columns (`due, stability, difficulty, scheduled_days,
learning_steps, reps, lapses, state, last_review`), RLS `enable` with four per-user policies + grants
to `authenticated`, a `(user_id, created_at desc)` index, and a `moddatetime` trigger. `cards.ts` has
**only POST** (bulk-save); there is **no list/GET and no `[id]` dynamic route** anywhere in the API.
The UI precedent is a protected `.astro` page hosting one `client:load` island (`/generate`,
`/review`). A mature 3-layer test harness (Vitest unit + integration, Playwright e2e) with an
established cookbook is in place; only `Button`/`Card`/`Textarea` shadcn primitives are installed.

## Desired End State

A user opens `/cards`, sees their cards newest-first in pages of 50 with a "Load more" pager, edits a
card's Q/A inline (Save/Cancel) with the review schedule provably untouched, and deletes a card only
after an explicit confirm click. The dashboard links into `/cards`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Browse paging | offset/range (`.range()`), `created_at desc`, page size 50, "Load more" | Rides the existing `(user_id, created_at desc)` index; PRD scale is "small/hundreds", no virtualization needed. | Plan |
| `hasMore` derivation | fetch `PAGE_SIZE + 1`, trim, flag | Avoids a second `count` round-trip per page. | Plan |
| List endpoint | add `GET` to existing `cards.ts`, keep `POST` | `cards.ts` is the card resource; one file owns list + bulk-create. | Plan |
| Edit/delete endpoint | new `PATCH`/`DELETE /api/cards/[id]` | RESTful per-resource verbs; first dynamic route in the API. | Plan |
| **Schedule-preserving edit (FR-013)** | PATCH zod schema + payload of **only** `{question, answer}` | FSRS columns are structurally unreachable from the edit path — can't be reset or spoofed. | Plan |
| RLS-miss handling | 0 affected rows → 404 | Mirrors `rate.ts`; never leaks whether another user's card exists. | Plan |
| Delete safety | inline two-step confirm (arm → confirm), permanent | FR-014 with no archive/restore (PRD non-goal); no `Dialog` primitive installed. | Plan |
| UI shape | protected `/cards` page + `DeckView` island | Mirrors the `/generate`+island precedent; clean URL; shares the `/cards` namespace with S-04. | Plan |
| Confirmation primitive | inline state, not shadcn `AlertDialog` | Matches existing inline-state idiom; avoids adding an un-installed primitive. | Plan |
| Test coverage | handler-property (GET/PATCH/DELETE) + two-user RLS incl. schedule-unchanged | Covers RLS (#1) and the FR-013 invariant directly; no E2E this slice. | Plan |
| Test infra | extend `makeApiContext()` with `params` **and** `url` | `[id].ts` handlers read `context.params.id` and `GET /api/cards` reads `context.url.searchParams`; the factory provides neither yet. | Plan |

## Scope

**In scope:** `GET /api/cards` (paginated list); `PATCH`/`DELETE /api/cards/[id]` (schedule-preserving
edit + permanent delete, RLS-scoped, 404-on-miss); a protected `/cards` page + `DeckView` island
(browse/Load-more, inline edit, confirm-gated delete); a dashboard entry; deck DTOs in `types.ts`; an
`makeApiContext` `params` extension; handler-property + two-user RLS tests (incl. the FSRS-untouched
assertion).

**Out of scope:** search/filter/tags; soft-delete/archive/restore/undo; client virtualization; any
schedule reset or schedule-editing UI; manual card creation (S-04); a new DB migration or index; a
shadcn `Dialog`/`AlertDialog`; an E2E test.

## Architecture / Approach

Bottom-up, four layers: **test-infra** (`makeApiContext` gains `params` + `url`) → **list** (`GET /api/cards`,
`range()` paging, `hasMore` via `PAGE_SIZE+1`) → **mutations** (`PATCH`/`DELETE /api/cards/[id]` — the
FR-013 trust boundary; zod schema of only `{question, answer}`, payload built from only those keys, so
FSRS columns can never be written; RLS miss → 404) → **UI** (`/cards` island: fetch-on-mount, Load-more
pager, inline Q/A edit, two-step confirm delete; dashboard link). Every endpoint is `prerender=false`,
auth-gated, runs through the user's RLS-scoped client (never service-role), uses the local `json()`
helper, and returns generic errors — mirroring `cards.ts` / review-endpoint idioms. No DB work.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Test-infra (`params` + `url`) | `makeApiContext()` supplies `context.params` and `context.url` | Keep the factory minimal; existing suite stays green. |
| 2. List endpoint | `GET /api/cards` paginated + handler tests | Correct `range()` offsets + `hasMore` derivation. |
| 3. Mutation endpoints | `PATCH`/`DELETE /api/cards/[id]` + handler + RLS tests | **PATCH must write only question/answer — never an FSRS column (FR-013).** |
| 4. Deck UI | `/cards` page + `DeckView` island + dashboard entry | Delete must be confirm-gated; edit failure must not silently drop. |

**Prerequisites:** F-01 + S-02 shipped (done); local Supabase running for integration tests.
**Estimated effort:** ~2–3 sessions across 4 phases (no DB work; endpoints small, UI is the bulk).

## Open Risks & Assumptions

- **Pagination over virtualization (FR-012).** Assumed offset/range "Load more" pager (page 50) is
  sufficient for the PRD's "small/hundreds" scale; if real decks grow into the thousands, revisit
  toward keyset pagination or windowing. *Most worth human review.*
- **`hasMore` via `PAGE_SIZE+1` fetch** rather than a `count` query — assumed fine; if the client ever
  needs a total count (e.g. "1 of 312"), switch to `count: 'exact'`.
- **Inline two-step confirm instead of a modal dialog** — assumed acceptable for FR-014; if product
  wants a stronger barrier, install shadcn `AlertDialog` (a deliberate dep addition, deferred).
- **`GET /api/cards` 400s on a malformed `page`** rather than clamping to 0 — chosen for an explicit
  contract; either is defensible.
- **FR-013 enforced structurally + by test, not by a DB trigger** — no trigger blocks FSRS writes;
  the guarantee rests on the route shape and the integration "schedule unchanged after edit" test. If
  another future write path edits content, it must adopt the same discipline (flagged in Migration
  Notes). The S-02 FSRS column list is duplicated in the integration test — update it if those columns
  change.
- **No E2E this slice** (matches the S-02 decision); a browse/edit/delete browser test can be added
  later via `/10x-e2e`.

## Success Criteria (Summary)

- A user browses their whole deck via a paginated `/cards` list and pages through it with "Load more".
- Editing a card's question/answer persists the change and leaves **every** spaced-repetition schedule
  column unchanged (FR-013) — proven by a two-user RLS integration test and a handler payload-keys guard.
- Deleting a card is permanent and requires an explicit confirmation step (FR-014); no single click ever
  deletes.
- B can never read, edit, or delete A's cards (two-user RLS isolation); all endpoints are auth-gated.
