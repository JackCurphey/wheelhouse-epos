# Ask the job type before showing the diary

**Date:** 4 September 2026
**Status:** **PROPOSED — not decided.** Raised by Jack on 4 September 2026 while
scoping customer-facing content work on the booking portal. Recorded here
because the content work was scoped and started first (Jack's call), and this
question would otherwise be lost in a chat log.
**Question raised by:** Jack — *"I'm wondering if it is better to ask them
beforehand, before they see the diary, what job they would like to book in.
When they see the diary, they can only see the slots that are available for the
job that they would like to book in, time-wise."*

**Affects:** `public-portal/portal.js` (the picker → auth → booking-form state
machine) and possibly the `GET /api/portal/:shopSlug/availability` contract.
It does not affect the staff diary, and it does not affect the server-side
booking validation, which stays authoritative either way.

Confidence tags: **[V]** verified · **[R]** reported · **[U]** unverified ·
**[NF]** searched, not found. Everything tagged **[V]** here was read directly
in the source files named.

---

## 1. How it works today

A customer lands on `/book/:shopSlug` and sees the week diary immediately. They
click an open slot, are sent through login / signup / continue-as-guest if they
are not already known, and only then reach the booking form where they choose
the job type. If the chosen job does not fit, `jobTypeFitError()` (`portal.js:179`) disables the
submit button and explains why. **[V]** `public-portal/portal.js`.

Three job types exist, defined server-side in `PORTAL_JOB_TYPES`
(`server/server.js:3372`) **[V]**:

| Value | Label | Minutes |
|---|---|---|
| `quick` | Quick fix (puncture, brake or gear adjustment) | 30 |
| `repair` | Repair (part replacement, wheel truing, etc.) | 60 |
| `service` | General service (full safety check & tune) | 120 |

The durations are already sent to the client on the `/mechanics` call, before
any slot is picked **[V]** — so the data needed to filter is already in hand at
the moment the diary first renders. No new endpoint is required to ask the
question earlier.

## 2. The case for asking first

### 2.1 The grid is currently wrong in both directions

`DEFAULT_JOB_DURATION_MIN = 60` is a fixed proxy: the grid decides what looks
free by checking a flat sixty minutes regardless of the job **[V]**
`portal.js:49`. The file's own comment acknowledges this and accepts the
resulting conflict as "the same tradeoff the rest of this booking flow already
makes."

Two consequences follow, and they point opposite ways:

- **Under-selling.** A 30-minute quick fix is shown as unavailable in any gap
  shorter than an hour. A 45-minute window that would take the job comfortably
  is hidden. The shop loses bookings it could have accepted and never learns it
  happened.
- **Over-promising.** A 120-minute service appears bookable at 16:30 against an
  18:00 close. The customer finds out it is not, later.

### 2.2 `fullDays` has the same blindness one layer down

The availability route computes free minutes per mechanic-day and marks the day
full when the total falls below `full_day_threshold_minutes`
(`server/server.js:3415-3437`) **[V]**. It merges overlapping jobs so time is
not double-counted, but it compares a **total**, not a contiguous block.

So a day with 90 free minutes split across three separate 30-minute gaps is not
marked full, yet cannot take a 60-minute repair. And a day with 100 contiguous
free minutes is marked full under a 120-minute threshold, though a quick fix
would drop into it without trouble. The portal renders full days as
unbookable, exactly like a closed day **[V]** `portal.js`.

Knowing the duration up front is the only change that addresses §2.1 and §2.2
coherently. Every alternative is a patch on a grid that is guessing.

### 2.3 The current flow fails in the most expensive place

A customer can click 16:30, be sent through account creation, and only then be
told the job does not fit. `jobTypeFitError()` exists because the flow permits
reaching an invalid state — it is a guard on an ordering problem, not a
feature. Asking first removes the state rather than guarding it.

### 2.4 It asks the question the customer can answer

Customers know what is wrong with the bike. They are usually flexible about
when. Asking the known thing in order to filter the flexible thing is the right
way round.

## 3. The case against a hard gate

Putting a required question **in front of** the diary costs something real. The
diary as the landing view proves, at a glance and with no effort from the
visitor, that the shop has slots this week. Someone arriving cold from a shop's
storefront would instead land on a form. That is a conversion cost, and it is
not obviously smaller than the problems in §2.

## 4. Recommended shape (Claude's recommendation, not a decision)

Keep the diary as the landing view. Put the job-type selector above it as a
persistent, always-visible filter that re-renders availability on change.
Nobody is blocked from seeing availability; everybody sees availability filtered
to what they are actually booking.

## 5. Costs and open questions

1. **Wrong guesses become silent.** Today, choosing "service" when you meant
   "quick fix" produces a visible error. Under filtering it quietly hides slots,
   and a customer may read a sparse week as a fully booked shop. **This is the
   main risk of the change.** It argues for the filter stating its effect
   conspicuously at all times — *"Showing times that fit a 2-hour general
   service — change"* — never a quiet dropdown.
2. **`fullDays` has to change or move, on both routes.** A day marked full may
   still fit a 30-minute job. Either the threshold check moves client-side
   against the chosen duration, or `/availability` starts accepting a duration
   parameter. Note this is not only a display problem: the booking POST applies
   the same duration-blind gate independently — `mechanicFreeMinutes()` against
   `full_day_threshold_minutes`, rejecting with *"That mechanic is fully booked
   that day"* (`server/server.js:3534`) **[V]** — so a short job filtered *in*
   by a smarter client would still be refused by the server. Both sides move or
   neither does. **This is the part of the change that is not small**, and it is
   the main open question for a spec. Not yet decided either way.
3. **It assumes a short list.** Three job types is a comfortable pre-question.
   If the merged service catalogue (JOB-12/13, PR #24) ever feeds this list,
   a pre-question across twenty services is a materially worse experience and
   this design would need revisiting.
4. **Server-side validation stays regardless.** `checkJobSlot()` (`server/server.js:3543`)
   re-checks fit against closing time and every other booked slot, and must
   continue to **[V]**. The client is never authoritative. This change stops
   customers meeting that error; it does not retire it.

## 6. What would falsify the recommendation

- **Customers not knowing their job type.** If shops report that customers
  routinely pick the wrong category, filtering on that answer hides the wrong
  slots, and §5.1 becomes the dominant effect rather than a manageable one.
  Unmeasured **[U]** — there are no customers yet.
- **The service catalogue replacing `PORTAL_JOB_TYPES`.** See §5.3.

## 7. Status of the work

Nothing in this document has been implemented. The customer-facing content work
scoped alongside it — job durations shown to customers, status labels, a
persistent booking confirmation, a diary legend — was chosen to go first and is
independent of the outcome here.
