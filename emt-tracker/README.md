# EMT Tracker

GMS Executive Management Team workspace for fortnightly agendas, decisions and follow-up reminders.

- Published path: `https://spark.kmt.global/emt-tracker/`
- Microsoft sign-in: tenant-scoped Entra SPA using delegated `User.Read`, restricted to the four approved EMT accounts
- Shared data: persisted through the KMT Spark Supabase project and protected by the EMT workspace function
- Reminder preferences: managed once per signed-in Microsoft account and applied automatically to that member's assigned agenda topics and follow-up actions; topic-level reminder switches have been removed
- Outlook email delivery: Microsoft Graph sender authorisation for `insights@gms.global`, production secrets, branded templates and delivery audit records are deployed; live test delivery to Lisa, George and Brenda, with Coco copied on each message, was accepted by Microsoft Graph on 24 September 2026
- Reminder automation: authenticated manual/test delivery is enabled; the recurring scheduled job is not enabled yet
- Calendar delivery: not enabled

The compiled static site is committed in this directory so it can be served by the existing Spark GitHub Pages deployment.
