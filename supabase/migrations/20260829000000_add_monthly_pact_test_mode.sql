create table public.monthly_pact_test_mode (
  id boolean primary key default true check (id),
  simulated_date date,
  updated_at timestamptz not null default now(),
  constraint monthly_pact_test_mode_date_check check (
    simulated_date is null or simulated_date in (date '2026-09-01', date '2026-09-15')
  )
);

insert into public.monthly_pact_test_mode (id, simulated_date)
values (true, null)
on conflict (id) do nothing;

alter table public.monthly_pact_test_mode enable row level security;
grant select, insert, update on public.monthly_pact_test_mode to service_role;

create or replace function public.monthly_pact_effective_now()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      (select simulated_date::timestamp + interval '12 hours'
       from public.monthly_pact_test_mode
       where id = true)
      at time zone 'America/New_York'
    ),
    now()
  );
$$;

create or replace function public.finalize_due_monthly_pacts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reference_now timestamptz := public.monthly_pact_effective_now();
begin
  update public.monthly_pacts p
  set status = case
        when reference_now >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then
          case when (select count(*) from public.monthly_pact_commitments c where c.monthly_pact_id = p.id and c.completed_at is not null) = 2
               then 'completed' else 'failed' end
        when reference_now >= (p.month_start::timestamp at time zone 'America/New_York') then 'active'
        else 'upcoming' end,
      final_result = case when reference_now >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York')
        then case when (select count(*) from public.monthly_pact_commitments c where c.monthly_pact_id = p.id and c.completed_at is not null) = 2
                  then 'succeeded' else 'failed' end else null end,
      finalized_at = case when reference_now >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then reference_now else null end
  where p.status in ('upcoming', 'active');
end;
$$;
