# EMT Tracker

GMS Executive Management Team workspace for fortnightly agendas, decisions and follow-up reminders.

- Published path: `https://spark.kmt.global/emt-tracker/`
- Microsoft sign-in: tenant-scoped Entra SPA using delegated `User.Read`, restricted to the four approved EMT accounts
- Shared data: persisted through the KMT Spark Supabase project and protected by the EMT workspace function
- Outlook email delivery: branded templates, delivery planning and audit records are deployed; Exchange sender authorisation, production secrets and the scheduled job remain disabled until separately approved
- Calendar delivery: not enabled

The compiled static site is committed in this directory so it can be served by the existing Spark GitHub Pages deployment.
