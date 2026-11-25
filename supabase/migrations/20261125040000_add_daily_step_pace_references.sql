-- Locks a past day's guidance after it has elapsed. Current and future guidance
-- remains derived from the latest authoritative totals.
create table if not exists public.daily_step_pace_references (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  local_date date not null,
  suggested_steps integer not null check (suggested_steps >= 0),
  data_environment text not null default 'production' check (data_environment in ('production', 'dev')),
  created_at timestamptz not null default now(),
  unique (pact_id, user_id, local_date, data_environment)
);
create index if not exists daily_step_pace_refs_pact_user_date_idx on public.daily_step_pace_references (pact_id, user_id, local_date);
alter table public.daily_step_pace_references enable row level security;
grant select, insert, update, delete on public.daily_step_pace_references to service_role;
