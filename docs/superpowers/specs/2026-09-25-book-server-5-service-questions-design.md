# Book server work, piece 5: service questions

**Date:** 2026-09-25. **Approved in session by Jack** (design, 25 Sep, in
three parts). **Not yet reviewed as a written spec** — Jack reviews this file
before the plan is written.
**Serves:** book screen `problem` (03) ("Service questions appear here, not in
a separate survey"), staff screens `services` (65) and `service-edit` (66)
("Ask as few or as many as this service needs"; "Existing job answers are
preserved when templates change").
**Part of:** the server prerequisite work for journey plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md:59`, item 3 gap table:
"Service questions ... no table, no route"). Piece 5 of six; Release 1 per
decision J2 (`docs/decisions/2026-09-23-book-journey-routing-and-modes.md:52`).
Pieces 1-4 merged (#64-#69). Piece 6 (customer uploads) is out of scope.

## Decisions this rests on (Jack, 25 Sep)

1. **Server side of both halves.** Staff set a service's questions through the
   server; the customer service list carries them; a booking saves the answers.
   No screens.
2. **Two kinds of question:** free text, and pick one from a list. Yes/no is a
   two-choice list.
3. **A "required" switch on each question**, off by default. A booking missing
   a required answer is refused with a clear message.
4. **"I'm not sure" is a switch on each list question** (not free text), on by
   default. The shop never types it; the customer sees it as an extra, last
   choice. Choosing it counts as an answer for a required question.
5. **The private link (piece 4) shows the questions and the customer's
   answers.**
6. **Questions are one ordered list stored on the service**, not separate
   tables. Staff save the whole list at once.
7. **Answers are a frozen copy on the booking**: each question's wording as
   asked, plus the answer. Rewording, reordering or deleting a question later
   does not change an earlier booking (as `booked_price` in #68).
8. **Limits:** up to 10 questions per service; wording up to 200 characters;
   list questions have 2 to 10 choices, each up to 100 characters; a free-text
   answer up to 1,000 characters.
9. **Each question has a permanent hidden id**, given by the server the first
   time it is saved. Rewording keeps it; delete and re-add gives a new one.
10. **Questions changed mid-booking:** answers are matched by id. If they do not
    match the service's current questions (an answered question is gone, or a
    new required one appeared), the booking is refused — "The questions for
    this service have changed — please check them and try again" — and nothing
    is saved.

## What is built

### Storage (migration 028)

- `workshop_services.questions JSONB NOT NULL DEFAULT '[]'` — the ordered list.
  Each item: `{ id, wording, kind: 'text' | 'choice', required, choices?,
  allowNotSure? }` (`choices` and `allowNotSure` only on `choice`).
- `workshop_jobs.question_answers JSONB`, nullable — the frozen copy. Each
  item, in the order asked: `{ id, wording, kind, answer }`, where `answer` is
  the text, the chosen option's wording, `{ notSure: true }`, or null for an
  optional question skipped. Null for "not sure" bookings, staff jobs, and
  bookings made before piece 5.

### Staff: `POST` / `PUT /api/workshop-services`, `GET` the service

- Take and return `questions` (added to `serializeWorkshopService`). A `PUT`
  that omits `questions` keeps the stored list, as `active`, `bookableOnline`
  and the placement fields already do (`name` and `price` stay required;
  `minutes` is cleared when omitted — unchanged by this piece).
- Validation refuses, with a plain message: missing wording, an unknown kind,
  a choice question with fewer than 2 or more than 10 choices, duplicate
  choices, more than 10 questions, anything over its length limit.
- The server assigns ids to questions that have none; an id sent by the caller
  is kept only if it already belongs to this service's stored list.
- The routes are already covered by `scripts/ci/assert-screen-trace.mjs`, and
  every one already reads `// screens: services, service-edit`; no change.

### Customer service list: `GET /api/portal/:shopSlug/services`

- Each service (today `{ id, name, price, minutes }`) gains `questions`:
  `id`, `wording`, `kind`, `required`, `choices`, `allowNotSure`. The route's
  `WHERE active = 1 AND bookable_online = 1` keeps staff-only and retired
  services excluded.

### Booking: `POST /api/portal/:shopSlug/bookings`

- New optional input `answers`: a list of `{ questionId, text }`,
  `{ questionId, choice }`, or `{ questionId, notSure: true }`.
- Checked before any database write: right after the service lookup and
  before the guest branch (`resolveGuestCustomer`, the first write): every required question answered;
  a choice is one of the question's current choices; `notSure` only where
  `allowNotSure`; text within its limit; no answer for a question this service
  does not have (that is the "questions have changed" refusal, decision 10);
  answers sent with `notSure: true` bookings refused.
- The frozen copy is written in the same insert as the job, passed through
  `createWorkshopJob` (as `booked_price` is).

### Where answers appear

- Staff job view (`serializeWorkshopJob`) gains `questionAnswers`.
- The private-link read-back (piece 4) gains `answers`: `{ wording, answer }`
  in order, the same shapes as storage.

## Tests (written first, each seen failing)

- Migration: both columns, types, defaults.
- Staff: a list saves and comes back in order; ids are assigned and survive a
  reword; a PUT without `questions` keeps them; each validation rule refuses.
- Customer list: questions included; staff-only service still hidden.
- Booking: good answers store the frozen copy; rewording and deleting a
  question afterwards leave it unchanged; skipped optional questions stored as
  null.
- Refusals, each leaving no job and no stray customer: missing required
  answer, choice not on the list, `notSure` where switched off, text too long,
  unknown question id, answers on a "not sure" booking.
- Staff job view and private link show the answers.

## Out of scope

- All screens: the question editor, questions on the booking page, answers on
  staff screens. Each is brought to Jack separately.
- Conditional questions (shown depending on an earlier answer); the atlas
  notes the brake example should be conditional "in production" with no rule.
- Photo answers (piece 6), inspection checklists, reporting on answers.

## Checked against the code (25 Sep, before planning)

`readServiceBody` / `readServicePlacement` and the service routes
(server/server.js 3954-4060), the portal service list (4432),
`serializeWorkshopJob` (2366), the booking route (4565) and the private-link
read-back (4749) were read. Corrections made above: the `// screens:` lines
already name `service-edit`; "PUT keeps omitted fields" is true only of some
fields; the answers check sits after the service lookup, before the guest
branch. Migration 027 is the latest merged, so this is 028.
