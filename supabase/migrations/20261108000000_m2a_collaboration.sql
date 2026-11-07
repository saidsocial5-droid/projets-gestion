-- M2a: subtasks as checklist items, @mentions, attachment activity, storage bucket.

-- Subtasks behave like checklist items: they skip the transition rules (any
-- status is allowed) but their status must still belong to the workflow.
create or replace function tasks_check_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wf uuid; st_wf uuid; st_cat text; restricted boolean;
begin
  select workflow_id into wf from projects where id = new.project_id;
  select workflow_id, category into st_wf, st_cat from workflow_statuses where id = new.status_id;
  if st_wf is distinct from wf then
    raise exception 'status % is not in the workflow of project %', new.status_id, new.project_id
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and new.status_id is distinct from old.status_id and new.parent_task_id is null then
    select restrict_transitions into restricted from workflows where id = wf;
    if restricted and not exists (
      select 1 from workflow_transitions
       where workflow_id = wf and to_status_id = new.status_id
         and (from_status_id = old.status_id or from_status_id is null)
    ) then
      raise exception 'transition not allowed' using errcode = 'P0001', hint = 'workflow_transition';
    end if;
  end if;

  if st_cat = 'done' then
    new.completed_at := case when tg_op = 'UPDATE' then coalesce(old.completed_at, now()) else now() end;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

-- can user u see project p? (same rules as project_role, for someone other than the caller)
create function user_can_view_project(p uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projects pr join workspace_members wm
      on wm.workspace_id = pr.workspace_id and wm.user_id = u
     where pr.id = p and (wm.role = 'admin' or (wm.role = 'member' and pr.privacy = 'workspace'))
  ) or exists (select 1 from project_members where project_id = p and user_id = u)
$$;

-- comments: body = {"text": "...", "mentions": ["<uuid>", ...]}
-- mentioned people who can see the project become followers, so they are notified.
create or replace function log_comment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare act uuid; p uuid; m text;
begin
  select project_id into p from tasks where id = new.task_id;
  insert into activities (project_id, task_id, actor_id, action, payload)
  values (p, new.task_id, new.author_id, 'comment.created',
          jsonb_build_object('comment_id', new.id, 'excerpt', left(coalesce(new.body->>'text', ''), 140)))
  returning id into act;

  insert into followers (task_id, user_id) values (new.task_id, new.author_id) on conflict do nothing;
  if jsonb_typeof(new.body->'mentions') = 'array' then
    for m in select jsonb_array_elements_text(new.body->'mentions') loop
      begin
        if user_can_view_project(p, m::uuid) then
          insert into followers (task_id, user_id) values (new.task_id, m::uuid) on conflict do nothing;
        end if;
      exception when invalid_text_representation then null;
      end;
    end loop;
  end if;

  insert into notifications (user_id, activity_id)
  select f.user_id, act from followers f
   where f.task_id = new.task_id and f.user_id is distinct from new.author_id
  on conflict do nothing;
  return null;
end $$;

create function log_attachment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare p uuid;
begin
  select project_id into p from tasks where id = new.task_id;
  insert into activities (project_id, task_id, actor_id, action, payload)
  values (p, new.task_id, new.uploader_id, 'attachment.added', jsonb_build_object('file_name', new.file_name));
  return null;
end $$;

create trigger log_attachment_activity after insert on attachments
  for each row execute function log_attachment_activity();

alter table attachments alter column uploader_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- Storage: private bucket, object key = <project_id>/<task_id>/<uuid>-<file name>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

create function storage_project(name text) returns uuid
language sql immutable as $$
  select case when split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(name, '/', 1)::uuid end
$$;

create policy "attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_view_project(public.storage_project(name)));
create policy "attachments upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_comment_project(public.storage_project(name)));
create policy "attachments delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (owner_id = auth.uid()::text or public.can_admin_project(public.storage_project(name))));
