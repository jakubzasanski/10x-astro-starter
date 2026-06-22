---
change_id: ui-redesign
title: UI redesign — warm "Sage" visual identity across all screens
status: new
created: 2026-06-22
updated: 2026-06-22
archived_at: null
---

## Notes

Full UI redesign of the app, replacing the current dark glassmorphism / "cosmic"
look with a **warm, cozy, professional** visual identity. **Phase A (design) is
done and approved by the user**; this change exists to carry **Phase B
(implementation in real code)**, to be continued in a later session.

**Workflow context:** this is a design-first change. The visual design was
produced and approved as rendered HTML mockups (the 10x `artifact-design`
process), NOT designed in code. Phase B re-creates the approved design in the
real Astro + React + shadcn/ui codebase, screen by screen, with render-verify.

### Approved design decisions (locked in Phase A)

See `design/DESIGN-FOUNDATION.md` for the full token system, palette hexes,
typography, logo, and per-screen notes. Headlines:

- **New app name: "Sage"** (was "10xCards"). Warm/green identity; the name drives
  the leaf logo. Renaming touches `<head>` titles, in-app copy, and possibly
  `package.json` / README / the Cloudflare deploy URL — the **deploy URL + repo
  rename are a separate user decision**, out of scope for the in-app work.
- **Direction:** warm paper ground + a single **moss-green** accent; cozy/soft
  (large radii, soft warm shadows). Serif for *studied content* (card Q/A),
  sans for *app chrome*.
- **Logo:** green sage leaf (filled gradient + veins), defined once as an SVG
  symbol.
- **Icons:** flat line icons (SVG, `currentColor`) in **dark beige** for neutral
  actions; semantic actions (Keep=green, Reject=red, ratings) keep their colors.

### Approved mockups (source of truth for Phase B)

- `design/app-mockup.html` — the full app: Generate, Review, Deck, Manual create,
  Sign-in. This is the canonical reference.
- `design/review-mockup.html` — earlier single-screen Review iteration (kept for
  history; superseded by app-mockup.html).

### Open decision before planning

- **Font strategy:** the mockups use a *system* serif stack
  (Iowan/Palatino/Georgia) and system sans — zero dependency, zero cost. Decide
  in `/10x-plan` whether to keep system fonts or self-host a specific typeface.
  No external font CDN (Cloudflare Workers + the project's existing constraints).

### Resuming Phase B

Next session: run `/10x-plan ui-redesign` (or `/10x-research` first if grounding
in the current component structure is needed). The plan should sequence:
shell + design tokens (global.css `@theme`) → shared primitives → screens in
order (Review → Generate → Deck → Manual → Auth) → render-verify each. The
current screens to migrate live under `src/pages/` and `src/components/`
(e.g. `src/components/review/ReviewSession.tsx`, `src/styles/global.css`).
