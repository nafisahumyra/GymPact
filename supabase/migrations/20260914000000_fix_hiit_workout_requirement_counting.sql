-- A HIIT workout satisfies the dedicated HIIT requirement when it exists.
-- It only satisfies Workouts when the Pact has no dedicated HIIT requirement.
-- Keep the scheduled deadline finalizer aligned with the Edge Function's
-- shared progress calculation.
create or replace function public.finalize_expired_gympact_pacts()
returns void
language sql
security definer
set search_path = public
as $$
  with participant_scores as (
    select
      p.id as pact_id,
      pp.user_id,
      case
        when exists (
          select 1 from public.pact_requirements r
          where r.pact_id = p.id and r.requirement_type = 'hiit'
        ) then totals.non_hiit_workout_count
        else totals.workout_count
      end as final_workout_count,
      requirement_scores.progress,
      requirement_scores.is_complete
    from public.pacts p
    join public.pact_participants pp on pp.pact_id = p.id
    cross join lateral (
      select
        count(distinct w.id)::integer as workout_count,
        count(distinct w.id) filter (
          where lower(coalesce(w.muscles, '')) not like '%hiit%'
        )::integer as non_hiit_workout_count,
        count(distinct w.id) filter (
          where lower(coalesce(w.muscles, '')) like '%hiit%'
        )::integer as hiit_count,
        coalesce(sum(
          case when measurement->>'unit' = 'steps'
            then (measurement->>'amount')::numeric else 0 end
        ), 0)::integer as steps_count
      from public.workouts w
      left join lateral jsonb_array_elements(coalesce(w.measurements, '[]'::jsonb)) measurement on true
      where w.user_id = pp.user_id
        and w.logged_at >= greatest(p.active_at, p.start_date::timestamp at time zone 'America/New_York')
        and w.logged_at < ((p.end_date + 1)::timestamp at time zone 'America/New_York')
    ) totals
    cross join lateral (
      select
        jsonb_object_agg(r.requirement_type, jsonb_build_object(
          'completed', least(case r.requirement_type
            when 'workouts' then case
              when exists (
                select 1 from public.pact_requirements hiit_requirement
                where hiit_requirement.pact_id = p.id and hiit_requirement.requirement_type = 'hiit'
              ) then coalesce(totals.non_hiit_workout_count, 0)
              else coalesce(totals.workout_count, 0)
            end
            when 'hiit' then coalesce(totals.hiit_count, 0)
            when 'steps' then coalesce(totals.steps_count, 0)
            else 0 end, r.target_amount),
          'target', r.target_amount
        )) as progress,
        bool_and(case r.requirement_type
          when 'workouts' then case
            when exists (
              select 1 from public.pact_requirements hiit_requirement
              where hiit_requirement.pact_id = p.id and hiit_requirement.requirement_type = 'hiit'
            ) then coalesce(totals.non_hiit_workout_count, 0)
            else coalesce(totals.workout_count, 0)
          end
          when 'hiit' then coalesce(totals.hiit_count, 0)
          when 'steps' then coalesce(totals.steps_count, 0)
          else 0 end >= r.target_amount) as is_complete
      from public.pact_requirements r
      where r.pact_id = p.id
    ) requirement_scores
    where p.status = 'active'
      and p.active_at is not null
      and now() >= ((p.end_date + 1)::timestamp at time zone 'America/New_York')
  ), pact_scores as (
    select pact_id,
      count(*) filter (where is_complete) as successful_participant_count,
      (array_agg(user_id) filter (where is_complete))[1] as successful_user_id,
      jsonb_object_agg(user_id::text, final_workout_count) as final_workout_counts,
      jsonb_object_agg(user_id::text, progress) as final_requirement_progress
    from participant_scores
    group by pact_id
  )
  update public.pacts p
  set status = 'completed',
      final_result = case when scores.successful_participant_count = 2 then 'both_completed'
                          when scores.successful_participant_count = 1 then 'winner'
                          else 'both_failed' end,
      final_workout_counts = scores.final_workout_counts,
      final_requirement_progress = scores.final_requirement_progress,
      winner_id = case when scores.successful_participant_count = 1 then scores.successful_user_id else null end,
      completed_at = now()
  from pact_scores scores
  where p.id = scores.pact_id and p.status = 'active';
$$;
