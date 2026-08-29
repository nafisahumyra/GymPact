create table public.monthly_pacts (
  id uuid primary key default gen_random_uuid(),
  month_start date not null,
  created_by uuid not null references public.users(id),
  recipient_id uuid not null references public.users(id),
  consequence text not null,
  status text not null default 'pending',
  final_result text,
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  finalized_at timestamptz,
  constraint monthly_pacts_month_start_check check (month_start = date_trunc('month', month_start)::date),
  constraint monthly_pacts_distinct_athletes check (created_by <> recipient_id),
  constraint monthly_pacts_consequence_check check (char_length(trim(consequence)) > 0),
  constraint monthly_pacts_status_check check (status in ('pending', 'upcoming', 'active', 'completed', 'failed', 'declined', 'cancelled')),
  constraint monthly_pacts_final_result_check check (final_result is null or final_result in ('succeeded', 'failed'))
);

create unique index monthly_pacts_one_per_month_idx
  on public.monthly_pacts (month_start)
  where status in ('pending', 'upcoming', 'active', 'completed', 'failed');

create table public.monthly_pact_commitments (
  monthly_pact_id uuid not null references public.monthly_pacts(id) on delete cascade,
  user_id uuid not null references public.users(id),
  goal text not null,
  signature text not null,
  signed_at timestamptz not null default now(),
  completed_at timestamptz,
  proof_path text,
  primary key (monthly_pact_id, user_id),
  constraint monthly_pact_commitments_goal_check check (char_length(trim(goal)) > 0),
  constraint monthly_pact_commitments_signature_check check (char_length(trim(signature)) > 0),
  constraint monthly_pact_commitments_proof_check check (
    (completed_at is null and proof_path is null) or (completed_at is not null and proof_path is not null)
  )
);

create table public.monthly_pact_checkins (
  id uuid primary key default gen_random_uuid(),
  monthly_pact_id uuid not null references public.monthly_pacts(id) on delete cascade,
  user_id uuid not null references public.users(id),
  checkin_date date not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint monthly_pact_checkins_body_check check (char_length(trim(body)) between 1 and 1000)
);

create index monthly_pact_commitments_pact_idx on public.monthly_pact_commitments(monthly_pact_id);
create index monthly_pact_checkins_pact_date_idx on public.monthly_pact_checkins(monthly_pact_id, checkin_date);

alter table public.monthly_pacts enable row level security;
alter table public.monthly_pact_commitments enable row level security;
alter table public.monthly_pact_checkins enable row level security;
grant select, insert, update on public.monthly_pacts to service_role;
grant select, insert, update on public.monthly_pact_commitments to service_role;
grant select, insert, update, delete on public.monthly_pact_checkins to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('monthly-pact-proofs', 'monthly-pact-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

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

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'gympact-finalize-monthly-pacts') then
    perform cron.schedule('gympact-finalize-monthly-pacts', '* * * * *', 'select public.finalize_due_monthly_pacts();');
  end if;
end $$;
