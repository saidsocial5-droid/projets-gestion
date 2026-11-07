-- M2b: membership integrity.

-- project members must belong to the project's workspace (guests included)
create function project_members_check_workspace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id
     where p.id = new.project_id and wm.user_id = new.user_id
  ) then
    raise exception 'user is not in the workspace' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger project_members_check_workspace before insert or update on project_members
  for each row execute function project_members_check_workspace();

-- leaving the workspace removes project memberships
create function workspace_members_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- workspace admins stay effective admins of every project, so the
  -- "keep one project admin" rule is relaxed for this cleanup
  perform set_config('app.membership_cleanup', 'on', true);
  delete from project_members pm using projects p
   where pm.project_id = p.id and p.workspace_id = old.workspace_id and pm.user_id = old.user_id;
  perform set_config('app.membership_cleanup', 'off', true);
  return old;
end $$;
create trigger workspace_members_cleanup after delete on workspace_members
  for each row execute function workspace_members_cleanup();

-- a workspace always keeps at least one admin
create function workspace_keep_admin() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE' or new.role <> 'admin') and old.role = 'admin'
     and not exists (select 1 from workspace_members
                      where workspace_id = old.workspace_id and role = 'admin' and user_id <> old.user_id) then
    raise exception 'last admin' using errcode = 'P0001', hint = 'last_admin';
  end if;
  return coalesce(new, old);
end $$;
create trigger workspace_keep_admin before update of role or delete on workspace_members
  for each row execute function workspace_keep_admin();

-- a project always keeps at least one explicit admin
create function project_keep_admin() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE' or new.role <> 'admin') and old.role = 'admin'
     and coalesce(current_setting('app.membership_cleanup', true), 'off') <> 'on'
     and exists (select 1 from projects where id = old.project_id)
     and not exists (select 1 from project_members
                      where project_id = old.project_id and role = 'admin' and user_id <> old.user_id) then
    raise exception 'last admin' using errcode = 'P0001', hint = 'last_admin';
  end if;
  return coalesce(new, old);
end $$;
create trigger project_keep_admin before update of role or delete on project_members
  for each row execute function project_keep_admin();

-- email of the people the caller can manage (profiles has no email column)
create function member_emails(ws uuid) returns table (user_id uuid, email text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text from auth.users u
    join workspace_members wm on wm.user_id = u.id and wm.workspace_id = ws
   where is_ws_admin(ws)
$$;
revoke all on function member_emails(uuid) from public;
grant execute on function member_emails(uuid) to authenticated;
