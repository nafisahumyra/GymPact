-- Older tracker indexes predate data environments. Rebuild them so the same
-- athlete can independently track e.g. Pushups in production and Dev.
drop index if exists public.exercise_goals_standalone_unique_idx;
drop index if exists public.exercise_goals_pact_unique_idx;

create unique index exercise_goals_standalone_environment_unique_idx
  on public.exercise_goals (user_id, exercise_name, data_environment)
  where pact_id is null;

create unique index exercise_goals_pact_environment_unique_idx
  on public.exercise_goals (user_id, exercise_name, pact_id, data_environment)
  where pact_id is not null;
