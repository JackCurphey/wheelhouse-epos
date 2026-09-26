# Book server piece 10: minimum notice and the shop's time zone

**Date:** 2026-09-26. **For:** d4 (`2026-09-26-book-d4-date-screen-design.md`),
which needs this merged first. **Approved by Jack, 26 Sep**, including
migration 033.

## Why

Customer availability offered start times earlier today that had already
passed, drop-off days after their window had closed, and the booking route
accepted past dates. The server's "today" is the UTC date (`utcToday`), an
hour behind UK time in summer. `timed_lead_minutes` is not a notice period:
it is how early a customer is asked to arrive.

## Decisions (Jack, 26 Sep)

1. A per-shop **minimum notice**, default 2 hours (120 minutes). No staff
   screen yet; every shop runs on the default until one exists.
2. A per-shop **time zone**, default UK time (`Europe/London`).
3. The rule is enforced by the server (availability and the booking route),
   not only hidden on screen.

## Changes

- **Migration `033_booking_notice_timezone.sql`:** `workshop_settings` gains
  `min_notice_minutes INTEGER NOT NULL DEFAULT 120` and `time_zone TEXT NOT
  NULL DEFAULT 'Europe/London'`. Additive only.
- **Staff settings** (the existing workshop settings GET/PUT): return and
  accept `minNoticeMinutes` and `timeZone`, omitted on PUT keeps the stored
  value.
  - `minNoticeMinutes`: an integer 0-10080, else "Minimum notice must be
    between 0 minutes and 7 days".
  - `timeZone`: a zone the runtime's `Intl` recognises, else "That time zone
    isn't recognised".
- **The shop's clock:** one server clock function (the only place that reads
  the real time), which tests can pin to a fixed moment. From it and the
  shop's `timeZone`: the shop's **today** (a date) and **now** (a date and
  minutes past midnight, in the shop's local time, honouring summer and
  winter time). The **earliest bookable moment** is now plus
  `minNoticeMinutes`, which can fall on a later date.
- **"Today" everywhere the server uses it** (`utcToday` call sites: the
  scheduled booking-mode change) becomes the shop's today.
- **GET `/api/portal/:shopSlug/availability`** (the `days` part, when
  `minutes` is given):
  - a date before the shop's today: timed, no start times; drop-off, no
    mechanic bookable;
  - timed: start times earlier than the earliest bookable moment are removed;
  - drop-off: a date is bookable only if the earliest bookable moment is
    before that date's drop-off window end.
  The legacy `busy` / `fullDays` view is unchanged.
- **POST `/api/portal/:shopSlug/bookings`**, inside the existing booking
  lock, beside the capacity checks:
  - a `jobDate` before the shop's today: refused, "That date has passed -
    please choose another day."
  - a timed start before the earliest bookable moment, or a drop-off date
    whose window end is not after it: refused, "That's too soon for the shop -
    please choose a later time or day." A timed start exactly at the earliest
    bookable moment is offered and accepted (amended 26 Sep: the boundary is
    inclusive, so what availability offers the booking route accepts). A
    drop-off day stays as availability states it: bookable only while the
    earliest bookable moment is before the window end.
  Both use the route's existing refusal style and status for business-rule
  refusals.

## Tests (written first, each watched failing)

- Existing tests keep their fixed September 2026 dates by running with the
  clock pinned before them; none is rewritten for the clock.
- New tests (in the availability, booking and settings test files):
  - settings: defaults returned; each field accepted, kept when omitted,
    refused out of range or unrecognised;
  - availability: past date offers nothing; today's times before now +
    notice removed, later ones kept; notice spilling into the next day;
    drop-off today offered before the window closes and not after;
  - booking: past date refused; too-soon time refused; a time just after the
    earliest moment accepted; drop-off too late for today refused;
  - time zone: on a UK clock-change day and in summer, "now" is local time,
    not UTC; a non-UK zone moves "today".
  - the mode-change "today" uses the shop's time zone.

## Not in this piece

- A staff screen for minimum notice and time zone.
- Using `timed_lead_minutes` in the customer's confirmation.
