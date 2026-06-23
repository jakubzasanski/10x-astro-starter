# Astro v6 → v7 Upgrade — Plan Brief

> Full plan: `context/changes/astro-7-upgrade/plan.md`
> Research: `context/changes/astro-7-upgrade/research.md`

## What & Why

Upgrade the app from Astro 6 to Astro 7 (current `latest`), keeping the framework on a supported, current major. v7 is a "speed" release (Rust compiler, Vite 8 + Rolldown) with a narrow breaking-change surface — and the codebase happens to avoid nearly all of it, making this a low-risk, mostly-mechanical bump.

## Starting Point

Astro 6.4.8 SSR app on Cloudflare Workers, with `@astrojs/cloudflare@13`, `@astrojs/react@5`, Vite 7 (pinned via a leftover `overrides`), React 19, Tailwind 4. Env is read via `astro:env/server`, not `Astro.locals.runtime`; no markdown/content-collections/assets/sessions; `wrangler.jsonc` already uses the v14 adapter entrypoint.

## Desired End State

`package.json` is on the Astro 7 stack with no Vite override; `astro.config.mjs` pins `compressHTML: true`; `npm run lint` and `npm run build` pass; the app runs in workerd and the key pages render visually unchanged.

## Key Decisions Made

| Decision                  | Choice                          | Why (1 sentence)                                                                 | Source   |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Upgrade mechanism         | Manual `package.json` edits     | Controlled, reviewable diff over `@astrojs/upgrade`'s unpredictable config rewrites | Plan     |
| `compressHTML`            | Pin `true` (v6 behavior)        | Preserve the just-shipped Sage UI rendering exactly; avoid subtle whitespace shifts | Plan     |
| `overrides.vite ^7`       | Remove entirely                 | It was an Astro-6-era workaround; astro@7 + cloudflare@14 both require Vite 8     | Plan     |
| `Astro.locals.runtime` migration | Not needed               | Verified zero `runtime` usage in `src/` — adapter v14's headline break doesn't apply | Research |
| Node / React / wrangler / Tailwind | No change             | All already satisfy v7's requirements                                            | Research |

## Scope

**In scope:**
- Bump `astro ^7`, `@astrojs/cloudflare ^14`, `@astrojs/react ^6`, `@astrojs/sitemap ^3.7.3`, `@astrojs/check ^0.9.9`
- Remove the `overrides.vite` pin; add `compressHTML: true`
- Clean reinstall, `astro sync`, lint+build green, fix any HTML-strictness errors
- Runtime + visual verification in workerd

**Out of scope:**
- `@astrojs/upgrade` automation; the new `compressHTML: 'jsx'` default
- Any `runtime`/sessions/image-service/entrypoint migration (not used / already correct)
- `wrangler.jsonc`, Node, React, Tailwind, wrangler changes
- Actual Cloudflare deploy (build-path verification only)

## Architecture / Approach

Lockstep manual version bump + two config edits, then one clean reinstall so Vite 8 hoists without the override. Regenerate types (`astro sync`), drive the standard lint+build gate to green, then a runtime/visual pass in workerd for what the gate can't catch (hydration, whitespace, deploy path).

## Phases at a Glance

| Phase                          | What it delivers                                  | Key risk                                              |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------- |
| 1. Dependency & config upgrade | Green lint+build on the Astro 7 stack             | Stricter Rust compiler flags malformed HTML in `.astro` |
| 2. Runtime & visual verification | Confirmed workerd runtime + unchanged rendering | `compressHTML`/whitespace or hydration regression     |

**Prerequisites:** None — Node 24, React 19, wrangler 4.90, Tailwind 4 already satisfy v7.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Exact published majors (`@astrojs/cloudflare@14`, `@astrojs/react@6`) confirmed via research; re-verify with `npm view` at install time.
- HTML-strictness fallout is unknown until `npm run build` runs — expected zero-to-small, concentrated in the recently-redesigned UI files.
- Clean reinstall (drop `node_modules` + lockfile) is required so a stale Vite 7 isn't retained after removing the override.

## Success Criteria (Summary)

- `npm run lint` + `npm run build` pass on the Astro 7 / Vite 8 stack.
- App runs in workerd; auth round-trip and React islands work.
- Key pages render with no visible regressions vs. the pre-upgrade Sage UI.
