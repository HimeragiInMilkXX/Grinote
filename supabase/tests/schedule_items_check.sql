-- Manual check of the schedule DB rules (20261129000001_schedule_items.sql).
-- Run in the Supabase SQL editor. It writes test rows, then raises an exception at the end,
-- so EVERYTHING is rolled back. The error message is the result:
--   ERROR: RESULTS: 1a ok;1b schedule_over_limit;2 schedule_past_day;...
-- Every line should show the expected code (or "ok"); "NOT rejected" means a rule is missing.

do $$
declare
  r text := '';
  today date := (now() at time zone 'Asia/Tokyo')::date;
  one_node uuid; one_project uuid; one_user uuid;
  loop_node uuid; loop_project uuid; loop_user uuid; loop_done int;
  other_node uuid;
  a uuid; rec bigint; cnt int;
begin
  -- an open one-time action and an open loop action (any projects)
  select n.id, n.project_id, p.user_id into one_node, one_project, one_user
  from nodes n join projects p on p.id = n.project_id
  where n."isAction" and not coalesce(n."isLoop", false) and not coalesce(n."isCompleted", false) and not coalesce(n."isRoot", false)
    and not exists (select 1 from schedule_items s where s.node_id = n.id and s.done_at is null)
  limit 1;

  select n.id, n.project_id, p.user_id, coalesce(n.repetitions_completed, 0) into loop_node, loop_project, loop_user, loop_done
  from nodes n join projects p on p.id = n.project_id
  where n."isAction" and n."isLoop" and not coalesce(n."isCompleted", false)
    and not exists (select 1 from schedule_items s where s.node_id = n.id and s.done_at is null)
  limit 1;

  select n.id into other_node from nodes n where n.project_id <> one_project limit 1;

  if one_node is null or loop_node is null then
    raise exception 'RESULTS: need one open one-time action and one open loop action without open entries';
  end if;

  -- 1 one-time: first ok, second rejected
  insert into schedule_items(project_id, user_id, node_id, scheduled_for) values (one_project, one_user, one_node, today + 1) returning id into a;
  r := r || '1a ok;';
  begin
    insert into schedule_items(project_id, user_id, node_id, scheduled_for) values (one_project, one_user, one_node, today + 2);
    r := r || '1b NOT rejected;';
  exception when others then r := r || '1b ' || sqlerrm || ';'; end;

  -- 2 past day rejected (expect schedule_past_day)
  begin
    insert into schedule_items(project_id, user_id, node_id, scheduled_for) values (loop_project, loop_user, loop_node, today - 1);
    r := r || '2 NOT rejected;';
  exception when others then r := r || '2 ' || sqlerrm || ';'; end;

  -- 3 loop limit: allow exactly 2 more repetitions
  update nodes set repetitions_required = loop_done + 2 where id = loop_node;
  insert into schedule_items(project_id, user_id, node_id, scheduled_for) values (loop_project, loop_user, loop_node, today);
  insert into schedule_items(project_id, user_id, node_id, scheduled_for) values (loop_project, loop_user, loop_node, today);
  r := r || '3ab ok;';
  begin
    insert into schedule_items(project_id, user_id, node_id, scheduled_for) values (loop_project, loop_user, loop_node, today + 3);
    r := r || '3c NOT rejected;';
  exception when others then r := r || '3c ' || sqlerrm || ';'; end;

  -- 4 node of another project rejected (expect schedule_foreign_node)
  begin
    insert into schedule_items(project_id, user_id, node_id, scheduled_for) values (one_project, one_user, other_node, today);
    r := r || '4 NOT rejected;';
  exception when others then r := r || '4 ' || sqlerrm || ';'; end;

  -- 5 move to the past rejected, to the future ok
  begin
    update schedule_items set scheduled_for = today - 2 where id = a;
    r := r || '5a NOT rejected;';
  exception when others then r := r || '5a ' || sqlerrm || ';'; end;
  update schedule_items set scheduled_for = today + 5 where id = a;
  r := r || '5b ok;';

  -- 6 tick: a record of the loop node becoming completed stamps the earliest open entry
  insert into records(node_id, project_id, user_id, status, started_at, ended_at)
  values (loop_node, loop_project, loop_user, 'abandoned', now(), now()) returning id into rec;
  update records set status = 'completed', completed_at = now() where id = rec;
  select count(*) into cnt from schedule_items where node_id = loop_node and done_at is not null and record_id = rec;
  r := r || '6 ticked=' || cnt || ' (expect 1);';

  -- 7 a done entry is frozen (expect schedule_done_locked)
  begin
    update schedule_items set scheduled_for = today + 1 where record_id = rec;
    r := r || '7 NOT rejected;';
  exception when others then r := r || '7 ' || sqlerrm || ';'; end;

  -- 8 deleting the record clears record_id on the done entry and is not blocked
  begin
    delete from task_journals where record_id = rec;
    delete from records where id = rec;
    select count(*) into cnt from schedule_items where node_id = loop_node and done_at is not null and record_id is null;
    r := r || '8 record delete ok, done kept=' || cnt || ' (expect 1);';
  exception when others then r := r || '8 ' || sqlerrm || ';'; end;

  raise exception 'RESULTS: %', r;
end $$;
