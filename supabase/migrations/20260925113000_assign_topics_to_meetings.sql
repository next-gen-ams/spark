alter table public.emt_topics
  add column if not exists meeting_date date;

with schedule as (
  select
    settings.meeting_anchor_date,
    (timezone('Australia/Melbourne', now()))::date as today
  from public.emt_settings as settings
  where settings.workspace_id = 'gms-emt'
), next_meeting as (
  select
    meeting_anchor_date +
      (ceil(greatest(0, today - meeting_anchor_date)::numeric / 14)::integer * 14)
      as meeting_date
  from schedule
)
update public.emt_topics
set meeting_date = next_meeting.meeting_date
from next_meeting
where emt_topics.bucket = 'agenda'
  and emt_topics.meeting_date is null;

update public.emt_topics
set meeting_date = null
where bucket = 'backlog';

alter table public.emt_topics
  drop constraint if exists emt_topics_agenda_meeting_date_check;

alter table public.emt_topics
  add constraint emt_topics_agenda_meeting_date_check
  check (bucket <> 'agenda' or meeting_date is not null);

create index if not exists emt_topics_meeting_date_idx
  on public.emt_topics (meeting_date, id)
  where bucket = 'agenda';

create or replace function public.emt_recycle_expired_agenda(reference_date date)
returns table(backlog_count integer, history_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  moved_to_backlog integer := 0;
  moved_to_history integer := 0;
begin
  if reference_date is null then
    raise exception 'Reference date is required.';
  end if;

  update public.emt_topics
  set
    bucket = 'backlog',
    meeting_date = null,
    updated_by = 'automatic meeting rollover',
    updated_at = now()
  where bucket = 'agenda'
    and meeting_date < reference_date
    and btrim(decision) = '';
  get diagnostics moved_to_backlog = row_count;

  update public.emt_topics
  set
    bucket = 'history',
    updated_by = 'automatic meeting rollover',
    updated_at = now()
  where bucket = 'agenda'
    and meeting_date < reference_date
    and btrim(decision) <> '';
  get diagnostics moved_to_history = row_count;

  return query select moved_to_backlog, moved_to_history;
end;
$$;

revoke all on function public.emt_recycle_expired_agenda(date) from public;
revoke all on function public.emt_recycle_expired_agenda(date) from anon;
revoke all on function public.emt_recycle_expired_agenda(date) from authenticated;
grant execute on function public.emt_recycle_expired_agenda(date) to service_role;

comment on column public.emt_topics.meeting_date is
  'Assigned fortnightly EMT meeting date. Required for agenda topics and cleared for backlog topics.';

comment on function public.emt_recycle_expired_agenda(date) is
  'Moves expired undecided agenda topics to backlog and decided topics to history.';
