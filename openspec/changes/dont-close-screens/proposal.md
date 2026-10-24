# Proposal: Don't close things by themselves, the screens

## Why

Jack's 24 Oct answer 9 (`docs/decisions/2026-10-24-morning-questions.md`)
says "Don't close things by themselves" makes both timers wait. Bike ready
waits with "Send now" and Undo, and the till's Paid box waits for "Start next
sale". Jack approved the drawings (#464): `ys-wait` (Your settings,
`app-map.mjs`), `job-finished-wait`, `job-finished-sent` (`diary.mjs`) and
`till-receipt-wait` (`till.mjs`). The server half (#466) already holds Bike
ready and has `POST /api/messages/:id/send-now`. This is the screens half,
in Jack's lane, and has no migration. Its risky area is the till's Paid box,
which is money; the change only alters when the next sale starts, but
`/review` still runs.

## What Changes

- Your settings gets the drawn "Don’t close things by themselves" switch,
  between Reduce motion and Larger text.
- On the job page, a held Bike ready shows the drawn strip, "… is waiting
  until you press Send now.", with Send now and Undo and no timer. After Send
  now it says "“Bike ready” sent to Maya by text · [time]", with no buttons.
  The strip also comes from the job's messages, so reopening the job still
  shows Send now.
- The job's Messages list says a held message is waiting until Send now, and
  doesn't keep checking for it.
- With the switch on, the till's Paid box has no countdown. Print prints and
  the box stays, Start next sale takes No receipt's place, and the line reads
  "The next sale waits until you press Start next sale."

## Capabilities

### Modified Capabilities

- `your-settings`: the Don't close things by themselves switch.
- `workshop-diary`: Bike ready's strip waits for Send now.
- `till`: Paid waits for Start next sale.

## Impact

- `src/screens/your-settings/your-settings-page.tsx`
- `src/screens/diary/job-dialog.tsx`
- `src/screens/diary/job-messages.tsx`
- `src/screens/till/pay-dialog.tsx`
- tests
