-- M2e: workflow administration.

-- Admin maintenance (moving tasks off a deleted status) may skip the
-- transition rules; the flag is transaction-local and only set inside
-- security-definer functions below.
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

  if tg_op = 'UPDATE' and new.status_id is distinct from old.status_id and new.parent_task_id is null
     and coalesce(current_setting('app.workflow_maintenance', true), 'off') <> 'on' then
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

-- Deletes a status after moving its tasks to another status of the same workflow.
create function delete_status(p_status uuid, p_move_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare wf uuid; ws uuid;
begin
  select s.workflow_id, w.workspace_id into wf, ws
    from workflow_statuses s join workflows w on w.id = s.workflow_id where s.id = p_status;
  if wf is null or not is_ws_admin(ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_move_to = p_status or not exists (select 1 from workflow_statuses where id = p_move_to and workflow_id = wf) then
    raise exception 'invalid target status' using errcode = 'check_violation';
  end if;
  if (select count(*) from workflow_statuses where workflow_id = wf) <= 2 then
    raise exception 'a workflow needs at least two statuses' using errcode = 'P0001', hint = 'min_statuses';
  end if;
  perform set_config('app.workflow_maintenance', 'on', true);
  update tasks set status_id = p_move_to where status_id = p_status;
  perform set_config('app.workflow_maintenance', 'off', true);
  delete from workflow_statuses where id = p_status;
end $$;
revoke all on function delete_status(uuid, uuid) from public;
grant execute on function delete_status(uuid, uuid) to authenticated;

-- Replaces the allowed transitions of a workflow in one transaction.
-- p_pairs: [{"from": "<uuid>|null", "to": "<uuid>"}, ...]
create function set_transitions(p_workflow uuid, p_restrict boolean, p_pairs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  select workspace_id into ws from workflows where id = p_workflow;
  if ws is null or not is_ws_admin(ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update workflows set restrict_transitions = p_restrict where id = p_workflow;
  delete from workflow_transitions where workflow_id = p_workflow;
  insert into workflow_transitions (workflow_id, from_status_id, to_status_id)
  select p_workflow, nullif(x->>'from', '')::uuid, (x->>'to')::uuid
    from jsonb_array_elements(coalesce(p_pairs, '[]'::jsonb)) x
   where (x->>'to') is not null and nullif(x->>'from', '') is distinct from x->>'to'
  on conflict do nothing;
end $$;
revoke all on function set_transitions(uuid, boolean, jsonb) from public;
grant execute on function set_transitions(uuid, boolean, jsonb) to authenticated;
