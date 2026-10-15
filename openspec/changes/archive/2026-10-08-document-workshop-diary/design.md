# Design: document what the workshop diary already does

## Context

See `proposal.md` for why. The behaviour lives in:

- `server/server.js`: in "Workshop jobs", the change-request helpers
  (`requestedOf`, `withBookingLock`, `withJobBookingLock`,
  `syncRequestedHold`, `syncJobHold`, `checkJobSlot`), the staff `PUT
  /api/workshop-jobs/:id` (which accepts a change dropped on its requested
  time), `answerChangeRequest` (`accept-change`, `decline-change`),
  `cancellation-seen`, `waitingItem` and `GET /api/workshop-waiting`;
  "Workshop settings" (`currentShopToday`, `shopDayWindow`,
  `toCapacitySettings`, `GET` and `PUT /api/workshop-settings`); "Workshop
  unavailability" (`clashesFor`, the four block routes, `GET
  /api/workshop-capacity`); and, in the portal section, `loadCapacity`,
  `GET /api/portal/:shopSlug/availability` and `checkCustomerTime`, the
  capacity checks the customer side shares.
- `server/capacity.js` (the calculator: hours, blocks, free time, start
  times, the old page's busy view, mode changes, the booking-lock key) and
  `server/clock.js` (the shop's now and today, minimum notice). Both are
  Mark's and shared (proposal, Lane).
- The staff diary: `src/screens/diary/diary-page.tsx`, `rules.ts`,
  `request-dialog.tsx`, `new-job-dialog.tsx`, `job-extras.tsx`.
- The old app: `public/app.js` (`renderWorkshop`, the waiting feed and its
  minute timer, the review pop-up) with `public/diary-waiting.js`,
  `diary-review.js` and `diary-marks.js`.
- Migrations 005 (the reserve), 015 (booking mode, drop-off window, lead
  time, "not sure" length), 018 (capacity holds), 023 (weekday hours,
  blocks, the scheduled mode change), 024 (untimed holds).

This change writes no code. The design questions are about how to describe
the app honestly, not how to build it.

## Goals / Non-Goals

**Goals:**

- Every requirement in `specs/workshop-diary/spec.md` traced to a test or a
  named place in the code (the Evidence table below).
- Refusal wording quoted exactly as the code returns it.
- Anything that could not be confirmed left out of the spec and listed
  under "Not confirmed"; anything that contradicts a decision or an older
  spec, or looks like a bug, listed under "Surprising".

**Non-Goals:**

- Fixing, changing or judging behaviour. Nothing here is changed.
- The areas the proposal leaves out (`workshop-jobs`, quotes, services,
  `online-booking`, and planned-only screens).

## Decisions

1. **Plain English in the spec, internal names only here.** The spec talks
   about "a booking request", "a change request", "the shared queue", "a
   hold"; route and function names appear only in this file and the
   proposal. Refusal messages are quoted exactly, including the ones with
   internal words ("Booking mode must be either 'timed' or 'dropoff'",
   "Send openingHours or openingDays, not both"), because that is what the
   app says.
2. **Tests first, code second as evidence.** Where a test pins the
   behaviour, it is cited. Where only the code shows it, the code is cited
   and the row says "code only". Screen tests that use a pretend server
   are cited for what the page does; where a pretend server's refusal words
   differ from the real server's (`diary-move.test.js` uses "Alex Morgan
   already has a job at that time"), the spec quotes the real server.
3. **Where the line with `workshop-jobs` falls.** The shop's open-day,
   hours, day-off and overlap checks, the version check, and plain accept
   and decline refusing a change request are job rules, already in
   `workshop-jobs`; this spec refers to them and only adds what the diary
   does with them (a refused move put back, the reason shown). Capacity
   holds and the shared queue, which `workshop-jobs` left out (its decision
   4), are here. The diary's day blocks ("Day 2 of 2"), left out of
   `workshop-jobs` (its decision 5), are here.
4. **The capacity rules the customer side shares are here, the customer
   screens are not.** What the availability route offers and the refusals
   a customer booking or change can meet are capacity rules, so they are
   specified here; the booking pages, the private link and its expiry are
   `online-booking`'s. So are the two customer pickers, the day picker and
   the month calendar (`src/components/ui/day-diary.tsx`,
   `month-calendar.tsx`; `tests/registry/day-diary.test.js`,
   `month-calendar.test.js`), taken out after the fresh review: they are
   listed here for `online-booking` to pick up.
5. **The old app is in only as far as "Waiting for you".** Its grid, month
   view, multi-mechanic split, resize handles and job form are old-app
   detail with little or no test, due to be removed once replaced (project
   rule 5). They are left out (see Not confirmed).
6. **Example data comes from the drawings** (project rules,
   `openspec/config.yaml`). Every name, bike, job number, service, note,
   line item and price in a scenario appears in the diary drawings
   (`docs/design/user-journeys/generator/diary.mjs`, with the mechanics'
   full names in `personas.md`): Maya Patel, Trek Domane AL 3, WH-1042,
   Alex Morgan (Alex), Jo Taylor (Jo), Sam Reed, Specialized Sirrus,
   Oliver Chen, Brompton C Line, WH-1052, Aisha Khan, Cannondale Quick,
   Jamie Brooks, Giant Escape 2, WH-1038, WH-1040, Standard service, Safety
   check, Gear service, Brake service · 45 min, Full service and Individual
   service, the customer's note "My rear brake squeals and feels weak. The
   gears could use a tune-up too.", Shimano brake pads, Fit & adjust
   brakes, Replace gear cable and £111.00. Where the drawings have no
   example (a job over two days, an untimed job's customer and bike, a
   block's reason, a note, a second time zone), the scenario uses a
   bracketed placeholder such as [reason]. The tests use other names
   (Wendy Waiting, Test repair, a mechanic called Sam, and so on); the
   scenarios describe the same behaviour with the drawings' names. Dates,
   times and lengths are the tests' own, because they pin the behaviour
   (the shop's today, notice, capacity sums). The Evidence table and the
   Surprising list below still quote test names and the reviewer's probes
   as they were run. No name, price or wording is invented.

## Evidence

Test files are under `tests/`. "Code" cites `server/server.js` unless
another file is named. "Code only" means no test asserts it.

| Requirement | Evidence |
|---|---|
| The diary shows a week, Monday to Sunday | `screens/diary-page.test.js`: "a job sits in its own day, showing the bike and the job"; "the week runs Monday to Sunday and is named in the toolbar"; "Next week loads the next week". `screens/diary-rules.test.js`: "a week runs Monday to Sunday, whatever day you start from"; "dates read as people say them". Code only: opening on today's week, Today, the address keeping `?date`, `?view`, `?who` (`diary-page.tsx` `DiaryPage`) |
| The Day view shows one column per mechanic | `screens/diary-page.test.js`: "Day view shows one column per mechanic for one day". Code only: "Not assigned yet" column (`diary-page.tsx`, columns) |
| Staff can show one mechanic's jobs | `screens/diary-page.test.js`: "choosing a mechanic shows only their jobs; a request with no mechanic yet shows only under Everyone" |
| Each job is drawn in its status colour, with a legend | `screens/diary-rules.test.js`: "a booking request is Pending (purple)"; "a change request is Change requested (amber)"; "waiting for parts and finished work have their own colours"; "started or paused work shows as Expected"; "a job waiting for the customer to answer a quote is teal". `screens/diary-page.test.js`: "the legend names each colour". Code: `rules.ts` `diaryState`, `STATE_LABEL`, `LEGEND_LABEL` |
| Ended bookings leave the diary, except a customer's cancellation until it is seen | `screens/diary-rules.test.js`: "a customer's cancellation shows until someone marks it seen, then it goes"; "declined, expired and shop-cancelled jobs are hidden". `screens/diary-page.test.js`: "declined bookings are not drawn"; "a booking request is Pending, a change request shows where it asks to go, a customer cancellation stays until seen". Code: struck through (`JobBlock`, `line-through`) |
| Jobs with no time sit in the No time row | `screens/diary-page.test.js`: "a job with no time sits in the No time row". `screens/diary-phone.test.js`: "jobs with no time sit in the No time row". Code: `diary-page.tsx` (`noTime` passed only in the Week view; chips are plain `span`s showing the bike; phone row only when one column, "None" when empty). Reviewer's reading, 8 Oct: the Day view draws untimed jobs nowhere |
| The grid covers the shop's opening hours | `screens/diary-rules.test.js`: "the grid covers the shop's widest opening hours"; "the grid is 09:00 to 18:00 when no hours are set, and stretches to show a job outside them". Code: `rules.ts` `gridRange` |
| Overlapping jobs share the column | `screens/diary-rules.test.js`: "jobs that overlap share the column side by side; others keep it to themselves". `screens/diary-extras.test.js`: "jobs that only partly overlap stay side by side, not stacked". Code: `rules.ts` `layoutLanes` |
| Jobs that start together become one stack | `screens/diary-rules.test.js`: "jobs that start at the same time make one stack; a partly overlapping job stays on its own (decisions 58, 59)". `screens/diary-extras.test.js`: "two jobs at the same time are one stack that opens a chooser; a tile opens that job"; "press and hold on a stack on a touch screen fans it out". `browser/diary-extras.spec.ts`: "a stack fans out on hover; a fanned job opens, shows its summary, and drags to move". Code: `StackBlock` (0.3 s fan) |
| A job over several days has a block on each day | `screens/diary-multiday.test.js`: "a job over two days has a block on each day, each saying which day it is" |
| A customer's change request shows where the customer wants to go | `screens/diary-page.test.js`: "a booking request is Pending, a change request shows where it asks to go, a customer cancellation stays until seen". `browser/diary-waiting.spec.ts` (old app): "a change request shows amber on the job and a dashed outline at the requested time". Code: `RequestedOutline`, `outlinesIn` |
| On a phone the diary is one day at a time | `screens/diary-phone.test.js`: all six tests. Code: `useIsPhone` (below 768 px) |
| Staff can move a job by dragging it or from the keyboard | `screens/diary-move.test.js`: "a job can be picked up with M, moved with the arrows, and saved with Enter"; "Escape puts the job back without saving"; "in the Day view, left and right move the job to another mechanic". `screens/diary-multiday.test.js`: "moving the second day moves just that day". `browser/diary-move.spec.ts`: "dragging a job down an hour and across a day moves it there"; "a click on a job opens its page, and Book in books it in". `screens/diary-rules.test.js`: "a dropped job starts where it was dropped, snapped to 15 minutes"; "a dropped job never starts before the grid or runs past its end". `screens/diary-extras.test.js`: "a stacked job can be moved from the keyboard: M on its tile, the arrows, Enter" |
| A move the shop's rules refuse is put back, and says why | `screens/diary-move.test.js`: "if the server refuses the time, it says why and the job stays put" (pretend-server words); "if someone else changed the job first, it says so"; "a booking request and a cancelled booking cannot be moved". Code: `diary-page.tsx` `save` (message, reload on stale), `movable` (no time: code only); the quoted clash message is `checkJobSlot` (see `workshop-jobs`) |
| Dropping a job on the customer's requested time accepts the change | `workshop-change-requests.test.js`: "dropping a job onto exactly its requested time in the old diary accepts the change"; "dropping a job onto its requested start with a different length accepts the change"; "dropping a job anywhere else in the old diary leaves the request standing". Code: `PUT /api/workshop-jobs/:id` (the `onRequested` branch); the new diary saves moves through the same route (`diary-page.tsx` `save`). Week view sends no `mechanicId` (`diary-page.tsx` `save`), so a request for another mechanic is not accepted by a Week-view drop: code reading |
| New job starts by choosing a time on the diary | `screens/diary-new-job.test.js`: "New job asks for a time; Cancel leaves the diary as it was"; "a click on the grid opens the form at that time, with the mechanic with most free time chosen". Code only: `pickApi` (Day view column's mechanic; "Not assigned yet" gives Shared queue), `enterInstead` (grid's first hour on the address date), no date or time field in `new-job-dialog.tsx` |
| New job chooses the mechanic with the fewest timed minutes | `screens/diary-new-job.test.js`: "a click on the grid opens the form at that time, with the mechanic with most free time chosen". Code only: `diary-page.tsx` `freest` (working days only; timed jobs of any booking state from the loaded week; nobody working → everyone; first on a tie); the sentence in `new-job-dialog.tsx` |
| The New job form finds the customer and fills in the work | `screens/diary-new-job.test.js`: "choosing work fills the job title and its length; only active services are offered"; "a customer is found by name and their bike chosen; saving creates the job"; "a job needs a title, and a customer unless it is a new bike build". Code only: the only bike chosen, the Shared queue pill, the Booked / Waiting for parts pills (`new-job-dialog.tsx`) |
| Saving a new job | `screens/diary-new-job.test.js`: "a customer is found by name and their bike chosen; saving creates the job" (the exact request); ""The bike is here now" books it in straight after saving"; "a job needs a title, and a customer unless it is a new bike build" (exact message); "if the server refuses, the form says why and stays open". Code only: the one-hour default (`new-job-dialog.tsx` `save`). Book-in refused after a Waiting for parts save: code reading (`save`; `readLegacyStatus` puts the bike in the shop; message from `server/workshop/transitions.js` `applyEvent`), confirmed by the reviewer's reading 8 Oct; no test |
| Staff can open a job's menu, summary and overview from the diary | `screens/diary-extras.test.js`: "right-click shows Job actions; View overview shows notes, line items and the cost"; "Open job in the menu opens the job page"; "Shift+F10 opens the menu from the keyboard; arrows move through it; Escape closes it and returns to the job"; "holding the right mouse button opens the overview straight away"; "resting the mouse on a job shows its summary; moving off hides it"; "press and hold on a touch screen shows the menu with the touch tip, and holding on opens the overview"; "the overview of a job with nothing on its order yet says so". Code: 0.6 s, at once with reduced motion (`extrasApi.enter`) |
| "Waiting for you" lists what customers are waiting on staff for | `workshop-waiting.test.js`: "a new online booking is listed with what the diary needs"; "a job staff made as pending is not listed"; "a change request is listed with where the booking is and where the customer wants it"; "a customer's cancellation is listed until someone marks it seen"; "a staff cancellation is never listed"; "the oldest arrival comes first, whatever its kind"; "another shop's waiting items never appear"; "a waiting item lists its services with ids, in order". Code: `GET /api/workshop-waiting`, `waitingItem` |
| The diary's Waiting column chooses and opens what is waiting | `screens/diary-page.test.js`: "Waiting for you lists what needs an answer"; "choosing a waiting card moves the diary to its week and marks its job"; "a chosen job in a stack marks the stack". `screens/diary-answer.test.js`: "double-clicking a card opens it straight away". `screens/diary-rules.test.js`: "a waiting card says what it is, who, what and when". Code only: "Nothing waiting.", the minute refresh (`refetchInterval: 60_000`), refresh after a move or answer. Code only: choosing resets the people filter (`set({ who: null })`); a second click does nothing (`onClick={choose}`) |
| Staff answer a new booking request in a pop-up | `screens/diary-answer.test.js`: "a booking request opens in a pop-up with what the customer asked for"; "Accept accepts the booking with the version seen, closes the pop-up and refreshes the diary"; "Decline asks first; Keep booking changes nothing"; "confirming Decline declines the booking". `browser/diary-waiting.spec.ts` (old app): "Decline asks first; keeping the booking changes nothing, confirming declines it" |
| Staff accept a customer's change request | `workshop-change-requests.test.js`: "accepting a change moves the booking and leaves it one hold"; "the requested hold becomes the booking hold"; "accepting when the requested time is no longer free is refused and changes nothing" (exact); "accepting with a stale version is refused" (exact); "accepting needs a version" (exact); "there is nothing to accept on a booking with no request" (exact); "accepting a change waits while another booking write holds the requested day"; "accepting and declining a change clear every requested field". Code: `answerChangeRequest` (shop rules through `checkJobSlot`, no calculator) |
| Staff decline a customer's change request | `workshop-change-requests.test.js`: "declining a change keeps the original time and tells the customer"; "declining a change lets the requested time go"; "declining with a stale version is refused"; "there is nothing to decline on a booking with no request" (exact); "accepting and declining a change clear every requested field". Code: `answerChangeRequest` (the same lock as accepting: code only) |
| The change request pop-up shows from and to | `screens/diary-answer.test.js`: "a change request shows where from and to, and Accept moves it"; "declining a change request keeps the booking where it was". Code only: the explanatory sentence (`request-dialog.tsx`). Moving to the requested mechanic: `workshop-change-requests.test.js` "accepting a change moves the booking and leaves it one hold" (same mechanic); reviewer's probe 8 Oct (Sam → Alex, not a repo test); the pop-up's `at()` shows no mechanic |
| Staff mark a customer's cancellation as seen | `workshop-waiting.test.js`: "a customer's cancellation is listed until someone marks it seen"; "Seen needs the version staff last read"; "Seen is only for a customer's cancellation". `screens/diary-answer.test.js`: "a customer's cancellation has one answer: Seen". `browser/diary-waiting.spec.ts`: "Seen takes a customer's cancellation off the list and the diary". Code: `cancellation-seen` (keeps the first time: code only) |
| An answer someone else got to first says so plainly | `screens/diary-answer.test.js`: "if someone else changed the job first, the pop-up says so and shows it afresh"; "a change to a time that has gone says the time is no longer free". `screens/diary-rules.test.js` (old wording): "each refusal becomes a plain sentence". `browser/diary-waiting.spec.ts`: "answering something someone else already answered says so plainly". Code: `request-dialog.tsx` `refusal` and the illegal-then-moved-on check |
| Other ways a booking changes keep or end a customer's request | `workshop-change-requests.test.js`: "the old diary's ordinary save keeps the customer's request and its hold"; "an old diary status change that ends a request clears it and lets its time go" (pending); "a staff cancellation of a requested booking clears the request"; "a staff reschedule request never holds a time the customer didn't ask for". `workshop-holds-follow.test.js`: "cancelling a job runs the release through syncJobHold, which leaves no held hold". Code: `PUT /api/workshop-jobs/:id` (waiting_parts, on_hold and complete all map to a confirmed booking, which keeps the request: code reading, no test) |
| The old app's Workshop diary shows what is waiting | `diary-rules.test.js` (old helpers): "'arrived' wording at each boundary"; "a new booking card"; "a change request card shows from and to"; "a change to another mechanic names them"; "a cancellation card"; "a card with no customer name says so plainly". `browser/diary-waiting.spec.ts`: "a new online booking is listed with its details, and clicking it jumps to the job"; "a staff-made pending job is not listed"; "the column picks up a new booking within a minute without a click"; "the minute timer stops at logout so it never wipes the login screen"; "with everything answered the column reads "Nothing waiting"". Code: `public/app.js` `renderWaitingFeed`, `startWaitingTimer`, `jumpToJob` |
| The old app answers what is waiting in a review pop-up | `diary-rules.test.js`: "pop-up headings name the kind and reference"; "each kind of answer reads plainly"; "answers group under their service, in service order"; "the change line names both times"; "the decline confirmation names the customer and day"; "each refusal becomes a plain sentence". `browser/diary-waiting.spec.ts`: "the pop-up shows the answers, the photo and the notes, and Accept confirms the booking"; "Decline asks first; keeping the booking changes nothing, confirming declines it"; "a change request can be accepted from the pop-up or its outline, and declined"; "Seen takes a customer's cancellation off the list and the diary"; "answering something someone else already answered says so plainly"; "closing the pop-up while an answer is on its way leaves the diary usable when the answer comes back"; "a diary drag on a copy someone else has changed is refused and the diary reloads"; "toggling complete on a job changed elsewhere is refused and the form closes". Code: `renderReviewJobModal`, `answerReview` |
| Each weekday can have its own opening hours | `workshop-weekday-hours.test.js`: all seven tests (status only for the two refusals; messages from `resolveOpeningHours` in `capacity.js` and `PUT /api/workshop-settings`). `capacity.test.js`: "a weekday uses its own hours, else the usual ones; a closed day has none"; "opening hours keep only the days that differ from the usual hours"; "stored weekday hours that are malformed are ignored, not trusted". The Saturday message is `checkJobSlot`. No screen sends `openingHours`: the old Edit Workshop sends only `openingTime`, `closingTime`, `openingDays`, `fullDayThresholdMinutes` (`public/app.js` `renderEditWorkshop`) |
| Lunch, leave and closures are blocks of unavailable time | `workshop-unavailability.test.js`: "a weekly lunch block round-trips"; "a shop closure covers whole days and clashes with everyone's jobs" (status only for the times refusal); "an update keeps omitted fields, and delete removes the block"; "another shop's mechanic and another shop's block are not found"; "a date-range list includes weekly blocks and overlapping date blocks only"; "a non-numeric block id is a 404, not a 500". `capacity-schema.test.js`: "the database refuses a weekly block with no mechanic"; "the database refuses a shop-wide closure with times". `capacity.test.js`: "blocks are validated before they are stored"; "validateBlock does not coerce junk into 0 or Sunday". Code: `validateBlock` (exact messages), block routes |
| A new block reports the bookings it clashes with and moves none | `workshop-unavailability.test.js`: "adding a block reports the bookings it clashes with, and does not move them"; "a cancelled booking is not a clash"; "a shop closure covers whole days and clashes with everyone's jobs". `capacity.test.js`: "a block clashes with the live jobs it overlaps". `shop-today-boundary.test.js`: "a new block reports clashes from the shop's today on, not the UTC date". Code: `clashesFor`, `blockClashes`. Code: `clashesFor` starts from the later of the block's start date and the shop's today; `blockClashes` filters by mechanic unless the block has none |
| Staff are held to the shop's rules but never to capacity | `workshop-holds-follow.test.js`: "staff are never refused for capacity". `workshop-unavailability.test.js`: "staff are never refused by a block - a lunch slot is bookable for them". `booking-lock.test.js`: "a staff move into a slot a stale hold occupies is rolled back with capacity" (exact message). Code: `POST` and `PUT /api/workshop-jobs`, `answerChangeRequest` (no calculator). Another customer's requested time: `checkJobSlot` (the `requested_*` half of the overlap query); reviewer's probe 8 Oct (staff 14:30–15:30 over a requested 14:00–15:00, refused 400 with the quoted message; not a repo test) |
| Each mechanic's free time is worked out one way for everyone | `capacity.test.js`: "lunch removes its half hour from the mechanic's day and their start times"; "a shop closure removes the day for everyone; leave removes it for one"; "a day off and a closed weekday are not scheduled"; "timed jobs cut their time out; untimed jobs take their minutes; the reserve comes off last"; "overlapping timed jobs are counted once, not twice"; "an unassigned walk-in is split across the mechanics working that day"; "an unassigned timed job also joins the shared queue, not just untimed ones"; "a mechanic on leave takes no share of the walk-in queue". `workshop-capacity-view.test.js`: "staff see free minutes, windows, block reasons and clashes". `workshop-holds-follow.test.js`: "assigning a queued walk-in moves its whole length onto the mechanic". `portal-availability-capacity.test.js`: "an unassigned walk-in takes a share of each working mechanic's drop-off day". `booking-requested-hold.test.js`: "the calendar does not offer a requested time". Code: `computeCapacity`, `loadCapacity` (later days: code only) |
| Staff can see the capacity of a range of days | `workshop-capacity-view.test.js`: all three tests. `booking-requested-hold.test.js`: "a block clashes with a job's own slot, never its requested one, and lists the job once". Code: `GET /api/workshop-capacity` (messages) |
| Customers are offered only the time capacity allows | `portal-availability-capacity.test.js`: "Saturday's shorter hours end its start times earlier"; "a cancelled booking frees its time"; "an unassigned walk-in takes a share of each working mechanic's drop-off day"; "a scheduled mode change applies from its date"; "the mechanic filter narrows the answer but not the queue split". `capacity.test.js`: "a drop-off day fits a job only while free minutes remain"; "start times need the free minutes as well as the gap"; "Saturday's shorter day ends the start times earlier". Code: `GET /api/portal/:shopSlug/availability`, `startTimesFor`, `fitsDropoff` |
| Customers are told nothing about why time is taken | `portal-availability-capacity.test.js`: "lunch takes its start times away, and shows as busy with no reason"; "a shop closure empties the day and marks it full for every mechanic"; "a range over 62 days, or a bad minutes value, is refused"; "a date that looks right but does not exist is refused"; "an end date before the start date is refused"; "a non-numeric mechanicId is refused, not silently emptied". `workshop-availability.test.js`: all six tests ("availability discloses nothing beyond a mechanic, a date and a window" among them). `capacity.test.js`: "the old booking page sees blocks and short days as busy, with no reason"; "the old booking page sees a day as full once nothing more fits". Code: `legacyView` |
| Customers are held to capacity when they book or change | `portal-capacity-reserve.test.js`: all three tests. `portal-capacity-holds.test.js`: "a slot already held by an in-flight request is refused with 409". `booking-lock.test.js`: "overlapping bookings sent at once: exactly one wins, the rest get capacity"; "a booking into time another booking holds refuses with capacity". `booking-requested-hold.test.js`: "a requested time keeps another customer out of it" (exact body). `portal-booking-change.test.js`: "time the mechanic isn't available is refused" (exact); "a drop-off day takes the day, not a time" (exact). `capacity.test.js`: "fitsFreeTime refuses a time inside a block". Code: `checkCustomerTime` (the reserve message: matched by /enough free time/ only) |
| Every live job holds its time | `portal-capacity-holds.test.js`: all four tests. `workshop-holds-follow.test.js`: "moving and resizing a job moves its hold"; "a walk-in joins the shared queue with its length, and its hold records it"; "two unassigned timed jobs at the same start do not collide, because an unassigned hold is untimed"; "declining a reschedule request returns a live job to scheduled, and its hold survives"; "cancelling a job runs the release through syncJobHold, which leaves no held hold". `capacity-holds-index.test.js`: "two drop-off holds for one mechanic on one day coexist"; "two timed holds at the same start still collide". `booking-lock.test.js`: "a booking waits while another booking holds the same shop and date". `capacity.test.js`: "a booking lock key is the date as a whole number". Code: `syncJobHold`, `withBookingLock`, migrations 018 and 024 (declining and expiring releasing: code only) |
| A customer's requested time is held until staff answer | `booking-requested-hold.test.js`: "a requested time keeps another customer out of it"; "the calendar does not offer a requested time"; "a job's own request never blocks the job"; "a job that stops being a request lets its requested time go and keeps its own"; "a job's own hold is never mistaken for its requested one"; "a request that stands keeps the hold it has". Code: `syncRequestedHold`, `loadCapacity`. Staff refused over it: as the row above |
| Customers cannot book sooner than the shop's minimum notice | `portal-availability-capacity.test.js`: the five piece-10 tests. `clock.test.js`: "the earliest bookable moment is now plus the notice, and can fall on a later date"; "the notice is real time, so it crosses the spring clock change correctly"; "a start time is in time from the earliest bookable moment on"; "a drop-off day is in time only while the earliest moment is before its window closes". `portal-booking-request.test.js`: "a start time sooner than now plus the notice is refused; just after it books"; "a drop-off today is refused once now plus the notice reaches the window's end" (exact). `portal-booking-change.test.js`: "a time sooner than the shop's notice is refused" (exact). `shop-today-boundary.test.js`: "a booking for the day that has passed in the UK is refused" (exact). Code: `server/clock.js`, `checkCustomerTime` |
| "Today" is the shop's own date, in its own time zone | `clock.test.js`: "in summer, now is UK time, not UTC"; "in winter, UK time and UTC agree"; "on the clock-change days, now follows the UK clock"; "a non-UK zone moves today"; "known and unknown time zones"; "a pinned test clock is read from the environment"; "in production the test pin is ignored and the real time is used". `shop-today-boundary.test.js`: "a new block reports clashes from the shop's today on, not the UTC date"; "a mode change cannot start on the shop's today"; "a booking for the day that has passed in the UK is refused". `workshop-mode-change.test.js`: "the mode change's today is the shop's today, in the shop's time zone". `portal-availability-capacity.test.js`: "in summer the notice runs from UK time, not UTC". Code: `currentShopToday` |
| Staff can read and change the workshop settings | `workshop-settings.test.js`: "a new shop defaults to timed booking, so nothing changes for existing shops"; "settings not named in a PUT are left alone"; "a new shop has two hours of minimum notice, on UK time"; "a new shop has no terms of its own". `capacity-schema.test.js`: "a new shop starts with no reserve, since blocks now carry lunch". `workshop-weekday-hours.test.js`: "a new shop reports every open day at the usual hours". Code: `GET` and `PUT /api/workshop-settings`, `serializeWorkshopSettings` |
| The booking mode, the drop-off window and the lengths have limits | `workshop-settings.test.js`: "a shop can switch to drop-off mode and set its window"; "an unknown booking mode is refused" (matches /timed\|drop/); "a drop-off window that ends before it starts is refused" (matches /after/); "the not-sure duration must be a sensible number of minutes" (matches /minutes/). Code: `PUT /api/workshop-settings` (exact messages; lead time and reserve limits: code only) |
| A shop can schedule a change of booking mode | `workshop-mode-change.test.js`: all six tests. `capacity.test.js`: "a scheduled mode change applies from its date on, not before"; "a scheduled mode change settles once its date arrives, not before"; "a mode change needs both parts, a real future date, and a different mode" (messages matched by /both/, /tomorrow/, /look like/). `capacity-schema.test.js`: "a mode change needs both a mode and a date, or neither". `portal-availability-capacity.test.js`: "a scheduled mode change applies from its date". Code: `validateModeChange`, `settleModeChange` ("The shop already uses that mode": code only). Cancelling: `workshop-mode-change.test.js` "a shop schedules drop-off mode from a future date, and can cancel it" sends both parts as null; a save leaving both parts out keeps the schedule ("other settings saves keep a scheduled change"). One part null and the other left out also cancels: code reading (`PUT /api/workshop-settings` runs `validateModeChange` only when a part is sent, and a missing part becomes null), no test |
| Minimum notice and the time zone have limits | `workshop-settings.test.js`: "minimum notice and time zone are saved, and kept when a PUT leaves them out"; "minimum notice outside 0 minutes to 7 days, or not whole, is refused" (exact); "a time zone the server does not recognise is refused" (exact). Leaving the field out keeps the value: same test. An empty text ("") saved as 0: code reading (`PUT /api/workshop-settings` refuses only null before `Number()`, and `Number("")` is 0), no test |
| Prices online and the shop's own booking terms are settings | `workshop-settings.test.js`: "price visibility can be turned on, and comes back as a boolean"; "booking terms are saved, kept when a PUT leaves them out, and reverted by null or blank"; "booking terms over 20,000 characters are refused" (exact); "booking terms that are not text or null are refused" (exact) |

## Not confirmed

Left out of the spec because no test or code reading showed it clearly, or
because it belongs to another area:

- **The old app's diary grid.** Its Week/Month views, the "All" and
  "Unassigned" pills and the split columns when two or more mechanics are
  chosen, resize handles, the right-click menu and the job form are in
  `public/app.js` with little test; they are old-app detail due to go, so
  only "Waiting for you" and its refusals are specified.
- **The tablet tray.** `browser/diary-extras.spec.ts` shows a press and
  hold laying a stack out on a tray that fits the diary on a tablet; the
  tray's sizing is left out as layout detail.
- **What the arrival lead time, the "not sure" length, the drop-off window
  and the booking terms do on the customer pages.** They are saved here;
  their effect on what a customer reads is `online-booking`'s. So is the
  private link's expiry on the shop's date (`shop-today-boundary.test.js`).
- **Who may change the workshop settings or blocks.** Not checked whether
  the routes are limited to owners; the spec says "staff".
- **The new request pop-up's content beyond the customer's words.** The old
  pop-up shows the answers grouped by service and the customer's photos;
  the new one shows only the customer's description, the service and the
  time. Whether the request-new drawing asks for more was not checked.
- **The shop's own day for the dashboard and sales list**
  (`shop-day-window.test.js`) is the till and sales area's, not the
  diary's; taken out after the fresh review.
- **The two customer pickers** (see decision 4): `online-booking`'s.
- **Today's marker in the week's header** ("· Today") and the today dot on
  the phone strip: code only, not put in a scenario.

## Surprising

For Jack to look at; nothing here is changed by this change. "Code
reading" means confirmed in the code and not covered by any test.

1. **Drop-off mode does not change the staff diary.** The decision says
   "In drop-off mode, everyone loses the time — staff included"
   (`2026-09-04-booking-mode-and-downtime.md` §2.2). No staff screen reads
   the booking mode: the new diary still draws every job on a time grid,
   and New job always saves a start time. Only the customer side changes
   (code reading: no `bookingMode` in `src/screens/diary/` or
   `public/app.js`).
2. **Lunch, leave and closures cannot be entered from any screen, and the
   diary does not show them.** The block routes, the staff capacity view,
   the booking mode, a scheduled mode change, minimum notice, the time
   zone, a weekday's own hours, the drop-off window, the arrival lead time,
   the "not sure" length, prices online and the booking terms have no staff
   screen; only the server and the tests use them. The old "Edit Workshop"
   screen sends only the usual opening and closing time, the open days and
   the reserve. A shop cannot set up lunch today without a developer (code
   reading: no caller in `src/` or `public/`).
3. **New job's "Waiting for parts" with "The bike is here now" fails half
   way.** Saving as Waiting for parts already puts the bike in the shop, so
   the book-in that follows is refused with "cannot book_in a job that is
   in_shop; from here you can collect"; the form shows that and stays open
   although the job was saved, and the diary is not refreshed. Pressing
   Save again is refused as a clash when a mechanic and time are set, but
   with Shared queue it creates a duplicate job and a second order. The
   same applies to any refused book-in after a save (code reading:
   `new-job-dialog.tsx` `save`; `readLegacyStatus`; confirmed by the fresh
   reviewer).
4. **A change request into another week shows no outline on the new
   diary.** The dashed outline is drawn only for jobs whose own day is on
   screen; the old diary drew outlines from the shop-wide waiting list, so
   a job booked in one week could show its request in another. Choosing a
   change-request card also goes to the booking's current day, where
   decision 19 says a click highlights the time the customer wants to move
   to (code reading: `outlinesIn`, `choose`).
5. **"Most free time" counts only timed bookings.** Decision 18 says New
   job assigns the mechanic with the most free time; the diary picks the
   mechanic working that weekday with the fewest timed minutes on screen,
   ignoring lunch, leave, closures, untimed jobs and the shared queue, so a
   mechanic on leave can be chosen, and counting cancelled, declined and
   expired bookings as if they were live (code reading: `freest`).
6. **Decided but not built.** Decision 15's "Offer another time" and the
   decline message, decision 62's mechanic pills on a booking request,
   and decision 23's "won't fit" warning on New job are not built (the
   older spec says so too). Decision 17 (blocks show the customer, and
   each shop chooses what is most prominent) is not built: blocks show the
   bike and the job, as the drawings do.
7. **The device's date, not the shop's, drives the diary's "today".** The
   week the diary opens on, Today, the today marker and the date in
   "Cancelled by the customer on [day]" come from the browser's clock and
   time zone, while the server uses the shop's (code reading: `rules.ts`
   `todayIso`).
8. **Accepting a change refused by the shop's rules says the time "is no
   longer free".** Any shop-rule refusal of the requested time (a closed
   day, outside the day's hours, the mechanic's day off) comes back as
   "The requested time is no longer free", which is not the reason (code
   reading: `answerChangeRequest`).
9. **The older diary spec is out of date on moving.** It says Enter or
   Space picks a job up and a stacked job has no keyboard move; the app
   now opens the job with Enter, picks it up with M, and moves a stacked
   job with M on its tile (`2026-10-03-staff-diary-view-design.md`, pieces
   3 and 5b). The app, not the spec, is current.
10. **Untimed jobs are invisible in the Day view and cannot be opened from
    the diary.** The No time row shows only in the Week view (and on a
    phone with one column), as plain chips with no click (code reading:
    `diary-page.tsx`).
11. **The change request pop-up says the mechanic stays when it may not.**
    It reads "Accepting keeps the same work and mechanic." and never names
    the mechanic the customer asked for, but accepting moves the booking to
    that mechanic (reviewer's probe: Sam → Alex).
12. **"Enter a time instead" has no way to enter a time.** It opens the
    form at the grid's first hour on the page-address date, and the form
    has no date or time field (decision 22 offers it as the keyboard way
    to place a job; code reading).
13. **A Week-view drop on the dashed outline does not accept a change to
    another mechanic.** The Week view sends no mechanic, so when the
    customer asked for a different mechanic the job moves to the requested
    day and time with its old mechanic and the request stays (code
    reading: `save`, the server's same-mechanic check).
14. **On a tablet, a second tap on a Waiting card does not open it.**
    Decision 14 says the first tap highlights and a second tap opens; on a
    tablet (the computer layout) a second tap does nothing and only Open or
    a double-tap opens it. The phone does open on a second tap (code
    reading: `choose`, `chooseItem`).
15. **An empty minimum notice saves no notice at all.** The server refuses
    null as the minimum notice but reads an empty text ("") as 0, so a
    save with the field cleared lets customers book from now on (code
    reading: `PUT /api/workshop-settings`; Mark's review of this pull
    request). Added after Jack's answer on this list (task 2.2); a fix
    would be a separate change.

## Risks / Trade-offs

- [A spec of the app as it is also records behaviour Jack may not want,
  such as items 1–3 above] → Each is listed under Surprising, so Jack can
  decide; a later change fixes it and updates the spec.
- [Code-only evidence is weaker than a test] → The Evidence table says
  which rows or parts rest on code alone.
- [The customer-side capacity rules sit here, not in `online-booking`] →
  Decision 4 above says why; `online-booking` refers here when written.
- [`capacity.js` and `clock.js` are Mark's] → This change only describes
  them; a later change to them follows the split plan's approvals.

## Migration Plan

None. Nothing is deployed. Archiving the change copies the spec to
`openspec/specs/workshop-diary/spec.md`.
