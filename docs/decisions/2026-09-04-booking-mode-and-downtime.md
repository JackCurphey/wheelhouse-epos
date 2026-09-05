# Booking mode, and how a shop's downtime is modelled

**Date:** 4 September 2026
**Status:** **Booking mode — DECIDED by Jack, 4 September 2026** (§2).
**What the customer picks — DECIDED by Jack, 5 September 2026** (§7), with two
sub-decisions still open (§7.6).
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

### 5.1 Where a job's duration comes from

**Revised 4 September, after Jack's clarification.** An earlier version of this
section concluded that a duration column on `workshop_jobs` was needed and was
"a migration, the first thing a plan should schedule". That is probably wrong.
The correction matters enough to keep visible.

The problem is real: `workshop_jobs` has `start_time` and `end_time` and nothing
else (`001_init_schema.sql:167-181`) **[V]**, and both `mechanicFreeMinutes()`
and the `/availability` query filter to rows where `start_time` is non-empty
**[V]**. An untimed job contributes **zero** busy minutes, so in drop-off mode
every day computes as entirely free, forever.

What was missed is that the durations already have a home. Jack: *"every job
item will have a time associated with it when we create it — a gear service
will be 45 minutes, a puncture 10 minutes, a general service 2 hours. The time
we just have in the cells currently is just an estimate before we add that
feature."* That feature is largely built:

- `workshop_services` carries `minutes` per service
  (`014_workshop_services.sql:9`) **[V]**.
- Labour lines carry `service_id` and `minutes` on `sale_document_items`
  (`014_workshop_services.sql:24-26`) **[V]**, and every workshop job already
  gets an order those lines can hang from.
- The portal uses **none** of it. `POST /bookings` creates the job with an
  auto-order and no labour lines (`server/server.js:3583`) **[V]**; the chosen
  job type only sets `end_time` via `addMinutesToTime`. `PORTAL_JOB_TYPES`
  (30/60/120) is placeholder scaffolding, and Jack has confirmed it as such.

### 5.1.1 The split this implies

**Duration is a property of the job's services. Start time is a property of the
schedule.** Today the two are conflated: duration is only expressed as
`end_time − start_time`, which is exactly why it evaporates when the times go
away. Under the split, `end_time` becomes *derived* in timed mode, and in
drop-off mode there is no schedule at all and the services carry the duration
alone. One rule, both modes.

It also means a job's duration is a **sum**, not a single value — a puncture
plus a gear service is 55 minutes — because the line model already permits
several services on one job.

### 5.1.2 Open fork: derive or denormalise

Not decided, and it should be decided before anything is built.

1. **Derive** — sum `sale_document_items.minutes` for the order linked to the
   job. No migration, one source of truth, no drift. Cost: every availability
   query becomes a join and aggregate across two more tables, and availability
   is the hottest read path in the portal.
2. **Denormalise** — keep a summed `estimated_minutes` on `workshop_jobs`,
   written whenever the lines change. Capacity queries stay flat and fast. Cost:
   a migration, and a second copy of a fact that can drift from the lines.

The earlier version of this document assumed option 2 without noticing option 1
existed.

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
2. A resolution to §5.1.2 — derive durations from labour lines, or denormalise
   them onto the job.
3. The portal offering the shop's own `workshop_services` in place of the
   hardcoded `PORTAL_JOB_TYPES`, and writing a labour line when a booking is
   made, so a job carries its real duration. See §6.3 for the cost of this.
4. Capacity from summed durations rather than from start/end times, in both
   `mechanicFreeMinutes()` and `/availability`.
5. A day-picker in the customer portal for drop-off mode.
6. Drop-off window and lead-time settings (§2, item 3).
7. The staff diary choosing list or grid by mode.

## 6. Open questions

1. **Can a shop change mode with jobs already booked?** Timed jobs becoming
   untimed is lossy; untimed becoming timed leaves every existing job with no
   time to show. Probably needs to be blocked, or to apply only from a date
   forward. Not decided.
2. **Does drop-off mode still assign a mechanic at booking time?** The portal
   currently requires one (`resolveJobMechanicId` **[V]**). A shop that fits work
   in around the day may prefer to assign later, which would change what the
   customer picks and what capacity is measured against.
