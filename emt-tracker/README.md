# EMT Tracker

GMS Executive Management Team workspace for weekly Monday agendas, decisions and follow-up reminders.

- Published path: `https://spark.kmt.global/emt-tracker/`
- Microsoft sign-in: tenant-scoped Entra SPA using delegated `User.Read`; access is granted only to active members in the EMT membership table
- Shared data: persisted through the KMT Spark Supabase project and protected by backend Microsoft profile and membership verification
- Completion: assigned decisions can be marked complete from the bottom action bar next to Save decision, or reopened. Completion date/actor and the Completed badge persist; completed items stop generating reminder emails. Changing the decision, owner, next action or due date reopens the task.
- List status: agenda, discussion backlog, decision log and detail drawer consistently show Pending (amber/clock) or Completed (green/check), based on the saved completion state. No detail opening is needed to check status.
- Deletion controls: decisions can be removed without deleting their discussion; the related action, owner and due date are cleared together, while historical-only discussions return to the backlog. Entire discussions and editable topic categories retain separate confirmation-based deletion.
- Reminder preferences: managed once per signed-in Microsoft account and applied automatically to that member's assigned agenda topics and follow-up actions; topic-level reminder switches have been removed
- Outlook email delivery: automatic reminders use the admin-managed `insights@gms.global` sender; signed-in members are never asked for `Mail.Send` and cannot send from personal accounts through the tracker
- Mail safeguards: recipients must be active EMT members, the sender is fixed server-side, deliveries are idempotent, and Graph credentials never reach the browser
- Reminder automation: the scheduler evaluates reminders hourly and sends only in the 09:00 Australia/Melbourne window when a member's global settings produce a due reminder
- Calendar delivery: not enabled

The compiled static site is committed in this directory so it can be served by the existing Spark GitHub Pages deployment.

## Source and verification

- Canonical editable source: [Spark `emt-tracker-source` branch](https://github.com/next-gen-ams/spark/tree/emt-tracker-source).
- Release record: [19 October 2026 completion and dependency remediation](https://github.com/next-gen-ams/spark/blob/emt-tracker-source/docs/releases/2026-10-19-follow-up-completion.md).
- Build: React/Vite static application. Supabase owns authenticated data and automatic Insights mail; no server-rendering or image-processing runtime is deployed with the frontend.
- Dependency audit on 19 October 2026: zero known vulnerabilities across all severities, down from 3 critical / 19 high / 16 moderate / 6 low. All dependency versions and security overrides are committed with the source lockfile.
- Verification: 12 regression tests, isolated PostgreSQL integration tests, rolled-back production-schema completion checks, TypeScript, targeted lint, Deno checks and browser checks for the local production build. Inherited full-repository generated-UI lint issues are documented separately and are not reported as a full lint pass.
- Backend release: `emt-workspace` v13 and `emt-reminders` v12. No existing user task was marked complete by the release checks.
