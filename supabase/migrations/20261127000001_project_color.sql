-- Project color (weekly calendar). Every project needs one of the preset palette keys.
-- Keep the key list in sync with PROJECT_COLORS in src/lib/projects/colors.ts.

alter table public.projects add column if not exists color text;

-- Backfill: each user's existing projects get distinct colors in creation order.
update public.projects p
   set color = (array['teal','amber','violet','blue','rose','green','orange','cyan','pink','slate'])[((s.rn - 1) % 10) + 1]
  from (
    select id, row_number() over (partition by user_id order by created_at, id) as rn
      from public.projects
  ) s
 where s.id = p.id
   and p.color is null;

alter table public.projects
  alter column color set not null,
  add constraint projects_color_check
    check (color in ('teal','amber','violet','blue','rose','green','orange','cyan','pink','slate'));
