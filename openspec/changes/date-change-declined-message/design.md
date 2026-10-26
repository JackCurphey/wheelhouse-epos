# Design: a declined date change tells the customer

1. **A second message template, `date_change_declined`,** with the drawn
   wording, stored like any other (`message_templates`), so a shop can reword
   it. It is not a row of its own: the template carries `partOf:
   'date_change_answered'`, so Settings shows it as the second box of that
   row, and its on/off follows the parent's (`templateFor` returns the
   parent's `enabled`). One switch, as the drawing has one.
2. **The subject** is the parent's (the drawing shows one subject).
3. **[New day and time]** is read from the request before the decline clears
   it and passed to the message's tap-ins; [Booked day and time] is the job's
   own day, which the decline leaves where it was.
4. **Sent after the answer commits**, through the same `sendBookingMessage`
   as the others, so a message that can't be queued is logged and the answer
   stands, and the reply says when the customer can't be reached.
5. **Settings:** `EditMessage` for `date_change_answered` shows both wordings
   (each with its own preview text), saving each under its own key.

## Decision log

- Own template key rather than a second wording column: no migration, and
  the engine, preview and reset already work per key.
