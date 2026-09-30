# RMIT DSC China PR Tracker

Interactive dashboard prototype inspired by the clean operational structure of the EMT Tracker and adapted to an RMIT client-facing visual direction. The client-facing build is published as a static Spark site; Meltwater is refreshed into a committed weekly snapshot so the API credential never reaches browser JavaScript.

## Included

- Password-entry screen with an optional seven-day remembered-device state; the plaintext password is never stored.
- Rolling past-three-month Meltwater overview.
- Published-media table with campaign-wave filtering, bilingual linked titles, outlet profiles and editorial media-landscape tiers.
- China-IP access notes and China-team page captures for The Beijing News and Beijing Youth Online when the original article cannot be opened from Australia.
- Weekly Meltwater snapshots covering total mentions, potential reach, daily trend, peak-day article popovers, sentiment mix, core topics and a bilingual recent-mention review queue from Saved Search `RMIT China DSC` (`29175637`).
- China market selector with locked future-market options, official RMIT branding and the standard KMT copyright banner.
- Two routed workspace views: a focused PR Performance page and a separate GEO Visibility page, with browser back/forward support.
- Expanded monthly KMT GEO report section with a pre-brand names-you headline, three stacked personas, bilingual sample prompts for each journey stage, and expandable English translations of Doubao, ERNIE and Qwen answers with cited-source links.
- One intentional GEO report link inside the GEO section, linked to the verified shared RMIT GEO report.
- Search, information dialogs and responsive layouts.

## Important boundaries

- The Spark build checks the agreed shared password against a PBKDF2 verifier and can remember a time-limited access marker for seven days. The plaintext password is not stored or committed. Because Spark is static hosting, this is a lightweight client-preview gate rather than server-enforced authentication; repository files and static assets are not confidential storage.
- Published entries come from the user-supplied tracker `媒体发布跟进- RMIT北京创意学科开放日新闻稿-0923.xls`, updated 29 Sep 2026. Media tiers are planning assessments, not official classifications.
- The Meltwater weekly snapshot is populated. GEO prompt-level data is stored in a committed read-only browser snapshot generated from the verified shared report; the browser never calls an authenticated GEO API or MCP.
- The `kmt-geo` MCP is registered separately in Codex with OAuth `geo:read` access. Its OAuth token is not present in source, static data, browser storage or build output.

## Preview

Run the static preview:

```sh
npm run preview
```

Then open `http://127.0.0.1:4173`. The server binds to localhost by default and exposes no browser-triggered manual refresh action. Local Codex automations refresh Meltwater every Monday and refresh the KMT GEO snapshot on the first Monday of each month.

Run the local tests with:

```sh
npm test
```

Refresh the committed GEO snapshot from the verified read-only share before publishing a new GEO check:

```sh
npm run refresh:geo
```

Generate any missing English translations after a GEO refresh:

```sh
npm run translate:geo
```

## Production handoff notes

- Move authentication to a server-side service with a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` session cookie if the dashboard later contains confidential information.
- Keep `MELTWATER_API_KEY` only in the existing 1Password item used by the local weekly automation. Never expose it through browser JavaScript or commit it to Git.
- The Spark site is served from the `pr-dashboard` directory inside `next-gen-ams/spark`.
- Replace sample media with a verified source of truth before publishing.
- Keep GEO data in the automation-generated `data/geo.json` cache. Never call the authenticated MCP directly from browser JavaScript or commit OAuth tokens.
