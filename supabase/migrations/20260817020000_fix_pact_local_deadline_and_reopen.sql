create or replace function public.finalize_expired_gympact_pacts()
returns void
language sql
security definer
set search_path = public
as $$
  with pact_scores as (
    select
      p.id,
      count(*) filter (
        where coalesce(workout_totals.completed, 0) >= p.target_amount
      ) as successful_participant_count,
      (array_agg(pp.user_id) filter (
        where coalesce(workout_totals.completed, 0) >= p.target_amount
      ))[1] as successful_user_id,
      jsonb_object_agg(
        pp.user_id::text,
        coalesce(workout_totals.completed, 0)
      ) as final_workout_counts
    from public.pacts p
    join public.pact_participants pp on pp.pact_id = p.id
    left join lateral (
      select count(*)::integer as completed
      from public.workouts w
      where w.user_id = pp.user_id
        and w.logged_at >= greatest(
          p.active_at,
          p.start_date::timestamp at time zone 'America/New_York'
        )
        and w.logged_at < (
          (p.end_date + 1)::timestamp at time zone 'America/New_York'
        )
    ) as workout_totals on true
    where p.status = 'active'
      and p.active_at is not null
      and now() >= (
        (p.end_date + 1)::timestamp at time zone 'America/New_York'
      )
    group by p.id, p.target_amount
  )
  update public.pacts p
  set
    status = 'completed',
    final_result = case
      when scores.successful_participant_count = 2 then 'both_completed'
      when scores.successful_participant_count = 1 then 'winner'
      else 'both_failed'
    end,
    final_workout_counts = scores.final_workout_counts,
    winner_id = case
      when scores.successful_participant_count = 1 then scores.successful_user_id
      else null
    end,
    completed_at = now()
  from pact_scores scores
  where p.id = scores.id
    and p.status = 'active';
$$;

do $$
declare
  affected_count integer;
begin
  select count(*) into affected_count
  from public.pacts p
  where p.id = 'b9e0ad50-8e6d-48cf-89ba-959ccf1394ac'
    and p.status = 'completed'
    and p.end_date = date '2026-08-16'
    and p.completed_at >= timestamptz '2026-08-17 00:00:00+00'
    and p.completed_at < timestamptz '2026-08-17 00:01:00+00'
    and (select count(*) from public.pact_participants pp where pp.pact_id = p.id) = 2;

  if affected_count <> 1 then
    raise exception 'Expected exactly one prematurely finalized GymPact, found %', affected_count;
  end if;

  update public.pacts
  set
    status = 'active',
    final_result = null,
    final_workout_counts = null,
    winner_id = null,
    completed_at = null
  where id = 'b9e0ad50-8e6d-48cf-89ba-959ccf1394ac';
end;
$$;
