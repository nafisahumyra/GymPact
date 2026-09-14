-- A Month Pact succeeds as soon as both individual proof-backed goals are
-- achieved. `finalized_at` is the second goal's actual completion timestamp;
-- failed Pacts retain the established America/New_York calendar deadline.
create or replace function public.finalize_due_monthly_pacts()
returns void
language sql
security definer
set search_path = public
as $$
  with completion_totals as (
    select
      p.id as pact_id,
      count(*) filter (where c.completed_at is not null)::integer as completed_count,
      max(c.completed_at) filter (where c.completed_at is not null) as completed_at
    from public.monthly_pacts p
    left join public.monthly_pact_commitments c on c.monthly_pact_id = p.id
    group by p.id
  )
  update public.monthly_pacts p
  set status = case
        when p.status = 'active' and totals.completed_count = 2 then 'completed'
        when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then 'failed'
        when now() >= (p.month_start::timestamp at time zone 'America/New_York') then 'active'
        else 'upcoming'
      end,
      final_result = case
        when p.status = 'active' and totals.completed_count = 2 then 'succeeded'
        when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then 'failed'
        else null
      end,
      finalized_at = case
        when p.status = 'active' and totals.completed_count = 2 then totals.completed_at
        when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then now()
        else null
      end
  from completion_totals totals
  where p.id = totals.pact_id
    and p.status in ('upcoming', 'active');
$$;
