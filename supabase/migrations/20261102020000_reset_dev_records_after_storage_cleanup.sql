-- Storage objects are deleted through the Storage API by reset-dev-data. The
-- database function remains record-only, avoiding any shared attachment paths.
create or replace function public.reset_gympact_dev_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.workouts where data_environment = 'dev';
  delete from public.exercise_set_logs where data_environment = 'dev';
  delete from public.exercise_goals where data_environment = 'dev';
  delete from public.pacts where data_environment = 'dev';
  delete from public.monthly_pacts where data_environment = 'dev';
end;
$$;
