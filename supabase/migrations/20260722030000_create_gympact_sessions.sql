create table public.gympact_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint gympact_sessions_token_hash_check check (length(token_hash) = 64),
  constraint gympact_sessions_expiry_check check (expires_at > created_at)
);

create index gympact_sessions_expires_at_idx
  on public.gympact_sessions (expires_at);

alter table public.gympact_sessions enable row level security;
