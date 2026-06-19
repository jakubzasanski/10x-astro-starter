-- Migration: create flashcards table
-- Roadmap F-01 (card-persistence-foundation): user-owned flashcards with RLS and
-- AI-vs-manual origin tracking. Establishes the project's first table + RLS pattern.
-- Spaced-repetition schedule columns are intentionally deferred to S-02.

create extension if not exists moddatetime schema extensions;

create table public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  question    text not null,
  answer      text not null,
  source      text not null check (source in ('ai', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index flashcards_user_id_created_at_idx
  on public.flashcards (user_id, created_at desc);

create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row execute procedure extensions.moddatetime (updated_at);

-- Table-level privileges. RLS policies below filter WHICH rows the role sees, but the
-- role still needs DML grants to touch the table. Tables created by `postgres` in a
-- migration do NOT inherit Supabase's auto-grants (those come from supabase_admin's
-- default privileges), so grant explicitly. Authenticated-only foundation.
grant select, insert, update, delete on table public.flashcards to authenticated;

alter table public.flashcards enable row level security;

create policy "flashcards_select_own" on public.flashcards
  for select to authenticated using (auth.uid() = user_id);

create policy "flashcards_insert_own" on public.flashcards
  for insert to authenticated with check (auth.uid() = user_id);

create policy "flashcards_update_own" on public.flashcards
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "flashcards_delete_own" on public.flashcards
  for delete to authenticated using (auth.uid() = user_id);
