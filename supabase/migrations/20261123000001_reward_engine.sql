-- Reward Engine v1.0 (docs/reward-engine.md)
-- XP is awarded once, on the server, at the task's active/paused -> completed transition,
-- together with the record, node, project XP/level/streak and resources, in one transaction.

-- 1. Reward snapshot on the completion record
alter table public.records add column if not exists reward_breakdown jsonb;
alter table public.records add column if not exists formula_version text;
alter table public.records alter column xp_change type integer;

-- 2. Atomic + idempotent completion.
--    Security invoker: RLS still decides which record/project the caller can touch.
--    p_expected_xp is the project XP the reward (growth stage, new level) was computed from;
--    if it changed meanwhile the call raises xp_conflict and the app recomputes.
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

  if r.status not in ('active', 'paused') then
    raise exception 'record_not_active';
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
      completed_at = now(),
      xp_change = p_xp,
      reward_breakdown = p_breakdown,
      formula_version = p_formula_version,
      resource_gained = p_resources,
      reward_redeemed = false
  where id = r.id;

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

-- 3. Add XP outside task completion (feeding resources), same optimistic check.
create or replace function public.add_character_xp(
  p_project_id uuid,
  p_xp integer,
  p_expected_xp numeric,
  p_new_level bigint
)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_xp numeric;
  new_xp numeric;
begin
  if p_xp is null or p_xp < 0 or p_new_level < 1 then
    raise exception 'invalid_reward';
  end if;

  select character_xp into current_xp from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'project_not_found';
  end if;

  if current_xp is distinct from p_expected_xp then
    raise exception 'xp_conflict';
  end if;

  update public.projects
  set character_xp = character_xp + p_xp, character_level = p_new_level
  where id = p_project_id
  returning character_xp into new_xp;

  return new_xp;
end;
$$;

revoke execute on function public.add_character_xp(uuid, integer, numeric, bigint) from public, anon;
grant execute on function public.add_character_xp(uuid, integer, numeric, bigint) to authenticated;

-- 4. One-off: the level curve is now growth_step x LEVEL_XP_REQUIREMENT_SCALE (5, src/lib/rewards/config.ts).
--    Scale existing XP by the same factor so every project keeps its level.
--    Past records.xp_change is history and stays as it was.
update public.projects set character_xp = character_xp * 5;
