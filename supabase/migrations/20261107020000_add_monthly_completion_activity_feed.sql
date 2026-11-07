-- Activity is a read-only feed of the existing workout records and the proof
-- records created when an athlete completes a Month Pact goal.  The proof
-- stays in its original private bucket; this view only exposes its metadata to
-- the server-side Activity endpoint.
create or replace view public.activity_feed
with (security_invoker = true) as
  select
    'workout:' || w.id::text as id,
    'workout'::text as activity_type,
    w.user_id,
    w.activity_name,
    w.muscles,
    w.measurements,
    w.duration_minutes,
    w.notes,
    w.photo_path,
    w.logged_at,
    w.data_environment,
    null::date as month_start,
    null::text as monthly_goal,
    u.display_name as athlete_name
  from public.workouts w
  join public.users u on u.id = w.user_id

  union all

  select
    'monthly-completion:' || c.monthly_pact_id::text || ':' || c.user_id::text as id,
    'monthly_goal_completion'::text as activity_type,
    c.user_id,
    null::text as activity_name,
    null::text as muscles,
    '[]'::jsonb as measurements,
    null::integer as duration_minutes,
    null::text as notes,
    c.proof_path,
    c.completed_at as logged_at,
    p.data_environment,
    p.month_start,
    c.goal as monthly_goal,
    u.display_name as athlete_name
  from public.monthly_pact_commitments c
  join public.monthly_pacts p on p.id = c.monthly_pact_id
  join public.users u on u.id = c.user_id
  where c.completed_at is not null
    and c.proof_path is not null;

grant select on public.activity_feed to service_role;
