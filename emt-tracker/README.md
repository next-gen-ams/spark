# EMT Tracker

GMS Executive Management Team workspace for fortnightly agendas, decisions and follow-up reminders.

- Published path: `https://spark.kmt.global/emt-tracker/`
- Microsoft sign-in: tenant-scoped Entra SPA using delegated `User.Read`; access is granted only to active members in the EMT membership table
- Shared data: persisted through the KMT Spark Supabase project and protected by backend Microsoft profile and membership verification
- Reminder preferences: managed once per signed-in Microsoft account and applied automatically to that member's assigned agenda topics and follow-up actions; topic-level reminder switches have been removed
- Outlook email delivery: automatic reminders use the admin-managed `insights@gms.global` sender; member-initiated topic shares request delegated `Mail.Send` only after preview and send from the signed-in member's account
- Mail safeguards: recipients must be active EMT members, previews do not send, manual sends are rate-limited and idempotent, and Graph access tokens are never stored
- Reminder automation: authenticated manual/test delivery is enabled; the recurring scheduled job is not enabled yet
- Calendar delivery: not enabled

The compiled static site is committed in this directory so it can be served by the existing Spark GitHub Pages deployment.
