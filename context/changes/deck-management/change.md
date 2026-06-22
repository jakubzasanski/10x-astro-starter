---
change_id: deck-management
title: Deck management — browse, schedule-preserving edit, and delete cards
status: impl_reviewed
created: 2026-06-21
updated: 2026-06-22
archived_at: null
---

# Deck management

Roadmap slice **S-03** (`context/foundation/roadmap.md`, Stream B — deck authoring & management).
Implements PRD **FR-012** (browse all cards, paginated), **FR-013** (edit question/answer WITHOUT
resetting the spaced-repetition schedule), and **FR-014** (permanent delete behind an explicit
confirmation prompt). NFR: list browse / card edit < 300ms p95 for decks under 1 000 cards.

Prerequisite **F-01** (card-persistence-foundation) is done; **S-02** (spaced-repetition-review) is
also done and has added the FSRS schedule columns to `flashcards`. The single most important
constraint of this slice is that **editing a card's content must never touch those FSRS columns**
(FR-013) — coordinated explicitly with S-02 in the plan.

## Notes

- Pure CRUD over the F-01 `flashcards` entity; low architectural risk. The risk that matters is the
  schedule-preserving-edit invariant (FR-013), which is enforced structurally (a zod schema with
  only `question`/`answer`, an update payload built from only those two keys) and proven by tests.
- Non-goals (PRD §Non-Goals, roadmap §Parked): no full-text search / tag filter; no soft-delete /
  archive / restore / undo; no analytics. Browse is a simple paginated list.
- Plan: `context/changes/deck-management/plan.md`. Brief: `context/changes/deck-management/plan-brief.md`.
