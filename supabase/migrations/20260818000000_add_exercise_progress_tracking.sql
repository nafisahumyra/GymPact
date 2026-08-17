create type public.exercise_goal_status as enum ('active', 'completed');

create table public.exercise_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exercise_name text not null,
  target_reps integer not null,
  status public.exercise_goal_status not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_goals_exercise_name_check
    check (exercise_name in ('Pushups', 'Pullups')),
  constraint exercise_goals_target_reps_check check (target_reps > 0),
  constraint exercise_goals_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status = 'active' and completed_at is null)
  ),
  unique (user_id, exercise_name)
);

create table public.exercise_set_logs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.exercise_goals(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  exercise_name text not null,
  reps integer not null,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint exercise_set_logs_exercise_name_check
    check (exercise_name in ('Pushups', 'Pullups')),
  constraint exercise_set_logs_reps_check check (reps > 0)
);

create index exercise_goals_user_id_idx
  on public.exercise_goals (user_id, exercise_name);

create index exercise_set_logs_goal_id_logged_at_idx
  on public.exercise_set_logs (goal_id, logged_at asc);

alter table public.exercise_goals enable row level security;
alter table public.exercise_set_logs enable row level security;

-- Browser access remains denied. The verified GymPact Edge Functions use the
-- service role only after validating the temporary GymPact session token.
