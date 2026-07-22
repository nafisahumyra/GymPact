alter table public.pacts
  add column final_result text,
  add column final_workout_counts jsonb,
  add column winner_id uuid references public.users(id),
  add column completed_at timestamptz;

alter table public.pacts
  add constraint pacts_final_result_check
    check (final_result is null or final_result in ('winner', 'both_completed', 'both_failed')),
  add constraint pacts_finalization_check
    check (
      (status = 'completed'
        and final_result is not null
        and final_workout_counts is not null
        and completed_at is not null)
      or
      (status <> 'completed'
        and final_result is null
        and final_workout_counts is null
        and winner_id is null
        and completed_at is null)
    ),
  add constraint pacts_winner_result_check
    check (
      (final_result = 'winner' and winner_id is not null)
      or
      (final_result is distinct from 'winner' and winner_id is null)
    );

create index pacts_completed_at_idx
  on public.pacts (completed_at desc)
  where status = 'completed';
