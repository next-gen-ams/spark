# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vinext/React application published through ChatGPT Sites and as a static build in the GMS Spark repository.

## Users

The GMS Executive Team, preparing for and running a weekly discussion of internal administrative work.

## Product Purpose

Keep proposed discussion topics, meeting decisions and follow-up work in one shared workspace. Success means the team can see what needs discussion, allocate a lead, record a decision and understand when the next reminder will be sent.

## Positioning

The tracker connects the weekly meeting agenda directly to ownership and follow-up, instead of separating meeting notes from action tracking.

## Operating Context

Used before, during and after a weekly executive meeting. Microsoft work accounts provide sign-in; Outlook email and calendar are intended to deliver reminders and meeting context.

## Capabilities and Constraints

- Microsoft work-account sign-in uses a tenant-scoped Entra single-page application and verifies the signed-in profile through Microsoft Graph.
- The primary workflow is: capture a topic, place it on an upcoming agenda, assign a lead, record a decision and track follow-up.
- Topic groups are managed from a dedicated settings view. The four initial groups can be renamed, new groups can be added, and deletion requires confirmation; linked agenda and decision records are preserved under `Uncategorised`.
- The shared workspace persists topics and topic groups in Supabase, while reminder preferences are saved separately for each approved Microsoft account behind the authenticated workspace API.
- Outlook email delivery uses an app-only Microsoft Graph sender fixed to `insights@gms.global`; the evaluator runs hourly and sends only in the 09:00 Australia/Melbourne window when a member's global settings produce a due reminder.
- Illustrative topics, dates and team members must be labelled as sample data.
- The initial interface language is English.

## Brand Commitments

Use the established GMS dashboard design language and authentic supplied GMS 10 Years logo. Preserve the GMS navy, warm-white, action-blue and coral/sky/lavender frosted workspace relationship.

## Evidence on Hand

- Approved GMS Frosted Workspace design system and authentic logo assets.
- The EMT roster is Lisa Xu, George Pesutto, Coco Hu and Brenda Cugley. Existing sample agenda and decision content remains illustrative even though the workspace is now persisted.

## Product Principles

- Make the next discussion and its owner obvious.
- Keep meeting preparation and follow-up in one continuous journey.
- Distinguish sample content and inactive reminder delivery from verified Microsoft sign-in.
- Preserve executive-level scanability while keeping item-level detail close at hand.
- Prepare and deduplicate reminder deliveries before sending, keep an auditable delivery record, and support a dry-run check that cannot send mail.

## Accessibility & Inclusion

Keyboard-operable controls, visible focus, readable contrast and responsive layouts are required for the mockup.
