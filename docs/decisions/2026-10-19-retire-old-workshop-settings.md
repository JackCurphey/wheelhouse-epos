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
   window, for example 09:00 to 10:00." The whole day shows the drop-off
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
