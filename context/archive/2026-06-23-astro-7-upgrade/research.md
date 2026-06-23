---
date: 2026-06-23T14:10:30+0200
researcher: Jakub Zasański
git_commit: f96f2da9f2e8f434f8596141d50bab8a0616083b
branch: master
repository: 10x-astro-starter
topic: "Upgrade Astro from v6 to v7 (major version), including @astrojs/* integrations and breaking-change migrations"
tags: [research, codebase, astro7, upgrade, cloudflare-adapter, vite8]
status: complete
last_updated: 2026-06-23
last_updated_by: Jakub Zasański
---

# Research: Astro v6 → v7 Upgrade

**Date**: 2026-06-23T14:10:30+0200
**Researcher**: Jakub Zasański
**Git Commit**: f96f2da9f2e8f434f8596141d50bab8a0616083b
**Branch**: master
**Repository**: 10x-astro-starter

## Research Question

Upgrade Astro from v6 (`^6.3.1`, installed 6.4.8) to v7 (`7.0.0`, current npm `latest`), including the `@astrojs/*` integrations and the Cloudflare adapter, and identify every breaking change that touches this codebase.

## Summary

**This is a low-risk, mostly mechanical upgrade.** Astro 7 (released 2026-06-22) is a "speed" release — Rust compiler is now the only compiler, Vite 8 + Rolldown bundler, native Rust Markdown pipeline. Its breaking-change surface is narrow, and **the codebase touches almost none of it**:

- The single most-publicized adapter breaking change — `@astrojs/cloudflare` v14 removing **`Astro.locals.runtime`** — **does not affect us**: there is zero `runtime` usage in `src/` (env comes via `astro:env/server`, not `runtime.env`).
- `wrangler.jsonc` already points `main` at `@astrojs/cloudflare/entrypoints/server` — already the v14 entrypoint shape.
- No rendered `.md`/`.mdx` pages and no markdown config → the Sätteri/native-Markdown change is irrelevant.
- No `src/fetch.ts`/`src/app.ts` → the advanced-routing reserved-filename collision doesn't apply.
- No content collections, no `astro:assets`, no `astro:actions`, no sessions, no view transitions, no Container API.

**The real work is version bumps + one config edit + validation:**

| Package | Current (installed) | Target | Note |
|---|---|---|---|
| `astro` | `^6.3.1` (6.4.8) | **`^7.0.0`** | Vite 8, Rust compiler default, Node `>=22.12.0` |
| `@astrojs/cloudflare` | `^13.5.0` (13.7.0) | **`^14.0.0`** | Vite 8; many breaking changes but none we use |
| `@astrojs/react` | `^5.0.4` (5.0.7) | **`^6.0.0`** | Vite 8; React 19 peer unchanged |
| `@astrojs/sitemap` | `^3.7.2` | **`^3.7.3`** | No major bump; not astro-gated |
| `@astrojs/check` | `^0.9.8` | **`^0.9.9`** | TS `^6` covered |
| **`overrides.vite`** | **`^7.3.2`** | **`^8.0.0` (or remove)** | **The single most likely thing to break the install/build** |

`wrangler ^4.90.0` (peer wants `^4.83.0`), `react`/`react-dom ^19.2.6`, `tailwindcss`/`@tailwindcss/vite ^4.2.4`, Node 24 (floor `>=22.12.0`) — **all already satisfy v7; no change.**

The project's only validation gates are `npm run lint` + `npm run build` (CLAUDE.md). The likely residual risk after bumping is the **stricter Rust compiler rejecting any malformed HTML** in `.astro` files (unclosed tags, unterminated attributes) — this will surface as build errors, not silent breakage.

## Detailed Findings

### Astro API surface the codebase actually uses

(From a full `src/` audit — see Code References.)

