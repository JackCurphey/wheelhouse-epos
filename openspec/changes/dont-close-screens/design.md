# Design: Don't close things by themselves, the screens

1. **Your settings.** A row in `ROWS` keyed `noAutoClose`, placed between
   Reduce motion and Larger text as `app-map.mjs` `ys-wait` draws it. The
   switch is already saved by `/api/your-settings`.
2. **The job strip.** `readyStrip` reads the finish reply's `readyMessage`.
   With `held`, the strip has no timer and offers Send now and Undo. Send now
   posts to `/api/messages/:id/send-now`; the strip then shows the sent line
   with the time it was pressed, in London time, and has no buttons. A
   refusal is shown as other refusals are (`refusalText`), and the strip goes.
   The style is the existing dark strip; the drawing reuses
   job-finished's strip, with only its words and buttons changed.
3. **Reopening.** A finished job reads its messages (the same query and key
   as Messages, `jobMessagesKey`). A held `bike_ready` message (state
   `intended`, `held`) gives the waiting strip when there is no strip from
   this visit. This isn't drawn. It is logged in `decided-while-building.md`:
   without it, a closed pop-up would leave Bike ready held with no Send now.
4. **Messages.** `JobMessage.held`. A held message reads "Waiting", "waits
   until Send now", and isn't checked every 5 seconds.
5. **The till.** `PaidStep` takes `wait`, the cashier's `noAutoClose` from
   `useYourSettings`. With `wait` on: there is no countdown; Print prints
   without moving on; Start next sale is in No receipt's place; and the line
   is shown (`role="status"`). A note to read (16 Oct) already stops the
   countdown, and it still shows.
