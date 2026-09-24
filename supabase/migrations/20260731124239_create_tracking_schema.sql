-- ============================================================================
-- GMS Digital — Tracking Dashboard
-- Lives in its own schema inside the uq-spark project. Isolation from the UQ
-- dashboard (public schema) is enforced in Postgres, not by password hygiene:
--
--   * separate schema           — no name collisions, clean to lift out later
--   * separate auth account     — on a domain public.is_team() does NOT match,
--                                 so the tracking user cannot read UQ data
--   * RLS on an exact email     — so a UQ/GRG account cannot read tracking data
--
-- Both directions matter. public.is_team() allows any @gms.global address, so
-- a tracking account on that domain would inherit access to every UQ table.
-- ============================================================================

create schema if not exists tracking;

-- The one identity allowed to touch this schema. Exact match, never a domain.
create or replace function tracking.is_tracking_user()
returns boolean
language sql stable security definer
set search_path to 'tracking'
as $$
  select coalesce((auth.jwt() ->> 'email') = 'tracking@gms-digital.internal', false);
$$;

-- ---------------------------------------------------------------- reference

create table if not exists tracking.client (
  id text primary key, name text not null, active boolean default true,
  note text, updated_at timestamptz default now());

-- Convention: 1 AUD = per_aud <ccy>. Converting to AUD is always a division.
create table if not exists tracking.fx (
  ccy text primary key, per_aud numeric not null, updated_at timestamptz default now());

create table if not exists tracking.vocab (
  id text primary key, kind text not null, value text not null,
  sort numeric default 0, active boolean default true);

-- ------------------------------------------------------------------ campaign

create table if not exists tracking.campaign (
  id text primary key,
  client_id text references tracking.client(id) on delete cascade,
  name text, io_number text, advertiser text,
  start_date text, end_date text,
  fx_ccy text, fx_rate numeric,
  am text, am_email text, version text, source_file text, imported_at text,
  note text, updated_at timestamptz default now());

-- MARGIN lives here — per line, never per client.
create table if not exists tracking.line (
  id text primary key,
  campaign_id text references tracking.campaign(id) on delete cascade,
  seq numeric default 0,
  objective text, platform text, supplier text, market text, placement text,
  buy_method text,
  currency text default 'AUD',      -- currency the INTERNAL spend is booked in
  rate_media numeric, rate_gms numeric, booked_units numeric,
  cost_media numeric, cost_gms numeric, margin_pct numeric,
  billable boolean default true,
  status text default 'Not started',
  landing_page text, kpi text, note text,
  updated_at timestamptz default now());

create table if not exists tracking.line_month (
  id text primary key,
  line_id text references tracking.line(id) on delete cascade,
  ym text, units numeric, budget_media numeric, budget_gms numeric,
  updated_at timestamptz default now());

create table if not exists tracking.creative (
  id text primary key,
  line_id text references tracking.line(id) on delete cascade,
  name text, live_from text, live_to text, preview_url text,
  status text default 'Live', note text, updated_at timestamptz default now());

-- Daily actuals. Every client-facing number is DERIVED from this, never typed.
create table if not exists tracking.spend (
  id text primary key,
  line_id text references tracking.line(id) on delete cascade,
  creative_id text references tracking.creative(id) on delete set null,
  date text, spend_internal numeric default 0, imp numeric, clicks numeric,
  note text, updated_at timestamptz default now());

create table if not exists tracking.settings (
  k text primary key, v text, updated_at timestamptz default now());

create index if not exists spend_line_date on tracking.spend (line_id, date);
create index if not exists line_campaign    on tracking.line (campaign_id);
create index if not exists line_month_line  on tracking.line_month (line_id);

-- ---------------------------------------------------------------- seed

insert into tracking.fx (ccy, per_aud) values
  ('AUD',1),('CNY',4.3),('USD',0.6433),('HKD',5.02),
  ('SGD',0.858),('JPY',87),('LKR',210.198),('KM',3.08)
on conflict (ccy) do nothing;

-- ---------------------------------------------------------------- grants

grant usage on schema tracking to anon, authenticated;
grant all on all tables in schema tracking to anon, authenticated;
grant all on all routines in schema tracking to anon, authenticated;
alter default privileges in schema tracking grant all on tables to anon, authenticated;

-- ---------------------------------------------------------------- RLS

do $$
declare t text;
begin
  foreach t in array array['client','fx','vocab','campaign','line','line_month',
                           'creative','spend','settings']
  loop
    execute format('alter table tracking.%I enable row level security', t);
    execute format('drop policy if exists trk_all on tracking.%I', t);
    execute format(
      'create policy trk_all on tracking.%I for all to authenticated '
      'using (tracking.is_tracking_user()) with check (tracking.is_tracking_user())', t);
  end loop;
end $$;
;
