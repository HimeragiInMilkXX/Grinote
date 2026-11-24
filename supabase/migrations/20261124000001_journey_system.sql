-- MVP 4.0: Journey system (docs/journey-system.md)
-- A finished task goes active/paused -> reviewing (timer stopped, no XP yet). The user writes a
-- report (reflections, later evidence), the AI analyses it, the user confirms, and only then
-- complete_task_with_reward awards XP and freezes the journal in the same transaction.

-- 1. records: new 'reviewing' status, the moment 完成 was pressed, one open record per project
alter table public.records drop constraint if exists chk_records_status;
alter table public.records add constraint chk_records_status
  check (status in ('active', 'paused', 'reviewing', 'completed', 'abandoned'));

alter table public.records add column if not exists ended_at timestamptz;

create unique index if not exists records_one_open_per_project
  on public.records (project_id)
  where status in ('active', 'paused', 'reviewing');

-- 2. task_journals: the report + AI analysis of one record
create table if not exists public.task_journals (
  record_id bigint primary key references public.records(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  node_id uuid not null,

  -- task snapshot, so the entry reads on its own (UI + AI history)
  task_name text not null,
  task_description text,
  estimated_minutes numeric,

  reflection_learned text check (char_length(reflection_learned) <= 4000),
  reflection_difficult text check (char_length(reflection_difficult) <= 4000),
  reflection_next text check (char_length(reflection_next) <= 4000),

  clarifications jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  verification text not null default 'self_report' check (verification in ('self_report', 'evidence')),

  analysis jsonb,
  ai_score smallint check (ai_score between 0 and 100),
  model text,
  analysis_status text not null default 'draft'
    check (analysis_status in ('draft', 'analyzing', 'needs_clarification', 'analyzed', 'failed', 'confirmed', 'confirmed_without_ai')),
  analysis_runs smallint not null default 0 check (analysis_runs >= 0),
  clarification_rounds smallint not null default 0 check (clarification_rounds >= 0),
  analyzed_at timestamptz,
  confirmed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_journals_project_idx on public.task_journals (project_id);

alter table public.task_journals enable row level security;

drop policy if exists "Users read their journals" on public.task_journals;
create policy "Users read their journals" on public.task_journals
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create journals for their records" on public.task_journals;
create policy "Users create journals for their records" on public.task_journals
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.records r
      where r.id = task_journals.record_id
        and r.user_id = (select auth.uid())
        and r.project_id = task_journals.project_id
        and r.node_id = task_journals.node_id
    )
  );

drop policy if exists "Users update their journals" on public.task_journals;
create policy "Users update their journals" on public.task_journals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- no delete policy: journals go only with their record (cascade)

-- Insert guard: a journal starts as an empty draft of a record that is waiting for its report.
-- Analysis, score and confirmation can only be written later (update guard + RPC).
create or replace function public.task_journals_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.records r
    where r.id = new.record_id and r.status = 'reviewing'
      and r.user_id = new.user_id and r.project_id = new.project_id and r.node_id = new.node_id
  ) then
    raise exception 'journal_record_not_reviewing';
  end if;

  new.analysis := null;
  new.ai_score := null;
  new.model := null;
  new.analysis_status := 'draft';
  new.analysis_runs := 0;
  new.clarification_rounds := 0;
  new.clarifications := '[]'::jsonb;
  new.evidence := '[]'::jsonb;
  new.verification := 'self_report';
  new.analyzed_at := null;
  new.confirmed_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_task_journals_insert_guard on public.task_journals;
create trigger trg_task_journals_insert_guard
  before insert on public.task_journals
  for each row execute function public.task_journals_insert_guard();

-- Guard: identity columns never change, a confirmed journal is frozen, and it can only become
-- confirmed together with its record's completion (inside complete_task_with_reward).
create or replace function public.task_journals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.confirmed_at is not null then
    raise exception 'journal_locked';
  end if;

  if new.record_id is distinct from old.record_id
     or new.project_id is distinct from old.project_id
     or new.user_id is distinct from old.user_id
     or new.node_id is distinct from old.node_id then
    raise exception 'journal_locked';
  end if;

  if new.analysis_status in ('confirmed', 'confirmed_without_ai') or new.confirmed_at is not null then
    if not exists (select 1 from public.records r where r.id = new.record_id and r.status = 'completed') then
      raise exception 'journal_not_completed';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_task_journals_guard on public.task_journals;
