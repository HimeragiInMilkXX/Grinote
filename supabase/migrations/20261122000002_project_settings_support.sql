-- Project settings: one-time character rename, locked fields, no edits during an active task,
-- progress reset RPC, and materials cascading with their project.

-- 1. One-time character rename (null = rename still available)
alter table public.projects add column if not exists character_name_changed_at timestamptz;

-- 2. Materials are deleted with their project (storage files are removed by the app first)
alter table public.materials drop constraint if exists materials_project_id_fkey;
alter table public.materials add constraint materials_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade;

-- 3. Guard trigger: safety net behind the settings server action.
--    Error messages are stable keys mapped to Japanese text by the app.
create or replace function public.projects_guard_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.final_goal is distinct from old.final_goal
     or new.character_id is distinct from old.character_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'project_locked_field';
  end if;

  if new.character_given_name is distinct from old.character_given_name then
    if old.character_name_changed_at is not null then
      raise exception 'project_character_name_locked';
    end if;
    new.character_name_changed_at := now();
  else
    -- the client can never set or clear this column directly
    new.character_name_changed_at := old.character_name_changed_at;
  end if;

  if (new.name, new.description, new.achieve_date_goal, new.daily_time_goal, new.work_days, new.character_given_name)
     is distinct from
     (old.name, old.description, old.achieve_date_goal, old.daily_time_goal, old.work_days, old.character_given_name) then
    if exists (
      select 1 from public.records r
      where r.project_id = new.id and r.status in ('active', 'paused')
    ) then
      raise exception 'project_active_task';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_projects_guard_settings on public.projects;
create trigger trg_projects_guard_settings
  before update on public.projects
  for each row execute function public.projects_guard_settings();

-- 4. Reset progress: keep the project, its settings, the root node and materials.
--    Security invoker, so RLS still decides which project the caller can touch.
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
    where r.project_id = p_project_id and r.status in ('active', 'paused')
  ) then
    raise exception 'project_active_task';
  end if;

  -- non-root nodes (cascades their records and material_nodes links)
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

revoke execute on function public.reset_project_progress(uuid) from public, anon;
grant execute on function public.reset_project_progress(uuid) to authenticated;
