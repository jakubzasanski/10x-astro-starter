# Sage — Design Foundation (approved, Phase A)

> Locked visual identity for the UI redesign. Phase B implements this in the real
> codebase. **Mockups are the source of truth**; this doc is the written summary.
> Reference render: `design/app-mockup.html` (full app), `design/review-mockup.html` (Review only).

## Name & brand

- **App name: Sage** (replaces "10xCards"). Warm, calm, "wise"; the name implies
  sage-green, which drives the leaf logo.
- **Wordmark:** "Sage" set in the **serif** display face, weight 600.
- **Logo:** a green **sage leaf** — filled with the green gradient, white center
  vein + two side veins, soft drop shadow. In the mockup it's defined once as an
  SVG `<symbol>`/`<g id="sageLeaf">` and referenced via `<use href="#sageLeaf">`.
  In React, make it a single `<SageLeaf />` component (or an SVG in `public/`).
- **Favicon:** leaf (🌿 in the mockup; ship a real SVG/PNG leaf).

## Color tokens

Warm paper ground + a single moss-green accent. Map these into `src/styles/global.css`
(`:root` + `@theme inline`), replacing the current neutral-grayscale shadcn tokens
and removing the dark "cosmic" gradient usage.

| Token            | Hex       | Role                                              |
| ---------------- | --------- | ------------------------------------------------- |
| `--ground`       | `#F7EEE0` | page background (warm golden paper)               |
| `--ground-deep`  | `#EFE2CF` | gradient bottom / inset wells / progress track    |
| `--surface`      | `#FFFDF8` | cards, inputs, panels (warm white)                |
| `--text`         | `#2D2922` | primary text (warm espresso near-black)           |
| `--text-soft`    | `#6B6155` | secondary text / answers                          |
| `--text-faint`   | `#9C8F7E` | labels, captions                                  |
| `--line`         | `#EBDFCD` | hairline borders on warm surfaces                 |
| `--accent`       | `#6BA06A` | the one bold accent — moss green                  |
| `--accent-deep`  | `#538152` | accent pressed / links / active nav / focus ring  |
| `--accent-warm`  | `#A9C56A` | olive-lime, for gentle gradients (bar, card spine)|
| `--accent-soft`  | `#EEF3E2` | accent tint backgrounds (avatar, AI badge)        |
| `--icon`         | `#8A7550` | **dark beige** — neutral flat icon color          |
| `--icon-soft`    | `#B7A582` | empty-state icons                                 |

Rating semantics (earthy/muted so the green accent stays the loudest note):

| Rating | Token       | Hex       |
| ------ | ----------- | --------- |
| Again  | `--r-again` | `#C75B45` (clay red) |
| Hard   | `--r-hard`  | `#C5872F` (ochre)    |
| Good   | `--r-good`  | `#4F9A5E` (leaf)     |
| Easy   | `--r-easy`  | `#3E938C` (teal)     |

The "Manual" origin badge uses a soft violet (`#F0EAF7` bg / `#7B5EA8` text) to
distinguish it from the green "AI" badge.

## Shape, shadow, motion

- `--radius: 22px` (cozy). Smaller elements: chips/inputs ~14–18px.
- Soft, warm, diffuse shadows (warm-brown rgba, large negative spread):
  - `--shadow-card`, `--shadow-lift` (hover), `--shadow-soft` (rows/panels) — see mockup `:root`.
- **One motion moment:** the answer **unfolds** on reveal (height + fade), matching
  the app's real behavior (question stays, answer appears below). Everything else
  is quiet. Respect `prefers-reduced-motion` (disable transitions/animations).

## Typography

Deliberate split — **meaning, not decoration**:

- **Serif** (`--serif`) for *studied content*: card question/answer, page `<h1>`,
  wordmark, candidate Q/A. Reads like a note you wrote.
  Stack: `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif`.
- **Sans** (`--sans`) for *app chrome*: nav, buttons, labels, counts, form fields.
  Stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Mono** (`--mono`) for `<kbd>` keycaps only.
- **OPEN DECISION (resolve in /10x-plan):** keep these system stacks (zero
  dependency) or self-host a specific typeface. No external font CDN allowed
  (Cloudflare Workers runtime + project constraints).

## Icons

- Flat **line icons** (SVG, `fill=none stroke=currentColor stroke-width=2`,
  round caps). The real codebase already uses `lucide-react` — use it; the mockup
  hand-rolled equivalents (edit/pencil, trash, sparkle, check, x, layers).
- **Neutral** icons (deck edit/delete, etc.) render in **dark beige** (`--icon`);
  hover darkens to `--text` (delete hover → red tint).
- **Semantic** actions keep their color: Keep = green, Reject = red, ratings use
  their rating tokens. Don't beige-out semantic icons.

## Screens covered (all approved)

All re-create the current functionality — no behavior change, visual only.

1. **Review** (`src/pages/review.astro` + `src/components/review/ReviewSession.tsx`)
   — progress bar, the card as a physical study object (warm paper, green spine,
   soft shadow), Show-answer → unfold, 4 rating chips, "All caught up" state,
   fully keyboard-driven (Space, 1–4). The failed-save retry banner (present in
   the current component) must keep its warm-styled equivalent.
2. **Generate** — paste area + char counter/cap, "Generate cards" primary, candidate
   list with Keep/Edit/Reject per card, sticky "Save N cards to deck" bar.
3. **Deck** — list rows (serif Q + muted A preview), AI/Manual origin badge,
   hover edit/delete (beige icons), counts header. Empty state to be built.
4. **Manual create** — Question + Answer fields with char hints, Save/Cancel.
5. **Auth** (sign-in shown) — centered card on warm ground, leaf logo, email +
   password, "Forgot password?", "Create an account". Apply the same language to
   sign-up, confirm-email, and the password-reset flow (S-05, already shipped).

## States to add during implementation

The mockups focus on the happy path. Phase B must also style: empty deck, zero
due cards (have a Review variant), loading/skeleton, and error/toast — in the
warm language. Flag these in the plan so they aren't forgotten.

## Out of scope (do NOT add)

- Gamification: streaks, points, progress/streak UI — **PRD non-goal** (parked in
  roadmap). "Friendly" is achieved via color/shape/motion/copy only.
- Search/filter/tags in deck — PRD non-goal.
- The deploy URL rename and git repo rename — separate user decision.
