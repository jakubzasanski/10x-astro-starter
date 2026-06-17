---
project: 10xCards
researched_at: 2026-06-17
recommended_platform: Cloudflare Workers
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript (JS family)
  framework: Astro 6 (SSR) + React 19 islands
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare
---

## Recommendation

**Deploy on Cloudflare Workers.**

The stack already ships the `@astrojs/cloudflare` adapter and `wrangler.jsonc`, so this is a **zero-migration** choice — every other candidate requires swapping to `@astrojs/node`. At 10xCards' scale (small users, low QPS) the **free tier costs $0** and covers 100k+ requests/month, which directly satisfies the "minimize cost" preference. The 15-second AI-generation budget fits comfortably: Workers bills **CPU time, not wall-clock**, so time awaiting the external LLM `fetch` is not counted. Cloudflare also matches the team's stated familiarity and leads the field on agent tooling (published `llms.txt` + a GA MCP server). The one real reservation — the stated need for persistent connections — is recorded in the risk register below; on Cloudflare that need is met via Durable Objects (WebSockets, GA) and Queues/Cron (background work, GA), not always-on processes.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Verdict |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **1st (recommended)** |
| **Railway** | Partial | Pass | Pass | Pass | Partial | 2nd |
| **Fly.io** | Pass | Pass | Partial | Pass | Partial | 3rd |
| **Render** | Partial | Pass | Partial | Pass | Pass | 4th |
| Vercel | — | — | — | — | — | Dropped (serverless-only; fails persistent-connection filter) |
| Netlify | — | — | — | — | — | Dropped (serverless-only; fails persistent-connection filter) |

Separately weighted dimensions: **persistent processes** — Fly/Railway/Render run always-on containers (clean support); Cloudflare is *limited* (Durable Objects + Queues/Cron, no always-on daemons). **Cost @ low traffic** — Cloudflare $0, Fly ~$3–8/mo, Render ~$14/mo, Railway ~$10–20/mo. **Migration cost** — Cloudflare zero; the others require `@astrojs/cloudflare` → `@astrojs/node`.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Passes all five agent-friendly criteria. `wrangler` covers the full operational loop (`deploy`, `rollback`, `versions`, `tail`). Docs are open-source markdown with `llms.txt`/`llms-full.txt`, and remote MCP hosting is GA (Anthropic partnership). Free tier is $0 at this scale; Hyperdrive (GA, free plan) solves Postgres connection pooling to the external Supabase. Zero migration because the project is already configured for it. Loses points only on persistent-process support (limited to Durable Objects/Queues) and on co-location (the app uses external Supabase rather than a same-vendor DB — though D1/R2/KV/Queues exist if wanted).

#### 2. Railway

The best *literal* fit for the interview answers: always-on containers (clean persistent-connection support), co-located managed Postgres with automated backups + point-in-time recovery, and excellent agent docs (`llms.txt`) plus a Railway MCP server (beta). The gaps vs. Cloudflare: higher cost (~$10–20/mo usage-based, with idle RAM still billed), rollback is dashboard-only (no CLI verb), and it requires swapping to `@astrojs/node`. The natural switch target if the persistent-connection need turns out to be real and near-term.

#### 3. Fly.io

Cheapest true always-on option (~$3–8/mo for a small machine, with `auto_stop_machines` to scale to zero on idle) and full VM-grade persistent processes. Falls to third because its co-located **Managed Postgres** is expensive (~$38/mo), which would push you back to external Supabase and negate the co-location preference; its MCP integration (`fly mcp`) is experimental; and docs are markdown-via-copy rather than a first-class `llms.txt`. Also requires `@astrojs/node`.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Persistent-connection mismatch.** You flagged a need for persistent connections/background workers, and Workers is the shortlist's hardest platform for that — no always-on daemon. WebSockets must be modeled as Durable Objects (a distinct actor/storage product with its own billing); background work as Queues + a consumer Worker.
2. **Supabase-from-the-edge needs care.** Efficient Postgres pooling requires Hyperdrive + a raw `pg`/`postgres.js` client against the *direct* connection string — not the pooled/Supavisor URL and not the Supabase JS client. Skipping it risks connection exhaustion under load.
3. **workerd ≠ Node, discovered at runtime.** The AI-generation path's LLM SDK can pass local Node dev and throw only after deploy to workerd if it assumes Node built-ins.
4. **$0 until it isn't.** The per-request CPU cap (10ms free / 30s default paid) and the changed subrequest limit (2026-02-11) bite if generation does CPU-heavy post-processing or fans out to many subrequests.
5. **Pages→Workers transition churn.** Cloudflare now steers new projects to Workers Static Assets; mid-migration docs/starters may hand you deprecated Pages guidance.

### Pre-Mortem — How This Could Fail

