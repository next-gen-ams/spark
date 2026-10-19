# Follow-up completion

Status: implemented and verified locally; not pushed or deployed.

## Interactive preview

Run `npx --no-install vite --config design-previews/completion/vite.config.ts`, then open `http://127.0.0.1:4193/?view=decisions`. This separate preview entry renders the actual application components with local mock authentication/data adapters; it does not alter the production entry or access live accounts. All visible records are synthetic. Completion and reopening persist only under a preview-specific localStorage key. Use Reset preview to restore the examples.

The browser check in `design-previews/completion/check-preview.mjs` verified Mark complete, immediate loading, persistence across refresh, Reopen, desktop and phone layouts, and zero page errors, with external requests blocked. Screenshots are kept alongside the harness. The preview follows the existing GMS Frosted Workspace styling and authentic logo assets; it is not a production deployment.

## Behavior

- Saved decisions with a follow-up owner show `Mark complete` in the Decision tab's bottom action bar, immediately left of Save decision. Reopen uses the same position. The summary card retains status/date information only. Phone layouts use two equal-width action columns.
- The completed state, completion date and verified actor appear in the drawer. The decision log shows a Completed badge; the original decision and task stay visible.
- `Reopen follow-up` returns the task to Open. Edits to decision, owner, next action or due date also reopen it; title/context edits retain completion.
- The existing mutation lock and spinner prevent duplicate submissions. Unsaved decision changes must be saved before completion is changed.
- Completed items are excluded from reminder previews and the real reminder evaluator, including due/overdue mail. Reopening restores eligibility under saved preferences and existing mail deduplication.
- Existing data defaults to Open. No existing topic has been marked complete by this implementation task.

## Storage and authorization

The additive migration introduces `completed_at` and `completed_by` with a consistency constraint. A service-role-only, security-invoker RPC sets completion atomically and verifies the actor is an active member. The Edge Function supplies the actor from the existing Microsoft profile verification; request JSON cannot choose the actor or timestamp. Repeating a completion preserves its original timestamp. A trigger clears completion when the task materially changes or its decision is deleted. No browser table grants or RLS policies are broadened.

## Verified 19 October 2026

- `npm test`: 12/12 pass, including the actual reminder evaluator with all external sending/database calls stubbed.
- `psql ... -f tests/completion.integration.sql`: pass against disposable local PostgreSQL 16; verifies completion, idempotency, reopening, changed-task reset, decision-deletion reset, inactive-member rejection and RPC grants. The test transaction rolls back.
- `npx --no-install tsc --noEmit --incremental false`: pass.
- Targeted `oxlint`, formatting and `git diff --check`: pass.
- `npm run build:github` with the existing public Microsoft identifiers: pass.
- Supabase production schema inspected read-only; no completion columns currently exist. Production workspace/reminder functions are still v12/v11. No production migration or email send was performed.

## Publication blocker

The required pre-push `pnpm audit --json` reports **3 critical, 19 high, 16 moderate and 6 low advisories** in the unchanged existing dependency tree. Examples include `tinypool`, `proxy-addr`, `react-server-dom-webpack`, `undici`, `sharp`, `braces` and `@modelcontextprotocol/sdk`. `pnpm view braces version` reports 3.0.3; the high-severity advisory has no official patched version. The feature introduces no new package or dependency version.

These are pre-existing findings, but the workspace security gate prohibits a push with unresolved critical/high findings. Publication is paused until dependency remediation is completed and rescanned. No third-party source scanner was used. Review the dependency/build-tool remediation scope before changing framework versions or replacing a transitive package.

## Deployment after the gate clears

1. Apply the additive completion migration.
2. Deploy workspace and reminder functions with `_shared/emt-completion.ts` included.
3. Build and publish the static frontend to Spark, retaining shared assets and old hashed chunks for existing sessions.
4. Verify a synthetic completion/reopen journey, persistence after reload, authorization denial and dry-run reminder exclusion without sending test mail.

Until deployment, the live site does not expose completion controls. Source of the pending feature is the task-local source checkout referenced by the GMS project index.

## Intermediate output review

- Cleanup candidate: `/Users/cocohu/Documents/Codex/2026-09-08/wo-x/work/emt-completion-db.OzJihV` (39 MB). This stopped disposable PostgreSQL cluster contains only synthetic integration-test data and can be regenerated from the committed SQL test. Kept pending owner-approved cleanup.
- Keep `/Users/cocohu/Documents/Codex/2026-09-08/wo-x/work/emt-dependency-audit.json` as security evidence until remediation is verified.
- Existing drag-motion previews were not changed or removed.
