# EMT Tracker

GMS Executive Management Team workspace for fortnightly agendas, decisions and follow-up reminders.

- Published path: `https://spark.kmt.global/emt-tracker/`
- Microsoft sign-in: tenant-scoped Entra SPA using delegated `User.Read`; access is granted only to active members in the EMT membership table
- Shared data: persisted through the KMT Spark Supabase project and protected by backend Microsoft profile and membership verification
- Deletion controls: decisions can be removed without deleting their discussion; the related action, owner and due date are cleared together, while historical-only discussions return to the backlog. Entire discussions and editable topic categories retain separate confirmation-based deletion.
- Reminder preferences: managed once per signed-in Microsoft account and applied automatically to that member's assigned agenda topics and follow-up actions; topic-level reminder switches have been removed
- Outlook email delivery: automatic reminders use the admin-managed `insights@gms.global` sender; signed-in members are never asked for `Mail.Send` and cannot send from personal accounts through the tracker
- Mail safeguards: recipients must be active EMT members, the sender is fixed server-side, deliveries are idempotent, and Graph credentials never reach the browser
- Reminder automation: the scheduler evaluates reminders hourly and sends only in the 09:00 Australia/Melbourne window when a member's global settings produce a due reminder
- Calendar delivery: not enabled

The compiled static site is committed in this directory so it can be served by the existing Spark GitHub Pages deployment.
