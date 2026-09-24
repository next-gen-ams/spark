create table if not exists public.emt_member_settings (
  member_email text primary key references public.emt_members(email) on update cascade on delete cascade,
  reminders_on boolean not null default true,
  agenda_reminder_timing text not null default '2 business days before',
  followup_reminder_timing text not null default '1 business day before',
  overdue_reminders_on boolean not null default true,
  business_days_only boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint emt_member_settings_email_domain check (lower(member_email) like '%@gms.global')
);

alter table public.emt_member_settings enable row level security;
revoke all on table public.emt_member_settings from anon, authenticated;
grant select, insert, update, delete on table public.emt_member_settings to service_role;

insert into public.emt_member_settings (
  member_email,
  reminders_on,
  agenda_reminder_timing,
  followup_reminder_timing,
  overdue_reminders_on,
  business_days_only,
  updated_by
)
select
  lower(member.email),
  settings.reminders_on,
  settings.agenda_reminder_timing,
  settings.followup_reminder_timing,
  settings.overdue_reminders_on,
  settings.business_days_only,
  'migration'
from public.emt_members as member
cross join public.emt_settings as settings
where member.active = true
  and member.email is not null
  and settings.workspace_id = 'gms-emt'
on conflict (member_email) do nothing;

update public.emt_topics
set
  reminder = 'Managed in global reminder settings',
  remind_lead = false,
  remind_followup = false,
  updated_at = now()
where reminder <> 'Managed in global reminder settings'
   or remind_lead = true
   or remind_followup = true;

comment on table public.emt_member_settings is
  'Personal EMT reminder preferences for each approved Microsoft account.';
;
