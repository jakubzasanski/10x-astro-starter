import { describe, expect, it } from "vitest";
import { isReviewRating, schedule } from "@/lib/services/scheduling";
import type { FsrsSchedule } from "@/types";

// Roadmap S-02 scheduling service. The oracle is the product contract (FR-016 four-level rating
// updates the schedule; harder ratings come due sooner; a lapse on a matured card is counted) and
// the pure-function invariants the rating endpoint relies on — NOT ts-fsrs internals, whose
// algorithm correctness is the library's concern (PRD non-goal: don't test the scheduler's math).
// `now` is injected everywhere so every assertion is deterministic.

const T0 = new Date("2026-06-21T12:00:00.000Z");

// A brand-new card's stored schedule, mirroring the DB column defaults (createEmptyCard()).
function newSchedule(due: string = T0.toISOString()): FsrsSchedule {
  return {
    due,
    stability: 0,
    difficulty: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
  };
}

const dueMs = (s: FsrsSchedule): number => new Date(s.due).getTime();

describe("isReviewRating", () => {
  it.each([1, 2, 3, 4])("accepts the four-level rating %d", (r) => {
    expect(isReviewRating(r)).toBe(true);
  });

  it.each([0, 5, -1, 1.5, "3", null, undefined, NaN, {}])("rejects out-of-scale input %p", (r) => {
    expect(isReviewRating(r)).toBe(false);
  });
});

describe("schedule — first review of a new card", () => {
  it("advances a new card to a future due, a non-New state, reps=1, and stamps last_review with now", () => {
    const next = schedule(newSchedule(), 3, T0);

    expect(dueMs(next)).toBeGreaterThan(T0.getTime());
    expect(next.state).not.toBe(0); // left the New state
    expect(next.reps).toBe(1);
    expect(next.last_review).toBe(T0.toISOString());
  });

  it("brings a harder rating due sooner: Again < Hard < Good ≤ Easy", () => {
    const again = dueMs(schedule(newSchedule(), 1, T0));
    const hard = dueMs(schedule(newSchedule(), 2, T0));
    const good = dueMs(schedule(newSchedule(), 3, T0));
    const easy = dueMs(schedule(newSchedule(), 4, T0));

    expect(again).toBeLessThan(hard);
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThanOrEqual(easy);
  });
});

describe("schedule — determinism (pure function)", () => {
  it("returns an identical schedule for the same (card, rating, now)", () => {
    expect(schedule(newSchedule(), 3, T0)).toEqual(schedule(newSchedule(), 3, T0));
  });
});

describe("schedule — lapse accounting on a matured card", () => {
  it("increments lapses when a card that reached Review state is rated Again", () => {
    // Drive a new card to Review state with successive Good ratings, advancing the clock to each due.
    let s = newSchedule();
    let now = T0;
    for (let i = 0; i < 6 && s.state !== 2; i++) {
      s = schedule(s, 3, now);
      now = new Date(s.due);
    }
    expect(s.state).toBe(2); // reached Review

    const lapsesBefore = s.lapses;
    const lapsed = schedule(s, 1, now); // Again on a Review-state card is a lapse

    expect(lapsed.lapses).toBe(lapsesBefore + 1);
  });
});
