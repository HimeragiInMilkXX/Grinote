-- Checks the projects_guard_settings trigger and reset_project_progress.
-- Always ends with an exception, so every change is rolled back. The error text holds the results.
-- Set pid to any project id (it must have a root node).
do $$
declare
  pid uuid := '8fd37102-0bbc-4aaf-bbd7-27f26ecf300a';
  uid uuid; root uuid; out text := '';
  n_before int; n_after int; r record;
begin
  select user_id into uid from public.projects where id = pid;
  select id into root from public.nodes where project_id = pid and "isRoot";

  -- 1 final_goal locked
  begin update public.projects set final_goal = 'x' where id = pid; out := out || '1:ALLOWED(bad) ';
  exception when others then out := out || '1:' || sqlerrm || ' '; end;

  -- 2 character_id locked
  begin update public.projects set character_id = character_id + 1 where id = pid; out := out || '2:ALLOWED(bad) ';
  exception when others then out := out || '2:' || sqlerrm || ' '; end;

  -- 3 first rename allowed and stamped
  update public.projects set character_given_name = 'TestRename' where id = pid;
  out := out || '3:stamped=' || ((select character_name_changed_at from public.projects where id = pid) is not null) || ' ';

  -- 4 second rename blocked
  begin update public.projects set character_given_name = 'Again' where id = pid; out := out || '4:ALLOWED(bad) ';
  exception when others then out := out || '4:' || sqlerrm || ' '; end;

  -- 5 the stamp can't be cleared directly
  update public.projects set character_name_changed_at = null where id = pid;
  out := out || '5:still_stamped=' || ((select character_name_changed_at from public.projects where id = pid) is not null) || ' ';

  -- 6 xp updates pass
  update public.projects set character_xp = character_xp + 1 where id = pid; out := out || '6:xp_ok ';

  -- 7 invalid work_days rejected by the CHECK constraint
  begin update public.projects set work_days = '{0,8}' where id = pid; out := out || '7:ALLOWED(bad) ';
  exception when others then out := out || '7:' || sqlerrm || ' '; end;

  -- 8 an active task blocks settings and reset, not xp
  insert into public.records (node_id, project_id, user_id, status) values (root, pid, uid, 'active');
  begin update public.projects set name = name || '!' where id = pid; out := out || '8:ALLOWED(bad) ';
  exception when others then out := out || '8:' || sqlerrm || ' '; end;
  update public.projects set character_xp = character_xp + 1 where id = pid; out := out || '8b:xp_ok ';
  begin perform public.reset_project_progress(pid); out := out || '9:ALLOWED(bad) ';
  exception when others then out := out || '9:' || sqlerrm || ' '; end;
  delete from public.records where project_id = pid and status = 'active';

  -- 10 reset leaves only the root
  select count(*) into n_before from public.nodes where project_id = pid;
  perform public.reset_project_progress(pid);
  select count(*) into n_after from public.nodes where project_id = pid;
  select character_xp, character_level, streak into r from public.projects where id = pid;
  out := out || '10:nodes ' || n_before || '->' || n_after
     || ' root_kept=' || exists(select 1 from public.nodes where id = root)
     || ' records=' || (select count(*) from public.records where project_id = pid)
     || ' resources=' || (select count(*) from public.project_resources where project_id = pid)
     || ' xp/lv/streak=' || r.character_xp || '/' || r.character_level || '/' || r.streak;

  raise exception 'RESULTS(rolled back): %', out;
end $$;
