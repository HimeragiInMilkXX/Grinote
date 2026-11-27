-- User-defined project schedule (MVP 6.0).
-- One row = one planned session of a tree node on a day (Tokyo date). A loop node may be
-- scheduled several times (up to its remaining repetitions), a one-time node once.
-- Confirming a task report ticks the earliest open entry of that node (records_tick_schedule).
-- Done entries are frozen: never moved, edited or deleted by the app.
-- See docs/schedule.md.

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  node_id uuid not null references public.nodes(id) on delete cascade,
  scheduled_for date not null,
  done_at timestamptz,
  record_id bigint references public.records(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_items_project_day_idx
  on public.schedule_items (project_id, scheduled_for);

create index if not exists schedule_items_open_node_idx
  on public.schedule_items (node_id, scheduled_for) where done_at is null;

create index if not exists schedule_items_user_idx
  on public.schedule_items (user_id);

alter table public.schedule_items enable row level security;

drop policy if exists "Users read their schedule" on public.schedule_items;
create policy "Users read their schedule" on public.schedule_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users schedule tasks of their projects" on public.schedule_items;
create policy "Users schedule tasks of their projects" on public.schedule_items
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = schedule_items.project_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users update their schedule" on public.schedule_items;
create policy "Users update their schedule" on public.schedule_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Completed entries can't be erased. (FK cascades from nodes/projects bypass RLS, so deleting a
-- node, the project, or reset_project_progress still cleans them up.)
drop policy if exists "Users delete their open schedule entries" on public.schedule_items;
create policy "Users delete their open schedule entries" on public.schedule_items
  for delete to authenticated
  using ((select auth.uid()) = user_id and done_at is null);

-- Guard: owner/project/node never change, done entries are frozen, the node must be an open
-- action of the project, new days can't be in the past (Tokyo), and the repetition limit holds.
create or replace function public.schedule_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n record;
  open_count integer;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id
      or new.user_id is distinct from old.user_id
      or new.node_id is distinct from old.node_id then
      raise exception 'schedule_locked_field';
    end if;

    if old.done_at is not null then
      -- only `record_id -> null` (records FK on delete set null) may touch a done entry
      if new.done_at is distinct from old.done_at or new.scheduled_for is distinct from old.scheduled_for then
        raise exception 'schedule_done_locked';
      end if;
      new.updated_at := now();
      return new;
    end if;

    -- the tick (done_at set by records_tick_schedule) skips the node checks:
    -- the node may just have become completed
    if new.done_at is not null then
      if new.scheduled_for is distinct from old.scheduled_for then
        raise exception 'schedule_done_locked';
      end if;
      new.updated_at := now();
      return new;
    end if;

    if new.scheduled_for is distinct from old.scheduled_for and new.scheduled_for < today then
      raise exception 'schedule_past_day';
    end if;

    new.updated_at := now();
    return new;
  end if;

  -- INSERT
  if new.done_at is not null or new.record_id is not null then
    raise exception 'schedule_done_locked';
  end if;

  if new.scheduled_for < today then
    raise exception 'schedule_past_day';
  end if;

  -- lock the node row so concurrent inserts can't both pass the limit
  select id, project_id, "isAction", "isRoot", "isCompleted", "isLoop",
         coalesce(repetitions_required, 1) as required,
         coalesce(repetitions_completed, 0) as completed
  into n
  from public.nodes
  where id = new.node_id
  for update;

  if not found or n.project_id is distinct from new.project_id then
    raise exception 'schedule_foreign_node';
  end if;

  if coalesce(n."isRoot", false) or not coalesce(n."isAction", false) then
    raise exception 'schedule_not_action';
  end if;

  if coalesce(n."isCompleted", false) then
    raise exception 'schedule_node_completed';
  end if;

  select count(*) into open_count
  from public.schedule_items s
  where s.node_id = new.node_id and s.done_at is null;

  if coalesce(n."isLoop", false) then
    if n.completed + open_count + 1 > n.required then
      raise exception 'schedule_over_limit';
    end if;
  elsif open_count >= 1 then
    raise exception 'schedule_over_limit';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_schedule_items_guard on public.schedule_items;
create trigger trg_schedule_items_guard before insert or update on public.schedule_items
  for each row execute function public.schedule_items_guard();

-- Tick: when a record becomes completed (complete_task_with_reward), stamp the node's earliest
-- open entry. Runs in the same transaction as the reward.
create or replace function public.records_tick_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.schedule_items s
  set done_at = coalesce(new.completed_at, now()),
      record_id = new.id
  where s.id = (
    select s2.id from public.schedule_items s2
    where s2.node_id = new.node_id
      and s2.project_id = new.project_id
      and s2.done_at is null
    order by s2.scheduled_for, s2.created_at
    limit 1
  );
  return new;
end;
$$;

revoke all on function public.records_tick_schedule() from public, anon, authenticated;

drop trigger if exists trg_records_tick_schedule on public.records;
create trigger trg_records_tick_schedule
  after update of status on public.records
  for each row
  when (old.status is distinct from 'completed' and new.status = 'completed')
  execute function public.records_tick_schedule();
