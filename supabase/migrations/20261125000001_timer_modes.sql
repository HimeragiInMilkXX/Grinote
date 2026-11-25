-- MVP 4.5: work timer modes (Pomodoro / 50-10 / 10-min starter / Flowtime).
-- The whole timer state machine (mode, phase, sessions, breaks, pauses, mode history)
-- lives in one jsonb column, written only by server actions (src/lib/timer/machine.ts).
-- records.duration keeps meaning "focus time in ms" (used by the reward and AI analysis).
-- null = a record from before 4.5 (no timer data).

alter table public.records
  add column if not exists timer jsonb;

alter table public.records
  drop constraint if exists records_timer_is_object;

alter table public.records
  add constraint records_timer_is_object
  check (timer is null or jsonb_typeof(timer) = 'object');

comment on column public.records.timer is
  'Work timer state (TimerState v1, src/lib/timer/types.ts). null for records before MVP 4.5.';
