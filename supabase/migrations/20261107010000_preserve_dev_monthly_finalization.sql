-- Keep Dev's existing monthly-pact lifecycle unchanged while production
-- finalizes unsigned current-month pacts at their deadline.
create or replace function public.finalize_due_monthly_pacts()
returns void language sql security definer set search_path = public as $$
  with completion as (
    select
      p.id,
      count(*) filter (where c.completed_at is not null)::integer as any_completed_count,
      count(*) filter (
        where c.completed_at is not null
          and c.completed_at < ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York')
      )::integer as completed_count,
      max(c.completed_at) filter (
        where c.completed_at is not null
          and c.completed_at < ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York')
      ) as latest_completed_at
    from public.monthly_pacts p
    left join public.monthly_pact_commitments c on c.monthly_pact_id = p.id
    where p.status in ('upcoming', 'active')
      or (p.data_environment = 'production' and p.status = 'pending')
    group by p.id
  )
  update public.monthly_pacts p
  set status = case
        when p.data_environment = 'dev' then case
          when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then
            case when completion.any_completed_count = 2 then 'completed' else 'failed' end
          when now() >= (p.month_start::timestamp at time zone 'America/New_York') then 'active'
          else 'upcoming'
        end
        when completion.completed_count = 2 then 'completed'
        when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then 'failed'
        when p.status = 'pending' then 'pending'
        when now() >= (p.month_start::timestamp at time zone 'America/New_York') then 'active'
        else 'upcoming'
      end,
      final_result = case
        when p.data_environment = 'dev' and now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then
          case when completion.any_completed_count = 2 then 'succeeded' else 'failed' end
        when completion.completed_count = 2 then 'succeeded'
        when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then 'failed'
        else null
      end,
      finalized_at = case
        when p.data_environment = 'dev' and now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then coalesce(p.finalized_at, now())
        when completion.completed_count = 2 then completion.latest_completed_at
        when now() >= ((p.month_start + interval '1 month')::timestamp at time zone 'America/New_York') then coalesce(p.finalized_at, now())
        else null
      end
  from completion
  where p.id = completion.id
    and (p.status in ('upcoming', 'active') or (p.data_environment = 'production' and p.status = 'pending'));
$$;
