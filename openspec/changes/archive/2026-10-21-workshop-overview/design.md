# Design

## Data
- Two reads, merged by job id:
  - today's jobs: `GET /api/workshop-jobs?start=<today>&end=<today>`, as the diary reads a day;
  - every job with the bike in the shop: `GET /api/workshop-jobs?custody=in_shop`.
- **Live** means a booking that stands: `bookingState` is `scheduled` or `reschedule_requested`. Requests, offers, and cancelled, declined or expired bookings are left out.
- What each figure and tab counts:
  - **Expected today**: live jobs whose first day (`jobDate`) is today. "Still to arrive" counts those whose custody is `expected`.
  - **In the workshop**: custody `in_shop`. "Ready to collect" counts those with work `complete`.
  - **Arrivals**: live, `jobDate` today, custody `expected`.
  - **Shared queue**: live, no mechanic, custody `expected` (today) or `in_shop`, work not `complete`.
  - **Needs attention**: custody `in_shop`, work `waiting_parts` or `on_hold`.
  - **Ready**: custody `in_shop`, work `complete`.
- Rows are sorted by `jobDate`, then start time; a job with no time comes last.
- "Due" for Book in means the appointment is no more than an hour away or has passed. A drop-off (no time) is due all day, so its Work reads "[work] · drop-off" and it gets Book in, where the drawing has "Drop-off" in its action cell. The drawing gives Book in to the 11:30 row and the time to a 10:30 one, so it implies a rule without stating it (logged).
- A job in the shop gets the drawing's "Open job" in its action cell (Needs attention's rows). Its Work adds "· waiting for parts" or "· on hold".
- Book in is `POST …/book-in` with the job's version, then both reads refresh. A refusal shows its words over the table, as the job page does.
- The page's heading is the shell's "Overview" (the nav label), as Diary and Till are.

## The server filter
`custody` on `GET /api/workshop-jobs` takes `in_shop`, `expected` or `collected` and adds `AND w.custody_state = ?`. It can be combined with `start`/`end`. Any other value is a 400.

## Contract for Mark (later): Planned effort
`GET /api/workshop-capacity` adds, per day, `plannedMinutes` (the timed and shared work booked that day, overlaps counted once) and `availableMinutes` (the mechanics' working time inside opening hours, minus blocks). Both come from `computeCapacity`, which builds `availableWindows` and then drops it. Then the Overview's third figure reads "Nh / Nh" with the drawn fill bar (audit M7).
