alter table public.users
  drop constraint if exists users_display_name_check;

drop policy if exists "Anonymous users can read the athlete directory" on public.users;

create policy "Anonymous users can read the athlete directory"
  on public.users
  for select
  to anon
  using (
    id in (
      '4a1a21a1-0000-4000-8000-000000000001'::uuid,
      '4a1a21a1-0000-4000-8000-000000000002'::uuid
    )
  );
