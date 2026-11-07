-- M3e: live updates. Clients subscribe to activity inserts for one project
-- (every meaningful change writes one row: tasks, comments, files, status
-- updates, deletions). Realtime applies the activities RLS select policy to
-- each subscriber, so nobody receives events for projects they cannot see.
-- (Realtime cannot filter DELETE events, so deletions are logged as
-- activities instead of subscribing to tasks.)
alter publication supabase_realtime add table activities;

create function log_task_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- skip when the whole project is being deleted
  if exists (select 1 from projects where id = old.project_id) and old.parent_task_id is null then
    insert into activities (project_id, task_id, actor_id, action, payload)
    values (old.project_id, null, auth.uid(), 'task.deleted', jsonb_build_object('title', old.title));
  end if;
  return old;
end $$;
create trigger log_task_delete after delete on tasks
  for each row execute function log_task_delete();
