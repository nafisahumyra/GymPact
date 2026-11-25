-- Weekly pact requirements are shared, while each participant accumulates
-- their own progress. Pushups and Pullups are measured in logged reps.
create or replace function public.create_gympact_pact_with_requirements_in_environment(
  p_created_by uuid, p_timeframe text, p_wager_type text, p_wager_description text,
  p_start_date date, p_end_date date, p_participant_ids uuid[], p_requirements jsonb,
  p_data_environment text
) returns public.pacts language plpgsql security definer set search_path = public as $$
declare participant_ids_sorted uuid[]; pair_key text; new_pact public.pacts; requirement jsonb; requirement_type_value text; requirement_target integer; requirement_position integer := 0; legacy_target integer;
begin
  if p_data_environment not in ('production', 'dev') or jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then raise exception 'Invalid Pact data.'; end if;
  if not exists (select 1 from jsonb_array_elements(p_requirements) item where lower(trim(item->>'type')) = 'workouts') then raise exception 'Workouts is required.'; end if;
  select array_agg(distinct participant_id order by participant_id) into participant_ids_sorted from unnest(p_participant_ids) as participant_id;
  if coalesce(array_length(participant_ids_sorted, 1), 0) <> 2 or not p_created_by = any(participant_ids_sorted) or (select count(*) from public.users where id = any(participant_ids_sorted)) <> 2 then raise exception 'Invalid Pact participants.'; end if;
  select string_agg(participant_id::text, ':' order by participant_id) into pair_key from unnest(participant_ids_sorted) as participant_id;
  select (item->>'targetAmount')::integer into legacy_target from jsonb_array_elements(p_requirements) item where item->>'type' = 'workouts' limit 1;
  insert into public.pacts (created_by, goal_type, target_amount, timeframe, wager_type, wager_description, status, start_date, end_date, participant_pair_key, data_environment)
  values (p_created_by, 'workouts', legacy_target, p_timeframe, p_wager_type, p_wager_description, 'pending', p_start_date, p_end_date, pair_key, p_data_environment) returning * into new_pact;
  for requirement in select value from jsonb_array_elements(p_requirements) loop
    requirement_type_value := lower(trim(requirement->>'type')); requirement_target := (requirement->>'targetAmount')::integer;
    if requirement_type_value not in ('workouts', 'hiit', 'steps', 'pushups', 'pullups') or requirement_target is null or requirement_target <= 0 then raise exception 'Invalid Pact requirement.'; end if;
    insert into public.pact_requirements (pact_id, requirement_type, target_amount, position) values (new_pact.id, requirement_type_value, requirement_target, requirement_position); requirement_position := requirement_position + 1;
  end loop;
  if (select count(*) from public.pact_requirements where pact_id = new_pact.id) <> jsonb_array_length(p_requirements) then raise exception 'Duplicate Pact requirement.'; end if;
  insert into public.pact_participants (pact_id, user_id) select new_pact.id, participant_id from unnest(participant_ids_sorted) as participant_id;
  return new_pact;
end;
$$;
