alter table public.users
  drop constraint if exists users_display_name_check;

alter table public.users
  add constraint users_display_name_check
  check (display_name in ('Nafisa', 'Mahfuzur'));

drop policy if exists "Anonymous users can read the athlete directory" on public.users;

create policy "Anonymous users can read the athlete directory"
  on public.users
  for select
  to anon
  using (display_name in ('Nafisa', 'Mahfuzur'));
