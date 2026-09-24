# EMT Tracker

GMS Executive Management Team workspace for fortnightly agendas, decisions and follow-up reminders.

- Published path: `https://spark.kmt.global/emt-tracker/`
- Microsoft sign-in: tenant-scoped Entra SPA using delegated `User.Read`, restricted to the four approved EMT accounts
- Shared data: persisted through the KMT Spark Supabase project and protected by the EMT workspace function
- Outlook email delivery: Microsoft Graph sender authorisation for `insights@gms.global`, production secrets, branded templates and delivery audit records are deployed; a live delivery to `coco.hu@gms.global` was verified on 24 September 2026
- Reminder automation: authenticated manual/test delivery is enabled; the recurring scheduled job is not enabled yet
- Calendar delivery: not enabled

The compiled static site is committed in this directory so it can be served by the existing Spark GitHub Pages deployment.
