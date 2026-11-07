-- M3c: project templates.
-- A template is a project with is_template = true. Copying keeps the
-- structure (sections, tasks, subtasks, dependencies, custom fields,
-- indicators) and drops the people, dates, values, comments and money.

create function copy_project_structure(p_from uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare first_status uuid;
begin
  select s.id into first_status
    from projects p join workflow_statuses s on s.workflow_id = p.workflow_id
   where p.id = p_to order by s.rank limit 1;

  create temp table _sec on commit drop as
    select id as old_id, gen_random_uuid() as new_id, name, rank from sections where project_id = p_from;
  insert into sections (id, project_id, name, rank) select new_id, p_to, name, rank from _sec;

  create temp table _task on commit drop as
    select t.id as old_id, gen_random_uuid() as new_id, t.* from tasks t where t.project_id = p_from;

  -- parents first, then subtasks
  insert into tasks (id, project_id, section_id, parent_task_id, status_id, title, description, priority, rank, board_rank)
  select x.new_id, p_to, s.new_id, null, first_status, x.title, x.description, x.priority, x.rank, x.board_rank
    from _task x left join _sec s on s.old_id = x.section_id
   where x.parent_task_id is null;
  insert into tasks (id, project_id, section_id, parent_task_id, status_id, title, description, priority, rank, board_rank)
  select x.new_id, p_to, null, par.new_id, first_status, x.title, x.description, x.priority, x.rank, x.board_rank
    from _task x join _task par on par.old_id = x.parent_task_id;

  insert into task_dependencies (task_id, depends_on_task_id)
  select a.new_id, b.new_id from task_dependencies d
    join _task a on a.old_id = d.task_id join _task b on b.old_id = d.depends_on_task_id;

  insert into project_fields (project_id, field_id, rank)
  select p_to, field_id, rank from project_fields where project_id = p_from
  on conflict do nothing;

  insert into indicators (project_id, name_ar, name_fr, unit, baseline, target, current, rank)
  select p_to, name_ar, name_fr, unit, baseline, target, baseline, rank from indicators where project_id = p_from;
end $$;
revoke all on function copy_project_structure(uuid, uuid) from public;

-- Saves an existing project as a new template. Caller must be able to edit the project.
create function save_as_template(p_project uuid, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); src projects; tid uuid;
begin
  if not can_edit_project(p_project) or not is_ws_staff((select workspace_id from projects where id = p_project)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into src from projects where id = p_project;
  insert into projects (workspace_id, workflow_id, owner_id, name, description, privacy, color, is_template, created_by)
  values (src.workspace_id, src.workflow_id, uid, p_name, src.description, 'workspace', src.color, true, uid)
  returning id into tid;
  insert into project_members (project_id, user_id, role) values (tid, uid, 'admin');
  perform copy_project_structure(p_project, tid);
  return tid;
end $$;
revoke all on function save_as_template(uuid, text) from public;
grant execute on function save_as_template(uuid, text) to authenticated;

-- create_project gains an optional template
drop function create_project(text, text, date, text);
create function create_project(
  p_name text,
  p_privacy text default 'workspace',
  p_due_date date default null,
  p_section_name text default 'المهام',
  p_template uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ws uuid; wf uuid; pid uuid;
begin
  select workspace_id into ws from workspace_members
   where user_id = uid and role in ('admin','member') order by created_at limit 1;
  if ws is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_template is not null and not exists (
    select 1 from projects where id = p_template and is_template and workspace_id = ws and can_view_project(id)) then
    raise exception 'unknown template' using errcode = 'check_violation';
  end if;
  select coalesce((select workflow_id from projects where id = p_template),
                  (select id from workflows where workspace_id = ws order by created_at limit 1)) into wf;

  insert into projects (workspace_id, workflow_id, owner_id, name, privacy, due_date, created_by)
  values (ws, wf, uid, p_name, p_privacy, p_due_date, uid) returning id into pid;
  insert into project_members (project_id, user_id, role) values (pid, uid, 'admin');
  if p_template is null then
    insert into sections (project_id, name, rank) values (pid, p_section_name, 'a0');
  else
    perform copy_project_structure(p_template, pid);
    if not exists (select 1 from sections where project_id = pid) then
      insert into sections (project_id, name, rank) values (pid, p_section_name, 'a0');
    end if;
  end if;
  return pid;
end $$;
revoke all on function create_project(text, text, date, text, uuid) from public;
grant execute on function create_project(text, text, date, text, uuid) to authenticated;
