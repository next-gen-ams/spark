# Organic title refresh TDD evidence

## Source and user journeys

The journeys were derived from the 30 September 2026 dashboard request.

- As a dashboard reader, I see reviewed English titles above the Chinese source titles in the six visible organic coverage cards.
- As an operator, I cannot publish a weekly snapshot when any visible organic coverage card lacks an English title.
- As a dashboard owner, I use the automatically updated external GEO report without maintaining a duplicate local snapshot or monthly refresh.

## Task report

| Behaviour | Validation | RED evidence | GREEN guarantee |
|---|---|---|---|
| Six visible organic cards have English titles | `npm test` | Failed on the first empty `titleEn` value | All six visible records contain non-Chinese `titleEn` text |
| Missing translations never show an internal review placeholder | `npm test` | Failed while `English title pending review` remained in `dashboard.js` | Source title is the safe UI fallback |
| Local GEO snapshot pipeline is retired | `npm test` | Failed while the GEO data and refresh scripts still existed | GEO data, scripts, local route and package commands are absent |

## Coverage and known gaps

`npm test` completed with 21 tests passed, 0 failed and 0 skipped. The project uses Node's native test runner and contract tests rather than instrumented browser coverage. The weekly automation is responsible for translating newly visible titles before the test and deployment gate; the dashboard safely falls back to the original source title if unreviewed data is inspected locally.

## Merge evidence

- RED checkpoint: `5d4cae4 test: require reviewed organic titles and retire GEO cache`
- GREEN checkpoint: the implementation commit follows the RED checkpoint and was created only after `npm test` passed 21/21.
