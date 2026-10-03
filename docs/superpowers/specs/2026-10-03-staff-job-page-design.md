# The staff job page

**Building under Jack's standing go-ahead (3 Oct 2026: "keep going and
merging … for the rest of this session")**, after the diary's pieces 1–5a.
The design is approved: journey 12, Workshop day (decisions 16, 20, 24, 30,
32, 35, 38–40, 46, 50, 51, 58), drawn as job-overview, job-book-in,
job-mechanic, job-waiting-parts, job-finished and job-collection in
`docs/design/user-journeys/generator/diary.mjs` and `job-page.mjs`.

## The pieces

1. **This piece: opening a job and moving it on.** The pop-up, read-only
   details, and the stage buttons the server already supports.
2. Editing notes and details (PUT with the version).
3. Work and parts: adding items to the job's order.
4. Take payment (journey 5) and the quote stage (journey 4).
5. Checklist, bike tag, storage hook, history: each needs server work first.

## Piece 1

- **Opening:** a click on a diary block, or Enter on it, opens the job as a
  near-fullscreen pop-up over the diary (decision 16); on a phone it fills
  the screen. Moving a job by keyboard becomes M, then the arrows (Enter
  now opens, as a button does).
- **Header:** the job title, a status badge, Close.
- **Customer strip** (decision 58): the customer's name, phone and email
  (from `GET /api/customers/:id`); the bike, "Mechanic: …" as plain text
  (decision 32), "Ready by" the diary day (decision 51), and the order total
  when there is one.
- **Job details:** WH number, created date, the diary time.
- **Notes:** "From the customer" (their booking words) above the job's
  notes, read-only in this piece.
- **Work and parts:** the job's order lines, read-only, with the total.
- **Stage button** (decisions 30, 35), from the job's states:
  - bike expected → **Book in**;
  - in the shop, not started → **Start work**;
  - being worked on → **Mark ready for collection**, and **Waiting for parts**;
  - waiting for parts → **Parts arrived**;
  - on hold → **Resume**;
  - finished, bike still here → **Hand over**;
  - collected → no button.
  A booking request still to be answered shows no stage button; it is
  answered from Waiting for you.
- Each action sends the version the page saw; a stale job says so and
  reloads, as elsewhere.

**Status words** (the badge): Booking request, Expected, In workshop,
Waiting for parts, On hold, Ready for collection, Collected.

Not in this piece: Take payment, the quote stage, the checklist, bike tag,
storage hook, history, the customer's link to their account, and the
Message / Email / Notes buttons.

## Tests first

`tests/screens/job-page.test.js`: opening from a block (click and Enter);
header, customer strip, details, notes and lines; each stage's button and
the action it sends; a stale action; M to move still works. Watched
failing first.

## Piece 2: editing (built 3 Oct)

- **Notes** (decision 38): one plain box under the customer's own words,
  saved with **Save notes** once something has changed (never by itself;
  "Don't close things by themselves" is in the same spirit). "Notes saved."
  confirms it. A job someone else changed first keeps the typed words in the
  box and says so.
- **Bike is here** (decision 50): a toggle pill in the job details. Turning
  it on books the bike in; once the bike is in it stays on.
- **Remove a day**: each later day in the Days list has Remove; day 1 has
  none.

Title, customer and bike stay as set on New job; the drawings don't edit
them on the job page.
