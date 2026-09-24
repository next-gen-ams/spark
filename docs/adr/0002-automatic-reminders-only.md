# ADR 0002: Use automatic Insights reminders only

- Status: Accepted
- Date: 2026-09-25
- Owners: GMS EMT Tracker
- Supersedes: [ADR 0001](0001-dual-path-email-delivery.md)

## Context

EMT members need reminders based on their global settings. They do not need to compose or share topic emails from their personal Microsoft account. Retaining delegated `Mail.Send` would add consent, UI and audit complexity without serving the chosen workflow.

## Decision

1. Keep Microsoft sign-in limited to `User.Read` for identity and workspace access.
2. Remove the member-send UI, delegated `Mail.Send` scopes, client API and `emt-user-mail` Edge Function.
3. Send all scheduled reminders through `emt-reminders` using the application-only Microsoft Graph identity and fixed sender `insights@gms.global`.
4. Use each member's global reminder settings and topic assignments to determine recipients and timing. The browser never receives the application credential.
5. Keep the existing delegated-mail audit table inactive for now. Removing an empty or historical audit structure is a separate retention decision.

## Consequences

- Members never grant mailbox-send access to EMT Tracker.
- Reminder delivery works without an interactive user session.
- Sender identity, templates, deduplication and audit records stay centrally controlled.
- Reintroducing personal-account sending requires a new decision and security review.

## Verification and rollback

- Confirm the production frontend contains no `Mail.Send`, member-send or manual preview flow.
- Confirm the `emt-user-mail` function is no longer deployed.
- Confirm automatic reminder dry runs still evaluate saved global settings without sending mail.
- Confirm scheduled production calls authenticate with a server-held secret and use `insights@gms.global`.

Rollback is a new, reviewed implementation decision; do not restore the superseded browser flow by configuration alone.
