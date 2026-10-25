# The overnight run's questions (25 Oct)

Jack answered these on 25 Oct, one at a time, after the overnight build
(`.agents/STATUS.md`, "Waiting on Jack"). Each answer was option 1 of the
choices put to him.

## Sending service reminders (WP-4.5; account and reminders decisions 2, 6, 8)

1. **The reminder's words are written when it is sent, not when it is set
   up.** It uses the shop's wording, the customer's name, phone or email, and
   their chosen way (text, WhatsApp or email) as they are on the day it goes.
   Chosen over fixing the words at collection, as every other message does
   today.
2. **A job with several services gets one reminder, at the soonest
   service's months, naming that service.** Chosen over one reminder per
   service, and over the latest service's months.
3. **One reminder per bike at a time; the newest visit wins.** When the bike
   is collected again, the waiting reminder is dropped and a new one is set
   from that visit. If a booking for the bike is already waiting when the
   reminder is due, it isn't sent. Chosen over keeping every reminder.
4. **A reminder goes when the shop opens on the day it is due**, or on the
   next open day, using the opening hours in Settings. Chosen over the time
   of day the bike was collected, and over a fixed hour.
5. **"Stop these" stops reminders on a button press, not when the link is
   opened.** The link opens a page with one button, so a phone or email app
   checking the link can't stop them by accident; the drawn "Service
   reminders stopped" page follows the press. Chosen over stopping as soon as
   the link is opened.

## The rest

6. **Paying for a repair online: ask Mark** on #199 how an online repair
   payment is recorded as a sale (his sales-in-pence decisions 4 and 8), and
   build once he answers.
7. **Discounts at the till wait for Mark's step C**, when the till saves
   sales the new way, so they are built once. Chosen over building them now
   on the old sales record.
8. **The in-shop ready page gets the "Remind me…" tick too** (drawn only on
   the pay-online ready page, `collect.mjs:77`), with the same drawn tick
   and wording, so customers who didn't tick it when booking, and those
   booked in by staff, can say yes when their bike is ready.
9. **Merging two customers keeps a yes to reminders**: if either record
   said yes, the kept record says yes, with when and where it was given.
10. **"Download everything" waits until all four lists can be made**
    (customers, sales, stock, workshop jobs), then comes as one zip of
    spreadsheets, as drawn.
