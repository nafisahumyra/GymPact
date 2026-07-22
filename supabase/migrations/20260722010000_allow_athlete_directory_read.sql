grant usage on schema public to anon;
grant select (id, display_name) on public.users to anon;

create policy "Anonymous users can read the athlete directory"
  on public.users
  for select
  to anon
  using (display_name in ('Nafisa', 'Mahfuzur'));
