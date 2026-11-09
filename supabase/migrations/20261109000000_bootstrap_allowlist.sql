-- Production safety: who may create the workspace on an empty database.
-- If this table has rows, only those emails can become the first admin;
-- if it is empty (local development, tests), the first sign-in does.
create table bootstrap_admins (
  email text primary key check (email = lower(email))
);
alter table bootstrap_admins enable row level security; -- no policies: invisible to the API

create or replace function bootstrap_or_join() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mail text;
  ws uuid;
  wf uuid;
  s_todo uuid; s_doing uuid; s_review uuid; s_done uuid;
begin
  if uid is null then return null; end if;
  select lower(email) into mail from auth.users where id = uid;

  insert into profiles (id, full_name)
  values (uid, coalesce(split_part(mail, '@', 1), ''))
  on conflict (id) do nothing;

  insert into workspace_members (workspace_id, user_id, role)
  select i.workspace_id, uid, i.workspace_role
    from invitations i
   where lower(i.email) = mail and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  on conflict (workspace_id, user_id) do nothing;

  insert into project_members (project_id, user_id, role)
  select i.project_id, uid, coalesce(i.project_role, 'viewer')
    from invitations i
   where lower(i.email) = mail and i.accepted_at is null and i.revoked_at is null
     and i.expires_at > now() and i.project_id is not null
  on conflict (project_id, user_id) do nothing;

  update invitations set accepted_at = now()
   where lower(email) = mail and accepted_at is null and revoked_at is null and expires_at > now();

  perform pg_advisory_xact_lock(hashtext('bootstrap_workspace'));
  if not exists (select 1 from workspaces)
     and (not exists (select 1 from bootstrap_admins) or exists (select 1 from bootstrap_admins where email = mail)) then
    insert into workspaces (name) values ('AFMI') returning id into ws;
    insert into workspace_members (workspace_id, user_id, role) values (ws, uid, 'admin');

    insert into workflows (workspace_id, name, restrict_transitions)
    values (ws, 'Default', true) returning id into wf;
    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'للتنفيذ', 'À faire', 'gray', 'todo', 'a0') returning id into s_todo;
    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'قيد التنفيذ', 'En cours', 'blue', 'in_progress', 'a1') returning id into s_doing;
    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'قيد المراجعة', 'En revue', 'amber', 'in_progress', 'a2') returning id into s_review;
    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'منجز', 'Terminé', 'green', 'done', 'a3') returning id into s_done;
    insert into workflow_transitions (workflow_id, from_status_id, to_status_id) values
      (wf, s_todo, s_doing), (wf, s_doing, s_review), (wf, s_review, s_doing),
      (wf, s_review, s_done), (wf, null, s_todo);
  end if;

  select workspace_id into ws from workspace_members where user_id = uid order by created_at limit 1;
  return ws;
end $$;
