-- ============================================================================
-- projets-gestion — initial schema (Postgres 15+ on Supabase)
-- Access model: Postgres Row Level Security. Every table has RLS enabled and
-- policies built on the helper functions in section 2. The app talks to the
-- database with the user's JWT (supabase-js), never with the service key,
-- except in background jobs.
-- Conventions: uuid ids, timestamptz in UTC, money as integer cents + currency,
-- calendar dates (due dates) as `date` (no time zone), ordering by text `rank`
-- (fractional index) so a drag only rewrites one row.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. Tenancy and people
-- ---------------------------------------------------------------------------

create table workspaces (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  default_locale text not null default 'ar' check (default_locale in ('ar','fr')),
  timezone       text not null default 'Africa/Casablanca',
  currency       char(3) not null default 'MAD',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- one row per auth user (Supabase auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  avatar_url  text,
  locale      text not null default 'ar' check (locale in ('ar','fr')),
  notify_email boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('admin','member','guest')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_members (user_id);

create table invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  email         text not null,
  workspace_role text not null default 'member' check (workspace_role in ('admin','member','guest')),
  project_id    uuid,             -- fk added after projects; guests are invited to one project
  project_role  text check (project_role in ('admin','editor','commenter','viewer')),
  token_hash    text not null unique,   -- sha256 of the emailed token, never the token
  invited_by    uuid references profiles(id) on delete set null,
  expires_at    timestamptz not null default now() + interval '14 days',
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on invitations (workspace_id);
create index on invitations (lower(email));
create unique index invitations_one_open_per_email
  on invitations (workspace_id, lower(email), coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where accepted_at is null and revoked_at is null;

create table donors (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  contact_name text,
  contact_email text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

-- ---------------------------------------------------------------------------
-- 2. Workflows (Jira-style statuses and transitions)
-- ---------------------------------------------------------------------------

create table workflows (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  -- false = any status can move to any status (no transition rows needed)
  restrict_transitions boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on workflows (workspace_id);

create table workflow_statuses (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  name_ar     text not null,
  name_fr     text not null,
  color       text not null default 'gray',
  category    text not null check (category in ('todo','in_progress','done')),
  rank        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workflow_id, id)          -- target for composite fks
);
create index on workflow_statuses (workflow_id, rank);

create table workflow_transitions (
  id             uuid primary key default gen_random_uuid(),
  workflow_id    uuid not null references workflows(id) on delete cascade,
  from_status_id uuid,               -- null = from any status ("global transition")
  to_status_id   uuid not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (workflow_id, from_status_id) references workflow_statuses(workflow_id, id) on delete cascade,
  foreign key (workflow_id, to_status_id)   references workflow_statuses(workflow_id, id) on delete cascade,
  check (from_status_id is distinct from to_status_id)
);
create unique index workflow_transitions_unique
  on workflow_transitions (workflow_id, coalesce(from_status_id, '00000000-0000-0000-0000-000000000000'::uuid), to_status_id);
create index on workflow_transitions (to_status_id);

-- ---------------------------------------------------------------------------
-- 3. Projects
-- ---------------------------------------------------------------------------

create table projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  workflow_id   uuid not null references workflows(id) on delete restrict,
  donor_id      uuid references donors(id) on delete set null,
  owner_id      uuid references profiles(id) on delete set null,
  name          text not null,
  description   text not null default '',
  privacy       text not null default 'workspace' check (privacy in ('private','workspace')),
  color         text not null default 'green',
  start_date    date,
  due_date      date,
  budget_cents  bigint check (budget_cents >= 0),
  currency      char(3) not null default 'MAD',
  is_template   boolean not null default false,
  archived_at   timestamptz,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index on projects (workspace_id, archived_at);
create index on projects (workflow_id);
create index on projects (donor_id);
create index on projects (owner_id);

alter table invitations
  add foreign key (project_id) references projects(id) on delete cascade;
create index on invitations (project_id);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null default 'editor' check (role in ('admin','editor','commenter','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on project_members (user_id);

create table sections (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  rank       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id)
);
create index on sections (project_id, rank);

-- ---------------------------------------------------------------------------
-- 4. Tasks
-- ---------------------------------------------------------------------------

create table tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  section_id     uuid,
  parent_task_id uuid references tasks(id) on delete cascade,
  status_id      uuid not null references workflow_statuses(id) on delete restrict,
  assignee_id    uuid references profiles(id) on delete set null,
  title          text not null check (length(title) between 1 and 500),
  description    jsonb not null default '{}',     -- rich text document (Tiptap JSON)
  priority       text check (priority in ('low','medium','high','urgent')),
  start_date     date,
  due_date       date,
  completed_at   timestamptz,                      -- set by trigger from status category
  rank           text not null,
  board_rank     text not null,                    -- order inside a board column
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search         tsvector generated always as (to_tsvector('simple', coalesce(title,''))) stored,
  foreign key (project_id, section_id) references sections(project_id, id) on delete set null (section_id),
  check (due_date is null or start_date is null or due_date >= start_date),
  check (parent_task_id is distinct from id)
);
create index on tasks (project_id, section_id, rank);
create index on tasks (project_id, status_id, board_rank);
create index on tasks (assignee_id, due_date) where completed_at is null;
create index on tasks (parent_task_id);
create index on tasks (status_id);
create index on tasks (due_date);
create index tasks_search_idx on tasks using gin (search);
create index tasks_title_trgm on tasks using gin (title gin_trgm_ops);

create table task_dependencies (
  task_id            uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);
create index on task_dependencies (depends_on_task_id);

-- ---------------------------------------------------------------------------
-- 5. Custom fields
-- ---------------------------------------------------------------------------

create table custom_fields (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('text','number','single_select','multi_select','date')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on custom_fields (workspace_id);

create table custom_field_options (
  id         uuid primary key default gen_random_uuid(),
  field_id   uuid not null references custom_fields(id) on delete cascade,
  label      text not null,
  color      text not null default 'gray',
  rank       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on custom_field_options (field_id, rank);

create table project_fields (
  project_id uuid not null references projects(id) on delete cascade,
  field_id   uuid not null references custom_fields(id) on delete cascade,
  rank       text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, field_id)
);
create index on project_fields (field_id);

create table task_field_values (
  task_id    uuid not null references tasks(id) on delete cascade,
  field_id   uuid not null references custom_fields(id) on delete cascade,
  -- text: "..." · number: 12.5 · single_select: "<option uuid>" · multi_select: ["<uuid>",...] · date: "2026-11-07"
  value      jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (task_id, field_id)
);
create index on task_field_values (field_id);

-- ---------------------------------------------------------------------------
-- 6. Collaboration
-- ---------------------------------------------------------------------------

create table comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  body       jsonb not null,
  edited_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on comments (task_id, created_at);
create index on comments (author_id);

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  uploader_id  uuid references profiles(id) on delete set null,
  storage_path text not null unique,          -- Supabase Storage key: <project_id>/<task_id>/<uuid>-<name>
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 26214400),  -- 25 MB
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on attachments (task_id);
create index on attachments (uploader_id);

create table followers (
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index on followers (user_id);

-- append-only log; written by triggers in section 9
create table activities (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  task_id     uuid references tasks(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null check (action in (
                'task.created','task.updated','task.status_changed','task.assigned',
                'task.completed','task.deleted','comment.created','attachment.added',
                'status_update.posted','member.added')),
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on activities (task_id, created_at);
create index on activities (project_id, created_at);
create index on activities (actor_id);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, activity_id)
);
create index on notifications (user_id, created_at desc) where read_at is null;
create index on notifications (activity_id);

-- ---------------------------------------------------------------------------
-- 7. Reporting
-- ---------------------------------------------------------------------------

create table status_updates (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  status     text not null check (status in ('on_track','at_risk','off_track','on_hold','complete')),
  title      text not null,
  body       jsonb not null default '{}',      -- may embed chart ids
  published_at timestamptz,                    -- null = draft
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on status_updates (project_id, published_at desc);
create index on status_updates (author_id);

create table dashboards (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id   uuid references projects(id) on delete cascade,   -- null = workspace-wide
  name         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on dashboards (workspace_id);
create index on dashboards (project_id);

create table charts (
  id           uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references dashboards(id) on delete cascade,
  title        text not null,
  type         text not null check (type in ('bar','donut','line','number')),
  source       text not null check (source in ('tasks','projects','indicators','expenses')),
  group_by     text check (group_by in ('status','status_category','assignee','section','priority','project','donor','due_week','completed_week')),
  filters      jsonb not null default '{}',
  rank         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on charts (dashboard_id, rank);

create table indicators (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name_ar    text not null,
  name_fr    text not null,
  unit       text not null default '',
  baseline   numeric not null default 0,
  target     numeric not null check (target >= 0),
  current    numeric not null default 0,
  rank       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on indicators (project_id, rank);

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  currency     char(3) not null default 'MAD',
  spent_on     date not null,
  category     text not null default 'other',
  label        text not null,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on expenses (project_id, spent_on);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  donor_id     uuid references donors(id) on delete set null,
  title        text not null,
  period_start date not null,
  period_end   date not null,
  project_ids  uuid[] not null default '{}',
  locale       text not null default 'fr' check (locale in ('ar','fr')),
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (period_end >= period_start)
);
create index on reports (workspace_id, created_at desc);
create index on reports (donor_id);

create table saved_filters (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  filters      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on saved_filters (user_id);
create index on saved_filters (workspace_id);

-- ---------------------------------------------------------------------------
-- 8. Access helpers (security definer: they bypass RLS to avoid recursion)
-- ---------------------------------------------------------------------------

create function ws_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from workspace_members where workspace_id = ws and user_id = auth.uid()
$$;

-- effective project role: explicit membership wins; otherwise workspace members
-- (not guests) get 'editor' on 'workspace' projects; workspace admins get 'admin'.
create function project_role(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when wm.role = 'admin' then 'admin' end
       from projects pr join workspace_members wm
         on wm.workspace_id = pr.workspace_id and wm.user_id = auth.uid()
      where pr.id = p),
    (select pm.role from project_members pm where pm.project_id = p and pm.user_id = auth.uid()),
    (select 'editor' from projects pr join workspace_members wm
         on wm.workspace_id = pr.workspace_id and wm.user_id = auth.uid()
      where pr.id = p and pr.privacy = 'workspace' and wm.role = 'member')
  )
$$;

create function can_view_project(p uuid) returns boolean
language sql stable as $$ select project_role(p) is not null $$;

create function can_comment_project(p uuid) returns boolean
language sql stable as $$ select project_role(p) in ('admin','editor','commenter') $$;

create function can_edit_project(p uuid) returns boolean
language sql stable as $$ select project_role(p) in ('admin','editor') $$;

create function can_admin_project(p uuid) returns boolean
language sql stable as $$ select project_role(p) = 'admin' $$;

create function task_project(t uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select project_id from tasks where id = t
$$;

create function is_ws_staff(ws uuid) returns boolean
language sql stable as $$ select ws_role(ws) in ('admin','member') $$;

create function is_ws_admin(ws uuid) returns boolean
language sql stable as $$ select ws_role(ws) = 'admin' $$;

-- ---------------------------------------------------------------------------
-- 9. Integrity triggers
-- ---------------------------------------------------------------------------

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('create trigger touch before update on %I for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- status must belong to the project's workflow; the move must be an allowed
-- transition; completed_at follows the status category.
create function tasks_check_status() returns trigger
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

  if tg_op = 'UPDATE' and new.status_id is distinct from old.status_id then
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
    -- keep the first completion time when moving between two 'done' statuses
    new.completed_at := case when tg_op = 'UPDATE' then coalesce(old.completed_at, now()) else now() end;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger tasks_check_status
  before insert or update of status_id, project_id on tasks
  for each row execute function tasks_check_status();

-- subtasks live in the parent's project; one level of nesting is enough
create function tasks_check_parent() returns trigger language plpgsql as $$
declare pp uuid; pparent uuid;
begin
  if new.parent_task_id is null then return new; end if;
  select project_id, parent_task_id into pp, pparent from tasks where id = new.parent_task_id;
  if pp is distinct from new.project_id then
    raise exception 'subtask must be in the parent task project' using errcode = 'check_violation';
  end if;
  if pparent is not null then
    raise exception 'subtasks cannot have subtasks' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger tasks_check_parent
  before insert or update of parent_task_id, project_id on tasks
  for each row execute function tasks_check_parent();

-- no dependency cycles
create function deps_no_cycle() returns trigger language plpgsql as $$
begin
  if exists (
    with recursive chain(id) as (
      select new.depends_on_task_id
      union
      select d.depends_on_task_id from task_dependencies d join chain c on d.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'dependency cycle' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger deps_no_cycle
  before insert or update on task_dependencies
  for each row execute function deps_no_cycle();

-- serialize dependency inserts per workspace so two concurrent inserts
-- cannot create a cycle together
create function deps_lock() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('deps'));
  return new;
end $$;
create trigger deps_lock before insert on task_dependencies
  for each statement execute function deps_lock();

-- deleting a status that still has tasks is refused (fk on delete restrict);
-- the app first moves the tasks (flow F09).

-- activity log + notifications for followers and assignee
create function log_task_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare act uuid; a text; pl jsonb := '{}';
begin
  if tg_op = 'INSERT' then
    a := 'task.created'; pl := jsonb_build_object('title', new.title);
  elsif new.status_id is distinct from old.status_id then
    a := case when new.completed_at is not null and old.completed_at is null
              then 'task.completed' else 'task.status_changed' end;
    pl := jsonb_build_object('from', old.status_id, 'to', new.status_id);
  elsif new.assignee_id is distinct from old.assignee_id then
    a := 'task.assigned'; pl := jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id);
  else
    a := 'task.updated';
  end if;

  insert into activities (project_id, task_id, actor_id, action, payload)
  values (new.project_id, new.id, auth.uid(), a, pl) returning id into act;

  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid() then
    insert into followers (task_id, user_id) values (new.id, new.assignee_id) on conflict do nothing;
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    insert into followers (task_id, user_id) values (new.id, auth.uid()) on conflict do nothing;
  end if;

  if a <> 'task.updated' then
    insert into notifications (user_id, activity_id)
    select f.user_id, act from followers f
     where f.task_id = new.id and f.user_id is distinct from auth.uid()
    on conflict do nothing;
  end if;
  return null;
end $$;

create trigger log_task_activity
  after insert or update of title, status_id, assignee_id, due_date, section_id on tasks
  for each row execute function log_task_activity();

create function log_comment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare act uuid; p uuid;
begin
  select project_id into p from tasks where id = new.task_id;
  insert into activities (project_id, task_id, actor_id, action, payload)
  values (p, new.task_id, new.author_id, 'comment.created', jsonb_build_object('comment_id', new.id))
  returning id into act;
  insert into followers (task_id, user_id) values (new.task_id, new.author_id) on conflict do nothing;
  insert into notifications (user_id, activity_id)
  select f.user_id, act from followers f
   where f.task_id = new.task_id and f.user_id is distinct from new.author_id
  on conflict do nothing;
  return null;
end $$;

create trigger log_comment_activity after insert on comments
  for each row execute function log_comment_activity();

-- ---------------------------------------------------------------------------
-- 10. Row level security
-- ---------------------------------------------------------------------------

alter table workspaces            enable row level security;
alter table profiles              enable row level security;
alter table workspace_members     enable row level security;
alter table invitations           enable row level security;
alter table donors                enable row level security;
alter table workflows             enable row level security;
alter table workflow_statuses     enable row level security;
alter table workflow_transitions  enable row level security;
alter table projects              enable row level security;
alter table project_members       enable row level security;
alter table sections              enable row level security;
alter table tasks                 enable row level security;
alter table task_dependencies     enable row level security;
alter table custom_fields         enable row level security;
alter table custom_field_options  enable row level security;
alter table project_fields        enable row level security;
alter table task_field_values     enable row level security;
alter table comments              enable row level security;
alter table attachments           enable row level security;
alter table followers             enable row level security;
alter table activities            enable row level security;
alter table notifications         enable row level security;
alter table status_updates        enable row level security;
alter table dashboards            enable row level security;
alter table charts                enable row level security;
alter table indicators            enable row level security;
alter table expenses              enable row level security;
alter table reports               enable row level security;
alter table saved_filters         enable row level security;

-- workspace
create policy ws_read  on workspaces for select using (ws_role(id) is not null);
create policy ws_admin on workspaces for update using (is_ws_admin(id));

-- profiles: you see people you share a workspace with; you edit yourself
create policy prof_read on profiles for select using (
  id = auth.uid() or exists (
    select 1 from workspace_members a join workspace_members b using (workspace_id)
     where a.user_id = auth.uid() and b.user_id = profiles.id and a.role <> 'guest'
  ) or exists (
    select 1 from project_members a join project_members b using (project_id)
     where a.user_id = auth.uid() and b.user_id = profiles.id
  ));
create policy prof_self on profiles for update using (id = auth.uid());
create policy prof_insert on profiles for insert with check (id = auth.uid());

-- membership
create policy wm_read  on workspace_members for select using (user_id = auth.uid() or is_ws_staff(workspace_id));
create policy wm_admin on workspace_members for all using (is_ws_admin(workspace_id)) with check (is_ws_admin(workspace_id));

-- invitations: admins invite anyone; project admins invite to their project
-- (acceptance runs server side with the service key after token check)
create policy inv_read  on invitations for select using (is_ws_admin(workspace_id) or (project_id is not null and can_admin_project(project_id)));
create policy inv_write on invitations for all
  using (is_ws_admin(workspace_id) or (project_id is not null and can_admin_project(project_id)))
  with check (is_ws_admin(workspace_id)
              or (project_id is not null and can_admin_project(project_id) and workspace_role = 'guest'));

-- donors, workflows, custom fields: staff read, admin write
create policy donors_read  on donors for select using (is_ws_staff(workspace_id));
create policy donors_write on donors for all using (is_ws_admin(workspace_id)) with check (is_ws_admin(workspace_id));

create policy wf_read  on workflows for select using (ws_role(workspace_id) is not null);
create policy wf_write on workflows for all using (is_ws_admin(workspace_id)) with check (is_ws_admin(workspace_id));
create policy wfs_read  on workflow_statuses for select using (exists (select 1 from workflows w where w.id = workflow_id and ws_role(w.workspace_id) is not null));
create policy wfs_write on workflow_statuses for all
  using (exists (select 1 from workflows w where w.id = workflow_id and is_ws_admin(w.workspace_id)))
  with check (exists (select 1 from workflows w where w.id = workflow_id and is_ws_admin(w.workspace_id)));
create policy wft_read  on workflow_transitions for select using (exists (select 1 from workflows w where w.id = workflow_id and ws_role(w.workspace_id) is not null));
create policy wft_write on workflow_transitions for all
  using (exists (select 1 from workflows w where w.id = workflow_id and is_ws_admin(w.workspace_id)))
  with check (exists (select 1 from workflows w where w.id = workflow_id and is_ws_admin(w.workspace_id)));

create policy cf_read  on custom_fields for select using (ws_role(workspace_id) is not null);
create policy cf_write on custom_fields for all using (is_ws_admin(workspace_id)) with check (is_ws_admin(workspace_id));
create policy cfo_read  on custom_field_options for select using (exists (select 1 from custom_fields f where f.id = field_id and ws_role(f.workspace_id) is not null));
create policy cfo_write on custom_field_options for all
  using (exists (select 1 from custom_fields f where f.id = field_id and is_ws_admin(f.workspace_id)))
  with check (exists (select 1 from custom_fields f where f.id = field_id and is_ws_admin(f.workspace_id)));

-- projects
create policy proj_read   on projects for select using (can_view_project(id));
create policy proj_insert on projects for insert with check (is_ws_staff(workspace_id));
create policy proj_update on projects for update using (can_admin_project(id) or (owner_id = auth.uid()));
create policy proj_delete on projects for delete using (can_admin_project(id));

create policy pm_read  on project_members for select using (can_view_project(project_id));
create policy pm_write on project_members for all using (can_admin_project(project_id)) with check (can_admin_project(project_id));

-- project children: view / edit by project role
create policy sec_read  on sections for select using (can_view_project(project_id));
create policy sec_write on sections for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

create policy task_read  on tasks for select using (can_view_project(project_id));
create policy task_write on tasks for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

create policy dep_read  on task_dependencies for select using (can_view_project(task_project(task_id)));
create policy dep_write on task_dependencies for all
  using (can_edit_project(task_project(task_id)))
  with check (can_edit_project(task_project(task_id)) and can_edit_project(task_project(depends_on_task_id)));

create policy pf_read  on project_fields for select using (can_view_project(project_id));
create policy pf_write on project_fields for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));
create policy tfv_read  on task_field_values for select using (can_view_project(task_project(task_id)));
create policy tfv_write on task_field_values for all using (can_edit_project(task_project(task_id))) with check (can_edit_project(task_project(task_id)));

create policy com_read   on comments for select using (can_view_project(task_project(task_id)));
create policy com_insert on comments for insert with check (author_id = auth.uid() and can_comment_project(task_project(task_id)));
create policy com_update on comments for update using (author_id = auth.uid());
create policy com_delete on comments for delete using (author_id = auth.uid() or can_admin_project(task_project(task_id)));

create policy att_read   on attachments for select using (can_view_project(task_project(task_id)));
create policy att_insert on attachments for insert with check (uploader_id = auth.uid() and can_comment_project(task_project(task_id)));
create policy att_delete on attachments for delete using (uploader_id = auth.uid() or can_admin_project(task_project(task_id)));

create policy fol_read  on followers for select using (can_view_project(task_project(task_id)));
create policy fol_self  on followers for insert with check (user_id = auth.uid() and can_view_project(task_project(task_id)));
create policy fol_del   on followers for delete using (user_id = auth.uid());

create policy act_read on activities for select using (can_view_project(project_id));
-- no insert/update/delete policies: written only by triggers

create policy notif_read   on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy su_read  on status_updates for select using (can_view_project(project_id) and (published_at is not null or author_id = auth.uid()));
create policy su_write on status_updates for all using (can_edit_project(project_id)) with check (can_edit_project(project_id) and author_id = auth.uid());

create policy dash_read  on dashboards for select using (case when project_id is null then is_ws_staff(workspace_id) else can_view_project(project_id) end);
create policy dash_write on dashboards for all
  using (case when project_id is null then is_ws_staff(workspace_id) else can_edit_project(project_id) end)
  with check (case when project_id is null then is_ws_staff(workspace_id) else can_edit_project(project_id) end);
create policy chart_read  on charts for select using (exists (select 1 from dashboards d where d.id = dashboard_id));
create policy chart_write on charts for all
  using (exists (select 1 from dashboards d where d.id = dashboard_id and case when d.project_id is null then is_ws_staff(d.workspace_id) else can_edit_project(d.project_id) end))
  with check (exists (select 1 from dashboards d where d.id = dashboard_id and case when d.project_id is null then is_ws_staff(d.workspace_id) else can_edit_project(d.project_id) end));

-- money and indicators: staff only (guests/donors see them in exported reports)
create policy ind_read  on indicators for select using (can_view_project(project_id));
create policy ind_write on indicators for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));
create policy exp_read  on expenses for select using (can_view_project(project_id) and is_ws_staff((select workspace_id from projects where id = project_id)));
create policy exp_write on expenses for all
  using (can_edit_project(project_id) and is_ws_staff((select workspace_id from projects where id = project_id)))
  with check (can_edit_project(project_id) and is_ws_staff((select workspace_id from projects where id = project_id)));

create policy rep_read  on reports for select using (is_ws_staff(workspace_id));
create policy rep_write on reports for all using (is_ws_staff(workspace_id)) with check (is_ws_staff(workspace_id));

create policy sf_own on saved_filters for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. Reporting views (security_invoker: RLS of the caller applies)
-- ---------------------------------------------------------------------------

create view project_progress with (security_invoker = true) as
select p.id as project_id,
       count(t.*) filter (where t.parent_task_id is null)                                   as tasks_total,
       count(t.*) filter (where t.parent_task_id is null and t.completed_at is not null)    as tasks_done,
       count(t.*) filter (where t.parent_task_id is null and t.completed_at is null
                            and t.due_date < (now() at time zone 'Africa/Casablanca')::date) as tasks_overdue,
       (select su.status from status_updates su
         where su.project_id = p.id and su.published_at is not null
         order by su.published_at desc limit 1)                                             as last_status,
       (select coalesce(sum(e.amount_cents),0) from expenses e where e.project_id = p.id)   as spent_cents
  from projects p
  left join tasks t on t.project_id = p.id
 group by p.id;
