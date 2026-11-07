\set ON_ERROR_STOP on
grant select, insert, update, delete on all tables in schema public to authenticated;
-- fixtures as superuser
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','admin@afmi'),('00000000-0000-0000-0000-00000000000b','member@afmi'),
 ('00000000-0000-0000-0000-00000000000c','guest@donor'),('00000000-0000-0000-0000-00000000000d','out@x');
insert into profiles(id, full_name) select id, email from auth.users;
insert into workspaces(id,name) values ('10000000-0000-0000-0000-000000000001','AFMI'),('10000000-0000-0000-0000-000000000002','Other');
insert into workspace_members values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','admin'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','guest'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000d','admin');
insert into workflows(id,workspace_id,name,restrict_transitions) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Default',true),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Other',false);
insert into workflow_statuses(id,workflow_id,name_ar,name_fr,category,rank) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','للتنفيذ','À faire','todo','a'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','جارٍ','En cours','in_progress','b'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','منجز','Terminé','done','c'),
 ('30000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000002','x','x','todo','a');
insert into workflow_transitions(workflow_id,from_status_id,to_status_id) values
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003'),
 ('20000000-0000-0000-0000-000000000001',null,'30000000-0000-0000-0000-000000000001');
insert into donors(id,workspace_id,name) values ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Bailleur X');
insert into projects(id,workspace_id,workflow_id,donor_id,name,privacy,budget_cents) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Reboisement','workspace',100000000),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',null,'Interne RH','private',null);
insert into project_members values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','viewer');
insert into expenses(project_id,amount_cents,spent_on,label) values ('50000000-0000-0000-0000-000000000001',5000000,'2026-10-01','Plants');

create function expect_error(q text, label text) returns void language plpgsql as $$
begin execute q; raise exception 'FAIL (no error): %', label;
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  % -> %', label, sqlerrm; end $$;
grant execute on function expect_error to authenticated;
create function check_eq(got bigint, want bigint, label text) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'FAIL %: got % want %', label, got, want; end if;
raise notice 'ok  %', label; end $$;
grant execute on function check_eq to authenticated;

-- ---------- member ----------
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select check_eq((select count(*) from projects), 1, 'member sees workspace project only');
insert into tasks(id,project_id,status_id,title,rank,board_rank,assignee_id) values
 ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Planter 1000 arbres','a','a','00000000-0000-0000-0000-00000000000a');
select expect_error($$update tasks set status_id='30000000-0000-0000-0000-000000000003' where id='60000000-0000-0000-0000-000000000001'$$, 'todo->done blocked');
update tasks set status_id='30000000-0000-0000-0000-000000000002' where id='60000000-0000-0000-0000-000000000001';
update tasks set status_id='30000000-0000-0000-0000-000000000003' where id='60000000-0000-0000-0000-000000000001';
select check_eq((select count(*) from tasks where completed_at is not null), 1, 'done sets completed_at');
update tasks set status_id='30000000-0000-0000-0000-000000000001' where id='60000000-0000-0000-0000-000000000001';
select check_eq((select count(*) from tasks where completed_at is not null), 0, 'global transition back to todo clears completed_at');
select expect_error($$insert into tasks(project_id,status_id,title,rank,board_rank) values ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000009','bad','b','b')$$, 'status from other workflow');
select expect_error($$insert into tasks(project_id,status_id,title,rank,board_rank) values ('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','x','b','b')$$, 'member cannot write private project');
insert into tasks(id,project_id,status_id,title,rank,board_rank) values
 ('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Acheter plants','b','b'),
 ('60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Sous-tache','c','c');
update tasks set parent_task_id='60000000-0000-0000-0000-000000000002' where id='60000000-0000-0000-0000-000000000003';
select expect_error($$update tasks set parent_task_id='60000000-0000-0000-0000-000000000003' where id='60000000-0000-0000-0000-000000000001'$$, 'no sub-subtasks');
insert into task_dependencies values ('60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002');
select expect_error($$insert into task_dependencies values ('60000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001')$$, 'dependency cycle');
insert into comments(task_id,author_id,body) values ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','{"t":"ok"}');
select check_eq((select count(*) from expenses), 1, 'member sees expenses');
select check_eq((select count(*) from activities), 7, 'activities logged (3 creates + 3 status + 1 comment)');
select check_eq((select count(*) from notifications), 0, 'member cannot read others notifications');

-- ---------- admin ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select check_eq((select count(*) from projects), 2, 'admin sees private project');
select check_eq((select count(*) from notifications), 5, 'assignee notified: create + 3 status + comment');

-- ---------- guest ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select check_eq((select count(*) from projects), 1, 'guest sees only shared project');
select check_eq((select count(*) from tasks), 3, 'guest sees its tasks');
select check_eq((select count(*) from expenses), 0, 'guest cannot see expenses');
select check_eq((select count(*) from donors), 0, 'guest cannot see donors');
select expect_error($$insert into comments(task_id,author_id,body) values ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','{}')$$, 'viewer cannot comment');
update tasks set title='hack' where id='60000000-0000-0000-0000-000000000001';
select check_eq((select count(*) from tasks where title='hack'), 0, 'viewer cannot update tasks');

-- ---------- outsider ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select check_eq((select count(*) from projects), 0, 'outsider sees nothing');
select check_eq((select count(*) from tasks), 0, 'outsider sees no tasks');
select check_eq((select count(*) from profiles where full_name like '%afmi%'), 0, 'outsider sees no AFMI people');

select project_id, tasks_total, tasks_done, last_status, spent_cents from project_progress;
reset role;