create trigger trg_task_journals_guard
  before update on public.task_journals
  for each row execute function public.task_journals_guard();

-- 3. Completion now needs a report: the record must be 'reviewing' and its journal analysed
--    (or failed, for the no-AI claim). The AI score in the snapshot must match the journal.
create or replace function public.complete_task_with_reward(
  p_record_id bigint,
  p_duration bigint,
  p_xp integer,
  p_breakdown jsonb,
  p_formula_version text,
  p_resources jsonb,
  p_expected_xp numeric,
  p_new_level bigint,
  p_new_streak numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.records%rowtype;
  p public.projects%rowtype;
  n public.nodes%rowtype;
  j public.task_journals%rowtype;
  snapshot_score numeric;
  res_key text;
  res_qty jsonb;
begin
  select * into r from public.records where id = p_record_id for update;
  if not found then
    raise exception 'record_not_found';
  end if;

  -- retry of an already rewarded completion: award nothing
  if r.status = 'completed' then
    return jsonb_build_object('record_id', r.id, 'already_completed', true, 'xp_change', r.xp_change);
  end if;

  if r.status <> 'reviewing' then
    raise exception 'record_not_active';
  end if;

  select * into j from public.task_journals where record_id = r.id for update;
  if not found or j.analysis_status not in ('analyzed', 'failed') then
    raise exception 'journal_required';
  end if;

  snapshot_score := (p_breakdown #>> '{inputs,ai,score}')::numeric;
  if j.analysis_status = 'analyzed' and snapshot_score is distinct from j.ai_score::numeric then
    raise exception 'invalid_reward';
  end if;
  if j.analysis_status = 'failed' and snapshot_score is not null then
    raise exception 'invalid_reward';
  end if;

  if p_xp is null or p_xp < 0 or p_duration is null or p_duration < 0 or p_new_level < 1 or p_new_streak < 0 then
    raise exception 'invalid_reward';
  end if;

  select * into p from public.projects where id = r.project_id for update;
  if not found then
    raise exception 'project_not_found';
  end if;

  if p.character_xp is distinct from p_expected_xp then
    raise exception 'xp_conflict';
  end if;

  select * into n from public.nodes where id = r.node_id and project_id = r.project_id for update;
  if not found then
    raise exception 'node_not_found';
  end if;

  if coalesce(n."isCompleted", false) then
    raise exception 'node_already_completed';
  end if;

  update public.records
  set status = 'completed',
      duration = p_duration,
      completed_at = coalesce(r.ended_at, now()),
      xp_change = p_xp,
      reward_breakdown = p_breakdown,
      formula_version = p_formula_version,
      resource_gained = p_resources,
      reward_redeemed = false
  where id = r.id;

  update public.task_journals
  set analysis_status = case when j.analysis_status = 'analyzed' then 'confirmed' else 'confirmed_without_ai' end,
      confirmed_at = now()
  where record_id = r.id;

  if n."isLoop" then
    update public.nodes
    set repetitions_completed = coalesce(repetitions_completed, 0) + 1,
        "isCompleted" = coalesce(repetitions_completed, 0) + 1 >= coalesce(repetitions_required, 1)
    where id = n.id;
  else
    update public.nodes set "isCompleted" = true where id = n.id;
  end if;

  update public.projects
  set character_xp = character_xp + p_xp,
      character_level = p_new_level,
      streak = p_new_streak
  where id = p.id;

  for res_key, res_qty in select key, value from jsonb_each(coalesce(p_resources, '{}'::jsonb)) loop
    insert into public.project_resources (project_id, resource_id, quantity)
    values (p.id, res_key::bigint, (res_qty #>> '{}')::integer)
    on conflict (project_id, resource_id)
    do update set quantity = public.project_resources.quantity + excluded.quantity;
  end loop;

  return jsonb_build_object('record_id', r.id, 'already_completed', false, 'xp_change', p_xp);
end;
$$;

revoke execute on function public.complete_task_with_reward(bigint, bigint, integer, jsonb, text, jsonb, numeric, bigint, numeric) from public, anon;
grant execute on function public.complete_task_with_reward(bigint, bigint, integer, jsonb, text, jsonb, numeric, bigint, numeric) to authenticated;

-- 4. A pending report counts as an active task for settings and reset
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
      where r.project_id = new.id and r.status in ('active', 'paused', 'reviewing')
    ) then
      raise exception 'project_active_task';
    end if;
  end if;

  return new;
end;
$$;

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
