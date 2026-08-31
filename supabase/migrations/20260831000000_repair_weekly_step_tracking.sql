-- The original weekly Steps migration was recorded in the remote migration
-- history before its tables were present. Keep this repair idempotent so an
-- existing clean database is unaffected.
create table if not exists public.weekly_step_goals (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  target_steps integer not null check (target_steps > 0),
  status public.exercise_goal_status not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_step_goals_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status = 'active' and completed_at is null)
  ),
  unique (pact_id, user_id)
);

create table if not exists public.weekly_step_logs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.weekly_step_goals(id) on delete cascade,
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  steps integer not null check (steps > 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists weekly_step_goals_pact_user_idx
  on public.weekly_step_goals(pact_id, user_id);
create index if not exists weekly_step_logs_pact_user_idx
  on public.weekly_step_logs(pact_id, user_id, logged_at asc);

alter table public.weekly_step_goals enable row level security;
alter table public.weekly_step_logs enable row level security;

grant select, insert, update, delete on public.weekly_step_goals to service_role;
grant select, insert, update, delete on public.weekly_step_logs to service_role;
