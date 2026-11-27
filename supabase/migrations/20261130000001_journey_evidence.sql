-- MVP 6.5: evidence upload for the task report (docs/journey-system.md)
-- Photos / videos / audio go to a private bucket under {user_id}/{project_id}/{record_id}/{file}.
-- They're read by the AI only while the report is written; after confirm they're just stored
-- and the user may still delete them (the analysis text stays).

-- 1. Private bucket (50 MB per file = the Supabase free-plan cap; per-kind limits in src/lib/journey/evidence.ts)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'journey_evidence', 'journey_evidence', false, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg',
    'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/aiff'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2. Storage policies: the first folder is the owner. Uploads only for a record of that user and
--    project that is still waiting for its report. No update policy (files are never replaced).
drop policy if exists "Users read their journey evidence" on storage.objects;
create policy "Users read their journey evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'journey_evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their journey evidence" on storage.objects;
create policy "Users delete their journey evidence" on storage.objects
  for delete to authenticated
  using (bucket_id = 'journey_evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload evidence for reviewing records" on storage.objects;
create policy "Users upload evidence for reviewing records" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'journey_evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.records r
      where r.id::text = (storage.foldername(name))[3]
        and r.project_id::text = (storage.foldername(name))[2]
        and r.user_id = (select auth.uid())
        and r.status = 'reviewing'
    )
  );

-- 3. Journal guard: a confirmed journal stays frozen, except that evidence items may be removed
--    (every remaining item must be unchanged, and nothing else may change).
create or replace function public.task_journals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.confirmed_at is not null then
    if (to_jsonb(new) - 'evidence' - 'updated_at') = (to_jsonb(old) - 'evidence' - 'updated_at')
       and jsonb_typeof(new.evidence) = 'array'
       and jsonb_array_length(new.evidence) < jsonb_array_length(old.evidence)
       and not exists (
         select 1 from jsonb_array_elements(new.evidence) e
         where not exists (select 1 from jsonb_array_elements(old.evidence) o where o = e)
       ) then
      new.updated_at := now();
      return new;
    end if;
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

  if jsonb_typeof(new.evidence) is distinct from 'array' or jsonb_array_length(new.evidence) > 3 then
    raise exception 'journal_evidence_invalid';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
