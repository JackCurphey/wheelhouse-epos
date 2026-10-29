# Design: A day nobody closed

## The contract

Money is whole pence. Staff routes, under the request's row-level security,
Owner only where Close the day is (until roles). "Today" is the shop's own
date, as before. "Wednesday" below is the day nobody closed, "Thursday" the
morning after.

**Migration 106** (`server/migrations/106_unclosed_day.sql`), additive and
safe to run twice:

- `float_checks.for_day DATE`, null on a normal morning: the earlier day
  nobody closed that this count was made for. Its `counted_pence` is that
  day's count. `CHECK (for_day IS NULL OR (counted_pence IS NOT NULL AND
  for_day < day))`, and `UNIQUE (shop_id, for_day)`.
- `day_closes.carried_pence INTEGER NOT NULL DEFAULT 0`: for a day closed
  late, the cash banked for still-earlier days after its count was made
  (in the count, but not this day's). 0 on every normal close.

**Routes**

- `GET /api/float-check` gains `unclosed: { day, startPence, cashPence,
  expectedPence } | null`: set before today's check when the last day the
  till opened (the latest earlier day with a float check) has no close, and
  the shop closed a day before it. `startPence` is what that day started
  with, `cashPence` its cash since (sales less cash taken out and cash
  banked for earlier days), `expectedPence` the two added.
- `POST /api/float-check`: with `unclosed` set, a look is refused, 400
  `count_needed`, except the Owner's look at closing (Jack's answer 8, 27
  Oct), which stays a look for today only. A count is kept with `for_day`
  and `expected_pence` = `unclosed.expectedPence` (held between £0 and the
  most a check holds).
- `GET /api/close-the-day` gains `earlierDay`: the oldest day waiting to be
  closed (a count kept for it, no close), or null.
- `GET /api/close-the-day?day=YYYY-MM-DD` (an earlier day) → `{ day,
  floatPence, floatStart, cashPence, paidOutsPence, expectedPence,
  paidOuts, countedBy, carriedPence, bankPence, topUpPence, close }`.
  `countedBy` is `{ pence, byName, at, day }`, the count made for it;
  `bankPence` is what to bag. 404 `not_waiting` for a day with no count
  waiting and no close.
- `POST /api/close-the-day { day }` closes that earlier day from its count
  → 201 `{ close }`. 404 `not_waiting`; 409 `already_closed` with `{ close
  }`; 409 `earlier_day_open` with `{ day }` while an older day waits.
  Today's close (no `day`) is also refused 409 `earlier_day_open` while a
  day waits.
- `POST /api/paid-outs { …, day }` adds cash taken out to a waiting earlier
  day (the drawing's "Add a paid-out" under "Cash taken out on
  Wednesday"); 404 `not_waiting`, 409 `day_closed`.
- `close` gains `countedBy` (as above, or null on a normal close) and
  `carriedPence`.
- `GET /api/needs-attention` gains `{ kind: 'day_not_closed', day, checkId,
  checkDay, countedByName, checkedAt, tillCode }` per waiting day, oldest
  first.

## Decisions

1. **Which day is "a day nobody closed"** (walk-through 2 H1(b); close-the-day
   design 8): the last day the till opened, so a shop shut on Sundays looks
   back to Saturday, and only when the shop closed a day before it. Before
   a shop's first close no close counts sales (close-the-day design 6), so
   its earlier days stay as they were: the morning is a normal check.
2. **What the drawer should have** that morning: what Wednesday started
   with, plus its cash since (cash sales after its check, less cash taken
   out on it after its check, less cash banked for an earlier day after its
   check). The drawn "[£ float]" is what Wednesday started with: the float
   on a normal morning, its count if it was counted (logged for Jack).
3. **The count is Wednesday's count** (walk-through 2 decision 6): Count it
   only, never Looks right. The Owner's look at closing stays a look (Jack's
   answer 8); then no count waits for Wednesday, and tonight's close counts
   Wednesday's sales with today's, as before (answer 9).
4. **Which sales Wednesday's close counts** (Jack's answer 6): every sale no
   close has counted, made up to the morning count: by the server's clock,
   or the till's own clock for a sale made offline (the rule close-the-day
   already uses for "since the float check"). Thursday's close counts the
   rest. Each sale is marked by one close under the shop's lock, as before.
5. **Banking** (`op-close-yesterday`): bank the count less the float ("Bank
   Wednesday's cash"); leave the float and today's sales. Below the float,
   bank nothing and "Put £[n] in…" (Jack's answer 5). Cash banked for an
   earlier day after the count (`carried_pence`) isn't banked twice.
6. **Thursday's drawer**: this morning's count, plus cash sales since, less
   cash taken out today since, less the cash banked for earlier days since
   (each such close's banked less any put in). Answer 9 otherwise.
7. **Oldest first**: an earlier day waits on the one before it, and today's
   close waits on every earlier day with a count, so a sale can't be swept
   into the wrong day. The Close the day page opens the waiting day first
   (the float check's "first" pattern, logged).
8. **Cash taken out for Wednesday** is kept with Wednesday's date: it comes
   off Wednesday's expected cash, never Thursday's.
9. **Locking**: the late close and a paid-out lock the shop's row first
   (`SELECT … FOR NO KEY UPDATE`), read and check, write, COMMIT, and only
   then reply; `UNIQUE (shop_id, day)` backs one close a day.
10. **Today's short float** still goes to Needs attention against the full
    expected figure (`op-today-two`); an over one only once Wednesday is
    closed (decision 8 H1, unchanged).

## Screens (second pull request)

- The float check: `op-float-check-unclosed`, Count it only, with the
  difference pop-up against the full figure.
- Today: the "wasn't closed" line with Close it (`op-today-unclosed`,
  `op-today-two`).
- `/workshop/till/close?day=…`: `op-close-yesterday` — Count the cash done
  ("Counted this morning by Jo Taylor"), Paid-outs and banking open, End-of-day report;
  `/workshop/till/close` shows a waiting day first.
