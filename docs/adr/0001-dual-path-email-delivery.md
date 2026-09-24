# ADR 0001: Separate automatic and member-initiated email delivery

- Status: Accepted
- Date: 2026-09-25
- Owners: GMS EMT Tracker

## Context

EMT Tracker needs to send scheduled reminders when nobody is signed in and also let an authenticated EMT member deliberately share a topic from their own GMS account. These two cases have different identity, consent and audit requirements. Treating them as one mail path would either give the browser an application credential or make unattended reminders depend on a user's session.

Workspace membership must remain data-driven. Active rows in `public.emt_members` are the authority for access and recipient selection; email addresses must not be compiled into the frontend as an allowlist.

## Decision

Use two independent Microsoft Graph mail paths:

1. Automatic reminders use the existing application-only permission and fixed sender `insights@gms.global`. The `emt-reminders` Edge Function owns scheduling, server-side templates and delivery audit records. No member session is required.
2. Member-initiated topic shares use incremental delegated `Mail.Send` permission and `POST /me/sendMail`. Initial dashboard sign-in remains limited to `User.Read`; Microsoft asks for mail permission only after the member reviews a server-generated preview and chooses to enable sending.
3. The `emt-user-mail` Edge Function verifies the Graph token through `/me`, checks that the sender and all recipients are active EMT members, rebuilds the approved template on the server, enforces a small recipient limit and rate limit, and records an idempotent audit entry before calling Graph.
4. Graph access tokens are request-scoped. They are never stored in Postgres, source control, logs, 1Password notes or browser application state outside MSAL's managed cache.
5. A Graph `202 Accepted` is reported as accepted for delivery, not as confirmed inbox delivery.

## Consequences

- Ordinary dashboard use does not request mailbox permissions.
- Automatic reminders remain reliable when no member is online.
- Manual messages appear in the signed-in member's Sent Items and clearly identify that member as sender.
- Adding or removing members requires a database membership change, not a frontend release.
- Tenant consent policy may require an administrator to approve delegated `Mail.Send` once.
- Two mail paths require separate monitoring and audit queries, but they also keep privileges narrow and failure modes explicit.

## Alternatives considered

- Use `insights@gms.global` for every message: rejected because it does not satisfy member-authored sending and obscures the human sender.
- Use delegated sending for automatic reminders: rejected because scheduled jobs cannot depend on an interactive member session.
- Send directly from the browser: rejected because recipient authorization, templates, rate limits and audit integrity must be enforced server-side.
- Store a reusable delegated refresh token: rejected because it broadens credential risk and is unnecessary with MSAL plus request-scoped Graph tokens.

## Verification and rollback

Before enabling member sends:

- Verify refresh restores the dashboard shell without exposing workspace data before backend authorization.
- Confirm inactive members and non-member recipients receive `403 Forbidden`.
- Confirm preview does not request `Mail.Send` or create a delivery record.
- Confirm send requires a preview request ID, rejects replay, caps recipients at three and rate-limits repeated sends.
- Confirm audit records contain sender, recipients, topic, subject, status, Graph request ID and timestamps, but no access token.
- Confirm no email is sent during automated tests.

Rollback consists of hiding the member-send UI and undeploying `emt-user-mail`. The automatic Insights reminder path remains independent and operational.
