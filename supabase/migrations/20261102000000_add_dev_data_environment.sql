-- Every persisted GymPact record belongs to exactly one backend-enforced
-- environment. Existing records remain production records.
alter table public.pacts add column if not exists data_environment text not null default 'production'
  check (data_environment in ('production', 'dev'));
alter table public.workouts add column if not exists data_environment text not null default 'production'
  check (data_environment in ('production', 'dev'));
alter table public.exercise_goals add column if not exists data_environment text not null default 'production'
  check (data_environment in ('production', 'dev'));
alter table public.exercise_set_logs add column if not exists data_environment text not null default 'production'
  check (data_environment in ('production', 'dev'));
alter table public.monthly_pacts add column if not exists data_environment text not null default 'production'
  check (data_environment in ('production', 'dev'));

drop index if exists public.pacts_one_open_pact_per_pair_idx;
create unique index pacts_one_open_pact_per_pair_environment_idx
  on public.pacts (participant_pair_key, data_environment)
  where status in ('pending', 'active');

drop index if exists public.monthly_pacts_one_per_month_idx;
create unique index monthly_pacts_one_per_month_environment_idx
  on public.monthly_pacts (month_start, data_environment)
  where status in ('pending', 'upcoming', 'active', 'completed', 'failed');

alter table public.exercise_goals drop constraint if exists exercise_goals_user_id_exercise_name_key;
alter table public.exercise_goals add constraint exercise_goals_user_id_exercise_name_environment_key
  unique (user_id, exercise_name, data_environment);

create index if not exists workouts_environment_logged_at_idx on public.workouts (data_environment, logged_at desc);
create index if not exists pacts_environment_status_idx on public.pacts (data_environment, status);
create index if not exists exercise_goals_environment_user_idx on public.exercise_goals (data_environment, user_id);

create or replace function public.reset_gympact_dev_data()
returns void language plpgsql security definer set search_path = public, storage as $$
begin
  -- Attachments are namespace-owned by Dev, never shared with production.
  delete from storage.objects where bucket_id in ('workout-proofs', 'monthly-pact-proofs') and name like 'dev/%';
  delete from public.workouts where data_environment = 'dev';
  delete from public.exercise_set_logs where data_environment = 'dev';
  delete from public.exercise_goals where data_environment = 'dev';
  delete from public.pacts where data_environment = 'dev';
  delete from public.monthly_pacts where data_environment = 'dev';
end;
$$;

revoke all on function public.reset_gympact_dev_data() from public, anon, authenticated;
grant execute on function public.reset_gympact_dev_data() to service_role;

create or replace function public.create_gympact_pact_with_requirements_in_environment(
  p_created_by uuid, p_timeframe text, p_wager_type text, p_wager_description text,
  p_start_date date, p_end_date date, p_participant_ids uuid[], p_requirements jsonb,
  p_data_environment text
) returns public.pacts language plpgsql security definer set search_path = public as $$
declare participant_ids_sorted uuid[]; pair_key text; new_pact public.pacts; requirement jsonb; requirement_type_value text; requirement_target integer; requirement_position integer := 0; legacy_target integer;
begin
  if p_data_environment not in ('production', 'dev') or jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then raise exception 'Invalid Pact data.'; end if;
  select array_agg(distinct participant_id order by participant_id) into participant_ids_sorted from unnest(p_participant_ids) as participant_id;
  if coalesce(array_length(participant_ids_sorted, 1), 0) <> 2 or not p_created_by = any(participant_ids_sorted) or (select count(*) from public.users where id = any(participant_ids_sorted)) <> 2 then raise exception 'Invalid Pact participants.'; end if;
  select string_agg(participant_id::text, ':' order by participant_id) into pair_key from unnest(participant_ids_sorted) as participant_id;
  select coalesce((select (item->>'targetAmount')::integer from jsonb_array_elements(p_requirements) item where item->>'type' = 'workouts' limit 1), (p_requirements->0->>'targetAmount')::integer) into legacy_target;
  insert into public.pacts (created_by, goal_type, target_amount, timeframe, wager_type, wager_description, status, start_date, end_date, participant_pair_key, data_environment)
  values (p_created_by, 'workouts', legacy_target, p_timeframe, p_wager_type, p_wager_description, 'pending', p_start_date, p_end_date, pair_key, p_data_environment) returning * into new_pact;
  for requirement in select value from jsonb_array_elements(p_requirements) loop
    requirement_type_value := lower(trim(requirement->>'type')); requirement_target := (requirement->>'targetAmount')::integer;
    if requirement_type_value not in ('workouts', 'hiit', 'steps') or requirement_target is null or requirement_target <= 0 then raise exception 'Invalid Pact requirement.'; end if;
    insert into public.pact_requirements (pact_id, requirement_type, target_amount, position) values (new_pact.id, requirement_type_value, requirement_target, requirement_position); requirement_position := requirement_position + 1;
  end loop;
  insert into public.pact_participants (pact_id, user_id) select new_pact.id, participant_id from unnest(participant_ids_sorted) as participant_id;
  return new_pact;
end;
$$;
revoke all on function public.create_gympact_pact_with_requirements_in_environment(uuid, text, text, text, date, date, uuid[], jsonb, text) from public, anon, authenticated;
grant execute on function public.create_gympact_pact_with_requirements_in_environment(uuid, text, text, text, date, date, uuid[], jsonb, text) to service_role;