| Surface | Used? | v7 impact |
|---|---|---|
| `astro:env` (`envField`, `astro:env/server`) | **Heavy** — 5 server secrets; imported in 3 lib files | **Unchanged in v7** ✅ |
| Middleware (`defineMiddleware`, `context.locals/cookies/request/url/redirect`) | **Heavy** — `src/middleware.ts` | **Unchanged in v7** ✅ |
| API routes (`APIRoute`, `prerender = false`, `context.*`) | **Heavy** — 11 routes | **Unchanged in v7** ✅ |
| `Astro` global (`Astro.locals/url/props/request/cookies`) | **Heavy** | **Unchanged in v7** ✅ |
| `Astro.locals.runtime` / `runtime.env` / `cfContext` | **NONE** | Adapter v14 removes `runtime` — **not used, no migration** ✅ |
| Content collections, `astro:assets`, `astro:actions`, sessions, view transitions, Container API | **NONE** | Irrelevant ✅ |
| React islands (`client:load` only), `@astrojs/react` | Yes (8 islands) | adapter bumps to v6; `getContainerRenderer` import path moved (not used) ✅ |
| Template directives (`class:list`, `is:inline`, `<slot>`, `import.meta.env.DEV`) | Light | Unaffected ✅ |
| Markdown (`.md`/`.mdx` pages, remark/rehype config) | **NONE** | Sätteri change irrelevant ✅ |

### Astro 7 breaking changes — and how each maps to this repo

