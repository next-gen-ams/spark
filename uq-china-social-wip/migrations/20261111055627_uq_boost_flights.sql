-- Paid flights can reference an organic post without sharing its identity or lifecycle.
create table public.boost_flights (
  id text primary key,
  content_id text references public.content(id) on delete set null,
  spend_month text not null check (spend_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  kind text not null check (kind in ('UQ post', 'Reboost', 'Creator post')),
  channel text not null check (channel in ('RED', 'WeChat', 'Alumni WeChat', 'Weibo')),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  post_url text not null default '' check (post_url = '' or post_url ~* '^https?://'),
  publish_date date,
  win_start date,
  win_end date,
  budget numeric not null check (budget >= 0),
  spend numeric check (spend >= 0),
  ctr text not null default '',
  status text not null default 'Planned'
    check (status in ('Auto', 'Planned', 'Proposed', 'Scheduled', 'Live', 'Boosted', 'Finished', 'Paused')),
  eng numeric check (eng >= 0),
  flw numeric check (flw >= 0),
  reads numeric check (reads >= 0),
  note text not null default '',
  check (win_end >= win_start),
  check (kind <> 'Creator post' or content_id is null)
);

create index boost_flights_content_id_idx on public.boost_flights (content_id);
alter table public.boost_flights enable row level security;
revoke all on public.boost_flights from public, anon, authenticated;
grant select, insert, update on public.boost_flights to authenticated;
grant select, insert, update, delete on public.boost_flights to service_role;

create policy team_all on public.boost_flights
  for all to authenticated
  using ((select public.is_team()))
  with check ((select public.is_team()));

alter publication supabase_realtime add table public.boost_flights;
