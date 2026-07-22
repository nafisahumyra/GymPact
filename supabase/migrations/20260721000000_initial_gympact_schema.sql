create extension if not exists pgcrypto;

create type public.pact_status as enum (
  'pending',
  'active',
  'completed',
  'expired',
  'cancelled'
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  created_at timestamptz not null default now(),
  constraint users_display_name_check check (display_name in ('Nafisa', 'Mahfuzur'))
);

create table public.pacts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id),
  goal_type text not null default 'workouts',
  target_amount integer not null,
  timeframe text not null,
  wager_type text not null,
  wager_description text not null,
  status public.pact_status not null default 'pending',
  start_date date not null,
  end_date date not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  participant_pair_key text not null,
  constraint pacts_goal_type_check check (goal_type = 'workouts'),
  constraint pacts_target_amount_check check (target_amount > 0),
  constraint pacts_timeframe_check check (timeframe in ('day', 'week', 'month')),
  constraint pacts_wager_type_check check (wager_type in ('reward', 'punishment')),
  constraint pacts_date_range_check check (end_date >= start_date),
  constraint pacts_cancelled_at_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create table public.pact_participants (
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.users(id),
  joined_at timestamptz not null default now(),
  primary key (pact_id, user_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  pact_id uuid references public.pacts(id) on delete set null,
  muscles text not null,
  duration_minutes integer not null,
  notes text,
  photo_path text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workouts_duration_minutes_check check (duration_minutes > 0)
);

create index pacts_created_by_idx on public.pacts (created_by);
create index pacts_status_idx on public.pacts (status);
create index pact_participants_user_id_idx on public.pact_participants (user_id);
create index workouts_user_logged_at_idx on public.workouts (user_id, logged_at desc);
create index workouts_pact_id_idx on public.workouts (pact_id) where pact_id is not null;

-- The key is the two participant UUIDs sorted and joined with ':'. The eventual
-- pact-creation server operation must create it and both participant rows atomically.
create unique index pacts_one_open_pact_per_pair_idx
  on public.pacts (participant_pair_key)
  where status in ('pending', 'active');

insert into public.users (id, display_name)
values
  ('4a1a21a1-0000-4000-8000-000000000001', 'Nafisa'),
  ('4a1a21a1-0000-4000-8000-000000000002', 'Mahfuzur')
on conflict (display_name) do nothing;

alter table public.users enable row level security;
alter table public.pacts enable row level security;
alter table public.pact_participants enable row level security;
alter table public.workouts enable row level security;

-- There are intentionally no anonymous table policies. Athlete selection is not
-- authorization, and direct browser access cannot be secured without an identity
-- token. Future trusted data operations must enforce the shared GymPact PIN.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-proofs',
  'workout-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are created: workout-proofs remains private until
-- trusted upload and signed-download operations are added during app migration.
