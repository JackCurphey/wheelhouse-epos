# Retiring the old app's workshop settings (19 Oct 2026)

The old app's Office › Edit shop › Workshop edits the opening hours, which
the new Settings now does (#281), and the full-day threshold: the time kept
free each day for "mechanics' lunches, admin time, and all the little bits"
(Jack, 4 Sep, `2026-09-04-job-type-before-diary.md` §2.2; default 2 hours).
The threshold has no drawing.

1. **Give the threshold a home in the new Settings, then remove the old
   screen** (Jack, 19 Oct: "lets do 1"). Drawn first as
   `bk-settings-reserve`: "Time kept free each day" under Notice in
   Settings › Workshop › Online booking, "For lunches, admin and little jobs
   between bikes", with "Online booking treats a day as full once less than
   this is left." Removing the old screen is allowed once its replacement
   is merged (CLAUDE.md, allowed rule 5).
2. **The booking mode reworded** (Jack, 19 Oct: "I want the drop-off
   question to be more suited towards how a bike is booked in for a certain
   time versus how a bike is booked in for a whole day. Then we can tell the
   customer to drop it off at a certain time regardless"). In Settings ›
   Workshop › Online booking, "How customers book / Customers choose: An
   exact time to arrive / A day to drop off" becomes "How bikes are booked
   in / Bikes are booked in for: A set time / The whole day", with "A set
   time: the customer drops the bike off at the time they booked, for
   example 13:00 to 14:00. The whole day: they drop it off in the drop-off
   window, for example 09:00 to 10:00." (Answer 3 changed the set time's
   half to "before the time they booked".) The whole day shows the drop-off
   window (`bk-settings-whole-day`). The section's summary reads "Set
   times" or "Whole day". Wording only: the booking mode itself is the
   4 Sep decision's.
3. **With a set time, the customer drops the bike off before the booking**
   (Jack, 19 Oct: "we should prompt customer to drop their bike off before
   the booking time, if its in the 'set time' mode, rather than having the
   customer drop the bike off during that window"), as his 4 Sep example
   had it ("Please bring the bike in 30 minutes before your scheduled
   job"). The set-time choice shows "Drop off before the booking [30]
   minutes", the lead time the server already keeps (`timed_lead_minutes`,
   default 30); the customer's confirmation reads "Drop your [bike] off by
   11:00, half an hour before your booking at 11:30."
   The booking pages' "choose a time to arrive" and "arrive 11:30" become
   "choose a time" and "11:30" (the booked time), so only the confirmation
   tells the customer when to drop off. The built booking pages already
   show the booked time without "arrive"; telling the customer the drop-off
   time on them is a later piece (it needs the lead time on the booking
   link, Mark's `portal.js`).
4. **Notice in hours or in whole days** (Jack, 19 Oct: "can we change the
   notice section slightly, so that it can be in hours or just how many
   days out? say for example its 3pm and we want to have a customer be
   able to book a bike in for the next day, and if we just had the notice
   to 24 hours this wouldnt be possible"). Notice gets "hours" or "days";
   days count calendar days, so 1 day lets a customer book any time
   tomorrow, whatever the time now (`bk-settings-notice-days`). The server
   keeps notice only in minutes today (`min_notice_minutes`), so days need
   a server change (Mark's) when it's built.
5. **Drawings approved; build the time kept free and remove the old screen**
   (Jack, 19 Oct: "Approve the drawings; build the time kept free each day
   and remove the old Edit workshop screen. The mode switch,
   drop-off-before, notice in days and the customer's drop-off line come
   later"): `bk-settings-reserve`, `bk-settings-whole-day`,
   `bk-settings-notice-days`, and the booking pages' wording.
6. **The time kept free reworded so lunch isn't counted twice** (Jack, 19 Oct:
   "1: reword it to 'For the little jobs between bikes. Lunch and admin go
   in the diary as blocks, so don't count them here.' and show the shop's
   own value"), after the fresh review found the approved hint told shops
   to count lunch, which since 24 Sep is a diary block
   (`2026-09-04-booking-mode-and-downtime.md` §4.4; new shops keep none
   free, `server/auth.js`). The hint is "For the little jobs between
   bikes"; the note adds "Lunch and admin go in the diary as blocks, so
   don't count them here." The drawing shows [n], each shop's own value.
7. **Build the customer's drop-off line next** (Jack, 19 Oct: "lets do 1",
   offered as: the "Drop your bike off by 11:00, half an hour before your
   booking" line on the real booking pages, plus the "Drop off before the
   booking" setting, with one small addition in Mark's booking-link file).
8. **Build notice in hours or days next** (Jack, 19 Oct: "1", offered as:
   notice in hours or days, a small server change in Mark's area then the
   Settings row). Drawn in answer 4 (`bk-settings-notice-days`).
9. **The set time / whole day switch next, drawn first** (Jack, 19 Oct: "1",
   offered as: draw the "from which day" choice for approval, then build
   the switch and the drop-off window). Drawn: choosing the other mode opens
   "Book bikes in for the whole day?" (or "for a set time?"), "From a day
   you choose", with "Starting on" a date, "Tomorrow at the earliest", and
   "Bookings already made keep their set times. From that day, customers
   book a day and drop their bike off in the drop-off window."; Cancel or
   "Change from [date]" (`bk-settings-mode-change`). Once chosen, the
   section says "Changing to the whole day from [date]. Bookings already
   made keep their set times." with "Cancel the change"
   (`bk-settings-mode-scheduled`). This follows the 24 Sep decision (a
   change of mode from a date the shop chooses; bookings keep their shape).
10. **Drawings approved; build the switch** (Jack, 19 Oct: "Approve the
    drawings; build the set time / whole day switch with its start day, the
    change-coming-up line, and the drop-off window for the whole day"):
    `bk-settings-mode-change`, `bk-settings-mode-scheduled`,
    `bk-settings-whole-day`.
11. **"Show prices on the booking page" now; confirming automatically later**
    (Jack, 19 Oct: "1: build the Show prices switch now; automatic confirming
    is its own piece later"). The prices switch is stored already
    (`show_prices_online`); confirming automatically (`2026-10-01-book-a-repair-review.md`
    decision 8) isn't built anywhere and is mostly Mark's booking code
    (WP-4.2).
