revoke all on function public.emt_recycle_expired_agenda(date) from public;
revoke all on function public.emt_recycle_expired_agenda(date) from anon;
revoke all on function public.emt_recycle_expired_agenda(date) from authenticated;
grant execute on function public.emt_recycle_expired_agenda(date) to service_role;
