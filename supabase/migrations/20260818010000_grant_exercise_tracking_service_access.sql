-- Exercise tracking is accessed only through session-verified Edge Functions.
grant select, insert, update, delete on public.exercise_goals to service_role;
grant select, insert, update, delete on public.exercise_set_logs to service_role;
