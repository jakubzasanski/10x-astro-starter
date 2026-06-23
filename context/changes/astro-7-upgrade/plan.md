# Astro v6 → v7 Upgrade Implementation Plan

## Overview

Upgrade the app from Astro 6 (`^6.3.1`, installed 6.4.8) to Astro 7 (`7.0.0`, current npm `latest`), bumping the four `@astrojs/*` integrations/adapter in lockstep, flipping the now-obsolete `overrides.vite ^7` pin to Vite 8, and pinning `compressHTML: true` to preserve the current rendered output. Validation is the project's standard gate — `npm run lint` + `npm run build` — plus a runtime/visual smoke check in the workerd runtime.

## Current State Analysis

(From `context/changes/astro-7-upgrade/research.md` — full audit + direct verification.)

- **Installed**: `astro@6.4.8`, `@astrojs/cloudflare@13.7.0`, `@astrojs/react@5.0.7`, `vite@7.3.5`. `package.json` declares `astro ^6.3.1`, `@astrojs/cloudflare ^13.5.0`, `@astrojs/react ^5.0.4`, `@astrojs/sitemap ^3.7.2`, `@astrojs/check ^0.9.8`, and `"overrides": { "vite": "^7.3.2" }`.
- **The codebase avoids v7's breaking surface**: no `Astro.locals.runtime`/`runtime.env`/`cfContext` usage anywhere in `src/` (env comes exclusively via `astro:env/server`); no rendered `.md`/`.mdx` pages and no markdown config; no content collections, `astro:assets`, `astro:actions`, sessions, view transitions, or Container API; no `src/fetch.ts`/`src/app.ts`.
- **`wrangler.jsonc` is already on the v14 adapter shape**: `main: "@astrojs/cloudflare/entrypoints/server"`, `compatibility_date: "2026-05-08"`, `compatibility_flags: ["nodejs_compat"]`.
- **Already-satisfied prerequisites**: Node 24 (floor `>=22.12.0`), React 19, `@tailwindcss/vite`/`tailwindcss ^4.2.4`, `wrangler ^4.90.0` (adapter v14 peer wants `^4.83.0`). None need changing.
- **Heavily-used-but-unchanged Astro surfaces**: `astro:env` (5 server secrets in `astro.config.mjs:17-36`, consumed in `src/lib/supabase.ts`, `src/lib/config-status.ts`, `src/lib/services/generation.ts`), middleware (`src/middleware.ts`), 11 `APIRoute` endpoints under `src/pages/api/**`, the `Astro` global across `.astro` files. v7 introduces no breaking changes to any of these.

## Desired End State

`package.json` declares Astro 7 + v14 Cloudflare adapter + v6 React integration with no Vite override; `astro.config.mjs` carries `compressHTML: true`; `npm run lint` and `npm run build` both pass; `npm run dev` and `npm run preview` run in workerd and the key pages render visually unchanged from v6. Verified by: clean install, green lint+build, and a manual page-by-page visual pass.

### Key Discoveries:

