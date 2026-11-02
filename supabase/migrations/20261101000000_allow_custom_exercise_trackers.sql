-- Preview layout supports optional, user-named individual trackers while
-- preserving Pushups and Pullups as the existing defaults.
alter table public.exercise_goals
  add column if not exists unit text not null default 'reps';

alter table public.exercise_goals
  drop constraint if exists exercise_goals_exercise_name_check;

alter table public.exercise_goals
  add constraint exercise_goals_exercise_name_check
  check (char_length(btrim(exercise_name)) between 1 and 48);

alter table public.exercise_goals
  add constraint exercise_goals_unit_check
  check (char_length(btrim(unit)) between 1 and 20);

alter table public.exercise_set_logs
  drop constraint if exists exercise_set_logs_exercise_name_check;

alter table public.exercise_set_logs
  add constraint exercise_set_logs_exercise_name_check
  check (char_length(btrim(exercise_name)) between 1 and 48);
