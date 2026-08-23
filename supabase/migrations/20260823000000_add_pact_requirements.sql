-- Requirements are shared by a Pact; each participant accumulates their own
-- progress against the same requirement rows.
create table public.pact_requirements (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts(id) on delete cascade,
  requirement_type text not null,
  target_amount integer not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint pact_requirements_type_check check (char_length(trim(requirement_type)) > 0),
  constraint pact_requirements_target_check check (target_amount > 0),
  constraint pact_requirements_unique_type unique (pact_id, requirement_type)
);

create index pact_requirements_pact_position_idx
  on public.pact_requirements (pact_id, position);

alter table public.pact_requirements enable row level security;
grant select, insert, update, delete on public.pact_requirements to service_role;

-- Preserve every existing Pact exactly as a single Workouts requirement.
insert into public.pact_requirements (pact_id, requirement_type, target_amount, position)
select p.id, 'workouts', p.target_amount, 0
from public.pacts p
where not exists (
  select 1 from public.pact_requirements r where r.pact_id = p.id
);

alter table public.pacts
  add column final_requirement_progress jsonb;

-- The legacy columns remain populated for current history compatibility. New
-- Pacts use this operation and use pact_requirements as the source of truth.
create or replace function public.create_gympact_pact_with_requirements(
  p_created_by uuid,
  p_timeframe text,
  p_wager_type text,
  p_wager_description text,
  p_start_date date,
  p_end_date date,
  p_participant_ids uuid[],
  p_requirements jsonb
)
returns public.pacts
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_ids_sorted uuid[];
  pair_key text;
  new_pact public.pacts;
  requirement jsonb;
  requirement_type_value text;
  requirement_target integer;
  requirement_position integer := 0;
  legacy_target integer;
begin
  if jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then
    raise exception 'A GymPact must include at least one requirement.';
  end if;

  select array_agg(distinct participant_id order by participant_id)
    into participant_ids_sorted
  from unnest(p_participant_ids) as participant_id;

  if coalesce(array_length(participant_ids_sorted, 1), 0) <> 2
    or not p_created_by = any(participant_ids_sorted) then
    raise exception 'A GymPact must include its creator and exactly two participants.';
  end if;

  if (select count(*) from public.users where id = any(participant_ids_sorted)) <> 2 then
    raise exception 'Unknown pact participant.';
  end if;

  select string_agg(participant_id::text, ':' order by participant_id)
    into pair_key
  from unnest(participant_ids_sorted) as participant_id;

  select coalesce(
    (select (item->>'targetAmount')::integer
     from jsonb_array_elements(p_requirements) item
     where item->>'type' = 'workouts'
     limit 1),
    (p_requirements->0->>'targetAmount')::integer
  ) into legacy_target;

  insert into public.pacts (
    created_by, goal_type, target_amount, timeframe, wager_type,
    wager_description, status, start_date, end_date, participant_pair_key
  ) values (
    p_created_by, 'workouts', legacy_target, p_timeframe, p_wager_type,
    p_wager_description, 'pending', p_start_date, p_end_date, pair_key
  ) returning * into new_pact;

  for requirement in select value from jsonb_array_elements(p_requirements) loop
    requirement_type_value := lower(trim(requirement->>'type'));
    requirement_target := (requirement->>'targetAmount')::integer;

    if requirement_type_value not in ('workouts', 'hiit', 'steps')
      or requirement_target is null or requirement_target <= 0 then
      raise exception 'Invalid pact requirement.';
    end if;

    insert into public.pact_requirements (pact_id, requirement_type, target_amount, position)
    values (new_pact.id, requirement_type_value, requirement_target, requirement_position);
    requirement_position := requirement_position + 1;
  end loop;

  if (select count(*) from public.pact_requirements where pact_id = new_pact.id)
      <> jsonb_array_length(p_requirements) then
    raise exception 'Duplicate pact requirement type.';
  end if;

  insert into public.pact_participants (pact_id, user_id)
  select new_pact.id, participant_id from unnest(participant_ids_sorted) as participant_id;

  return new_pact;
end;
$$;

revoke all on function public.create_gympact_pact_with_requirements(uuid, text, text, text, date, date, uuid[], jsonb)
  from public, anon, authenticated;
grant execute on function public.create_gympact_pact_with_requirements(uuid, text, text, text, date, date, uuid[], jsonb)
  to service_role;

-- Keep the existing America/New_York end-of-day semantics while finalizing
-- against every requirement, rather than against workouts alone.
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
      totals.workout_count,
      requirement_scores.progress,
      requirement_scores.is_complete
    from public.pacts p
    join public.pact_participants pp on pp.pact_id = p.id
    cross join lateral (
      select
        count(distinct w.id)::integer as workout_count,
        count(distinct w.id) filter (
          where coalesce(w.muscles, '') like '%HIIT%'
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
            when 'workouts' then coalesce(totals.workout_count, 0)
            when 'hiit' then coalesce(totals.hiit_count, 0)
            when 'steps' then coalesce(totals.steps_count, 0)
            else 0 end, r.target_amount),
          'target', r.target_amount
        )) as progress,
        bool_and(case r.requirement_type
          when 'workouts' then coalesce(totals.workout_count, 0)
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
      jsonb_object_agg(user_id::text, workout_count) as final_workout_counts,
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
