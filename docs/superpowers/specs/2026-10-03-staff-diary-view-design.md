# The staff diary, piece 1: seeing the week and the day

**Asked for by Jack, 3 Oct 2026** ("just continue building if you can"),
after the shell (PR #97). The design is approved: journey 12, Workshop day
(`docs/decisions/2026-09-27-workshop-day-review.md`, decision 69), drawn by
`docs/design/user-journeys/generator/diary.mjs` (`diary-desktop`,
`diary-day-desktop`, the tablet boards).

## The pieces of the diary

1. **This piece: seeing it.** Week and Day views, the toolbar, the "Waiting
   for you" column, the legend. Nothing changes a job yet.
2. Answering what's waiting: the request pop-ups (accept, decline, change,
   cancellation seen), using the existing routes.
3. Moving jobs: drag to another time or mechanic (`PUT /api/workshop-jobs/:id`).
4. The phone diary: one day as a timeline, the Waiting sheet.
5. New job, the hover summary, stacks that fan out, the right-click menu.
6. Multi-day jobs as one block per day (decision 52, settled 3 Oct); this
   needs a database change, so it is asked about first.

## Intent (piece 1)

`/workshop/diary` shows the shop's real jobs the way the drawings do, so
staff can see the week at a glance and what is waiting for them.

## Approach

- **Data**, all existing routes: `GET /api/workshop-jobs?start&end`,
  `GET /api/employees?role=mechanic`, `GET /api/workshop-settings` (opening
  hours) and `GET /api/workshop-waiting` (refreshed every minute, as the old
  diary does).
- **Toolbar** (decision 60): Week/Day switch; previous and next arrows, the
  date range and Today; people chips (Everyone, then each mechanic, tinted
  when chosen). No New job button until piece 5.
- **Waiting for you (n)**, 224px on the left: one card per item, with its
  kind as a coloured label, the customer, the service and the time. Choosing
  a card moves the diary to that job's week and rings its block (decision 14).
  The Open button arrives with the pop-ups in piece 2.
