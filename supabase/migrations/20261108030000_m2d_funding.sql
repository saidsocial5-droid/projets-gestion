-- M2d: funding defaults and report data.

alter table expenses alter column created_by set default auth.uid();
alter table reports  alter column created_by set default auth.uid();

-- Everything a donor report needs for one project and period, computed as the
-- caller (RLS applies: guests never reach expenses).
create function report_project(p uuid, period_start date, period_end date) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'id', pr.id,
    'name', pr.name,
    'start_date', pr.start_date,
    'due_date', pr.due_date,
    'budget_cents', pr.budget_cents,
    'currency', pr.currency,
    'tasks_total', (select count(*) from tasks where project_id = p and parent_task_id is null),
    'tasks_done', (select count(*) from tasks where project_id = p and parent_task_id is null and completed_at is not null),
    'tasks_done_in_period', (select count(*) from tasks where project_id = p and parent_task_id is null
                               and (completed_at at time zone 'Africa/Casablanca')::date between period_start and period_end),
    'spent_cents', (select coalesce(sum(amount_cents), 0) from expenses where project_id = p),
    'spent_in_period_cents', (select coalesce(sum(amount_cents), 0) from expenses where project_id = p and spent_on between period_start and period_end),
    'expenses_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'amount_cents', s) order by s desc)
        from (select category, sum(amount_cents) s from expenses
               where project_id = p and spent_on between period_start and period_end group by category) c), '[]'::jsonb),
    'indicators', coalesce((
      select jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_fr', name_fr, 'unit', unit,
                                          'baseline', baseline, 'target', target, 'current', current) order by rank)
        from indicators where project_id = p), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'title', title, 'text', body->>'text', 'published_at', published_at) order by published_at)
        from status_updates where project_id = p and published_at is not null
         and (published_at at time zone 'Africa/Casablanca')::date between period_start and period_end), '[]'::jsonb)
  )
  from projects pr where pr.id = p
$$;
grant execute on function report_project(uuid, date, date) to authenticated;
