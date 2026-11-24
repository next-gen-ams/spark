# RMIT DSC China PR Tracker

Interactive dashboard prototype inspired by the clean operational structure of the EMT Tracker and adapted to an RMIT client-facing visual direction. The client-facing build is published as a static Spark site; Meltwater is refreshed into a committed weekly snapshot so the API credential never reaches browser JavaScript.

## Included

- Password-entry screen with an optional seven-day remembered-device state; the plaintext password is never stored.
- Rolling past-three-month Meltwater overview.
- Published-media table with campaign-wave filtering, bilingual linked titles, outlet profiles and editorial media-landscape tiers.
- China-IP access notes and China-team page captures for The Beijing News and Beijing Youth Online when the original article cannot be opened from Australia.
- Weekly Meltwater snapshots covering total mentions, daily trend, peak-day article popovers, sentiment mix and core topics from Saved Search `RMIT China DSC` (`29175637`).
- Organic coverage lists six additional Beijing Open Day pickups reviewed in Meltwater, with one record per outlet. Campaign potential reach uses reviewed article figures and shows the number of articles included in each subtotal.
- The PR view includes a captured GEO citation from the 29 September 2026 check, where Baidu ERNIE cited the Huanqiu Open Day article.
- China market selector with locked future-market options, official RMIT branding and the standard KMT copyright banner.
- A focused PR Performance page plus one external GEO Visibility navigation item linked to the verified, automatically updated RMIT GEO report.
- Search, information dialogs and responsive layouts.

## Important boundaries

- The Spark build checks the agreed shared password against a PBKDF2 verifier and can remember a time-limited access marker for seven days. The plaintext password is not stored or committed. Because Spark is static hosting, this is a lightweight client-preview gate rather than server-enforced authentication; repository files and static assets are not confidential storage.
- Published entries come from the user-supplied tracker `媒体发布跟进- RMIT北京创意学科开放日新闻稿-0923.xls`, updated 29 Sep 2026. Media tiers are planning assessments, not official classifications.
- The Meltwater weekly snapshot is populated. The citation screenshot captures one historical campaign result. GEO Visibility opens the live KMT GEO report.

## Preview

Run the static preview:

```sh
npm run preview
```

Then open `http://127.0.0.1:4173`. The server binds to localhost by default and exposes no browser-triggered manual refresh action.

The local Codex weekly Meltwater automation was reactivated on 22 October 2026,
scheduled for Mondays at 10:00 Australia/Melbourne. Each run starts from the
current remote main in its own temporary checkout and refreshes the snapshot.
Publication uses the branch/PR/checks
flow in [CONTRIBUTING.md](../CONTRIBUTING.md), then normal protected merge and
Pages/live verification. Credentials remain runtime-only through 1Password.
The recovery verified the active schedule, script syntax and existing tests.
A manual refresh on 22 October then verified the live API, snapshot archive and
six reviewed English titles; see the [maintenance record](../docs/repository-maintenance.md).
Every release must still confirm the protected PR, Pages deployment and live
snapshot; an active schedule alone does not prove that data has been refreshed.

Run the local tests with:

```sh
npm test
```

## Production handoff notes

- Move authentication to a server-side service with a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` session cookie if the dashboard later contains confidential information.
- Keep `MELTWATER_API_KEY` only in the existing 1Password item used by the local weekly automation. Never expose it through browser JavaScript or commit it to Git.
- Maintain the reviewed Open Day pickups and their article reach in `dashboard.js` using the same Meltwater evidence as the GMS workbook. Keep public article links and one record per outlet. Weekly monitoring data feeds the mention count, trend and sentiment.
- The Spark site is served from the `pr-dashboard` directory inside `next-gen-ams/spark`.
- Replace sample media with a verified source of truth before publishing.
- Keep GEO Visibility pointed at the verified KMT GEO shared report; no local GEO cache or GEO refresh automation is required.
