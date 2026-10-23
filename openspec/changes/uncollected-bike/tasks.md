# Tasks

## 1. The server (first pull request)

- [x] 1.1 Migration 064: `collection_reminder_days` (3, 1–60) and `collection_today_days` (7, 2–90) on `workshop_settings`; `uncollected_contacted_at`, `uncollected_contacted_by_login_id` on `workshop_jobs`. Tested from empty on a scratch database
- [x] 1.2 Tests first (`tests/uncollected-bike.test.js`): the settings save and read back, Today's not longer than the reminder's is refused; marking ready queues one "Bike still waiting" for the days set; reopening stops it; due, it goes only while in the shop, finished, unpaid and on; its words say what's left to pay; Needs attention lists a bike past the Today count with its fields, oldest first, not before; Contacted records and removes it, refused for a bike not listed and for Staff; another shop's bikes never appear. Watch each fail
- [x] 1.3 Build it: the settings, the template (`LIVE_KEYS`), queueing beside Bike ready, the due check, `[What’s left to pay]`, the `uncollected` kind, the Contacted route (route list). Verify 1.2
- [x] 1.4 `/review` (migration, messaging core); lint, `npm test`, `npm run test:browser`; pull request

## 2. The screens (second pull request)

- [x] 2.1 Tests first: Settings › Workshop › Collection's two rows save on leaving the box and refuse Today's not longer, saying why, and raising the reminder past Today's count can be done without a dead end (server review finding); Settings › Messages lists Bike still waiting with its days; Today's line with its words, the phone link and Contacted taking it off. Watch each fail
- [x] 2.2 Build them to `cp-setting` and `cp-today-uncollected`. Verify 2.1; a browser test
- [x] 2.3 Log what's decided while building; lint, tests, fresh review; archive as the last commit
