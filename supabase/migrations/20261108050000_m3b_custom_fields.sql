-- M3b: custom field values are validated against the field type and must
-- belong to a field attached to the task's project.

create function task_field_values_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare ftype text; v jsonb := new.value; opt text;
begin
  select f.type into ftype
    from custom_fields f
    join project_fields pf on pf.field_id = f.id
    join tasks t on t.project_id = pf.project_id
   where f.id = new.field_id and t.id = new.task_id;
  if ftype is null then
    raise exception 'field is not attached to this project' using errcode = 'check_violation';
  end if;

  if ftype = 'text' and not (jsonb_typeof(v) = 'string' and length(v #>> '{}') <= 2000) then
    raise exception 'text expected' using errcode = 'check_violation';
  elsif ftype = 'number' and jsonb_typeof(v) <> 'number' then
    raise exception 'number expected' using errcode = 'check_violation';
  elsif ftype = 'date' and not (jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'date expected' using errcode = 'check_violation';
  elsif ftype = 'single_select' then
    if jsonb_typeof(v) <> 'string' or not exists (
      select 1 from custom_field_options where field_id = new.field_id and id::text = (v #>> '{}')) then
      raise exception 'unknown option' using errcode = 'check_violation';
    end if;
  elsif ftype = 'multi_select' then
    if jsonb_typeof(v) <> 'array' then
      raise exception 'array expected' using errcode = 'check_violation';
    end if;
    for opt in select jsonb_array_elements_text(v) loop
      if not exists (select 1 from custom_field_options where field_id = new.field_id and id::text = opt) then
        raise exception 'unknown option' using errcode = 'check_violation';
      end if;
    end loop;
  end if;
  return new;
end $$;

create trigger task_field_values_check before insert or update on task_field_values
  for each row execute function task_field_values_check();

-- deleting an option removes it from task values
create function custom_field_option_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from task_field_values where field_id = old.field_id and value = to_jsonb(old.id::text);
  update task_field_values set value = value - old.id::text
   where field_id = old.field_id and jsonb_typeof(value) = 'array' and value ? old.id::text;
  return old;
end $$;
create trigger custom_field_option_cleanup after delete on custom_field_options
  for each row execute function custom_field_option_cleanup();

-- detaching a field from a project removes that project's values for it
create function project_field_detach_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from task_field_values v using tasks t
   where v.task_id = t.id and t.project_id = old.project_id and v.field_id = old.field_id;
  return old;
end $$;
create trigger project_field_detach_cleanup after delete on project_fields
  for each row execute function project_field_detach_cleanup();
