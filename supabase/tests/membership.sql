-- Run against the local stack: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/membership.sql
-- Everything runs in a transaction that is rolled back.
begin;
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'solo-admin@t.test'),
  ('a0000000-0000-0000-0000-000000000002', 'm@t.test');
insert into profiles (id) values ('a0000000-0000-0000-0000-000000000001'), ('a0000000-0000-0000-0000-000000000002');
insert into workspaces (id, name) values ('b0000000-0000-0000-0000-000000000001', 'T');
insert into workspace_members values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member');
insert into workflows (id, workspace_id, name) values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'w');
insert into projects (id, workspace_id, workflow_id, name) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'p');
insert into project_members values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin');

do $$
begin
  begin
    update workspace_members set role = 'member' where user_id = 'a0000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: last workspace admin demoted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok  last workspace admin cannot be demoted';
  end;
  begin
    update project_members set role = 'viewer' where user_id = 'a0000000-0000-0000-0000-000000000002';
    raise exception 'FAIL: last project admin demoted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok  last project admin cannot be demoted';
  end;
  -- leaving the workspace removes project memberships even for the last project admin
  delete from workspace_members where user_id = 'a0000000-0000-0000-0000-000000000002';
  if exists (select 1 from project_members where user_id = 'a0000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL: project membership kept';
  end if;
  raise notice 'ok  leaving the workspace cleans project memberships';
  begin
    insert into project_members values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'viewer');
    raise exception 'FAIL: outsider added to project';
  exception when check_violation then
    raise notice 'ok  outsiders cannot be added to a project';
  end;
end $$;
rollback;
