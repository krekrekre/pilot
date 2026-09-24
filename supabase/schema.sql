-- CadetReady schema. Idempotent — safe to re-run against an existing project.
-- Paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- training_sessions
-- One row per finished training run. The subject is either a signed-in user
-- (user_id) or an anonymous visitor identified by a first-party cookie
-- (anon_id) — never both, never neither.
-- ---------------------------------------------------------------------------

create table if not exists public.training_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  anon_id         text,
  module_slug     text        not null,
  score           integer     not null,
  total_questions integer     not null,
  accuracy        integer     not null,
  config          jsonb,
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- Bring an older install (user_id NOT NULL, no anon support) up to date.
alter table public.training_sessions alter column user_id drop not null;
alter table public.training_sessions add column if not exists anon_id    text;
alter table public.training_sessions add column if not exists user_agent text;
alter table public.training_sessions add column if not exists created_at timestamptz not null default now();

alter table public.training_sessions drop constraint if exists training_sessions_subject_check;
alter table public.training_sessions add constraint training_sessions_subject_check
  check ((user_id is null) <> (anon_id is null));

create index if not exists training_sessions_user_idx    on public.training_sessions (user_id, created_at desc);
create index if not exists training_sessions_anon_idx    on public.training_sessions (anon_id, created_at desc);
create index if not exists training_sessions_created_idx on public.training_sessions (created_at desc);

-- RLS: a signed-in user may read their own rows and nothing else.
-- There is deliberately no INSERT policy — writes go through /api/scores using
-- the service role key, which bypasses RLS. That keeps score submission
-- server-validated instead of letting the browser write arbitrary rows.
alter table public.training_sessions enable row level security;

drop policy if exists "read own training sessions" on public.training_sessions;
create policy "read own training sessions" on public.training_sessions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscriptions
-- Written by the Stripe webhook. Declared here so the schema file describes
-- the whole database.
-- ---------------------------------------------------------------------------

create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_sub_id      text unique,
  status             text not null default 'inactive',
  plan               text,
  period_end         timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
