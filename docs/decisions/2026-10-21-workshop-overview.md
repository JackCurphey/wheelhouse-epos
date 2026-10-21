# The Workshop Overview page: questions while building

The staff app's Workshop › Overview (`/workshop/overview`, drawn as
`overview` in `docs/design/user-journeys/generator/diary.mjs`) shows "Not
built yet". The drawing shows three figures, four tabs and a table of jobs,
but no recorded decision says what each figure counts or each tab lists.

## Answers

1. **Build it now.** Jack, 21 Oct: "1: build the Workshop Overview page now
   (pulled forward from WP-2.1), to its drawing." (The split plan had it in
   stage 4, needing block 3; the drawing itself has no search or filters,
   only the four tabs.)
2. **What it counts and lists.** Jack, 21 Oct: "Yes: build the Workshop
   Overview with those definitions, Planned effort left out and handed to
   Mark." The definitions, as proposed: everything is for today (the shop's
   own date).
   - *Expected today*: bikes booked for today, with "N still to arrive"
     (not yet booked in).
   - *In the workshop*: bikes in the shop now, with "N ready to collect".
   - *Planned effort*: left out until Mark's capacity figures give it (a
     contract for him).
   - *Arrivals*: today's bookings not yet in: Book in when due, else the
     appointment time or "Drop-off".
   - *Shared queue*: today's and in-shop jobs with no mechanic.
   - *Needs attention*: waiting for parts (walk-through 2 Oct) and on hold.
   - *Ready*: in the shop with the work finished.
   - Sorted by time; Open job opens the job's page in the diary; the Custody
     column reads "Expected" or "In the shop" until storage slots exist.
