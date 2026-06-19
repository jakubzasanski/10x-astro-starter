# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Grant table privileges on every new RLS table

- **Context**: Any Supabase migration that creates a new table in the `public` schema with RLS (`supabase/migrations/*`).
- **Problem**: RLS policies decide *which rows* a role sees but presuppose table-level privileges. Tables created by `postgres` in a migration do NOT inherit Supabase's auto-grants (those come from `supabase_admin`'s default privileges), so `authenticated` ends up with no SELECT/INSERT/UPDATE/DELETE and every PostgREST request fails with `42501 permission denied` despite correct policies. Hit in card-persistence-foundation (F-01): `flashcards` had RLS + 4 policies but returned 403/42501 until the GRANT was added.
- **Rule**: On every new `public` table, add explicit `grant select, insert, update, delete on table <t> to authenticated;` (plus any other API roles you intend) alongside `enable row level security` and the policies. Verify per-user access with a two-user isolation test through PostgREST — not `supabase db lint`, which checks neither RLS nor grants.
- **Applies to**: plan, plan-review, implement, impl-review
