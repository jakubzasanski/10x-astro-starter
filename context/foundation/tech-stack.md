---
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

A solo developer shipping 10xCards in a 3-week, after-hours MVP window with a hard deadline needs a battle-tested, agent-friendly starter that delivers auth, a Postgres database, and edge deploy without assembly. 10x-astro-starter is the recommended default for `(web, js)` and clears all four agent-friendly gates — TypeScript-first with Zod boundaries, opinionated layout/routing, popular in JS training data, and version-pinned docs. The PRD's auth requirements (email/password, verification, reset, 7-day sessions) map directly onto the starter's Supabase SSR auth, and AI flashcard generation rides as an external LLM call from an API route, so the `has_auth` and `has_ai` flags are set while payments, realtime, and background jobs stay out of scope per the PRD non-goals. Cloudflare Pages is the starter's shipping default; one gotcha to watch is the edge runtime's limit on long-running tasks, but the 15-second generation budget streams comfortably within it. CI runs on GitHub Actions with auto-deploy-on-merge — exactly what the starter ships with. Bootstrapper confidence is first-class, so scaffolding should be mostly smooth with occasional manual steps.
