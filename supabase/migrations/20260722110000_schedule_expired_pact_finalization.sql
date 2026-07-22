create extension if not exists pg_cron;

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
          (p.start_date::text || 'T00:00:00.000Z')::timestamptz
        )
        and w.logged_at < (
          (p.end_date + 1)::text || 'T00:00:00.000Z'
        )::timestamptz
    ) as workout_totals on true
    where p.status = 'active'
      and p.active_at is not null
      and now() >= (
        (p.end_date + 1)::text || 'T00:00:00.000Z'
      )::timestamptz
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
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'gympact-finalize-expired-pacts'
  ) then
    perform cron.schedule(
      'gympact-finalize-expired-pacts',
      '* * * * *',
      'select public.finalize_expired_gympact_pacts();'
    );
  end if;
end;
$$;
