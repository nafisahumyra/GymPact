create or replace function public.finalize_due_monthly_pacts()
returns void language sql security definer set search_path = public as $$
  update public.monthly_pacts p
  set status = case
        when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then
          case when (select count(*) from public.monthly_pact_commitments c where c.monthly_pact_id = p.id and c.completed_at is not null) = 2
               then 'completed' else 'failed' end
        when now() >= (p.month_start::timestamp at time zone 'America/New_York') then 'active'
        else 'upcoming' end,
      final_result = case when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York')
        then case when (select count(*) from public.monthly_pact_commitments c where c.monthly_pact_id = p.id and c.completed_at is not null) = 2
                  then 'succeeded' else 'failed' end else null end,
      finalized_at = case when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then now() else null end
  where p.status in ('upcoming', 'active');
$$;

drop function if exists public.monthly_pact_effective_now();
drop table if exists public.monthly_pact_test_mode;
