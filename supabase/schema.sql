create extension if not exists pgcrypto;

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  decision_text text not null,
  result jsonb not null,
  score integer not null check (score >= 0 and score <= 100),
  verdict text not null,
  share_token text unique not null default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_id_idx on public.analyses(user_id);
create index if not exists analyses_created_at_idx on public.analyses(created_at desc);
create index if not exists analyses_share_token_idx on public.analyses(share_token);

alter table public.analyses enable row level security;

-- Authenticated users can read only their own analyses.
drop policy if exists "Users can read own analyses" on public.analyses;
create policy "Users can read own analyses"
on public.analyses
for select
to authenticated
using (auth.uid() = user_id);

-- Authenticated users can insert only rows that belong to themselves.
drop policy if exists "Users can insert own analyses" on public.analyses;
create policy "Users can insert own analyses"
on public.analyses
for insert
to authenticated
with check (auth.uid() = user_id);

-- Anonymous users can insert anonymous analyses (user_id stays null).
drop policy if exists "Anonymous can insert analyses" on public.analyses;
create policy "Anonymous can insert analyses"
on public.analyses
for insert
to anon
with check (user_id is null);

-- Authenticated users can update/delete only their own rows.
drop policy if exists "Users can update own analyses" on public.analyses;
create policy "Users can update own analyses"
on public.analyses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own analyses" on public.analyses;
create policy "Users can delete own analyses"
on public.analyses
for delete
to authenticated
using (auth.uid() = user_id);

-- Public read using share token header for read-only share endpoints.
-- Client must send header: x-share-token: <share_token>
drop policy if exists "Public can read shared analyses by token" on public.analyses;
create policy "Public can read shared analyses by token"
on public.analyses
for select
to anon, authenticated
using (
  share_token = (
    coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-share-token'
  )
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.analyses to authenticated;
grant select, insert on table public.analyses to anon;
