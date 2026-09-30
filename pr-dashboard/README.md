# RMIT DSC China PR Tracker

Interactive dashboard prototype inspired by the clean operational structure of the EMT Tracker and adapted to an RMIT client-facing visual direction. The client-facing build is published as a static Spark site; Meltwater is refreshed into a committed weekly snapshot so the API credential never reaches browser JavaScript.

## Included

- Password-entry screen with an optional seven-day remembered-device state; the plaintext password is never stored.
- Rolling past-three-month Meltwater overview.
- Published-media table with campaign-wave filtering, bilingual linked titles, outlet profiles and editorial media-landscape tiers.
- Weekly Meltwater snapshots covering total mentions, potential reach, daily trend, peak-day article popovers, sentiment mix, core topics and a bilingual recent-mention review queue from Saved Search `RMIT China DSC` (`29175637`).
- China market selector with locked future-market options, official RMIT branding and the standard KMT copyright banner.
- Separate KMT GEO Dashboard call-to-action linked to the verified shared RMIT GEO report.
- Search, information dialogs and responsive layouts.

## Important boundaries

- The Spark build checks the agreed shared password against a PBKDF2 verifier and can remember a time-limited access marker for seven days. The plaintext password is not stored or committed. Because Spark is static hosting, this is a lightweight client-preview gate rather than server-enforced authentication; repository files and static assets are not confidential storage.
- Published entries come from the user-supplied tracker `媒体发布跟进- RMIT北京创意学科开放日新闻稿-0923.xls`, updated 29 Sep 2026. Media tiers are planning assessments, not official classifications.
- The Meltwater weekly snapshot is populated. The KMT GEO CTA opens the verified shared report URL. The `kmt-geo` MCP is registered separately in Codex with OAuth `geo:read` access; its OAuth token must never be exposed to this static browser build.

## Preview

Run the static preview:

```sh
npm run preview
```

Then open `http://127.0.0.1:4173`. The server binds to localhost by default and exposes no browser-triggered manual refresh action. A local Codex automation refreshes and publishes the Spark snapshot every Monday.

Run the local tests with:

```sh
npm test
```

## Production handoff notes

- Move authentication to a server-side service with a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` session cookie if the dashboard later contains confidential information.
- Keep `MELTWATER_API_KEY` only in the existing 1Password item used by the local weekly automation. Never expose it through browser JavaScript or commit it to Git.
- The Spark site is served from the `pr-dashboard` directory inside `next-gen-ams/spark`.
- Replace sample media with a verified source of truth before publishing.
- Ingest future GEO metrics into a server-side or automation-generated cache. Never call the authenticated MCP directly from browser JavaScript or commit OAuth tokens.