1. **Vite 8 + Rolldown bundler** (PR #15819). Astro 7 depends on `vite ^8.0.13`. → **Action: change/remove the `overrides.vite ^7.3.2` pin.** That pin was an Astro-6-era workaround (PR #16062) for the Cloudflare adapter needing Vite 7 while Vite 8 leaked in via `@cloudflare/vite-plugin`/`@tailwindcss/vite` and crashed workerd. On the Astro-7 / adapter-v14 stack everything standardizes on Vite 8, so a `^7` pin now *causes* the misalignment. Vite 8 has a Rollup-plugin-compat layer, so `@tailwindcss/vite` keeps working.
2. **Rust compiler is the only compiler** (PR #16462); `experimental.rustCompiler` and the Go compiler removed. The Rust compiler **rejects invalid HTML** (unclosed tags, unterminated attributes) instead of auto-correcting. → **Action: fix any malformed HTML the build flags.** This is the most likely build failure. No `experimental.rustCompiler` flag in our config to remove.
3. **`compressHTML` default `true` → `'jsx'`** (PR #16965/#16966) — whitespace now stripped using JSX rules; can change inline spacing visually. → **Action: visual check after build; set `compressHTML: true` to restore v6 HTML-aware behavior if needed.**
4. **Default Markdown processor → Sätteri (native Rust)** — `@astrojs/markdown-remark` no longer auto-installed. → **No action** (no rendered markdown, no remark/rehype config).
5. **Advanced routing default; `src/fetch.ts` reserved** (PR #16877). → **No action** (no `src/fetch.ts`/`src/app.ts`; no `experimental.advancedRouting` flag).
6. **Removed**: `@astrojs/db` package + its CLI; `astro:transitions` internal constants/helpers. → **No action** (neither used).
7. **Deprecation**: `getContainerRenderer()` moved to `@astrojs/react/container-renderer`. → **No action** (Container API not used).

### `@astrojs/cloudflare` v14 breaking changes — mapped to this repo

| v14 breaking change | Affects us? |
|---|---|
| `Astro.locals.runtime` removed (`runtime.env` → `import { env } from "cloudflare:workers"`, `runtime.cf` → `Astro.request.cf`, etc.) | **No** — zero `runtime` usage in `src/` |
| `astro dev` now runs in workerd; `astro preview` now supported | Already the case — CLAUDE.md notes dev uses the workerd runtime |
| Custom entrypoint API changed; wrangler `main` → `@astrojs/cloudflare/entrypoints/server` | **Already done** — `wrangler.jsonc` `main` is exactly this |
| Removed options `workerEntryPoint`, `cloudflareModules` | **No** — not present in config |
| Cloudflare **Pages** support dropped (Workers only) | **No** — project deploys to Workers |
| Default image service `compile` → `cloudflare-binding` | **No** — `astro:assets`/images not used |
| Sessions config reshaped to object form | **No** — sessions not used |
| Peer `wrangler ^4.83.0` | Satisfied — project has `^4.90.0` |

`wrangler.jsonc` already has `compatibility_date: "2026-05-08"` and `compatibility_flags: ["nodejs_compat"]` — adequate for workerd dev + Supabase SSR.

## Recommended upgrade sequence

1. `npx @astrojs/upgrade` (bumps `astro` + official integrations together and applies known migrations) — or bump versions manually in `package.json`.
2. Edit `package.json`: change `"overrides": { "vite": "^7.3.2" }` → `"^8.0.0"` (or remove the override entirely and let Astro hoist Vite 8). Reinstall.
3. `npx astro sync` (regenerate `astro:env` virtual-module types — required by CLAUDE.md before lint/build).
4. `npm run lint` then `npm run build` — fix any HTML the Rust compiler now rejects.
5. `npm run preview` (or `npm run dev`) — visual smoke check for `compressHTML` whitespace regressions; set `compressHTML: true` if needed.
6. Confirm Cloudflare deploy path still builds (wrangler `main` already correct).

## Code References

- `astro.config.mjs:11` — `output: "server"` (SSR)
- `astro.config.mjs:12` — `integrations: [react(), sitemap()]`
- `astro.config.mjs:16` — `adapter: cloudflare()`
- `astro.config.mjs:17-36` — `env.schema` (5 server secrets via `envField`) — unchanged in v7
- `src/lib/supabase.ts:3` / `src/lib/config-status.ts:1` / `src/lib/services/generation.ts:1` — `import ... from "astro:env/server"`
- `src/middleware.ts:1,7` — `defineMiddleware`, `context.locals/cookies/request/url/redirect`
- `src/pages/api/**` — 11 `APIRoute` endpoints, all `prerender = false`
- `src/pages/api/cards/[id].ts:43,94` — `context.params.id` (only dynamic route)
- `tsconfig.json:2` — extends `astro/tsconfigs/strict`
- `wrangler.jsonc` — `main: "@astrojs/cloudflare/entrypoints/server"` (already v14 shape), `compatibility_date: "2026-05-08"`, `nodejs_compat`
- `package.json` `overrides.vite: "^7.3.2"` — **must move to `^8` or be removed**

## Architecture Insights

- Env is consumed exclusively through the typed `astro:env/server` virtual module, never through `Astro.locals.runtime` — this is what insulates the app from the adapter's headline breaking change. The `astro:env` schema must be regenerated (`npx astro sync`) after the bump or lint/build fails (a project-specific gotcha already codified in CLAUDE.md).
- The `overrides.vite ^7` pin is a leftover transitional fix; the entire upgrade hinges on flipping it to Vite 8 in lockstep with `astro@7` + `@astrojs/cloudflare@14`. Bumping packages without touching the override would force-downgrade Vite and break the build.
- Validation is lint + build only (no test runner wired for unit/build gating; Playwright/Vitest/Stryker exist but aren't the upgrade gate). Visual whitespace regressions from `compressHTML` won't be caught by lint/build — they need a manual preview check.

## Historical Context (from prior changes)

- `context/foundation/lessons.md` — only lesson recorded is about RLS table grants (Supabase migrations); not relevant to a framework bump.
- `context/archive/2026-06-22-ui-redesign/` — the most recent shipped change ("Sage" UI redesign) touched many `.astro` files; those are the files most likely to surface Rust-compiler HTML-strictness errors, so they're worth a closer build-error read if any appear.

## Open Questions

1. **Exact published peer/version of `@astrojs/cloudflare@14`** — research relied on CHANGELOG/registry reasoning; confirm `npm view @astrojs/cloudflare@latest peerDependencies` at implementation time (Astro `^7`, wrangler `^4.83.0`).
2. **Sätteri package id/spelling** — flagged as uncertain by research; only matters if markdown is ever added (currently N/A).
3. **HTML-strictness fallout** — unknown until `npm run build` runs against the actual `.astro` files; expected small or zero, concentrated in the recently-redesigned UI files.

## Related Research

- None prior for this change. This is the first research artifact under `context/changes/astro-7-upgrade/`.