3. ~~**What the customer picks, once the catalogue replaces
   `PORTAL_JOB_TYPES`.**~~ **Answered 5 September — see §7.**
4. **Whether "no room left that day" needs to say more.** §2.2 of the other
   document notes a full day is currently indistinguishable from a closed one.
   In drop-off mode this is the *only* signal a customer gets, so it carries far
   more weight.

## 7. What the customer picks

**DECIDED by Jack, 5 September 2026.** This answers the question raised as §6.3.

### 7.1 The decision

1. **A per-item visibility flag on the service catalogue.** Jack: *"a flag on a
   workshop job item. It just decides whether it is visible on the customer
   booking or not, so that each shop can decide what jobs they would like to
   show on the online booking system."* The shop ticks which services a customer
   may book online; the rest stay internal.
2. **An escape hatch at the bottom of the list** — *"Not sure"* or *"Something
   not listed?"* — for the customer who cannot place their problem in the
   shop's terms.

### 7.2 Why the full catalogue does not go in front of a customer

The catalogue is written in mechanic language and organised by *work performed*
— "rear mech index", "bottom bracket service", "wheel true". Customers arrive
with symptoms ("gears slipping", "creaking when I pedal") or with nothing beyond
"it needs looking at". Showing them the internal list asks them to complete the
diagnosis before a mechanic has seen the bike.

The visibility flag keeps the two lists deliberately different things rather
than letting one leak into the other.

### 7.3 Why the stakes are lower than they look

The customer's choice does not have to be correct. Every portal booking is
written with status `pending` (`server/server.js:3591`) **[V]**, and staff can
change a job's start and end times when they review it
(`server/server.js:2423-2425`) **[V]**. The customer's pick is an estimate with
a human check already in the path — not a commitment. This is what makes a short
list plus an escape hatch sufficient, where otherwise it would need to be a
diagnosis tool.

### 7.4 Customers pick one thing, not several

The line model permits several services on one job (§5.1.1), but a customer
should not be assembling a basket of labour — that is the same mistake as the
long list, in a different shape. One selection, plus the free-text *"What do you
need done?"* box the portal already has **[V]**. The mechanic adds any further
lines at approval, where the pricing has to be checked anyway.

### 7.5 Cost

- One column on `workshop_services` (it currently carries only `active`
  **[V]**), and a migration.
- A staff toggle wherever services are managed.
- The portal reading bookable services in place of the hardcoded
  `PORTAL_JOB_TYPES`.

No taxonomy, no symptom-to-service mapping table, nothing for a shop to maintain
beyond a checkbox.

### 7.6 Still open, and both needed before this is built

1. **What duration does "not sure" book?** It must have one — capacity is
   computed from durations (§5.1), and in drop-off mode capacity *is* the
   booking rule (§3). Recommended: a shop setting for an inspection slot,
   defaulting to something short, with the mechanic extending at approval.
   Taking the shop's shortest bookable service instead would be automatic but
   arbitrary. **Not decided.**
2. **Whether customers see prices.** `workshop_services` carries `price`
   **[V]**, so rendering catalogue entries to customers exposes it unless
   deliberately suppressed. Some shops price online happily; others treat it as
   an invitation to be undercut. This is a per-shop business decision, not a UI
   default, and it should be settled before the picker is built rather than
   discovered when a shop finds their labour rates public. **Not decided.**

### 7.7 Deliberately not built: symptom-first

The better long-term experience is a plain-English symptom list ("gears aren't
shifting properly") mapped behind the scenes to catalogue services that supply
the duration. Held back on purpose: it requires every shop to maintain a
symptom-to-service mapping, which is configuration work a shop will not do
during onboarding, and a half-filled mapping is worse than none — it produces
confidently wrong durations. Worth revisiting once there are design partners who
will tune it.

## 8. Status of the work

Nothing here is implemented. The customer-facing content work merged alongside
it (durations, status words, badges, dates, legend, confirmation panel) is
independent of every decision in this document, except that the confirmation
panel is where §2 item 3's drop-off copy will land.
