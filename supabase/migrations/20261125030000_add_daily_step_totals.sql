-- An explicit daily total is the authoritative source for Steps on that
-- local day.  Legacy weekly_step_logs remain in place for historical pacts.
create table if not exists public.daily_step_totals (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  local_date date not null,
  timezone text not null default 'America/New_York',
  steps integer not null check (steps >= 0),
  data_environment text not null default 'production'
    check (data_environment in ('production', 'dev')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pact_id, user_id, local_date, data_environment)
);

create index if not exists daily_step_totals_pact_user_date_idx
  on public.daily_step_totals (pact_id, user_id, local_date);

alter table public.daily_step_totals enable row level security;
grant select, insert, update, delete on public.daily_step_totals to service_role;
