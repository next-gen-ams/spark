# RMIT DSC China PR Tracker

Interactive dashboard prototype inspired by the clean operational structure of the EMT Tracker and adapted to an RMIT client-facing visual direction. Meltwater data is fetched through a small local server so the API credential never reaches browser JavaScript.

## Included

- Password-entry screen and sign-out interaction.
- Rolling past-three-month Meltwater overview.
- Published-media table with campaign-wave filtering, bilingual linked titles, outlet profiles and editorial media-landscape tiers.
- Weekly server-side Meltwater snapshots covering total mentions, potential reach, daily trend, peak-day article popovers, sentiment mix, core topics and a bilingual recent-mention review queue from Saved Search `RMIT China DSC` (`29175637`).
- China market selector with locked future-market options, official RMIT branding and the standard KMT copyright banner.
- Separate GEO Dashboard call-to-action with a deliberately unconfigured URL.
- Search, information dialogs and responsive layouts.

## Important boundaries

- The current password screen is a visual prototype, not production authentication. Any non-empty password opens the preview; no credential or session is stored.
- Published entries come from the user-supplied tracker `媒体发布跟进- RMIT北京创意学科开放日新闻稿-0923.xls`, updated 29 Sep 2026. Media tiers are planning assessments, not official classifications.
- Meltwater is live; the separate GEO dashboard URL is not yet connected.

## Preview

Run with a server-side Meltwater credential:

```sh
MELTWATER_API_KEY='resolved securely at runtime' npm run preview
```

Then open `http://127.0.0.1:4173`. The server binds to localhost by default, refreshes Meltwater automatically every seven days, and exposes no browser-triggered manual refresh action. The Vercel deployment uses the same seven-day CDN cache and a weekly production Cron warm-up.

Run the local tests with:

```sh
npm test
```

## Production handoff notes

- Use server-side password verification with a strong password hash stored in the hosting platform's secret manager.
- Issue a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` session cookie after successful authentication.
- Add rate limiting and generic login errors; never ship the shared password or its hash in client JavaScript.
- Configure `MELTWATER_API_KEY` in the hosting platform's server-side secret manager. Never use a `VITE_` or other browser-exposed environment variable for it.
- The Vercel project uses the `pr-dashboard` slug and the `pr-dashboard` root directory inside `next-gen-ams/spark`.
- Replace sample media with a verified source of truth before publishing.
- Connect the GEO URL through deployment configuration rather than hardcoding a draft link.
