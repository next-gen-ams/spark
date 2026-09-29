# Weekly EMT cadence — TDD evidence

## Source and journey

The journey was derived from Coco's 29 September 2026 request: an EMT member should see and assign topics to the next three Monday meetings after the cadence changed from fortnightly to weekly, while reminder timing follows the selected meeting date.

## RED evidence

- `npm test -- tests/meeting-schedule.test.ts` failed because `addMeetingWeek` did not exist.
- The backend validation test then failed because the weekly schedule helper did not exist.

## GREEN evidence

| Guarantee | Test | Result |
| --- | --- | --- |
| The next three meeting cards advance in seven-day intervals | `shows the next three weekly meetings on a normal day` | Pass |
| A meeting remains current for the whole Melbourne calendar day, including daylight-saving time | `keeps the current meeting first for the full Melbourne calendar day` | Pass |
| The schedule advances after the meeting day | `advances to the next meeting after the Melbourne meeting day` | Pass |
| Moving forward advances exactly one week | `moves a topic exactly one week forward` | Pass |
| Backend validation accepts weekly Mondays and rejects off-cycle dates | `backend accepts each weekly Monday and rejects off-cycle dates` | Pass |

## Verification

- `npm test`: 9/9 passed.
- `node --experimental-strip-types --experimental-test-coverage --test tests/*.test.ts`: 97.12% line coverage, 87.50% branch coverage and 92.31% function coverage across exercised modules.
- `NEXT_PUBLIC_MICROSOFT_CLIENT_ID=<public app id> NEXT_PUBLIC_MICROSOFT_TENANT_ID=<public tenant id> npm run build:github`: passed.
- Targeted `oxlint` for changed application, scheduling and test files: passed.
- Full-repository `npm run lint`: still reports pre-existing generated UI accessibility rules and Deno-module resolution errors outside this change.
- Production: Supabase migration applied, `emt-workspace` v12 active, Spark commit `dc8d393` published, live HTML and JavaScript both verified as weekly.

## Known boundary

The historical migration that originally introduced meeting dates remains immutable and contains its original fortnightly backfill. The new production rule and current database comments are weekly; existing future Monday assignments remain valid.
