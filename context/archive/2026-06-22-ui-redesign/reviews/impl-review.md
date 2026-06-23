<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UI Redesign — "Sage" Visual Identity

- **Plan**: context/changes/ui-redesign/plan.md
- **Scope**: All 6 phases (full plan)
- **Date**: 2026-06-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria re-run live, all green: `npx astro sync` ✓, `npm run lint` ✓,
`npm run build` ✓, grep guard (`bg-cosmic` / `0a0e1a` / `border-white/10`) → no matches ✓.

Note: the build emits a CSS warning about bogus `[file:line]`/`[tool:pytest]` utilities.
Traced to Tailwind v4 auto-scanning `.claude/skills/*.md` — pre-existing and unrelated to
this change (no Tailwind/astro config touched in the redesign range). Out of scope here.

## Findings

### F1 — Dead i18n key carrying raw HTML in both catalogs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/i18n/en.ts:142, src/i18n/pl.ts:143
- **Detail**: `landing.h1` held a string with embedded `<span class="accent">` markup but was never consumed — Welcome.astro:25 renders the safe split keys `landing.h1pre` + `landing.h1accent` as plain text inside a real `<span>`. No live XSS sink, but a dead HTML-bearing string invites a future unsafe `set:html`. No other `set:html`/`dangerouslySetInnerHTML` exists in the repo.
- **Fix**: Delete the unused `landing.h1` line from both en.ts and pl.ts.
- **Decision**: FIXED — removed both keys; lint + build re-verified green.

### F2 — Unplanned `source`-column thread (api/cards.ts, types.ts, test)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/api/cards.ts:63, src/types.ts:22, test/handlers/cards.test.ts:69
- **Detail**: Plan's "What We're NOT Doing" says "no data-layer or API changes," yet three non-UI files changed. They form one justified thread: Phase 5's AI/Manual badges need each card's `source`, so `source` was added to the `GET /api/cards` SELECT list, to the `DeckCard` type, and to the test fixture. Read-only column add — no new endpoint, no auth/validation/routing change, RLS still scopes rows.
- **Fix**: None needed — optionally note the boundary crossing in change.md.
- **Decision**: ACKNOWLEDGED — benign and necessary; no change.

### F3 — card.tsx / textarea.tsx named in plan but never touched

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/ui/card.tsx, src/components/ui/textarea.tsx
- **Detail**: Phase 2 listed these two shadcn primitives for "tweaks," but both are untouched in the diff. The redesign instead styles bare `<textarea>` elements via global.css classes. Outcome-equivalent and within the "no primitive API changes" boundary; only the named files differ from the actual approach. button.tsx was correctly classes-only.
- **Fix**: None — end state matches intent.
- **Decision**: ACKNOWLEDGED — outcome-equivalent; no change.

### F4 — Site-wide footer not in plan; hardcoded personal name, not via t()

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/layouts/Layout.astro:53
- **Detail**: `<footer>© {year} Jakub Zasański</footer>` (commit 42a50ad) wasn't in the plan and renders on every page. It bypasses the i18n `t()` layer and shows a personal name rather than the "Sage Flashcards" brand. A copyright holder's name is legitimately not translated, so this is a product/branding call, not a defect.
- **Fix**: Confirm the intended footer text; leave as-is if intentional.
- **Decision**: ACCEPTED — user confirmed keep-as-is (intentional copyright line).

### F5 — Leftover favicon.png fallback line

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/layouts/Layout.astro (favicon links)
- **Detail**: The new leaf `public/favicon.svg` is wired up first, but the original starter's `public/favicon.png` link remains as a fallback. The PNG is the old non-Sage art. Harmless (SVG wins in all modern browsers); a stale leftover.
- **Fix**: Replace favicon.png with a leaf PNG, or drop the fallback line.
- **Decision**: SKIPPED — cosmetic leftover; left for a future cleanup.