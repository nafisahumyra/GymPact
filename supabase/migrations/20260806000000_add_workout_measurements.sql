-- Measurements replace the single-duration input for new workouts. Legacy
-- duration records are backfilled so every existing workout has the new shape.
alter table public.workouts
  add column activity_name text,
  add column measurements jsonb;

update public.workouts
set measurements = jsonb_build_array(
  jsonb_build_object('amount', duration_minutes, 'unit', 'minutes')
)
where measurements is null and duration_minutes is not null;

alter table public.workouts
  alter column duration_minutes drop not null,
  alter column measurements set default '[]'::jsonb,
  alter column measurements set not null,
  add constraint workouts_measurements_array_check
    check (jsonb_typeof(measurements) = 'array');
