-- psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql  (needs an empty database: run after `supabase db reset`)
begin;
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'stranger@x.test'),
  ('e0000000-0000-0000-0000-000000000002', 'Boss@AFMI.test');
insert into bootstrap_admins values ('boss@afmi.test');
do $$
declare r uuid;
begin
  perform set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
  r := bootstrap_or_join();
  if r is not null or exists (select 1 from workspaces) then raise exception 'FAIL: stranger created the workspace'; end if;
  raise notice 'ok  a stranger cannot claim an empty database';
  perform set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
  r := bootstrap_or_join();
  if r is null or not exists (select 1 from workspace_members where user_id = 'e0000000-0000-0000-0000-000000000002' and role = 'admin') then
    raise exception 'FAIL: listed admin could not bootstrap';
  end if;
  raise notice 'ok  the listed email (any case) becomes the first admin';
end $$;
rollback;
