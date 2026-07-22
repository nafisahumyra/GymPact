-- Pact data remains private to the browser. These grants are only used by
-- session-verified Edge Functions that use the Supabase service role.
grant select, insert, update on public.pacts to service_role;
grant select, insert on public.pact_participants to service_role;

create or replace function public.create_gympact_pact(
  p_created_by uuid,
  p_goal_type text,
  p_target_amount integer,
  p_timeframe text,
  p_wager_type text,
  p_wager_description text,
  p_start_date date,
  p_end_date date,
  p_participant_ids uuid[]
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
begin
  select array_agg(distinct participant_id order by participant_id)
    into participant_ids_sorted
  from unnest(p_participant_ids) as participant_id;

  if coalesce(array_length(participant_ids_sorted, 1), 0) <> 2 then
    raise exception 'A GymPact must include exactly two participants.';
  end if;

  if not p_created_by = any(participant_ids_sorted) then
    raise exception 'The pact creator must be a participant.';
  end if;

  if (
    select count(*)
    from public.users
    where id = any(participant_ids_sorted)
  ) <> 2 then
    raise exception 'Unknown pact participant.';
  end if;

  select string_agg(participant_id::text, ':' order by participant_id)
    into pair_key
  from unnest(participant_ids_sorted) as participant_id;

  insert into public.pacts (
    created_by,
    goal_type,
    target_amount,
    timeframe,
    wager_type,
    wager_description,
    status,
    start_date,
    end_date,
    participant_pair_key
  )
  values (
    p_created_by,
    p_goal_type,
    p_target_amount,
    p_timeframe,
    p_wager_type,
    p_wager_description,
    'pending',
    p_start_date,
    p_end_date,
    pair_key
  )
  returning * into new_pact;

  insert into public.pact_participants (pact_id, user_id)
  select new_pact.id, participant_id
  from unnest(participant_ids_sorted) as participant_id;

  return new_pact;
end;
$$;

revoke all on function public.create_gympact_pact(
  uuid, text, integer, text, text, text, date, date, uuid[]
) from public, anon, authenticated;

grant execute on function public.create_gympact_pact(
  uuid, text, integer, text, text, text, date, date, uuid[]
) to service_role;
