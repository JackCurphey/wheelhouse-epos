# Design: the server holds Bike ready

## Decisions

1. **Held is a send time of "never"**: `send_after = 'infinity'`, a value
   Postgres keeps for timestamps. The sender claims only rows whose send time
   has come, so it never claims a held one; Undo, which stops a message whose
   send time is still to come, stops it as it is. No new state, no migration;
   the message stays `intended`.
2. **Who holds**: `queueBikeReady` reads the signed-in person's switch
   (`login_preferences.accessibility.noAutoClose`) and queues with
   `hold: true`. Bike still waiting is queued as before; it only goes if Bike
   ready was sent first (unchanged).
3. **Send now** (`POST /api/messages/:id/send-now`, any signed-in staff
   member, as Undo): sets the send time to now only where it's held, else
   409 `illegal`; the sender sends it on its next round.
4. **As the screens read it** (`serializeMessage`): `held: true` and
   `sendAfter: null` for a held message; the finish reply's `readyMessage`
   says the same.
