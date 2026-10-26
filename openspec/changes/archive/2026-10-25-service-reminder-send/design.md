# Design: sending service reminders

## Decisions

1. **One module,** `server/messaging/service-reminders.js`. It holds:
   - setting a reminder up (`queueServiceReminder`), called after a
     successful collect;
   - its check when due;
   - its fill at send time.

   The engine calls the last two through its existing `DUE_CHECKS` and a
   new `FILL_AT_SEND` map. No other message changes.
2. **When it is due.** The shop's local date of `collected_at`, plus the
   soonest service's `reminder_months`, in calendar months; a date past the
   month's end falls on its last day, as Postgres adds months. Then the
   first day from that date the shop is open (opening days in Settings, up
   to a week on), at that day's opening time, in the shop's time zone. It is
   worked out in SQL with `AT TIME ZONE`, so summer time is right. It is
   stored as `send_after`, an instant, as every message's send time is.
3. **Which service.** Of the job's services with months set, the fewest
   months, then the first in the job's order. That service's name is the
   [Service] tap-in. A job with none set sets nothing up.
4. **One per bike.** When a reminder is set up, any reminder still waiting
   for another job with the same bike is undone. A job with no bike (an
   online booking never checked in to a bike) keeps its own; there is
   nothing to match it on.
5. **When due, it goes only if all of these hold:**
   - the customer says yes;
   - the message is on;
   - the job is still collected;
   - no later collection of the same bike;
   - no booking for the same bike still live and not collected.

   Otherwise it is undone, as the other reminders are.
6. **Filled in at send time (answer 1).** At the claim, the body, subject,
   channel and address are written again from the shop's wording now and
   the customer's contact now. With no way to reach them any more, it is
   undone. The body stored when it was set up is only what staff see
   meanwhile.
7. **"Stop these: [link]"** is added after the shop's wording, at both set-up
   and send, so the shop can't take it off (drawn: "It can't be taken
   off"). While sending is pretend, links read "[link]" (`messageLink`).
8. **The email's subject isn't drawn.** "Your [Bike] is due its [Service] —
   [Shop name]", following the other messages' subjects. Logged.
9. **Reopening the collection** (`reopen-custody`) undoes the job's waiting
   reminder, as reopening the work undoes Bike ready.
