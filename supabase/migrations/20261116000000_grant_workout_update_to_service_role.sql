-- Activity edits are performed by the server-side Edge Function after it
-- verifies the GymPact PIN session and record ownership.
grant update on table public.workouts to service_role;
