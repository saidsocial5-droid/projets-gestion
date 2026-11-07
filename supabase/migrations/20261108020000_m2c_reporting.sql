-- M2c: status updates (publish + notify), project statistics for dashboards.

alter table status_updates alter column author_id set default auth.uid();

-- Publishing an update stores a progress snapshot, logs it and notifies the
-- project's explicit members and the project owner.
create function status_update_publish() returns trigger
language plpgsql security definer set search_path = public as $$
declare act uuid;
begin
  if new.published_at is null or (tg_op = 'UPDATE' and old.published_at is not null) then
    return new;
  end if;

  new.body := coalesce(new.body, '{}'::jsonb) || jsonb_build_object('snapshot', (
    select jsonb_build_object(
      'total',   count(*) filter (where parent_task_id is null),
      'done',    count(*) filter (where parent_task_id is null and completed_at is not null),
      'overdue', count(*) filter (where parent_task_id is null and completed_at is null
                                    and due_date < (now() at time zone 'Africa/Casablanca')::date))
    from tasks where project_id = new.project_id));

  insert into activities (project_id, actor_id, action, payload)
  values (new.project_id, new.author_id, 'status_update.posted',
          jsonb_build_object('status', new.status, 'title', new.title))
  returning id into act;

  insert into notifications (user_id, activity_id)
  select distinct u, act from (
    select user_id as u from project_members where project_id = new.project_id
    union select owner_id from projects where id = new.project_id
  ) x
  where u is not null and u is distinct from new.author_id
  on conflict do nothing;
  return new;
end $$;

create trigger status_update_publish before insert or update of published_at on status_updates
  for each row execute function status_update_publish();

-- Dashboard numbers for one project, computed as the caller (RLS applies).
create function project_stats(p uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  with t as (
    select * from tasks where project_id = p and parent_task_id is null
  ), today as (
    select (now() at time zone 'Africa/Casablanca')::date as d
  )
  select jsonb_build_object(
    'total',   (select count(*) from t),
    'done',    (select count(*) from t where completed_at is not null),
    'overdue', (select count(*) from t, today where completed_at is null and due_date < today.d),
    'due_week',(select count(*) from t, today where completed_at is null and due_date between today.d and today.d + 7),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status_id', s.id, 'count', coalesce(c.n, 0)) order by s.rank)
        from workflow_statuses s
        join projects pr on pr.workflow_id = s.workflow_id and pr.id = p
        left join (select status_id, count(*) n from t group by status_id) c on c.status_id = s.id
    ), '[]'::jsonb),
    'by_assignee', coalesce((
      select jsonb_agg(jsonb_build_object('assignee_id', assignee_id, 'open', n) order by n desc)
        from (select assignee_id, count(*) n from t where completed_at is null group by assignee_id) a
    ), '[]'::jsonb),
    'completed_weekly', (
      select jsonb_agg(jsonb_build_object('week', w::date, 'count', (
               select count(*) from t
                where (completed_at at time zone 'Africa/Casablanca')::date >= w::date
                  and (completed_at at time zone 'Africa/Casablanca')::date <  w::date + 7)) order by w)
        from today, generate_series(date_trunc('week', today.d) - interval '7 weeks', date_trunc('week', today.d), interval '1 week') w
    )
  )
$$;
grant execute on function project_stats(uuid) to authenticated;
