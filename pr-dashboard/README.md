# RMIT DSC China PR Tracker

Interactive dashboard prototype inspired by the clean operational structure of the EMT Tracker and adapted to an RMIT client-facing visual direction. The client-facing build is published as a static Spark site; Meltwater is refreshed into a committed weekly snapshot so the API credential never reaches browser JavaScript.

## Included

- Password-entry screen with an optional seven-day remembered-device state; the plaintext password is never stored.
- Rolling past-three-month Meltwater overview.
- Published-media table with campaign-wave filtering, bilingual linked titles, outlet profiles and editorial media-landscape tiers.
- China-IP access notes and China-team page captures for The Beijing News and Beijing Youth Online when the original article cannot be opened from Australia.
- Weekly Meltwater snapshots covering total mentions, potential reach, daily trend, peak-day article popovers, sentiment mix, core topics and a bilingual recent-mention review queue from Saved Search `RMIT China DSC` (`29175637`).
- China market selector with locked future-market options, official RMIT branding and the standard KMT copyright banner.
- A focused PR Performance page plus one external GEO Visibility navigation item linked to the verified, automatically updated RMIT GEO report.
- Search, information dialogs and responsive layouts.

## Important boundaries

- The Spark build checks the agreed shared password against a PBKDF2 verifier and can remember a time-limited access marker for seven days. The plaintext password is not stored or committed. Because Spark is static hosting, this is a lightweight client-preview gate rather than server-enforced authentication; repository files and static assets are not confidential storage.
- Published entries come from the user-supplied tracker `媒体发布跟进- RMIT北京创意学科开放日新闻稿-0923.xls`, updated 29 Sep 2026. Media tiers are planning assessments, not official classifications.
- The Meltwater weekly snapshot is populated. GEO data is not copied into this site; the dashboard opens the verified KMT GEO shared report directly.

## Preview

Run the static preview:

```sh
npm run preview
```

Then open `http://127.0.0.1:4173`. The server binds to localhost by default and exposes no browser-triggered manual refresh action. A local Codex automation refreshes Meltwater every Monday.

Run the local tests with:

```sh
npm test
```

## Production handoff notes

- Move authentication to a server-side service with a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` session cookie if the dashboard later contains confidential information.
- Keep `MELTWATER_API_KEY` only in the existing 1Password item used by the local weekly automation. Never expose it through browser JavaScript or commit it to Git.
- After each weekly refresh, add faithful English translations for the six visible recent mentions when `titleEn` is empty. Preserve the Chinese source title, names, dates, URLs and metrics; `npm test` blocks publication while a visible English title is missing.
- The Spark site is served from the `pr-dashboard` directory inside `next-gen-ams/spark`.
- Replace sample media with a verified source of truth before publishing.
- Keep GEO Visibility pointed at the verified KMT GEO shared report; no local GEO cache or GEO refresh automation is required.
