-- Migration: add FSRS spaced-repetition schedule to flashcards
-- Roadmap S-02 (spaced-repetition-review): exercises the schedule columns F-01 deferred.
-- Adds the full ts-fsrs Card shape as explicit, indexable columns. Defaults mirror
-- ts-fsrs createEmptyCard() so existing rows backfill to "new / due now" and the S-01
-- insert path (/api/cards) keeps working unchanged — new cards are immediately reviewable.
--
-- No new GRANT: the table is already granted to `authenticated` (F-01) and new columns
-- inherit table-level privileges. No RLS policy change: policies are row-scoped on user_id
-- and are unaffected by added columns.

alter table public.flashcards
  add column due            timestamptz      not null default now(),
  add column stability      double precision not null default 0,
  add column difficulty     double precision not null default 0,
  add column elapsed_days   integer          not null default 0,
  add column scheduled_days integer          not null default 0,
  add column reps           integer          not null default 0,
  add column lapses         integer          not null default 0,
  add column state          smallint         not null default 0 check (state in (0, 1, 2, 3)),
  add column last_review    timestamptz;

-- Serves the per-user due query: where user_id = ? and due <= now() order by due asc.
create index flashcards_user_id_due_idx
  on public.flashcards (user_id, due asc);
