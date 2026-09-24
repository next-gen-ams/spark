create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
    from cron.job
   where jobname = 'emt-reminders-melbourne-9am';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'emt-reminders-melbourne-9am',
    '0 * * * *',
    $job$
      select net.http_post(
        url := 'https://agpggomwormexgjzbjtv.supabase.co/functions/v1/emt-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-emt-reminder-key', (
            select decrypted_secret
              from vault.decrypted_secrets
             where name = 'emt_reminder_job_secret'
          )
        ),
        body := '{"mode":"send","scheduled":true}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$
  );
end;
$$;

comment on extension pg_cron is
  'Runs the EMT reminder evaluator hourly; the function sends only at 09:00 Australia/Melbourne.';
