alter table public.users
  add column if not exists profile_photo_path text;

alter table public.gympact_sessions
  add column if not exists athlete_id uuid references public.users(id);

grant update (athlete_id) on public.gympact_sessions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
