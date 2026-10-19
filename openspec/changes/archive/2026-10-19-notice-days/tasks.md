# Tasks: notice in hours or days

## 1. Server (Mark's; flagged for him)

- [x] 1.1 Tests first, watched failing: earliestBookable with days (start of the day N ahead, shop time zone); the setting starts null, saves 1–28, refuses others, null goes back to hours; availability at 15:00 with 1 day offers tomorrow from opening
- [x] 1.2 Migration 044; the settings route; capacity settings; earliestBookable

## 2. Settings

- [x] 2.1 Tests first, watched failing: Notice shows hours or days; saving each; switching unit; refusals
- [x] 2.2 The Notice row

## 3. Checks

- [x] 3.1 Browser test; a fresh review; `npm test` and `npm run test:browser` pass
