-- Tracking remains owned by each participant. Existing pacts retain their
-- check-in-only behavior and do not infer any numeric data from goal text.
alter table public.monthly_pact_commitments
  add column if not exists goal_type text not null default 'single_attempt',
  add column if not exists tracking_mode text not null default 'checkins_only',
  add column if not exists target numeric,
  add column if not exists unit text,
  add column if not exists reported_progress numeric;

alter table public.monthly_pact_commitments
  drop constraint if exists monthly_pact_commitments_goal_type_check,
  add constraint monthly_pact_commitments_goal_type_check
    check (goal_type in ('single_attempt', 'cumulative')),
  drop constraint if exists monthly_pact_commitments_tracking_mode_check,
  add constraint monthly_pact_commitments_tracking_mode_check
    check (tracking_mode in ('track', 'checkins_only')),
  drop constraint if exists monthly_pact_commitments_tracking_values_check,
  add constraint monthly_pact_commitments_tracking_values_check
    check (
      (tracking_mode = 'checkins_only' and target is null and unit is null and reported_progress is null)
      or
      (tracking_mode = 'track' and target > 0 and char_length(trim(coalesce(unit, ''))) > 0 and reported_progress >= 0)
    );
