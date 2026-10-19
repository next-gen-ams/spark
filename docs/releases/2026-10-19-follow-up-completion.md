# Follow-up completion

Status: published on Spark on 19 October 2026 (completion frontend `6ba552c`, list-status follow-up `7dd4f94`, workspace v13, reminders v12).

## Interactive preview

Run `npx --no-install vite --config design-previews/completion/vite.config.ts`, then open `http://127.0.0.1:4193/?view=decisions`. This separate preview entry renders the actual application components with local mock authentication/data adapters; it does not alter the production entry or access live accounts. All visible records are synthetic. Completion and reopening persist only under a preview-specific localStorage key. Use Reset preview to restore the examples.

The browser check in `design-previews/completion/check-preview.mjs` verified Mark complete, immediate loading, persistence across refresh, Reopen, desktop and phone layouts, and zero page errors, with external requests blocked. Screenshots are kept alongside the harness. The preview follows the existing GMS Frosted Workspace styling and authentic logo assets; it is not a production deployment.

## Behavior

- Follow-up status is also visible without opening the drawer: agenda and backlog metadata and the decision log show the same Pending (amber/clock) or Completed (green/check) badge. The drawer uses the same terminology. Pending includes undecided topics; it does not mean overdue. This is display-only and reads the persisted completion timestamp, not the legacy discussion status field.
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
- The additive migration is applied and production workspace/reminder functions are v13/v12. A synthetic live-schema transaction verified completion, idempotency, reopening, changed-task/deletion reset and RPC grants, then rolled back. Existing decisions were not marked complete; no test email was sent. Unauthenticated workspace/reminder requests returned 401; disallowed workspace origin returned 403.

## Dependency remediation and release verification

The initial pre-push `pnpm audit --json` reported **3 critical, 19 high, 16 moderate and 6 low advisories**. On 19 October Coco approved remediation and Spark publication. The final installed dependency tree reports **zero known vulnerabilities across all severities**, with 238 dependency entries instead of 698. No advisories were ignored or suppressed.

- Removed unused Vinext/RSC/image-server, Cloudflare/Wrangler and shadcn generator chains. This eliminates `braces` without needing an unpatched upstream release. The deployed product was already a static page backed by Supabase; Vite now produces its static assets directly.
- Updated React/React DOM to 19.2.9, Vite to 8.3.4, Tailwind to 4.3.3 and lint/format tools. Explicit overrides pin esbuild 0.28.2, PostCSS 8.5.31 and source-map-js 1.2.2. The retained UI state CSS was copied with its MIT license so removing the generator preserves styling.
- Only the three existing public Microsoft identifier/base-path constants are inlined; no environment object, application secret or service-role credential is bundled. Existing MSAL storage, callback path and backend membership checks remain in place.
- `gitleaks git --redact`: 52 source commits passed before publication; the final documentation/check-only delta was scanned again before pushing. A directory scan additionally flagged generated random framework keys in ignored, obsolete `dist/server/**` artifacts; these are not tracked or copied to Spark. The current frontend build did not produce those files. The complete published `emt-tracker/` directory and outbound Spark commit also passed secret scans.
- Production build, TypeScript and targeted changed-file lint passed. Both Edge Functions passed `deno check`. The full lint command continues to report inherited generated-UI accessibility/type issues and Node-versus-Deno resolution errors; it is not reported as a full pass.
- Post-migration Supabase advisors show no new completion-function finding. Existing shared-project warnings remain for `is_team`/`is_tracking_user` SECURITY DEFINER execution grants and disabled leaked-password protection; these are outside this dependency/completion change and were not modified. EMT uses verified Microsoft sign-in and server-only table access; the seven RLS-without-policy notices reflect deliberate denial of direct browser access. Advisory references: [function grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Browser checks passed for the actual components with mock data (complete/loading/reload/reopen, desktop/phone) and the production static bundle (configured Microsoft sign-in, protected workspace, logo, refresh, phone overflow, script-free auth callback, no page/asset errors).

## Completed deployment

1. Applied the additive completion migration and deployed workspace v13 and reminders v12 with the shared completion helper.
2. Published static assets in Spark commit `6ba552ccae22bda57c5b45ea7a656e585a77687b`, retaining shared assets and old hashed chunks for existing sessions. GitHub Pages build/deployment `39183561149` completed successfully.
3. Verified [the live dashboard](https://spark.kmt.global/emt-tracker/): HTML matches the published build; new CSS/JS, logo and silent callback load successfully. Automated checks passed for configured sign-in, protected workspace, refresh and phone layout, with no page or asset errors.
4. Authenticated completion/loading/reload/reopen was tested in the actual UI with synthetic local adapters; production database behavior was tested in a rolled-back synthetic transaction. No real member's task was completed and no test email was sent. The reminder heartbeat remained active with no failed runs in the preceding 24 hours.

Source is maintained on [Spark's `emt-tracker-source` branch](https://github.com/next-gen-ams/spark/tree/emt-tracker-source); static publication remains on `main` under `emt-tracker/`. Source remediation commit: `0926750`. The task-local checkout and GMS project index point to those authoritative remote locations. The legacy ChatGPT team.site remote was not updated.

## Intermediate output review

- Cleanup candidate: `/Users/cocohu/Documents/Codex/2026-09-08/wo-x/work/emt-completion-db.OzJihV` (39 MB). This stopped disposable PostgreSQL cluster contains only synthetic integration-test data and can be regenerated from the committed SQL test. Kept pending owner-approved cleanup.
- Keep `/Users/cocohu/Documents/Codex/2026-09-08/wo-x/work/emt-dependency-audit.json` as before-remediation security evidence.
- Existing drag-motion previews were not changed or removed.

## List-status follow-up verification, 19 October 2026

- Published in Spark `7dd4f946e75dc8b53680b8d64d1286932f8e4c9e`; Pages deployment `39184187745` succeeded. Live HTML references the new status-bearing JS/CSS assets. Source implementation: `9e26292` on `emt-tracker-source`. Existing shared assets and prior hashed chunks were retained.
- `check-list-status.mjs` passed against actual UI components with synthetic local adapters: both status states in backlog and Decision log, agenda Pending, mark-complete immediate list update, refresh persistence, reopening and phone overflow. Desktop/phone evidence is stored as `preview-list-status*.png`. No live user records were changed.
- 12/12 regression tests passed, including real reminder candidate generation excluding completed agenda/due/overdue work. Exercised-module coverage: 97.33% lines / 90.32% branches (not whole-app coverage). TypeScript, changed-code lint, static production build and configured-login smoke check passed; dependency audit remained zero.
- Retrieved the deployed `emt-reminders` v12 source read-only: ACTIVE, with `if (!isFollowUpOpen(topic)) continue;` before candidate generation, and the shared helper returns false when `completed_at` exists. No backend change or email send was needed. Already-sent/in-flight mail cannot be recalled; subsequent evaluations skip completed work. Reopening or materially changing the follow-up restores eligibility under saved preferences.
- No authentication, authorization, input or deployment configuration changed. The reusable badge renders fixed labels through React and receives only the existing completion timestamp.