- **Week grid**: seven days from Monday, an hour gutter, 30-minute rows
  covering the shop's opening hours (09:00–18:00 if none are set), a "No
  time" row for jobs without a time, and today's header marked "Today".
  Overlapping jobs share the column side by side (decision 59's lanes).
- **Day view**: one column per mechanic for one day.
- **Job blocks** (decision 45): tinted fill with an ink outline in the
  status colour; bike on the first line, the job's title on the second;
  the Day view also writes the status word. The full description (bike, job,
  customer, WH number, status, time) is read out to screen readers.
- **Status colours**: the drawings' own (`ST` in `diary.mjs`), added to
  `src/styles/theme.css` as `--wh-state-*` tokens, contrast-checked.
- **Which jobs show, and how** (the old diary's rules in
  `public/diary-marks.js`): a booking request is purple and shows in the
  Everyone view; a change request is amber with a dashed outline at the
  time asked for; a cancellation by the customer is struck through until
  someone marks it seen; declined, expired and other cancelled jobs are
  hidden.
- **Legend** under the grid.
- **Tablet**: the same page in the narrower frame. **Phone**: the week grid
  scrolls sideways until piece 4.

## Decided here, for Jack to overrule

- **Status mapping.** The drawings have six states; the database has more.
  Waiting for parts is `workState = waiting_parts`; Finished is
  `workState = complete` (collected or not); started and on-hold work shows
  as Expected (the legend: "Expected, booked in or in the workshop"). Words
  per 3 Oct answer 11 (#110).
- ~~**"Waiting for the customer" (teal)** needs the quote's state, which the
  jobs list doesn't send. It is left out of the grid and the legend until
  the server sends it.~~ Replaced (#110): the jobs list sends the quote's
  state, and the teal state is drawn and in the legend, named "Quoting"
  (3 Oct answer 11).
- **No "Me" view for mechanics** yet: the server doesn't link a login to a
  mechanic.

## Tests first

Pure rules (`tests/screens/diary-rules.test.js`): status mapping, the week's
days, grid hours, lanes, waiting card wording. The page in jsdom
(`tests/screens/diary-page.test.js`): blocks in the right day and time,
people chips filter, Week/Day, previous/next/Today, the waiting column and
choosing a card, the change-request outline, the struck-through cancellation.
Status colour tokens pinned and contrast-checked. Each watched failing first.

## Done when

`npm test`, typecheck, lint, build and the browser tests pass, and the diary
is checked in a browser with real jobs at computer and tablet widths.

## Piece 2: answering what's waiting (built 3 Oct)

- A chosen waiting card shows **Open**; double-clicking a card opens it
  straight away (decision 14). It opens as a centred pop-up (decision 15).
- **New booking request** (request-new): the customer, bike, what they told
  us, the service and the time asked for. **Accept**, or **Decline**, which
  asks first ("Decline Sam Reed's booking for Fri 9 Oct? This can't be
  undone.") with **Keep booking** to back out.
- **Change request** (request-change): from and to. **Accept** or **Decline**.
- **Cancelled booking** (request-cancel): one answer, **Seen**.
- Every answer goes to the existing route with the version the pop-up saw.
  A job someone else changed first says so ("This job changed while you
  were looking at it.") and shows it afresh; a time that has gone says "The
  requested time is no longer free."; a job that no longer exists says so.

Left out because the server can't do them yet: choosing the mechanic as you
accept (decision 62), "Offer another time", and a written message with a
decline (the server sends none, so the button says "Decline booking", not
"Decline & notify customer"). "Open full job" waits for the job page.

## Piece 3: moving a job (built 3 Oct)

- **Drag** a job to another time or day (Week view) or another mechanic
  (Day view, decision 32). Moves snap to 15 minutes, like the old diary, and
  stay inside the grid's hours; a click that doesn't move past 4px isn't a
  drag.
- **From the keyboard**, so dragging is never the only way (accessibility
  first): Enter (or Space) picks the job up, Up/Down move it 15 minutes,
  Left/Right move it a day or a mechanic, Enter saves, Escape puts it back.
  Each step is read out ("Moving Trek Domane. Wed 7 Oct, 10:30–11:30.").
- Saving is the existing `PUT /api/workshop-jobs/:id` with the version the
  diary saw, and `mechanicId` only when it changed. The server's own reason
  for a refused time is shown ("Couldn't move Trek Domane: …"); a job
  someone else changed first says so and the diary reloads. Dropping a
  change request on its requested time accepts it (the server does this).
- A booking request is answered before it's moved, and a cancelled booking
  isn't moved.

Not yet: changing a job's length by dragging its edge (the old diary has
resize handles; the drawings don't show them).

## Piece 4: the phone diary (built 3 Oct)

Below 768px the diary is one day at a time (decision 68, diary-phone):
- one people chip that opens a choice of Everyone (one column), By mechanic
  (a column each) or one person;
- week arrows ("5–11 Oct") and a strip of the week's seven days in place of
  the Week/Day switch, today marked with an amber dot;
- the "No time" row (when one column shows), a 44px-a-row timeline, and the
  same blocks, moving and keyboard moving as on a computer;
- "Waiting (n)" in the top bar opens the list as a sheet; choosing a card
  goes to its day and pins a bar at the bottom with Open; choosing it again,
  or Open, opens the request.

The top bar's action slot comes from the frame (`src/staff/header-slot.ts`).
The "+" for a new job arrives with piece 5.

## Piece 5a: New job (built 3 Oct)

- **New job** in the toolbar (the "+" in the phone's top bar) turns the
  diary to "Choose a time" (decision 22): busy blocks fade, a click on the
  grid opens the form at that time (snapped to 15 minutes). "Enter a time
  instead" opens the form without picking, for keyboard users. Cancel backs
  out.
- **The form** (new-job, new-job-day), with only what the server saves:
  New bike build or pre-delivery check (decision 50: the customer becomes
  optional); find a customer by name, phone or email; their bike (an only
  bike is chosen for you); Work as pills, Full service / Individual service
  (decision 66), from the shop's active services, which fill the title and
  the length; Job title; Notes; the time and mechanic, with the mechanic
  chosen automatically as the one working that day with most free time
  (decision 18) or the column's mechanic in the Day view, changeable;
  Starting status (Booked / Waiting for parts); "The bike is here now",
  which books it in straight after saving.
- Saving is `POST /api/workshop-jobs`; the server's reason for a refusal is
  shown and the form stays open.

Not yet, because the server has nowhere to keep them: storage hooks,
separate customer and staff notes, "+ New customer" and "+ Add a bike" from
the form, and the free-time warning.

Still to come in piece 5: the hover summary, stacks that fan out, and the
right-click menu (they open the job page, which isn't built yet).