Six months in, the "Cloudflare was obvious" call unraveled — and the trigger was the box that was ticked: persistent connections. A "show live generation progress" feature became a WebSocket need, implemented as a naive in-memory Worker loop that silently never worked, because Workers are request-scoped. Rebuilding it on Durable Objects cost two weeks the team didn't have before the deadline, and per-object billing surprised them. Meanwhile the chosen LLM SDK assumed Node APIs: it ran in Node dev but threw on workerd in production, forcing a mid-sprint swap to a fetch-based client. Supabase connections intermittently exhausted until they retrofitted Hyperdrive against the direct connection string — a step skipped because the JS client "worked" in testing. None were strictly Cloudflare's fault; each was a spot where the edge model diverged from the Node mental model the team actually held. The root mistake: answering "yes, we need persistent processes," then picking the shortlist's worst platform for that — without first confirming whether the PRD actually required it (it does not, today).

### Unknown Unknowns

- **CPU-time-not-wall-clock saves you only for I/O.** The 15s LLM await is free; synchronous parsing/chunking of a large response *is* billed CPU against the cap. Know which side of the line your code sits on.
- **"Persistent" on Cloudflare means Durable Objects** — a separate product with its own pricing and storage/actor model, not a Worker setting.
- **workerd package compatibility is per-package and runtime-discovered.** The `nodejs_compat` flag helps but isn't total; test the exact LLM SDK on workerd before committing.
- **Local dev fidelity gap.** Astro's dev server runs on Node/Vite; some failures appear only under `wrangler dev` or after deploy. The `astro sync` + build CI gates will not catch a workerd-only runtime error.

## Operational Story

- **Preview deploys**: `npx wrangler versions upload` produces a versioned preview URL without promoting to production; `wrangler versions deploy` does gradual rollout. PR-triggered previews are wired through Workers Builds / GitHub Actions (not automatic — needs CI config). Protect preview URLs with Cloudflare Access if they expose real data.
- **Secrets**: `SUPABASE_URL` / `SUPABASE_KEY` are stored as encrypted **Workers Secrets** via `npx wrangler secret put <NAME>` (these back the `astro:env/server` declarations in `astro.config.mjs`). CI authenticates with a `CLOUDFLARE_API_TOKEN` held in GitHub Secrets; the existing build job also needs `SUPABASE_URL`/`SUPABASE_KEY` repo secrets. Rotation = re-run `wrangler secret put`.
- **Rollback**: `npx wrangler rollback [version-id]` reverts to a prior version deterministically (find ids with `wrangler versions list`); time-to-revert is seconds. Caveat: Supabase schema/migrations do **not** roll back with the Worker — coordinate DB changes separately.
- **Approval**: production publish (`wrangler deploy` / `versions deploy`) and secret rotation are human-gated. An agent may run read-only ops unattended — `wrangler tail`, `wrangler versions list`, `wrangler deployments list`, build-status checks.
- **Logs**: live runtime logs via `npx wrangler tail`; deploy history via `npx wrangler deployments list`. Both are read-only and scriptable for an agent.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Persistent-connection need can't use always-on processes | Devil's advocate / interview Q1 | M | H | If/when real, implement WebSockets via Durable Objects (GA) and background work via Queues/Cron (GA); confirm the PRD actually requires it before building — today it does not. |
| LLM SDK assumes Node APIs, fails only on workerd | Pre-mortem / Unknown unknowns | M | H | Pick a fetch-based / workerd-compatible LLM client; test under `wrangler dev` before deploy; enable `nodejs_compat`. |
| Supabase connection exhaustion from the edge | Devil's advocate / Research finding | M | M | Use Hyperdrive (GA, free) + `pg`/`postgres.js` against the Supabase **direct** connection string for DB-heavy paths; the cookie-based auth SSR client is fine as-is. |
| CPU-cap / subrequest-limit overrun on CPU-heavy generation | Devil's advocate | L | M | Keep response parsing lean; offload heavy post-processing; upgrade to paid ($5/mo, 30s–5min CPU) only if profiling shows a real CPU bound. |
| Deprecated Pages guidance during Workers transition | Devil's advocate | M | L | Follow Workers (Static Assets) docs; the project already targets Workers via `wrangler.jsonc`. |
| Local dev (Node) diverges from workerd in prod | Unknown unknowns | M | M | Smoke-test with `wrangler dev` against the build before each deploy; don't rely solely on `astro dev`. |

## Getting Started

The project is already configured for Cloudflare (`@astrojs/cloudflare` + `wrangler.jsonc`), so no `astro add` / init step is needed.

1. **Confirm tooling**: `npx wrangler --version` (expect v4.x, the pinned devDependency) and authenticate — `npx wrangler login` locally, or set `CLOUDFLARE_API_TOKEN` for CI.
2. **Set production secrets**: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`.
3. **Build and deploy**: `npm run build && npx wrangler deploy`.
4. **Verify at runtime, not just locally**: `npx wrangler tail` to watch live logs, and use `npx wrangler dev` (workerd) — not only `npm run dev` (Node) — to catch edge-only runtime errors before shipping.
5. **(Recommended, when DB load grows)** add Hyperdrive: `npx wrangler hyperdrive create 10xcards-db --connection-string="<supabase-direct-connection-string>"`, bind it in `wrangler.jsonc`, and query it with `pg`/`postgres.js` for DB-heavy paths. The existing cookie-based Supabase auth client needs no change.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
