alter table public.pacts
  add column active_at timestamptz;

create index pacts_active_at_idx
  on public.pacts (active_at)
  where active_at is not null;
