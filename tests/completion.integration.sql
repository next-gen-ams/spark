-- Run only against an empty disposable local PostgreSQL database.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.emt_members (email text primary key, active boolean not null);
create table public.emt_topics (
  id bigint primary key, title text not null, decision text not null default '',
  follow_up_owner text not null default '', follow_up_action text not null default '',
  due_date date, updated_by text, updated_at timestamptz default now()
);
alter table public.emt_topics enable row level security;
grant select, update on public.emt_topics to service_role;
grant select on public.emt_members to service_role;
\ir ../supabase/migrations/20261019003943_add_emt_follow_up_completion.sql
insert into public.emt_members values ('member@example.test', true), ('inactive@example.test', false);
insert into public.emt_topics (id,title,decision,follow_up_owner,due_date)
values (1,'Synthetic test','Approved','Synthetic Owner','2026-10-30'), (2,'Undecided','','',null);

do $$
declare completed_time timestamptz; result_count int;
begin
  assert not has_function_privilege('anon', 'public.emt_set_follow_up_completion(bigint,boolean,text)', 'execute');
  assert not has_function_privilege('authenticated', 'public.emt_set_follow_up_completion(bigint,boolean,text)', 'execute');
  assert has_function_privilege('service_role', 'public.emt_set_follow_up_completion(bigint,boolean,text)', 'execute');
  perform public.emt_set_follow_up_completion(1,true,'member@example.test');
  select completed_at into completed_time from public.emt_topics where id=1;
  assert completed_time is not null;
  assert (select completed_by='member@example.test' from public.emt_topics where id=1);
  perform public.emt_set_follow_up_completion(1,true,'member@example.test');
  assert (select completed_at=completed_time from public.emt_topics where id=1), 'Repeat completion must be idempotent';
  update public.emt_topics set title='New title' where id=1;
  assert (select completed_at=completed_time from public.emt_topics where id=1), 'Title edit must retain completion';
  perform public.emt_set_follow_up_completion(1,false,'member@example.test');
  assert (select completed_at is null and completed_by is null from public.emt_topics where id=1);
  perform public.emt_set_follow_up_completion(1,true,'member@example.test');
  update public.emt_topics set follow_up_owner='New owner' where id=1;
  assert (select completed_at is null from public.emt_topics where id=1), 'Reassignment must reopen';
  perform public.emt_set_follow_up_completion(1,true,'member@example.test');
  update public.emt_topics set follow_up_action='New action' where id=1;
  assert (select completed_at is null from public.emt_topics where id=1), 'New action must reopen';
  perform public.emt_set_follow_up_completion(1,true,'member@example.test');
  update public.emt_topics set due_date='2026-11-01' where id=1;
  assert (select completed_at is null from public.emt_topics where id=1), 'New due date must reopen';
  perform public.emt_set_follow_up_completion(1,true,'member@example.test');
  update public.emt_topics set decision='', follow_up_owner='' where id=1;
  assert (select completed_at is null and completed_by is null from public.emt_topics where id=1), 'Deleting decision must clear completion';
  select count(*) into result_count from public.emt_set_follow_up_completion(2,true,'member@example.test');
  assert result_count=0, 'Undecided/unassigned discussion cannot complete';
  begin
    perform public.emt_set_follow_up_completion(2,true,'inactive@example.test');
    raise exception 'Inactive member was accepted';
  exception when others then
    if sqlerrm <> 'An active EMT member is required.' then raise; end if;
  end;
end;
$$;
set local role service_role;
select count(*) as undecided_completion_rows from public.emt_set_follow_up_completion(2,true,'member@example.test');
reset role;
select 'PASS: completion, idempotency, reopen, edit reset, deletion reset and permissions' as result;
rollback;
