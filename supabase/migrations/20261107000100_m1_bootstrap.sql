-- M1: first-login bootstrap, invitation claim, project creation.

alter table projects alter column created_by set default auth.uid();
alter table tasks    alter column created_by set default auth.uid();
alter table comments alter column author_id  set default auth.uid();
alter table invitations alter column invited_by set default auth.uid();
-- M1 has no emailed token yet: the magic link proves the email, and the open
-- invitation is claimed on sign-in. M2 adds emailed invite links.
alter table invitations alter column token_hash set default encode(gen_random_bytes(32), 'hex');

-- Called after every sign-in. Creates the profile, claims open invitations for
-- the signed-in email, and, if the database has no workspace at all, creates
-- the AFMI workspace with its default workflow and makes the caller admin.
-- Returns the caller's workspace id, or null (no access).
create function bootstrap_or_join() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mail text;
  ws uuid;
  wf uuid;
  s_todo uuid; s_doing uuid; s_review uuid; s_done uuid;
begin
  if uid is null then return null; end if;
  select email into mail from auth.users where id = uid;

  insert into profiles (id, full_name)
  values (uid, coalesce(split_part(mail, '@', 1), ''))
  on conflict (id) do nothing;

  -- claim invitations
  insert into workspace_members (workspace_id, user_id, role)
  select i.workspace_id, uid, i.workspace_role
    from invitations i
   where lower(i.email) = lower(mail) and i.accepted_at is null and i.revoked_at is null
     and i.expires_at > now()
  on conflict (workspace_id, user_id) do nothing;

  insert into project_members (project_id, user_id, role)
  select i.project_id, uid, coalesce(i.project_role, 'viewer')
    from invitations i
   where lower(i.email) = lower(mail) and i.accepted_at is null and i.revoked_at is null
     and i.expires_at > now() and i.project_id is not null
  on conflict (project_id, user_id) do nothing;

  update invitations set accepted_at = now()
   where lower(email) = lower(mail) and accepted_at is null and revoked_at is null
     and expires_at > now();

  -- first user ever: create the workspace
  perform pg_advisory_xact_lock(hashtext('bootstrap_workspace'));
  if not exists (select 1 from workspaces) then
    insert into workspaces (name) values ('AFMI') returning id into ws;
    insert into workspace_members (workspace_id, user_id, role) values (ws, uid, 'admin');

    insert into workflows (workspace_id, name, restrict_transitions)
    values (ws, 'Default', true) returning id into wf;

    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'للتنفيذ',      'À faire',  'gray',   'todo',        'a0') returning id into s_todo;
    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'قيد التنفيذ',  'En cours', 'blue',   'in_progress', 'a1') returning id into s_doing;
    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'قيد المراجعة', 'En revue', 'amber',  'in_progress', 'a2') returning id into s_review;
    insert into workflow_statuses (workflow_id, name_ar, name_fr, color, category, rank) values
      (wf, 'منجز',         'Terminé',  'green',  'done',        'a3') returning id into s_done;

    insert into workflow_transitions (workflow_id, from_status_id, to_status_id) values
      (wf, s_todo,   s_doing),
      (wf, s_doing,  s_review),
      (wf, s_review, s_doing),
      (wf, s_review, s_done),
      (wf, null,     s_todo);     -- reopen / reset from anywhere
  end if;

  select workspace_id into ws from workspace_members where user_id = uid
   order by created_at limit 1;
  return ws;
end $$;

revoke all on function bootstrap_or_join() from public;
grant execute on function bootstrap_or_join() to authenticated;

-- Creates a project in the caller's workspace with the workspace's first
-- workflow, makes the caller project admin (so private projects stay
-- visible to their creator) and adds one starter section.
create function create_project(
  p_name text,
  p_privacy text default 'workspace',
  p_due_date date default null,
  p_section_name text default 'المهام'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ws uuid; wf uuid; pid uuid;
begin
  select workspace_id into ws from workspace_members
   where user_id = uid and role in ('admin','member') order by created_at limit 1;
  if ws is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select id into wf from workflows where workspace_id = ws order by created_at limit 1;

  insert into projects (workspace_id, workflow_id, owner_id, name, privacy, due_date, created_by)
  values (ws, wf, uid, p_name, p_privacy, p_due_date, uid) returning id into pid;
  insert into project_members (project_id, user_id, role) values (pid, uid, 'admin');
  insert into sections (project_id, name, rank) values (pid, p_section_name, 'a0');
  return pid;
end $$;

revoke all on function create_project(text, text, date, text) from public;
grant execute on function create_project(text, text, date, text) to authenticated;
