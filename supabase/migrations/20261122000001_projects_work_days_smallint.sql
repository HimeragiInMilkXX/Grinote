-- work_days: boolean[7] (Mon-first, positional) -> smallint[] of ISO weekdays (1=Mon .. 7=Sun), sorted & unique.
-- Run in one go (Supabase SQL editor wraps it in a transaction).

alter table public.projects add column work_days_v2 smallint[];

update public.projects p
set work_days_v2 = coalesce((
  select array_agg(i::smallint order by i)
  from generate_subscripts(p.work_days, 1) as i
  where p.work_days[i]
), '{}'::smallint[]);

alter table public.projects drop column work_days;
alter table public.projects rename column work_days_v2 to work_days;
alter table public.projects alter column work_days set not null;
alter table public.projects add constraint projects_work_days_check
  check (cardinality(work_days) between 1 and 7 and work_days <@ '{1,2,3,4,5,6,7}'::smallint[]);

comment on column public.projects.work_days is 'ISO weekday numbers (1=Mon .. 7=Sun), sorted and unique';
