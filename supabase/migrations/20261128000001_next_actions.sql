-- AI suggested next action (MVP 5.5).
-- One row per suggestion session. The AI (or the user) picks existing, startable tree nodes:
-- kind 'progress' = one task, 'practice_progress' = one loop task + one task.
-- The current next action of a project is its latest 'saved' row (by saved_at).
-- See docs/next-action.md.

create table if not exists public.next_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'saved', 'rejected', 'replaced', 'expired')),
  origin text not null
    check (origin in ('task_completed', 'tree_saved', 'manual')),
  intent text
    check (intent is null or intent in ('next_work_day', 'continue_now', 'unsure')),
  kind text
    check (kind is null or kind in ('progress', 'practice_progress')),
  source text not null default 'ai'
    check (source in ('ai', 'user')),
  progress_node_id uuid references public.nodes(id) on delete set null,
  practice_node_id uuid references public.nodes(id) on delete set null,
  -- task name snapshots (the node ids become null when a node is deleted)
  progress_task_name text,
  practice_task_name text,
  progress_reason text,
  practice_reason text,
  message text,
  scheduled_for date,
  generation_count smallint not null default 0
    check (generation_count between 0 and 4),
  history jsonb not null default '[]'::jsonb,
  model text,
  progress_done_at timestamptz,
  practice_done_at timestamptz,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint next_actions_saved_complete check (
    status <> 'saved' or (saved_at is not null and kind is not null and scheduled_for is not null)
  )
);

create index if not exists next_actions_project_status_idx
  on public.next_actions (project_id, status, saved_at desc);

-- at most one open draft per project
create unique index if not exists next_actions_one_draft_idx
  on public.next_actions (project_id) where status = 'draft';

alter table public.next_actions enable row level security;

drop policy if exists "Users read their next actions" on public.next_actions;
create policy "Users read their next actions" on public.next_actions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create next actions for their projects" on public.next_actions;
create policy "Users create next actions for their projects" on public.next_actions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = next_actions.project_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users update their next actions" on public.next_actions;
create policy "Users update their next actions" on public.next_actions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- needed by reset_project_progress (security invoker); the app itself never deletes rows
drop policy if exists "Users delete their next actions" on public.next_actions;
create policy "Users delete their next actions" on public.next_actions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Guard: owner/project never change, picked nodes must belong to the project, touch updated_at.
create or replace function public.next_actions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id or new.user_id is distinct from old.user_id then
      raise exception 'next_action_locked_field';
    end if;
  end if;

  if new.progress_node_id is not null and not exists (
    select 1 from public.nodes n where n.id = new.progress_node_id and n.project_id = new.project_id
  ) then
    raise exception 'next_action_foreign_node';
  end if;

  if new.practice_node_id is not null and not exists (
    select 1 from public.nodes n where n.id = new.practice_node_id and n.project_id = new.project_id
  ) then
    raise exception 'next_action_foreign_node';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_next_actions_guard on public.next_actions;
create trigger trg_next_actions_guard before insert or update on public.next_actions
  for each row execute function public.next_actions_guard();

-- Reset also clears next actions (same body as 20261124000001 plus one delete).
create or replace function public.reset_project_progress(p_project_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'project_not_found';
  end if;

  if exists (
    select 1 from public.records r
    where r.project_id = p_project_id and r.status in ('active', 'paused', 'reviewing')
  ) then
    raise exception 'project_active_task';
  end if;

  delete from public.next_actions where project_id = p_project_id;

  -- non-root nodes (cascades their records, journals and material_nodes links)
  delete from public.nodes
  where project_id = p_project_id and coalesce("isRoot", false) = false;

  delete from public.records where project_id = p_project_id;
  delete from public.project_resources where project_id = p_project_id;

  update public.nodes
  set "isCompleted" = false, repetitions_completed = 0
  where project_id = p_project_id and coalesce("isRoot", false) = true;

  update public.projects
  set character_xp = 0, character_level = 1, streak = 0
  where id = p_project_id;
end;
$$;
