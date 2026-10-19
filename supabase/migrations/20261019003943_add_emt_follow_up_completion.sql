alter table public.emt_topics
  add column completed_at timestamptz,
  add column completed_by text,
  add constraint emt_topics_completion_check check (
    (completed_at is null and completed_by is null) or
    (completed_at is not null and nullif(btrim(completed_by), '') is not null
      and btrim(decision) <> '' and btrim(follow_up_owner) <> '')
  );

-- A materially changed task needs a new completion, while title/context edits
-- must preserve the already completed follow-up.
create function public.emt_reset_changed_completion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.decision, new.follow_up_owner, new.follow_up_action, new.due_date)
     is distinct from
     row(old.decision, old.follow_up_owner, old.follow_up_action, old.due_date)
  then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;

revoke all on function public.emt_reset_changed_completion() from public, anon, authenticated;
create trigger emt_reset_changed_completion before update on public.emt_topics
  for each row execute function public.emt_reset_changed_completion();

-- The Edge Function verifies the Microsoft identity and active membership.
-- This atomic update is callable only by its server-side service role.
create function public.emt_set_follow_up_completion(
  topic_id bigint, is_complete boolean, actor_email text
)
returns setof public.emt_topics
language plpgsql security invoker set search_path = '' as $$
begin
  if topic_id is null or topic_id <= 0 or is_complete is null then
    raise exception 'Invalid completion request.';
  end if;
  if not exists (
    select 1 from public.emt_members
    where lower(email) = lower(actor_email) and active
  ) then
    raise exception 'An active EMT member is required.';
  end if;
  return query
    update public.emt_topics as topic
    set completed_at = case when is_complete then coalesce(topic.completed_at, now()) else null end,
        completed_by = case when is_complete then coalesce(topic.completed_by, lower(actor_email)) else null end,
        updated_by = lower(actor_email), updated_at = now()
    where topic.id = topic_id
      and btrim(topic.decision) <> '' and btrim(topic.follow_up_owner) <> ''
    returning topic.*;
end;
$$;

revoke all on function public.emt_set_follow_up_completion(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.emt_set_follow_up_completion(bigint, boolean, text) to service_role;

comment on column public.emt_topics.completed_at is 'Server-recorded follow-up completion time. Null means open.';
comment on column public.emt_topics.completed_by is 'Verified EMT member who marked the follow-up complete.';
