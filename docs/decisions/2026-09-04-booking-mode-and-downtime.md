# Booking mode, and how a shop's downtime is modelled

**Date:** 4 September 2026
**Status:** **Booking mode — DECIDED by Jack, 4 September 2026** (§2).
**Downtime model — PROPOSED**, direction agreed by Jack, shape not specced (§4).
**Raised by:** Jack, while reviewing the customer-facing content work on the
booking portal.

**Affects:** `workshop_jobs` (a migration — see §5.1), `mechanicFreeMinutes()`
and the `/availability` route, the customer portal, and — for the first time in
this line of work — the **staff** diary in `public/app.js`. It supersedes §2.2
and §5.2 of `2026-09-04-job-type-before-diary.md`, which are corrected there.

Confidence tags: **[V]** verified · **[R]** reported · **[U]** unverified ·
**[NF]** searched, not found.

---

## 1. Two ways bike shops actually work

Jack: *"some shops book a bike in for the whole day. They'll just have a
customer drop it off in the morning, and they'll get to it at some point in the
day and fit it around all the other things. Some shops do have it like we have
now, where they're for set times."*

The product currently assumes the second. A customer picks 14:00 and the job
occupies 14:00–16:00.

## 2. Decided

1. **Booking mode is a per-shop setting**, not per job type. Jack considered and
   rejected per-job-type ("puncture — wait for it" alongside "service — leave it
   with us"): *"it would be per shop, not necessarily per job type."*
2. **In drop-off mode, everyone loses the time — staff included.** Jack: *"some
   shops are just built like the mechanic won't have a timed diary per se.
   They'll just have a list of jobs to get done during the day."* This is not a
   portal-only change.
3. **The confirmation copy carries a drop-off expectation, and it differs by
   mode.** Jack's examples: timed mode — *"Please bring the bike in 30 minutes
   before your scheduled job"*; drop-off mode — *"bring the bike in between 9
   and 10."*

**The two numbers in item 3 are shop settings, not literals.** Jack gave "30
minutes" and "9 and 10" as examples. Hardcoding either would put a claim about a
specific shop's policy in front of that shop's customers. Timed mode needs a
lead-time in minutes; drop-off mode needs a drop-off window (start and end).
Both need defaults, and the copy renders whatever the shop has set.

## 3. Why this is decided before the other open designs

Booking mode changes what the word "availability" means, so it sits underneath
the job-type filtering question rather than beside it.

| | Timed mode | Drop-off mode |
|---|---|---|
| Availability asks | Can a 2-hour job start at 14:00 without colliding? | Does this day still have 2 hours of unbooked capacity? |
| Answered by | Slot collision against other jobs and closing time | Total booked minutes against the day's capacity, less the reserve |
| The marked band (`job-type-before-diary` §4.2) | Applies | **Does not apply** — no time axis to draw a band on |
| The capacity reserve (§4 below) | A coarse backstop | **The entire booking rule** |

The second column is the important one. A drop-off shop running today's leaky
reserve (§4.1) would accept a full day's work and then one more job on top,
every single day.

## 4. Downtime

### 4.1 The defect, proven

`full_day_threshold_minutes` (default 120, `005_full_day_threshold.sql` **[V]**)
is meant to hold back part of the day for lunch, admin, and the parts of a
mechanic's shift that are not spent on a bike. It does not.

The gate asks whether free time is *already* below the threshold, never whether
the booking in hand would push it below — `freeMinutes <
full_day_threshold_minutes` (`server/server.js:3535`) **[V]**.

Run against a live server, not reasoned about **[V]**: a 09:00–18:00 day is 540
minutes; with 420 booked, exactly 120 are free. `120 < 120` is false, so a
120-minute service is accepted (`201 Created`) and the day ends with **zero**
free minutes. One booking consumes the whole allowance. Every day.

### 4.2 Why a threshold is the wrong shape for it

The number answers two unrelated questions at once:

- *When is this mechanic unavailable?* — a fact, located in time, belonging on
  the diary.
- *Should we stop taking work today?* — a policy, a quantity, belonging in
  settings.

Lunch is the first kind modelled as the second. That is why it cannot be placed
at 13:00, why no mechanic sees it on their own diary, and why a customer watches
a day vanish with no reason given (see the corrected §2.2 of
`job-type-before-diary`).

### 4.3 Options

1. **Recurring unavailability blocks per mechanic** — lunch 13:00–13:30 daily,
   admin 16:30–17:00 Fridays, as entries the diary knows about. In timed mode
   everything already built handles them: the portal renders busy time as
   hatched "Unavailable" with no detail leaked **[V]**, `checkJobSlot` prevents
   overlap **[V]**, and the §4.2 band routes around them with no extra logic. In
   drop-off mode they simply reduce the day's bookable minutes. **The same model
   works in both modes**, which is the strongest evidence it is the right shape.
2. **A per-job changeover buffer** — every booking reserves its duration plus a
   fixed margin. Models the real effect that nobody moves straight from one bike
   to the next, and scales with how busy the day is, where a flat daily
   threshold charges a packed day and an empty one identically. Does not cover
   lunch.
3. **Fix the existing gate to test after the booking** — reject when
   `free − jobLength < threshold`. Small. Makes the reserve genuinely hold.
   Still invisible and still unplaceable: a correctness fix, not a design.

### 4.4 Direction agreed

Options 1 and 3. Option 3 immediately, because today's behaviour is a defect
whatever else is decided, and because drop-off mode cannot ship without it.
Option 1 as the real answer — once lunch is a block, the threshold stops
carrying weight it was never shaped for and can shrink or go. Option 2 only if
shops report changeover time mattering separately from lunch; unmeasured **[U]**.

## 5. What exists already, and what is missing

### 5.1 The gap that decides the size of this work

**`workshop_jobs` stores no duration.** The table has `start_time` and
`end_time` and nothing else (`001_init_schema.sql:167-181`) **[V]**, and both
`mechanicFreeMinutes()` and the `/availability` query filter to rows where
`start_time` is non-empty **[V]**. An untimed job therefore contributes **zero**
busy minutes, so in drop-off mode every day computes as entirely free, forever.

Capacity in drop-off mode is impossible until a job's estimated minutes live on
the row. **This is a migration**, and it is the first thing a plan should
schedule. The estimate itself already exists at booking time — `PORTAL_JOB_TYPES`
sends 30/60/120 **[V]** — it is simply discarded once the job is written.

### 5.2 Encouraging: the staff list view largely exists

Drop-off mode's staff view — Jack's *"list of jobs to get done during the
day"* — is closer than expected. All **[V]** in `public/app.js`:

- `unscheduledJobsFor(dateStr, mechanicId)` (`:1774`) already collects jobs on a
  day with no start time.
- `renderUnscheduledCell()` (`:1813`) already renders them as a day cell rather
  than time-positioned blocks.
- `renderJobCard()` (`:1801`) already handles a job with no time — the time
  span is conditional on `j.startTime`.

So the schema tolerates untimed jobs and the staff UI can already draw them.
What is missing is the mode switch, the duration, and the capacity arithmetic.

### 5.3 Missing

1. A per-shop booking mode setting, and a staff UI to set it.
2. A duration column on `workshop_jobs` (§5.1).
3. Capacity from summed durations rather than from start/end times, in both
   `mechanicFreeMinutes()` and `/availability`.
4. A day-picker in the customer portal for drop-off mode.
5. Drop-off window and lead-time settings (§2, item 3).
6. The staff diary choosing list or grid by mode.

## 6. Open questions

1. **Can a shop change mode with jobs already booked?** Timed jobs becoming
   untimed is lossy; untimed becoming timed leaves every existing job with no
   time to show. Probably needs to be blocked, or to apply only from a date
   forward. Not decided.
2. **Does drop-off mode still assign a mechanic at booking time?** The portal
   currently requires one (`resolveJobMechanicId` **[V]**). A shop that fits work
   in around the day may prefer to assign later, which would change what the
   customer picks and what capacity is measured against.
3. **Whether "no room left that day" needs to say more.** §2.2 of the other
   document notes a full day is currently indistinguishable from a closed one.
   In drop-off mode this is the *only* signal a customer gets, so it carries far
   more weight.

## 7. Status of the work

Nothing here is implemented. The customer-facing content work merged alongside
it (durations, status words, badges, dates, legend, confirmation panel) is
independent of every decision in this document, except that the confirmation
panel is where §2 item 3's drop-off copy will land.
