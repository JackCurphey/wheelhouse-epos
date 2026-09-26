# Book server piece 9: the bike note, an optional description, and words on choice answers

**Date:** 2026-09-26. **For:** d3 (`2026-09-26-book-d3-problem-screen-design.md`),
which needs this merged first. **Approved by Jack, 26 Sep**, including
migration 032.

## Why

The problem screen (d3) asks for the bike in the customer's own words, makes
the description optional unless the customer is "Not sure", and lets a
customer type words as well as, or instead of, tapping a quick answer. Staff
today see an online booking only through the job's Notes (the description is
copied there); question answers are stored but shown to staff nowhere.

## Decisions (Jack, 26 Sep)

1. The bike words are a note on the booking, not a `customer_bikes` row.
   Staff create the real bike at check-in.
2. The description is required only when `notSure` is true.
3. A choice question's answer may carry typed words with or without a
   choice; a required question is answered by a choice, words, or
   "I'm not sure".
4. Staff see the bike note, the answers and the description in the job's
   Notes, as well as the values being stored separately.

## Changes

- **Migration `032_booking_bike_note.sql`:** `ALTER TABLE workshop_jobs ADD
  COLUMN customer_bike_note TEXT;` Additive only.
- **POST `/api/portal/:shopSlug/bookings`:**
  - `bikeNote`: optional. Absent, null or blank after trimming stores null.
    A non-string is refused with "Your bike description must be text"; over
    200 characters after trimming with "Your bike description can be up to
    200 characters". Stored in `customer_bike_note`. `newBike` and `bikeId`
    are unchanged.
  - `description`: trimmed; required only when `notSure` is true ("Please
    describe what you need done", unchanged). Otherwise empty stores null.
  - The job title is "Online booking: <services> - <description>" as today,
    or "Online booking: <services>" when there is no description (still cut
    to 200 characters).
  - Notes: the lines below, in order, joined by line breaks, leaving out any
    that are empty:
    1. "Bike (customer's words): <note>"
    2. for each answered question, in the stored order: "<wording> <answer>",
       where the answer is the choice (or "I'm not sure"), then " - " and the
       words when both are given, or the words alone
    3. "Customer's description: <description>"
- **`checkAnswers` (`server/service-questions.js`):** for a choice question,
  `text` is accepted with or without `choice` (a string, trimmed, at most
  1,000 characters, "An answer can be up to 1,000 characters"). `notSure` and
  `choice` stay mutually exclusive as today. The stored entry keeps its shape
  `{id, wording, kind, answer}` and gains `text` (the trimmed words or null)
  on choice questions, so readers of `answer` are unaffected. A required
  choice question with no choice, no `notSure` and no words is refused with
  "Please answer: <wording>" as today.
- **GET `/booking-links/:code`:** the reply gains `bikeNote` (string or null),
  and each answer gains `text` when the stored entry has it.

## Tests (written first, each watched failing)

In the existing booking test files (`tests/portal-booking-request.test.js`,
`tests/portal-booking-answers.test.js`, `tests/portal-booking-link.test.js`):
- the note is stored, trimmed, and creates no bike; blank stores null; a
  non-string and a 201-character note are refused
- a service booking with no description succeeds, with the short title; a
  "Not sure" booking with no description is still refused
- a choice answer with words only, with a choice and words, and a required
  choice question answered by words alone; over-long words refused
- the Notes text for a booking with all parts, and with none
- the link read-back returns `bikeNote` and each answer's `text`

## Not in this piece

- A staff screen showing the note and answers outside Notes, and turning the
  note into a bike record.
- Removing `newBike`.
