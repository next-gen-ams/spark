# Dashboard Insights and Snapshot Refresh TDD Evidence

## Source and journeys

Journeys were derived from the requested dashboard change:

- A PR reader sees exactly three concise, data-grounded weekly insights.
- GEO Visibility opens the verified KMT GEO report without a duplicate local page.
- Weekly and monthly refreshes retain the prior genuine snapshot for comparisons.
- The PR sidebar shows the next real Monday 10:00 Melbourne refresh.

## RED evidence

- Command: `npm test`
- Result: 14 passed, 6 failed.
- Intended failures covered the absent Insights snapshot/component, the still-local GEO view, the old sidebar context, and the missing snapshot utility.
- Checkpoint: `185a4df test: define dashboard insights and snapshot refresh behavior`

## GREEN evidence

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Three PR insight cards load from a committed snapshot | `dashboard-contract.test.mjs`, `insights.test.mjs` | PASS |
| GEO Visibility links directly to the full report | `dashboard-contract.test.mjs` | PASS |
| Previous snapshots are archived only for meaningful changes | `snapshot-utils.test.mjs` | PASS |
| Next refresh resolves to Monday 10:00 Australia/Melbourne across DST | `snapshot-utils.test.mjs` | PASS |
| Insights remain tied to current Meltwater and GEO snapshots | `npm run validate:insights` | PASS |

Final validation: `npm test` passed 21/21 tests; JavaScript syntax checks, `git diff --check`, and `npm audit --omit=dev` also passed.

## Known gap

The first true week-on-week and month-on-month deltas will be available only after the next successful scheduled refresh creates each previous-snapshot file. Until then, both insight sections are explicitly marked as baseline.
