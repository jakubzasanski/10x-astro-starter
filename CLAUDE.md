# Rules for AI

This file provides guidance to AI Agent when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + build on every push and PR to master. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 2

Pick a starter and a stack for the PRD you wrote in Lesson 1, with the **stack chain**:

```
(/10x-init  →  /10x-shape  →  /10x-prd)  →  /10x-tech-stack-selector  →  (bootstrapper)
```

The PRD chain ships from Lesson 1 (re-included in this lesson so you can fix the PRD mid-flight). `/10x-tech-stack-selector` is the lesson's main topic; `/10x-bootstrapper` is the next link, taught in Lesson 3.

### Task Router — Where to start

| Skill | Use it when |
| --- | --- |
| **Stack selection (lesson focus)** | |
| `/10x-tech-stack-selector` | You have a PRD at `context/foundation/prd.md` and need to pick a starter. Opens with an explicit choice (take the recommended default for your `(product_type, language_family)` cell, or design your own), walks the follow-up question set when you design your own, applies four agent-friendly quality gates, reasons over the language-aware starter registry, and writes `context/foundation/tech-stack.md`. Optional `[path-to-prd]` argument lets you point at a non-default PRD location (e.g., `/10x-tech-stack-selector @context/foundation/prd-v2.md`); without it the skill defaults to `context/foundation/prd.md`. Use AFTER `/10x-prd`, BEFORE `/10x-bootstrapper`. |
| **Re-run upstream if needed** | |
| `/10x-init` / `/10x-shape` / `/10x-prd` | Bundled so you can fix the PRD mid-flight. If `/10x-tech-stack-selector` surfaces a gap (e.g., a Functional Requirement that forces a feature your recommended starter doesn't carry), re-run `/10x-prd` to amend the PRD before the stack pick. |

### How the chain hands off

- `/10x-tech-stack-selector` reads `context/foundation/prd.md` frontmatter (`product_type`, `target_scale`, `timeline_budget`) as priors. If the PRD is absent, it refuses with a one-sentence redirect to `/10x-shape` — no inline mini-PRD fallback.
- The skill writes `context/foundation/tech-stack.md` with a 4-key frontmatter (`starter_id`, `package_manager`, `project_name`, `hints`) plus a one-paragraph `## Why this stack` body. The hand-off is intentionally minimal — bootstrapper does not parse rationale, only fields.
- `/10x-bootstrapper` (Lesson 3) reads `tech-stack.md` and the registry to scaffold the project.

### What tech-stack-selector captures (and what it does NOT)

- **Captured**: starter pick (registry-shaped), language family, package manager (open string per ecosystem — `pnpm`, `uv`, `bundle`, `cargo`, etc.), team size, deployment target (drawn from the chosen starter's `deployment_defaults`), CI/CD provider + flow, bootstrapper confidence (`verified | first-class | best-effort`), path taken (standard | custom), self-check answers (custom path), quality override (set when the user proceeds with a starter that failed ≥1 agent-friendly gate), feature flags (auth/payments/realtime/AI/background-jobs).
- **NOT captured (deliberate)**: strategic test plan, strategic deployment plan, strategic implementation decisions. Those are downstream of stack selection — a future technical-roadmap concern, not yet planned. Tech-stack-selector owns *framework-shaped* test/deploy/CI choices because those are inseparable from stack pick; what defers is the *strategic* layer ("we TDD on X surface", "preview environment per PR").

### The opening choice (load-bearing)

The first question is an explicit choice — never silent. The skill names the recommended starter for your `(product_type, language_family)` cell up front and asks for explicit confirmation:

- **Standard path** — accept the recommended default. The skill skips the feature audit, team profile, tech preferences, and framework-variant questions; it asks only the deployment, CI/CD, and project-name questions. The hand-off records `path_taken: standard` under `hints`.
- **Custom path** — design your own. The skill walks the full follow-up set (feature audit, team profile, tech preferences, deployment, CI/CD, framework variant), drills into a testing-runner question only when the chosen starter leaves it ambiguous, and closes with a 5-point readiness self-check (from prework lesson 4.1) before locking in. The hand-off records `path_taken: custom` and populates `self_check_answers`.

The recommended-default-per-cell map is multi-language: web/JS and saas/JS both → 10x-astro-starter (the 10x-branded starter leads whenever it competes in a JS cell); api/JS → hono; api/Python → fastapi; web/Python → django; web/Ruby → rails; api/Go → go; api/Rust → axum; mobile/Dart → flutter; desktop/Rust → tauri; etc. Cells with no vetted default carry `<none>` and force the custom path.

### Quality gates (agent-friendly criteria)

Every starter card carries four booleans the LLM filters against:

1. **Typed** — explicit types/schemas the agent can reason from without running the program.
2. **Convention-based** — strong opinions on layout, routing, configuration.
3. **Popular in training data** — assessed *per language family*, not globally (Django is popular within Python training data; Spring within Java; etc.).
4. **Well-documented** — current, version-pinned, link-able docs.

Candidates failing any gate are excluded from the unprompted recommendation set. If you explicitly name a failing starter as your preference, the skill challenges that pick — surfacing the strongest higher-criteria alternative AND the compensation path (CLAUDE.md instructions that patch the gaps) — and asks you to confirm or pivot. Confirming the known-friction pick records the override on the hand-off so bootstrapper can adjust.

### Bootstrapper confidence

Every recommendation surfaces `bootstrapper_confidence` verbatim — never silently elided:

- **`verified`** — bootstrapper has been run end-to-end on this stack; scaffolding will be smooth.
- **`first-class`** — registered with a valid CLI, expected to work but not battle-tested; expect mostly-smooth scaffolding with occasional manual steps.
- **`best-effort`** — limited support; manual steps likely; expect friction (and bootstrapper's CLAUDE.md generation compensates with extra ecosystem-specific context).

This is the heads-up before running `/10x-bootstrapper` so you know what to expect.

### Foundation paths used by this lesson

- `context/foundation/prd.md` — input (from Lesson 1)
- `context/foundation/tech-stack.md` — output (the chain hand-off)
- `context/foundation/lessons.md` — recurring rules & pitfalls
- `docs/reference/contract-surfaces.md` — load-bearing names registry

### Universal language

The shipped skill carries no 10xDevs / cohort / certification references. The recommended-default registry is multi-language (JS, Python, Ruby, Java, Go, Rust, PHP, .NET, Dart) and the cohort's `10x-astro-starter` is one card in the JS+web cell — not "the" recommended path for everyone.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