- The single most-publicized adapter breaking change — `@astrojs/cloudflare` v14 removing `Astro.locals.runtime` — does **not** apply (zero `runtime` usage in `src/`). Verified via `grep -rn "runtime" src/`.
- The `overrides.vite ^7.3.2` pin was an Astro-6-era workaround (Astro PR #16062) and is now the chief upgrade hazard: leaving it would force-downgrade Vite below the `^8` that both `astro@7` and `@astrojs/cloudflare@14` require, breaking install/build.
- The stricter Rust compiler (now the only compiler in v7) rejects malformed HTML — unclosed tags, unterminated attributes — instead of silently auto-correcting. This is the only plausible source of build errors, most likely (if anywhere) in the recently-redesigned UI `.astro` files (`context/archive/2026-06-22-ui-redesign/`).
- `npx astro sync` must run after the bump to regenerate the `astro:env` virtual-module types, or lint/build fails — a project-specific gotcha codified in `CLAUDE.md`.

## What We're NOT Doing

- Not running `npx @astrojs/upgrade` — versions are bumped manually for a controlled, reviewable diff (user decision).
- Not adopting v7's new `compressHTML: 'jsx'` default — pinning `true` to preserve current rendering (user decision).
- Not migrating off `Astro.locals.runtime` (not used), nor reshaping sessions/image-service/entrypoint config (not used / already correct).
- Not changing `wrangler.jsonc`, Node version, React, Tailwind, or wrangler — all already v7-compatible.
- Not adding markdown/content-collections support, and not wiring `@astrojs/markdown-remark`.
- Not deploying to Cloudflare as part of this change (build-path verification only).

## Implementation Approach

Manual, lockstep version bump in `package.json` plus the two `astro.config.mjs` edits, then a single clean reinstall so Vite 8 hoists without the override. Regenerate types with `astro sync`, then drive the standard lint+build gate to green — treating any HTML-strictness failure as a localized fix, not a redesign. Finish with a runtime/visual pass in workerd to catch anything lint+build can't (whitespace, hydration, deploy-path).

## Phase 1: Dependency & config upgrade

### Overview

Move the dependency manifest and Astro config to the v7 stack, reinstall cleanly, regenerate generated types, and get lint + build green — including fixing any HTML the Rust compiler now rejects.

### Changes Required:

#### 1. Dependency version bumps

**File**: `package.json`

**Intent**: Move Astro and its integrations/adapter to their v7-compatible majors so the framework, adapter, and React integration align on Astro 7 + Vite 8.

**Contract**: In `dependencies`, set `astro` → `^7.0.0`, `@astrojs/cloudflare` → `^14.0.0`, `@astrojs/react` → `^6.0.0`, `@astrojs/sitemap` → `^3.7.3`, `@astrojs/check` → `^0.9.9`. Leave `react`/`react-dom`/`@types/react*`, `tailwindcss`/`@tailwindcss/vite`, and (in `devDependencies`) `wrangler` unchanged — all already satisfy v7. Confirm the exact published majors at install time with `npm view <pkg>@latest version` / `npm view @astrojs/cloudflare@latest peerDependencies` before committing the numbers.

#### 2. Remove the Vite override

**File**: `package.json`

**Intent**: Delete the obsolete Astro-6-era Vite pin so `astro@7` + `@astrojs/cloudflare@14` hoist Vite 8 naturally (user decision: remove rather than re-pin to `^8`).

**Contract**: Remove the `"overrides": { "vite": "^7.3.2" }` block entirely (or the `vite` key within it if other overrides exist — currently it's the only one, so remove the whole `overrides` object).

#### 3. Pin compressHTML to preserve rendering

**File**: `astro.config.mjs`

**Intent**: Keep v6's HTML-aware whitespace compression so the just-shipped "Sage" UI renders byte-for-byte as before, rather than adopting v7's new `'jsx'` default (user decision).

**Contract**: Add top-level `compressHTML: true` to the `defineConfig({...})` object (alongside `output: "server"`).

#### 4. Clean reinstall & type regeneration

**File**: (no source edit — lockfile + generated types)

**Intent**: Resolve the new dependency tree from scratch so Vite 8 hoists cleanly without override interference, then regenerate the `astro:env` virtual-module types the lint/build gate depends on.

**Contract**: Reinstall from a clean state (e.g. remove `node_modules` + `package-lock.json`, then `npm install`) so the removed override doesn't leave a stale Vite 7 pinned in the lockfile. Then run `npx astro sync` to regenerate `.astro/` types. `package-lock.json` will be updated and should be committed.

#### 5. Fix any HTML-strictness failures surfaced by the build

**File**: `src/**/*.astro` (only those the build flags, if any)

**Intent**: The v7 Rust compiler errors on malformed HTML (unclosed tags, unterminated attributes) that v6 silently corrected. Fix each flagged location to valid HTML — no behavioral redesign.

**Contract**: Driven by `npm run build` error output. Expected scope is zero-to-small, concentrated in the recently-redesigned UI files. Each fix is a minimal correction (close the tag, terminate the attribute) preserving existing intent.

### Success Criteria:

#### Automated Verification:

- Clean install succeeds with no peer-dependency or override conflicts: `npm install`
- Resolved Vite is a single v8 major: `npm ls vite` shows `vite@8.x` (no `vite@7` retained)
- Resolved Astro stack is on v7: `npm ls astro @astrojs/cloudflare @astrojs/react` shows `astro@7.x`, `@astrojs/cloudflare@14.x`, `@astrojs/react@6.x`
- Generated types regenerate without error: `npx astro sync`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- The `package.json` diff is limited to the five version bumps, the removed `overrides`, and (in `astro.config.mjs`) the added `compressHTML: true` — no unintended config rewrites.
- Any `.astro` edits made are minimal HTML corrections, not behavioral changes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to Phase 2.

---

## Phase 2: Runtime & visual verification

### Overview

Confirm the upgraded app runs correctly in the workerd runtime and renders visually unchanged — covering what lint+build cannot (hydration, whitespace, the Cloudflare build path).

### Changes Required:

#### 1. Runtime smoke check in workerd

**File**: (no source edit — runtime verification)

**Intent**: Verify the dev/preview server boots in workerd under the v14 adapter (which now runs dev in workerd) and that auth + the React islands still hydrate and function.

**Contract**: Run `npm run dev` (and/or `npm run preview`), exercise sign-in, the dashboard, and at least one interactive island (`client:load` ThemeToggle/LanguageToggle, plus the generate/review/cards flows). No console errors, auth round-trip works, islands hydrate.

#### 2. Visual whitespace pass

**File**: (no source edit — visual verification)

**Intent**: Confirm `compressHTML: true` preserved rendering and nothing shifted across the key pages of the recently-shipped Sage UI.

**Contract**: Visually compare key pages — auth (signin/signup/forgot/reset), dashboard, cards (list/new/manual), generate, review — against expected v6 appearance. No layout/spacing regressions.

### Success Criteria:

#### Automated Verification:

- Dev/preview server starts in workerd without error: `npm run dev` (or `npm run preview`)

#### Manual Verification:

- Sign-in → dashboard auth round-trip works; protected-route redirect still works.
- React islands hydrate and respond (theme toggle, language toggle, generate/review/cards interactions); no browser console errors.
- Key pages render with no visible layout/spacing regressions vs. the pre-upgrade Sage UI.
- Production build artifact is the Cloudflare Workers shape (wrangler `main` entrypoint resolves) — confirmed from the Phase 1 `npm run build` output / `dist/`.

**Implementation Note**: This is the final phase; on success the change is ready for `/10x-impl-review` and then `/10x-archive`.

---

## Testing Strategy

### Automated (the project's only gates):

- `npm run lint` (type-checked ESLint) and `npm run build` (SSR build via `@astrojs/cloudflare`) — both must pass after `npx astro sync`.
- No unit/integration test runner is wired as a gate (Playwright/Vitest/Stryker exist but aren't the upgrade gate).

### Manual Testing Steps:

1. Start `npm run dev`; sign in and confirm the dashboard loads (auth round-trip + protected-route redirect).
2. Toggle theme and language (React islands) — confirm hydration and no console errors.
3. Walk the cards / generate / review flows for obvious breakage.
4. Visually scan auth, dashboard, cards, generate, review pages for whitespace/layout shifts.

## Performance Considerations

Astro 7's Vite 8 + Rolldown should make builds faster; no runtime performance change expected. No action required.

## Migration Notes

No data migration. The only "migration" is dependency resolution: the clean reinstall is what makes removing the Vite override safe — a stale lockfile could otherwise retain Vite 7.

## References

- Related research: `context/changes/astro-7-upgrade/research.md`
- Adapter alignment already in place: `wrangler.jsonc` (`main: "@astrojs/cloudflare/entrypoints/server"`)
- Env consumption (unchanged surface): `src/lib/supabase.ts:3`, `astro.config.mjs:17-36`
- Recently-redesigned UI (HTML-strictness watch): `context/archive/2026-06-22-ui-redesign/`
- Project gate gotcha: `CLAUDE.md` (run `npx astro sync` before lint/build)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dependency & config upgrade

#### Automated

- [x] 1.1 Clean install succeeds with no peer-dependency or override conflicts (`npm install`) — 398b446
- [x] 1.2 Resolved Vite is a single v8 major (`npm ls vite` shows `vite@8.x`, no `vite@7`) — 398b446
- [x] 1.3 Resolved Astro stack on v7 (`npm ls astro @astrojs/cloudflare @astrojs/react`) — 398b446
- [x] 1.4 Generated types regenerate without error (`npx astro sync`) — 398b446
- [x] 1.5 Linting passes (`npm run lint`) — 398b446
- [x] 1.6 Production build succeeds (`npm run build`) — 398b446

#### Manual

- [x] 1.7 `package.json` diff limited to 5 bumps + removed `overrides` + `compressHTML: true`; no unintended rewrites — 398b446
- [x] 1.8 Any `.astro` edits are minimal HTML corrections, not behavioral changes — 398b446

### Phase 2: Runtime & visual verification

#### Automated

- [x] 2.1 Dev/preview server starts in workerd without error (`npm run dev` / `npm run preview`)

#### Manual

- [x] 2.2 Sign-in → dashboard auth round-trip + protected-route redirect work
- [x] 2.3 React islands hydrate and respond; no browser console errors
- [x] 2.4 Key pages render with no visible layout/spacing regressions vs. pre-upgrade Sage UI
- [x] 2.5 Production build artifact is the Cloudflare Workers shape (wrangler `main` entrypoint resolves)
