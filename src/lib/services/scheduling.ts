import { type Card, type Grade, Rating, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import type { FsrsSchedule, ReviewRating } from "@/types";

// Roadmap S-02: the single place the spaced-repetition algorithm runs. A pure function — no I/O,
// no DB, no clock of its own (the caller passes `now`) — so it is deterministic and unit-testable.
// The rating endpoint owns persistence; this module only computes the next schedule from the
// stored one. PRD non-goal: we integrate an off-the-shelf scheduler (ts-fsrs), we do not write
// scheduling logic.

// One scheduler instance for the module. Default parameters; fuzz spreads longer due intervals so
// cards reviewed together don't pile up on the same future day. Fuzz is seeded from the card, so
// the same (card, now, rating) always yields the same result — tests stay deterministic.
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

// FR-016 four-level scale → ts-fsrs Grade. Rating's enum values already are 1..4 for
// Again/Hard/Good/Easy, but map explicitly so the contract is visible. Callers narrow untrusted
// input with isReviewRating first, so the lookup here is total.
const RATING_TO_GRADE: Record<ReviewRating, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

export function isReviewRating(value: unknown): value is ReviewRating {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

// Rebuild a ts-fsrs Card (Date-typed) from the stored DB-typed schedule. We seed from
// createEmptyCard and override every persisted field. Seeding this way also supplies the
// deprecated, derived `elapsed_days` field (which we don't store — next() recomputes elapsed
// time from last_review + now) without us naming it.
function toCard(s: FsrsSchedule): Card {
  return {
    ...createEmptyCard(new Date(s.due)),
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  };
}

// Flatten a ts-fsrs Card back to the DB-typed schedule (timestamps as ISO strings).
function toSchedule(card: Card): FsrsSchedule {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

// Apply a recall rating to a card's current schedule and return its next schedule.
// `now` is injected (never read internally) to keep the function pure and deterministic.
export function schedule(current: FsrsSchedule, rating: ReviewRating, now: Date): FsrsSchedule {
  const { card } = scheduler.next(toCard(current), now, RATING_TO_GRADE[rating]);
  return toSchedule(card);
}
