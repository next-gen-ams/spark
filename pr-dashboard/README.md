# RMIT DSC China PR Tracker

Interactive dashboard prototype inspired by the clean operational structure of the EMT Tracker and adapted to an RMIT client-facing visual direction. The client-facing build is published as a static Spark site; Meltwater is refreshed into a committed weekly snapshot so the API credential never reaches browser JavaScript.

## Included

- Password-entry screen with per-tab access state.
- Rolling past-three-month Meltwater overview.
- Published-media table with campaign-wave filtering, bilingual linked titles, outlet profiles and editorial media-landscape tiers.
- Weekly Meltwater snapshots covering total mentions, potential reach, daily trend, peak-day article popovers, sentiment mix, core topics and a bilingual recent-mention review queue from Saved Search `RMIT China DSC` (`29175637`).
- China market selector with locked future-market options, official RMIT branding and the standard KMT copyright banner.
- Separate KMT GEO Dashboard call-to-action with a deliberately unconfigured URL.
- Search, information dialogs and responsive layouts.

## Important boundaries

- The Spark build checks the agreed shared password against a PBKDF2 verifier and keeps access only for the current browser tab. The plaintext password is not committed. Because Spark is static hosting, this is a lightweight client-preview gate rather than server-enforced authentication; repository files and static assets are not confidential storage.
- Published entries come from the user-supplied tracker `媒体发布跟进- RMIT北京创意学科开放日新闻稿-0923.xls`, updated 29 Sep 2026. Media tiers are planning assessments, not official classifications.
- The Meltwater weekly snapshot is populated; the separate KMT GEO Dashboard URL is not yet connected.

## Preview

Run the static preview:

```sh
npm run preview
```

Then open `http://127.0.0.1:4173`. The server binds to localhost by default and exposes no browser-triggered manual refresh action. The Spark snapshot is refreshed every Monday by GitHub Actions.

Run the local tests with:

```sh
npm test
```

## Production handoff notes

- Move authentication to a server-side service with a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` session cookie if the dashboard later contains confidential information.
- Keep `MELTWATER_API_KEY` only in the GitHub Actions repository secret. Never expose it through browser JavaScript.
- The Spark site is served from the `pr-dashboard` directory inside `next-gen-ams/spark`.
- Replace sample media with a verified source of truth before publishing.
- Connect the GEO URL through deployment configuration rather than hardcoding a draft link.
