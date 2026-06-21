-- Migration: reconcile flashcards schedule columns to the ts-fsrs v5 Card shape
-- Roadmap S-02 (spaced-repetition-review). The previous S-02 migration was written against an
-- assumed 9-field FSRS Card. ts-fsrs v5's actual Card differs in two ways:
--   1. it ADDS `learning_steps` (position in the short-term learning/relearning step sequence), and
--   2. it DEPRECATES `elapsed_days` (slated for removal in v6; next() recomputes elapsed time from
--      last_review + now, so it never needs to be persisted as input).
-- Add the former and drop the latter so a row round-trips the real Card losslessly (no-data-loss
-- guardrail) without carrying a deprecated, derived column.
alter table public.flashcards
  add column learning_steps integer not null default 0,
  drop column elapsed_days;
