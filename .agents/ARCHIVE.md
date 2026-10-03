# ARCHIVE — Wheelhouse

Superseded resume-file content, kept verbatim. Nothing is deleted from the
project's history; when `.agents/STATUS.md` outgrows its 8,000-byte cap,
content moves here rather than being dropped. Decisions move to
`docs/decisions/` instead.

---

## Moved from STATUS on 2026-09-27 (handover)

STATUS.md was restructured for a handover to a fresh agent: it had grown to
~32 KB, far past its own 8,000-byte cap, and read as a chronological wall of
text rather than a resume file. Everything below is moved here verbatim, in
its original order, so nothing is lost. The new STATUS.md is a short,
current, plain-English summary written from the same facts.

**Updated:** 2026-09-27
**Branch:** `main` at `278fb1b` (pieces (a) #72, (b) #73, (c) #74, (d1) #75, server pieces 7 #76 and 8 #77 merged; d2 #78, #79, #80, piece 9 #81, d3 #82, piece 10 #83, d4 #84 and its follow-ups #85, server piece 11 (terms) #86 merged; **d5 merged: #87**, CI green on `fc49f9b`; two look tweaks merged: **#88**). The two look tweaks (Jack, 26 Sep): (1) `details` gets a separate full-width "Read the booking terms" button above the tick box (whose label is now plain text, no button inside it); (2) `pending`'s `totalLine` ("From £T") shows only with two or more services - one service shows only its own price line. **Piece 12 (customer change and cancel) built on `feat/book-server-12-change-cancel`**, off `main` at `278fb1b`, with the final review's fixes in (27 Sep; not pushed, no PR - Jack's call) - see the paragraph after the d5/piece-12 note below. Server prerequisite pieces 1-6 for the book
journey are all merged: #64-#70, then **piece 6 (customer photos, migration
029) as #71** (25 Sep; PR CI green). Specs and plans for each are under
`docs/superpowers/`; piece 6's are
`docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md` and
`docs/superpowers/plans/2026-09-25-book-server-6-customer-photos.md`.
**Plan 4a's endpoint check re-run 25 Sep**
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`): every book screen has a
supplying route. **Jack decided 25 Sep:** no automatic acceptance in Release 1
(A1); `pending` shows the booked price, following the shop's "show prices
online" setting (B1); the work splits into four pieces with their own spec and
PR: (a) booked price in the booking reply and link read-back, (b) customer
shell at `/book`, (c) missing form controls (each approved by Jack), (d) the
six screens. **Piece (a) merged: #72** (25 Sep, CI green on its final
commit; spec `docs/superpowers/specs/2026-09-25-book-a-booked-price-design.md`).
**Piece (b) merged: #73** (26 Sep, CI green on its final commit). Every
`/book` address serves the React customer app (`src/customer/`, placeholders
for the six screens). **Piece (c) merged: #74** (26 Sep, CI green on its final commit; seven
registry controls plus the registry colour-name fix; spec
`docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md`). **Piece
(d) is five parts** (Jack, 26 Sep): (d1) groundwork, (d2) service screens,
(d3) problem, (d4) date, (d5) details + sending + pending + journey test.
**(d1) merged: #75** (26 Sep, CI green on its final commit; plan
`docs/superpowers/plans/2026-09-26-book-d1-groundwork.md`; spec
`docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md`). A screen
plugs in as `src/screens/book/<id>.tsx`, wrapped in `BookFrame` (shop name,
step/progress, title, pinned action) and, where it needs earlier answers, in
`RequireDraft` with a `has` check (redirects to `/book/<shopSlug>` when
missing); it reads and writes the booking in progress via `useDraft()`
(`src/screens/book/draft.tsx`), and is registered by screen id in `SCREENS` in
`src/customer/app-shell.tsx`. Installed controls
(`src/components/ui/<name>.tsx`): edit the registry item under
`registry/primitives/` or `registry/patterns/`, run `npm run registry:build`,
then `npx shadcn add ./public/r/<name>.json --yes --overwrite` - never
hand-edit an installed copy, the drift check (`tests/customer/installed-controls.test.js`)
fails a copy that no longer matches its source byte for byte; the first
installed control that imports a sibling registry item will need that check's
comparison to normalise `@/registry/(primitives|patterns)/` to
`@/components/ui/` (shadcn rewrites those imports on install), none of the
current ten need it. `key={shopSlug}` on `DraftProvider` in the `/book/:shopSlug`
layout route is load-bearing - remove it and a shop change carries the
previous shop's draft over instead of starting that shop's own
(`tests/customer/book-layout.test.js`). **Deferred for d2 (and later):** no
`env(safe-area-inset-bottom)` (fine unless `book.html` gains
`viewport-fit=cover`); long action labels (`Button` is
`whitespace-nowrap`); Enter-to-submit on `details` (the action sits outside
any `form`); `/book` doesn't pick up the shop's own accent colour
(`book.html` doesn't load `public/app.js`). **Jack, 26 Sep
(direction, not yet scheduled):** each shop will eventually choose one colour
scheme that applies everywhere (staff and customer apps); not built now.
Until then `/book` uses the default Wheelhouse colours. **Jack, 26 Sep
(further direction, not yet scheduled):** each shop will also choose
"Pop-ups: our colours / plain white", applied in both the staff app and the
booking app. Until then, booking pop-ups use `--modal-bg` as built. **Open for piece (d) from (c):** `day-diary` scales so every
start time is 44px, so a service shorter than 30 minutes (start time under 30
minutes before a booking) stretches the whole diary - decide with real service
lengths; `month-calendar` hard-codes an `h2` (fit the screen's heading order);
Jack to decide whether available days need more contrast on a grey page.
**Open for piece (d):**
on a storefront subdomain the app reads the shop from the address
(`/book/<slug>`), not the host, so `/book/<other-shop>` on one shop's subdomain
shows the other shop; decide which wins. No request-level test covers the
`/book` 500 page when the app is not built (only `appEntryTags` is tested).
The diary's open/close can likely come from `GET /api/portal/:shopSlug/mechanics`
(`openingTime`/`closingTime`, the widest hours; `server/server.js`
~:4441-4453), with a shorter day already returned by `/availability` as busy
time - piece (d) to confirm. Jack changed J1 on 25 Sep: the new app takes all
of `/book` now (nobody uses the old page); `public-portal/` files are deleted
in a later clean-up. **d2 paused (Jack, 26 Sep):** a booking must hold
several services, and a full service will list the individual services it
includes (so d2 can say "already part of your general service"). Order:
**piece 7 merged: #76** (26 Sep at `0456294`, CI green on its final commit; plan
`docs/superpowers/plans/2026-09-26-book-server-7-multiple-services.md`); the
contract: POST takes `serviceIds` (1-10) or `notSure` alone; answers are
`{serviceId, questionId, ...}`; the 201 and `/booking-links` reply return
`services` (`[{name, price}]`) and `totalPrice`, `bookedPrice`/`serviceName`
gone; `workshop_job_services` is the only source; migration 030 drops
`workshop_jobs.service_id`/`booked_price`, with a count guard that rolls the
whole migration back if the backfill ever copies fewer rows than a shop has.
**Deploy note:** back up any real shop database before deploying - 030 drops
columns and old code can't run against the migrated schema (no code-only
rollback). **For d2:** change `BookingDraft` to `serviceIds[]` (drop
`serviceId`/`serviceName`, keep a summed `serviceMinutes` or derive it), give
each `Answer` a `serviceId`, update `hasService` in `require-draft.tsx`, read
`services`/`totalPrice` on `pending`; the link's answers and "Please answer:
..." errors don't name which service a question belongs to, and service names
on links are live (a rename changes past links) - decide in d2/d5. Then
**server piece 8** (what a full service includes;
merged: **#77** (26 Sep at `4049fa9`, CI green on its final commit `e1dd051`); spec
`docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md`, plan
`docs/superpowers/plans/2026-09-26-book-server-8-service-includes.md`). Server
only: migration 031 `workshop_service_includes`; staff `includes: number[]` on
`/api/workshop-services` (omitted on PUT keeps; individual services `[]`);
customer `/services` gives each `full[]` item `includes: [{id, name}]` (active
individual services, bookable online or not, shop's order); a booking with a
full service and a service it includes is refused ("<full> already includes
<service>", d2 decision 26 Sep). No staff screen sets it yet - screens 65/66 are a later
piece, which must first lock rows so a simultaneous "add X to F" and "promote X
to full" can't both commit (checks run before the transaction today; customers
are guarded by a kind filter). Then **(d2)** service screens with multi-select
and a Continue button, using `PortalFullService.includes` for the "Includes ..."
line (shortened past a few items); ticking a full service hints "Included in
your <full service>" on the services it includes and locks them (Jack, 26 Sep,
replacing piece 8's warn-and-remove). **(d2) merged: #78** (26 Sep at `ecde7da`, CI green on its final commit `2ad5ab7`; spec
`docs/superpowers/specs/2026-09-26-book-d2-service-screens-design.md`, plan
`docs/superpowers/plans/2026-09-26-book-d2-service-screens.md`; subagent-driven
development, fresh helper per task, task reviews, final review on the most
capable model).** Built: the `service` screen (three fixed options: full,
individual, not sure) and the `service-list` screen (full services, each
category, then Other, multi-select with a Continue button, hint-and-lock on a
full service's included items); `serviceIds[]` on the draft and `serviceId` on
each `Answer`; `BookFrame`'s loading/unknown-shop/failed/focus behaviour and
its `actionNote` slot above the pinned button. Closes three carried-over
items: the blank header while `/services` loads or fails now shows a proper
loading/error state, focus moves to the screen's `h1` on a screen change, and
a Playwright check (`tests/browser/book-service-list.spec.ts`) proves the
pinned Continue never covers the last service at 320px.
**(d5) built on `feat/book-d5-details-send-pending`** (26 Sep; spec
`docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md`,
plan `docs/superpowers/plans/2026-09-26-book-d5-details-send-pending.md`,
which carries the decision log and the spec walk; server piece 11 (booking
terms), PR #86, merged into this branch). Built: the `details` screen
(summary; name, mobile, one update channel - Text message by default,
WhatsApp, Email - an email required only for Email; the booking terms in a
dialog, fetched from piece 11's `/terms` when opened; the four messages
under their fields with a pinned note and focus on the first; "photos were
cleared" asked in a dialog); sending (`/services` read again and answers
cleaned with `cleanAnswers`; photos as bare base64; "Sending…"; success
clears the draft and replaces details with the private link; a time gone
clears the date choice and returns to `date` with "Sorry, that time was
booked while you were filling in your details - please choose another"; a
changed questions refusal returns to `problem` with the server's message;
429, no response and anything else stay on details); the `pending` screen
(status as its heading, reference, services and prices, "From £T", day and
time, bike note, description, answers, Copy link, "Need to change or
cancel? Contact <shop>"; 404, 410, Try again). Rules in `details-rules.ts` /
`pending-rules.ts`; the registry `dialog` installed unchanged. **Jack's
approvals (26 Sep):** the booking terms text; Text message as the default
update channel; no marketing-permission checkbox; the four extra refusals
("That mechanic is unavailable at that time", "This shop takes drop-offs on
that day" / "A start time is required", "Please choose a mechanic") also
routed to `date` alongside the spec's three, plus three more after the final review ("The shop is closed that day", "That mechanic does not work that day", "That job doesn't fit in the shop's opening hours"; Jack, 26 Sep); a 400 "Please answer: …" goes to `problem` like changed questions; a non-JSON or 5xx failure shows the no-connection message; and the copy not in the spec -
"Please check the answers marked above" (reused from d3 on a failed Request
booking), "We couldn't load the booking terms", "We couldn't load this
booking", "Reference" (the pending summary's only label), and "Loading…" as
pending's heading while it loads. **Piece 11 (booking terms) merged: #86**
(26 Sep at `6ba19b5`; migration 034; standard Wheelhouse terms with a shop's
own replacement, `GET /api/portal/:shopSlug/terms`, a copy of the terms in
force saved on each online booking). **For piece 12 / d6:** `pending` has
no "View request" / "Change or cancel request" buttons yet - it says
"Contact <shop>"; piece 12 (change and cancel via the private link) and d6
(their screens) will replace `contactLine` in `pending-rules.ts` with those
buttons.

**Server piece 12 (customer change and cancel) built on `feat/book-server-12-change-cancel`** (27 Sep; spec `docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md`, plan `docs/superpowers/plans/2026-09-27-book-server-12-change-cancel.md`, which carries the decision log and the spec walk; the branch also carries `1418dd2`, the details summary's "From £" only with two or more services, since refined by decision (b) below). Built: migration 035 (the stored change request, `cancelled_by`/`cancelled_at`, `cancellation_seen_at`, `change_declined_at`, and `workshop_capacity_holds.purpose` 'booking' | 'requested' - a partial unique index guards at most one live requested hold per job); customer `POST /api/portal/:shopSlug/booking-links/:code/cancel|change|withdraw-change` (shared link limiter, 404/410 as the read route, the booking lock for every day involved); an unconfirmed booking moves at once, a confirmed one's change is held as a request rather than applied; the customer may change or cancel only while the bike is expected, no work has started and the booking's day hasn't passed in the shop's time zone; a double-tapped cancel answers with the cancelled booking; the link view adds `requested`, `canChange`, `canCancel`, `changeDeclined`; staff `POST /api/workshop-jobs/:id/accept-change|decline-change|cancellation-seen` (version-checked), `GET /api/workshop-waiting` (`{count, items}`, oldest first); the old `accept`/`decline` refuse a customer's change request instead of silently acting on it; staff cancel records `cancelled_by = 'staff'` and clears a declined change. **Jack's decisions, in the spec (26-27 Sep):** (1) cancel is immediate while the bike hasn't been dropped off; (2) a change to a confirmed booking is a request staff accept or decline, keeping the old slot meanwhile; (3) staff answer requests in the existing diary, from a left-hand "Waiting for you" column (built in the staff diary piece); (4) an unconfirmed booking moves at once when the new time is free and stays awaiting confirmation; (5) customer cancellations appear in "Waiting for you" as "Cancelled by customer" until "Seen"; (6) a requested new time is held until staff decide. **Jack's decisions, with the plan approval (27 Sep):** the in-shop change wording "Your bike is already with the shop - please contact them to change it"; a confirmed booking "changed" to the time it already has makes no request, and withdraws any open one; the four staff messages - "There's no change request to accept", "There's no change request to decline", "This booking has a change request from the customer - accept or decline the change instead", "Only a customer's cancellation can be marked as seen"; the one-live-requested-hold-per-job partial unique index in migration 035. **Jack's decisions, on the final review (27 Sep):** (a) the customer's change and cancel stop once work has started or once the booking's day has passed, with the same in-shop wording and code; (b) the details summary with one priced service reads "<service>, from £X" with no separate total line, and two or more services keep the names line and "From £T". **Controller rulings (pre-flight), for Jack to confirm:** the legacy diary's ordinary save keeps a customer's request (a note-only edit doesn't drop it); dropping a job onto exactly its requested slot in the legacy diary accepts the change; every way a request ends (withdraw, replace, accept-change, decline-change, cancel, a legacy status change that ends it) clears the requested fields, so a later `request_reschedule` can't resurrect a stale one; the "exactly one wins" race tests hold the day's booking lock from the test's own database connection so both requests wait on it. **Next:** the staff diary piece (Jack's design, 26-27 Sep: a "Waiting for you" column on the left, jump-and-highlight into the job, Accept/Decline inside the job), then **d6** (the customer's own change and cancel screens, replacing `pending`'s "Contact <shop>" line with the buttons noted above). **Open:** the controller rulings above, for Jack to confirm; whether/when to open the PR is Jack's call. Parked minors: a legacy-diary save onto the requested start with a different length is refused by the job's own request (for the staff diary piece); a legacy-diary save can undo a customer's move of an unconfirmed booking (the existing last-save-wins; staff diary piece); resending an identical change request moves it to the back of the waiting list.

**Known follow-ups:** pressing Back while a booking is "Sending…"
leaves the customer without their private link - not built, no screen
covers it; the terms dialog's backdrop-tap
focus return is unchecked; a journey test whose `beforeAll` fails partway
through seeding can leave a throwaway test shop stored (its `afterAll`
never runs) - clean up manually if `book-journey.spec.ts` ever fails there.
**(d4) merged: #84 at `d7638eb`** (26 Sep, CI green on its final commit
`b57f87e`; spec `docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md`,
plan `docs/superpowers/plans/2026-09-26-book-d4-date-screen.md`, which carries the
decision log and the spec walk; server piece 10, PR #83, merged into this
branch). Built: the `date` screen (a month calendar for this month and next; a
timed day shows mechanic pills, all on, and the one-day diary, one column per
mechanic, a mechanic with no free time shown as unavailable all day; a
drop-off day shows the drop-off window and a mechanic choice starting on "Any
mechanic", which Continue turns into the first bookable mechanic in the
shop's order; a pinned summary; "Choose a day" / "Choose a time"; a saved time
that has been taken is cleared with "Your chosen time is no longer available
- please choose another"; "There are no free days in the next two months -
please contact the shop"); the rules in `src/screens/book/date-rules.ts`; the
`/mechanics` and `/availability` hooks in `src/screens/book/date-query.ts`;
`RequireDraft` gained `to` (the screen to send the customer to; default the
first screen); `hasDate(draft)` in `require-draft.tsx`, tested but not
applied. The calendar's range uses the device's date (the client can't know
the shop's time zone); the server (piece 10) offers nothing before the shop's
earliest bookable moment. **Two follow-ups (Jack, 26 Sep), built on `fix/book-d4-followups`
off `main` at `d7638eb`:** (1) the draft now records `anyMechanic?: true` on a
drop-off choice (`mechanicId` still holds the resolved real mechanic); going
back shows "Any mechanic" selected again; a stored mechanic that stops being
bookable is silently re-resolved to another bookable mechanic
(`reresolveMechanic` in `date-rules.ts`) rather than cleared as taken, unless
none is bookable that day; picking a named mechanic, a new day, or a timed
time clears `anyMechanic`. (2) the "saved choice no longer free" message
reworded to "Your chosen time is no longer available - please choose
another". **For d5:** wrap `details` in `RequireDraft` with `hasDate` and
`to="date"`; send `date`, `mechanicId` (always the real, resolved mechanic)
and, on a timed day only, `startTime` (a drop-off day stores none); `d5` may
ignore `anyMechanic` entirely - it exists only so the date screen can restore
the "Any mechanic" pill; build the "that day was just taken" refusal screen
(`full`) for a capacity or "too soon" refusal when sending. The line "We
couldn't load the free days" (not in the spec) and the "no longer available"
note's look (d3's `--wh-warn-bg` / `--wh-warn-ink`) are both approved by Jack
(26 Sep). **Jack to judge** from `/tmp/d4-date-timed-320.png`: whether
available days stand out on the page, and the diary's height with real
service lengths. Carried from piece 10: dashboard and sales "today" still
query a UTC-midnight window (follow-up piece).
**(d3) merged: #82** (26 Sep at `8e8db72`, CI green on its final commit `6d45c88`) (26 Sep; spec
`docs/superpowers/specs/2026-09-26-book-d3-problem-screen-design.md`, plan
`docs/superpowers/plans/2026-09-26-book-d3-problem-screen.md`, which carries
the decision log and the spec walk; server piece 9, PR #81, merged 26 Sep at
`e3c02b4`, CI green on its final commit `5492ae8`, and already merged into
this branch). Built: the `problem` screen (a bike box, each ticked service's
questions as pills plus "Or tell us in your own words", a description
required only for "Not sure", and up to 5 photos with a "cleared" message
after a refresh); `bikeNote` and `hadPhotos` on the draft (`bike` removed);
the rules in `src/screens/book/problem-rules.ts`; and `hasProblem(draft,
services)` in `require-draft.tsx`, tested but not applied. **For d4:** wrap
`date` in `RequireDraft` with `(d) => hasProblem(d, data)` only once
`/services` has loaded (`hasProblem` needs the services data; calling it
before data exists would throw with services ticked), and add a redirect
target to `problem` (the spec sends the customer back to `problem`, but
`RequireDraft` redirects to the first screen by default). Draft answers are
`{serviceId, questionId, choice?, text?, notSure?}`, matching piece 9. **For
d5:** send `bikeNote` and each answer's `text`; photos are
`useDraft().photos` (memory only) and must go as bare base64 (piece 6 note
below); before sending, re-clean answers with `cleanAnswers` against fresh
`/services` data (the shop can edit questions between problem and send); and
check `photosCleared` (`hadPhotos` true but no photos held after a later
refresh) and send the customer back to add photos or confirm without them.
The on-screen keyboard check is `tests/browser/book-problem.spec.ts`:
an imitation (viewport cut to 320x300), not a real keyboard. Jack approved
the look of the "photos were cleared" note (`--wh-warn-bg` / `--wh-warn-ink`).
Known follow-ups: a pill question's "Please answer" message is not linked
for screen readers (needs a `PillGroup` change). Final-review fix wave (26
Sep): `problem-rules.ts` gained `cleanAnswers` (drops a stale choice, a
`notSure` the shop has since disallowed, an answer to a deleted question, or
one left over from an unticked service before the draft's answers are saved
on Continue - a draft could otherwise pass `hasProblem` and still be refused
by server piece 9's `checkAnswers`); `answered()`/`missingAnswers` now also
require `q.allowNotSure` for `notSure` to count; and a required text
question's `Textarea` now carries `aria-required="true"`. Notes: `queryClient` is exported from
`src/customer/app-shell.tsx` only so tests can clear it; `notSurePatch` is
shared by both screens; the locked-row background uses `--wh-hover` (Jack to
confirm the look). **#79 merged** (26 Sep at `29bffda`): `ChoiceCard` puts a space between
title, detail and price, so its accessible name reads "Service 1 From £20"
even with no stylesheet (with styles loaded, Chromium already read it
correctly - the run-together name came from the missing stylesheet). Fixed in
d2 (e76c5a2): `/book` and `/workshop` were served with no stylesheet since
piece (b) (82da9ac) - Vite puts shared CSS on the common chunk once there are
two entries, and `appEntryTags` only read the entry's own `css`.
**Piece 6 open items** (facts only):
- Memory risk before public exposure: the booking route reads a body up to
  73,400,320 bytes (5 x 10 MB x 1.4) BEFORE the guest limiter. Peak memory per
  request is roughly 300 MB (received chunks, Buffer.concat copy, utf8 string,
  JSON.parse copy, plus base64 decode). No concurrency limit exists and the
  Dockerfile/compose set no memory limit, so about 10-15 simultaneous max-size
  posts could exhaust Node memory (the same process serves the staff tills).
  Cheapest fix: cap concurrent large-body reads (503 beyond 2-3), reject early
  on Content-Length over the cap, free chunks before parsing. Needs Jack's
  decision before this route is publicly reachable (hosting not chosen, PL-1).
- Files can be left on disk if COMMIT fails after photos were saved (rare,
  up to 50 MB per booking).
- Customer photos must be sent as bare base64; a `data:image/...;base64,`
  prefix or line breaks is refused as "could not be read". Note for whoever
  builds the booking page's photo picker.
- Pre-existing, not from piece 6: a guest's customer row and a newBike row can
  remain after some refusals inside the lock ("Please choose a mechanic",
  capacity refusals, the 23505 case); a JSON body of `null` gives 500.
**Phases 0-3 merged** (#54-#59). **Phase 4 foundation merged** (#60-#62).
**Open:** Mark's #50 review is against the superseded
84-screen version; told 20 Sep. Other open items are Jack's.

## Where this stands

**Release 1 scope is narrowed and settled** (#51); live scope file
`docs/decisions/2026-09-10-release-1-scope-reduction.md`. **The screen designs are 82
screens**, 13 notes applied, asserted by `check-notes.mjs` (#54). The tag
barcode is a declared **non-scanning specimen**; PDFs and board PNG **stale**.

**Still no Lightspeed technical spec and no account.** LS-01 to LS-09 are
"Pending", needing the first shop's series and an authorised account.
Recovery is outside Release 1; WorkOS auth and design remediation stay approved
and unbuilt. The `prototype/` demo has **no week view** — the staff diary
(`public/app.js:1496`; `buildWeekGridHtml` :2038, `renderWeekGrid` :2072,
interactions :1878-2285) and customer slot grid (`public-portal/portal.js:364`)
are the spec for screens 38/39/44.

**Check the checkout before judging state; stage one's transaction mode is
OFF.** Detail: `ARCHIVE.md`.

## Operational traps

- **The app is on `localhost:8080`, not 4000; Postgres on 5433, not 5432.**
- **Never delete the `cf-*` header names in `server/gateway.js`** — the strip
  list; removing it reopens a login brute-force bypass.
- **Never hand-edit the screen designs HTML**; `package.py` regenerates it.
- **`public/dist` is untracked** (23 Sep; three stale files were committed
  in `fa32b60`). A fresh checkout must `npm run build` before `/workshop`
  serves or `tests/workshop-page.test.js` passes.
- **`npm run docker:down` keeps the volume** — not a clean database. Use a
  scratch one to test migrations from empty.
- **`npm test` hangs silently** without the compose Postgres up.
- **`public/index.html` loads `/app.js`, never `/dist/`** — before Task 1 the
  bundle loaded on no page. The React app is only `/workshop` and below.
- **`npm run test:browser` builds and boots its own server on 8091**, never
  reusing one: 8080 is the docker `app`, 31 Aug image.

## Read order for a fresh session

This file → **Plan register** below and the plans it names →
`2026-09-10-release-1-scope-reduction.md` → `…-lightspeed-readiness.md`.

## Immediate next actions

1. **Piece 5 (service questions): built on branch
   `feat/book-server-5-service-questions`, open as PR #70** (off
   `41f48e8`). Spec
   `docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md`;
   plan `docs/superpowers/plans/2026-09-25-book-server-5-service-questions.md`
   carries the decision log and a full spec walk at its end. Migration 028
   adds `workshop_services.questions` and `workshop_jobs.question_answers`.
   **Next:** read CI on #70; Jack decides whether to merge. Follow-up: a
   null byte in answer or description text gives a 500 after the guest
   customer row is written — needs one shared text clean-up step.
   **Piece 4 merged (#69):** private link `/book/<shop>/booking/<code>`,
   read-only until 30 days after the booked date, hash-only storage, staff
   replace route (no button), 30 lookups/15 min/IP, `customer_description`
   apart from `notes`. **For the page and staff button, later:** no-store and
   no-referrer headers, no tight polling, an audit entry on link replacement,
   and the staff screen id on the route's `// screens:` line (now `expired`).
   Plan 4a stays STOPPED at Task 7 item 3; routing decided 23 Sep
   (`docs/decisions/2026-09-23-book-journey-routing-and-modes.md`). Earlier
   25 Sep, Jack: guests always give a phone; the booked price is stored on the
   job (#68); `/sdbdemo` no longer booking is accepted.
2. **Jack: Lightspeed series + test account.** P00-LS and P07 wait on it.
3. **Jack: printer, tag dimensions, driver host.** The **scanner half of P00b
   is closed** (`2026-09-23-p00b-scanner-evidence`): 1D, **cannot read QR**, so
   the tag carries Code 128 as note 11 has it. No tag from our printer has been
   scanned — the screen designs' barcode stays a non-scanning specimen.
4. **Jack: the message providers**, and what inbound replies do.
5. **Mark: the screen review** (#50), open since 17 Sep.
6. **Split the Release 1 plan into issues** — row IDs, state changes, expected
   failure, test command, proof per package.

**Carried open:** four, incl. three tenant-isolation gaps confirmed ABSENT on
`main` 9 Sep. Three closed 20 Sep (Jack): screen-design checks **run in CI**;
`prototype/` and review-pack scripts stay **out** of CI; money stays a JS
float, **totalled in SQL, never JavaScript** — binds Phase 4. **Hubtiger
trial lapsed ~15 Sep**; re-entry needs Jack's login.

## Done and branches

43 PRs merged (#1–#51), plus #54-#64. Record in `ARCHIVE.md`. One branch still
matters — `docs/jack-ranking-2026-09-10` holds the only copy of the filled
**Jack's priority** column, empty on `main`. `plan/phase-4-screens` was
deleted 23 Sep (its plans are on `main`, newer).

## Phases 0-3

Seven state machines replace `workshop_jobs.status`, now a **generated
column**; fifteen action endpoints are guarded by them and an optimistic
`version`, **which every Phase 4 mutation must echo**. **A 409 carries `code:
'stale' | 'illegal'`** (#60, Jack). **Quote line decisions are final** (#59).
Detail, incl. #58's carried items: `ARCHIVE.md`.

## Phase 4 foundation (Tasks 1-6)

`/workshop/*` serves the React app (`src/staff/`). `ROUTES` (`routes.ts`)
maps screen id → URL; `SCREENS` (`app-shell.tsx`) registers built screens.
Server calls go through `src/lib/api/client.ts` (`jobAction` needs
`version`); identity only via `useSession`. `src/lib/adapters/intent.ts`
records print/message intent, stores nothing, never claims delivery. **Not
yet:** nav, styling, shop theme, auth guard. Endpoint gap list: `ARCHIVE.md`.

## Plan register

Decisions: files under `docs/decisions/`; undecided ones in `ARCHIVE.md`.
LOCKED: `2026-08-31-master-implementation-plan.md`. Current: the Release 1
workshop plan and the Phase 4 screens plan; the phase plan summary is in
`ARCHIVE.md`. Approved, unbuilt: WorkOS, design
remediation. Detail: `ARCHIVE.md`.

## Canonical commands

```sh
npm run docker:up   # the suite hangs silently without it
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node scripts/ci/assert-screen-trace.mjs
npm run registry:validate && node scripts/ci/check-registry-drift.mjs
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
npm run test:browser
```

All run in CI too, so a green PR means they passed.


**Verified 24 Sep: CI on `main` `9291119` green, 471/471.** Same day: #65 CI
green; #66 CI green against main on `50785ac`, 565/565 locally. Prior (2a 528/528, 23 Sep 437/437): `ARCHIVE.md`. Check a PR's CI
against the run's own SHA, not the PR pane.

**A worktree needs its own `.env`** — gitignored, so it does not travel;
without it the server uses 5432 not 5433 and every server-booting test fails
with `ECONNREFUSED`, which looks like broken code and is not. Live-server tests
must `import '../server/load-env.js'` first.

## Open items needing Mark

Eight. The screen review (#50) is urgent, re-point at the 82 screen designs;
the other seven in `ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap 8,000 bytes.
Past that, trim by **moving** — to `ARCHIVE.md` or `docs/decisions/`, never by
deleting. Check the byte count before committing, not after.

---

## Mark's original `.agents/STATUS.md`

Authored by Mark Curphey. Last updated `fa32b60`, 31 August 2026 (blob
`0eca91d3`, 2,007 bytes). Untracked from `main` by `9da1d75` on 2 September;
still present unchanged on nine unmerged branches. Reproduced here in full so
that it survives any merge. Recover the original directly with
`git show fa32b60:.agents/STATUS.md`.

**Do not act on the commands in the text below.** It is a historical record.
Its `git reset --hard 8514727` line was accurate when written and is now
obsolete and destructive: `8514727` predates the commit that added the
2,880-line WorkOS plan, which is on `main` via PR #29.

````markdown
# STATUS — Wheelhouse

**State:** phase one merged-ready; architecture stage one **set up, not started**
**Branch:** `feat/shadcn-foundation` (PR #9, CI green)
**Updated:** 2026-08-31

> This directory is gitignored volatile scratch and an earlier copy of it was
> destroyed mid-session. Durable records live in `docs/`. Do not put anything
> here that matters.

## Start here if you are a fresh session

Read `docs/superpowers/plans/2026-08-31-architecture-stage-1.md`. It has the
exact commands. Short version — from a new branch off master, with docker up:

```
Workflow({ name: 'wheelhouse-architecture-stage-1' })
```

Decisions that govern the work: `docs/decisions/2026-08-31-frontend-platform.md`.

## Done

- **`fix/cross-tenant-login-scope` merged** (PR #4). Master had no CI at all
  before that; it also carried the fix scoping every `logins` write to the
  caller's shop.
- **Frontend phase one** — PR #9, CI green on run `33396591409` (89/89 tests,
  41s). Vite 8 + React 19 + TS + Tailwind 4.3.3 + a shadcn registry with four
  enforcement gates, each mutation-tested. Nothing user-visible changed.

## Next

Architecture stage one, via the workflow above. Six ceilings; the seventh
(managed Postgres with PITR and a rehearsed restore) is infrastructure and is
deliberately excluded — a human owns it.

## Open items needing Mark

1. `--status-complete-paid-ink` — held back on purpose, needs sign-off.
2. Dark-mode palette in `src/styles/theme.css` was invented during the scaffold
   with no design approval. Nothing renders it yet.
3. Registry primitives use native `<dialog>` rather than Radix, because
   `@radix-ui/*` was not installed. Should be an explicit decision.
4. `design/workos-auth-migration` carries duplicate copies of two commits from
   when the working tree switched branches mid-session.
   `git reset --hard 8514727` cleans it. Mark's branch, Mark's call.
5. After stage one lands: repoint the `app` healthcheck in `docker-compose.yml`
   at `/healthz`.
````

---

## Provenance of the current `.agents/STATUS.md`

Moved out of `STATUS.md` on 6 September 2026 when the file passed its
8,000-byte cap. Verbatim as it stood there:

This file replaces Mark's `.agents/STATUS.md` (`fa32b60`, 31 Aug, blob
`0eca91d3`). That version is still on nine unmerged branches, where it is
identical everywhere. A merge of any of them will **silently** keep this file
and drop Mark's with no conflict — so its live content was carried forward here
by hand rather than left to git. Recover the original with:
`git show fa32b60:.agents/STATUS.md`

---

## Merged work, 30 August - 2 September 2026

Moved out of `STATUS.md` on 6 September 2026 when the file passed its
8,000-byte cap. Verbatim as it stood there. Full list any time:
`gh pr list --state merged -L 100`.

**Carried forward verbatim from Mark's file (`fa32b60`):**

- **`fix/cross-tenant-login-scope` merged** (PR #4). Master had no CI at all
  before that; it also carried the fix scoping every `logins` write to the
  caller's shop.
- **Frontend phase one** — PR #9, CI green on run `33396591409` (89/89 tests,
  41s). Vite 8 + React 19 + TS + Tailwind 4.3.3 + a shadcn registry with four
  enforcement gates, each mutation-tested. Nothing user-visible changed.

**Since (30 Aug - 2 Sep):**

- **Websites and checkout** — per-shop public websites (#1), Shopify
  checkout (#2), owner preview button (#3). Plans archived (#6).
- **Platform and infra** — Cloudflare Tunnel assumption dropped (#8), CI push
  trigger on main (#10), architecture stage-one workflow set up (#11), README
  made accurate (#12), ESLint stopped parsing workflow files (#26).
- **Workshop / diary** — booking portal data leak closed (DS-7, #19), server
  enforces diary rules (DS-8, #20), first workshop tests (DS-9, #21), service
  catalogue and labour lines (JOB-12/13, #24).
- **Design** — audit findings, shared tokens, WCAG contrast gate (#14).
- **Research and direction** — business/market research (#7), business plan and
  workshop-first direction (#13), wedge decision (#22) and plan reconciliation
  (#23), Book My Bike In teardown + Hubtiger research (#25), Lightspeed R-Series
  as first platform (#27).
- **WorkOS auth** — design spec and 2,880-line plan on `main` (#29, replaces
  #15). Approved, not implemented.
- **Process** — `.agents/STATUS.md` untracked (#28), then rebuilt and tracked.

---

## Housekeeping notes

Moved out of `STATUS.md` on 7 September 2026 when the file passed its
8,000-byte cap after the stage-one merge. Verbatim as it stood there.

- `origin/design/workos-auth-migration` (0dad2a4, 31 Aug) is the superseded
  pre-rebuild branch. Its content is safe: the 2,880-line plan and 760-line
  spec are both on `main`, byte-identical, merged via PR #29. Deleting the
  stale remote branch is a judgement call nobody has made.

---

## Open design items carried from Mark's 31 August STATUS.md

Moved out of `STATUS.md` on 7 September 2026 when the file passed its
8,000-byte cap. STILL OPEN — moved for space, not resolved. Verbatim.

Items 1-4 are carried forward verbatim in substance from Mark's own STATUS.md
(`fa32b60`, 31 Aug) and re-verified against the tree on 2026-09-03.

1. **`--status-complete-paid-ink` needs sign-off.** Held back on purpose.
   Still unapplied and now inconsistent: `public/tokens.css:75` has the fixed
   `#4d7364`, `src/styles/theme.css:84` still has `#6b9484` at 3.21 contrast,
   which fails AA. `docs/decisions/2026-08-31-frontend-platform.md:68` records
   it as NOT applied.
2. **Dark-mode palette** in `src/styles/theme.css` was invented during the
   scaffold with no design approval. Nothing renders it yet. Design direction
   is Mark's to approve.
3. **Registry primitives use native `<dialog>`** rather than Radix, because
   `@radix-ui/*` was not installed. Should be an explicit decision, not a
   default that hardened.

---

## Branch audit — 7 September 2026

Run at session close, after the stage-one merge. 26 remote branches.

**22 have zero commits `main` cannot reach.** Verified with
`git rev-list --count origin/main..<branch>` returning 0 for each. That check
also rules out the squash-merge case: a squash-merged branch keeps its own
commit objects and would have returned non-zero. For these 22, deleting the
remote branch removes a ref, not history — every commit remains reachable from
`main`, and the GitHub PR page survives deletion and still shows the diff.

**Two are safe in content but not in commits:**

- `docs/ownership-signoff` — 1 commit (`90f1f23`). Its content was brought to
  `main` by cherry-pick on 6 Sep, so `main` holds an equivalent commit under a
  different SHA. Deleting the branch orphans the original object.
- `design/workos-auth-migration` — 5 commits. Every file on it also exists on
  `main`, and the two documents that matter — the 2,880-line WorkOS plan and the
  760-line spec (`2026-08-31-workos-auth-migration-design.md`) — are
  byte-identical to `main`'s copies, confirmed by diff. What looked like unique
  content is older versions of files `main` has since rewritten. The five commit
  objects are not in `main`'s history.

**One is genuinely unmerged:** `chore/purge-test-shops-script`, PR #36, open.
More relevant now than when it was raised — the cross-tenant verifier left
throwaway shops around ids 18389-18391 in the dev database on 7 Sep.

**Recommendation:** delete the 22, leave the other two, keep #36's branch.

**Why this is worth doing at all.** Mark's ownership sign-off sat on
`docs/ownership-signoff` for a week, 103 commits behind `main`, with no PR ever
opened — and it read as "never signed off" in every document that referenced it.
Nothing was broken. It was invisible because it was one line in a list where
almost every other line was dead. Deleting the dead ones is what makes the next
live branch visible.


## PR accounting, moved from STATUS 8 September 2026

Moved to keep STATUS under its 8,000-byte cap. Accurate as at 7 September 2026.

36 PRs merged, spanning #1-#42 (counted 7 Sep; #36 open, #15 closed unmerged,
5/16/17/18 are issue numbers). The earlier "36 merged, #1-#40" overcounted by
two. The detail to 2 September is elsewhere in this file. Full list:
`gh pr list --state merged -L 100`.

## Hubtiger trial — records created 8 September 2026

Left in the Hubtiger trial account by the 8 Sep testing. Listed so a later
session knows why they are there.

- Job **#96** (demo-seeded) — a `Repair` line, SKU 100002, £75.00, added to test
  the POS parts pull. Also dragged from Tue 09:00 to Wed 08:00 to test
  rescheduling.
- Customer **ZZTest PosPush** (`zztest@example.com`) and job **#100** — created
  from scratch to rule out demo data as the cause of the quote-push failure.
  Job #100 was later moved to Bike Ready as part of that testing. That customer
  also synced through to the Lightspeed X-Series trial as `ZZTest-53CH`, which
  is what proved writes to the POS work.
- Job **#101** — created through the public booking widget to test the
  customer-facing flow. Mobile 07700 900456, an Ofcom-reserved fictitious
  number that cannot reach anyone.
- Job **#99** — two POS lines (Repair £75.00, Replacement Parts £50.00) and a
  quote sent to `jack@curphey.com`, testing the quote-approval round trip.
- Setting changed: Technician 2 linked to POS user Jack Curphey, on the POS
  integration page.

In the Velodrop trial: appointment **241105 ("ZZTest Trial")**.
## Moved out of STATUS.md, 9 September 2026

STATUS.md hit its 8,000-byte cap when the workshop prototype and the restored
operational traps were added. Trimmed by moving, per its own rule. Verbatim:

### Immediate next action 2, full text (moved 9 Sep)

```
2. **Test the timestamp question against a live Lightspeed account.** Signing
   off the R-Series research did not settle it, because documentation cannot: if
   a `Workorder`'s `timeStamp` does not move when a child `WorkorderLine`
   changes, polling parents silently misses line edits and the diary shows a job
   as unchanged while its contents changed. A design fork — test it **before the
   sync loop is written**. Needs an account, so it is Jack's. Read the real
   bucket size from `X-LS-Api-Bucket-Level` on the same call; 90 and 60 are both
   published and neither has been seen live.
```

### Immediate next action 3, full text (moved 9 Sep)

```
3. **Decide on branch cleanup.** 22 of 26 remote branches have zero commits
   `main` cannot reach; deleting those removes a label, not history. Analysis and
   recommendation: `.agents/ARCHIVE.md`, "Branch audit". Not tidiness — the
   ownership sign-off hid for a week in a list where 25 of 26 lines were dead.
```

### Decisions in force — full status cells (moved 9 Sep)

```
| Decision | Status |
|---|---|
| `2026-08-31-business-plan.md` | Decided, except lines marked OPEN |
| `2026-08-31-frontend-platform.md` | Decided (approver: Mark) |
| `2026-09-02-lightspeed-first-platform.md` | DECIDED by Jack, 2 Sep 2026 |
| `2026-09-02-r-series-sync-and-rate-limits.md` | **SIGNED OFF by Jack, 7 Sep** (PR #30). §4 and §5 binding on the master plan; two open questions survive the sign-off — next action 2 |
| `2026-09-01-wedge-booking-vs-workshop.md` | **DECIDED** 1 Sep, ratified 6 Sep; §4 and §5b superseded by the Lightspeed decision |
| `2026-09-01-ownership-signoff.md` | Signed off by Jack 1 Sep — 58 agreed, 5 queried (`PF-3`, `DP-1`–`DP-4`), 0 reassigned. The five queries still need Mark |
| `2026-09-06-tenant-scoping-and-pooler-safety.md` | **DECIDED by Jack, 6 Sep** — the pooler guard hard-fails; the pool error handler was fixed on the stage-one branch. Also carries the flag-flip checklist and what the new tests do and do not prove |
| `2026-09-04-job-type-before-diary.md` | **Proposed 4 Sep, not decided** |
| `2026-09-04-booking-mode-and-downtime.md` | Booking mode + customer picker **DECIDED** (5 Sep); downtime model proposed |
| `2026-08-31-feature-catalogue.md` | Reference |
```

### Open items needing Mark — full text (moved from STATUS.md, 9 Sep)

(as written 7 Sep)

Three design items carried from Mark's 31 August file — the paid-ink contrast
token, the unapproved dark-mode palette, and the registry's native `<dialog>`
primitives — have moved to `.agents/ARCHIVE.md`. They are still open; they are
just not what this file is for any more.

1. **A connection dying while actively serving a request still crashes the
   process**, taking every shop's in-flight requests with it. `pool.on('error')`
   was added by stage one, but pg-pool removes the error listener at checkout,
   so it covers idle clients only. Pre-existing, and the crash guard treats it
   as a deliberate restart policy — but it wants an explicit decision at
   "hundreds of shops" scale rather than an inherited default.
2. **Gate spacing / dates.** `2026-08-31-business-plan.md:583` — OPEN pending
   Mark's weekly time budget.

Mark's fifth item — `git reset --hard 8514727` on `design/workos-auth-migration`
— is **deliberately dropped as obsolete**, not lost. PR #29 put the plan on
`main`; see the housekeeping notes in `.agents/ARCHIVE.md`.

### Plan register — full table (moved from STATUS.md, 9 Sep)

(as written 7 Sep)

| Plan | Status |
|---|---|
| `2026-08-31-master-implementation-plan.md` | LOCKED — the arc |
| `2026-08-31-architecture-stage-1.md` | Executed — merged 7 Sep (PR #37), five of six ceilings closed |
| `2026-09-05-booking-mode-foundations.md` | Executed — merged 5 Sep (PR #35) |
| `2026-08-31-workos-auth-migration.md` | Approved design (2,880 lines), not implemented |
| `2026-08-31-workshop-service-catalogue.md` | Design agreed; server rules and tests merged |
| `2026-08-31-design-remediation.md` | Findings recorded in `docs/design/` |
| `plans/done/2026-08-30-storefront-framework.md` | Executed |
| `plans/done/2026-08-30-shopify-checkout.md` | Executed |

## Tenant isolation — two gaps confirmed on `main`, 9 September 2026

Both were carried in STATUS as "unknown, not open". Both are ABSENT, verified
against the code and, for the second, against the running database. Neither is
fixed; this is a record of what is true, not of work done.

### 1. Composite tenant-consistent foreign keys — ABSENT

Every foreign key in the schema is single-column, referencing only the parent's
`id`. 61 `REFERENCES` clauses across the 15 files in `server/migrations/`; not
one `FOREIGN KEY (...)` or `REFERENCES x (...)` clause contains a comma, and
there is no `UNIQUE (shop_id, id)` anywhere to make a composite FK possible. The
only composite key of any kind is the junction primary key at
`001_init_schema.sql:159`. No schema SQL exists outside `server/migrations/`.

Examples of the single-column pattern: `customer_bikes.customer_id`
(`001:135`), `workshop_jobs.customer_id`/`bike_id`/`mechanic_id`
(`001:171-173`), `sales.customer_id`/`cashier_id` (`001:193-194`),
`sale_items.sale_id`/`product_id` (`001:232-233`).

**What it permits.** FK referential checks bypass RLS, so shop A can insert a
`customer_bikes` or `workshop_jobs` row pointing at shop B's `customer_id` —
creating a tenant-A-visible record attached to another tenant's entity, and
confirming which of B's row IDs exist (an existence oracle). This was already
demonstrated in-repo: `docs/reviews/2026-08-31-architecture-stage-1-review.md`,
lines 70-84.

### 2. Privilege boundary on the non-RLS resolver tables — ABSENT

The resolver tables are `shops`, `logins`, `sessions`
(`001_init_schema.sql:22-50`) and `customer_logins`, `customer_sessions`
(`003_customer_portal.sql:5-30`). `logins` and `customer_logins` are the two
declared RLS exemptions in `scripts/ci/assert-rls-coverage.mjs:26`; `shops` and
`sessions` have no `shop_id`, so that check never considers them.

There is exactly one grant statement in the entire repository —
`docker/init-db.sh:18`, `GRANT ALL ON SCHEMA public TO epos_app`. No `REVOKE`,
no second role, no per-table grants. And migrations run through the app's own
pool (`server/migrations/run-migrations.js` imports `pool` from `../db.js`), so
`epos_app` **creates and therefore owns** every table — owner-level DML applies
regardless of grants.

Confirmed against the running container, 9 Sep:

```
     tablename     | tableowner | sel | ins | upd | del
 customer_logins   | epos_app   | t   | t   | t   | t
 customer_sessions | epos_app   | t   | t   | t   | t
 logins            | epos_app   | t   | t   | t   | t
 sessions          | epos_app   | t   | t   | t   | t
 shops             | epos_app   | t   | t   | t   | t
```

**What it permits.** The only thing separating tenants on these tables is
application code — `server/auth.js` queries `shops`/`logins` by email or id with
no shop predicate (`:53,:67,:74,:139,:165`). Any SQL-capable path can rewrite
the shop-to-login mapping or repoint a session's `login_id` and obtain
RLS-legitimate access to another tenant. RLS cannot defend this, because the
mapping is what RLS trusts.

**The adjacent control is real, and is a different thing.** `init-db.sh`'s
comment promises only that `epos_app` is not a superuser, which protects against
RLS bypass. Verified: `rolsuper=f`, `rolbypassrls=f` for `epos_app`, both `t`
for `postgres`. That guarantee holds and is orthogonal to resolver-table
writability.

### How this was verified

A subagent surveyed and reported both as absent; the load-bearing absence claims
were then re-checked directly in the main session (the grep patterns above) and,
for the privilege claim, proven by catalog query against the live database
rather than inferred from source. Recorded because a delegated "X does not
exist" is not evidence on its own.

## Moved out of STATUS.md, 19 September 2026

### Working-tree trap of 10 Sep — resolved

The 10 Sep close recorded uncommitted Release 1 work sitting on `main` in the
root checkout: two decisions, an adversarial review,
`docs/design/release-1-journey/`, `docs/presentations/`, and edits to the master
plan and workshop spec. It landed in PR #51 (`21c811c`, 10 Sep 23:58). The
working tree is clean; the warning is retired, not lost.

### Branch cleanup — 19 September 2026

Executed the recommendation from the 7 Sep audit above, twelve days later and
against a larger list. **29 remote and 19 local branches deleted**, each checked
individually with `git rev-list --count origin/main..<branch>` returning 0 — so
this removed refs, not history, and every commit stays reachable from `main`.
The GitHub PR pages survive the deletion and still show their diffs.

Remote branches deleted: `chore/architecture-stage-1-setup`,
`chore/ci-trigger-main`, `chore/untrack-agents-status`,
`design/audit-remediation-plan`, `design/workos-auth-migration-rebuilt`,
`design/workshop-service-catalogue`, `docs/archive-executed-plans`,
`docs/bmbi-and-hubtiger-research`, `docs/business-plan`,
`docs/business-research`, `docs/competitive-trials-2026-09-08`,
`docs/job-type-before-diary`, `docs/lightspeed-first-platform`,
`docs/plan-wedge-reconciliation`, `docs/readme-accuracy`,
`docs/status-after-healthcheck-merge`, `docs/status-after-pr-45`,
`docs/status-close-2026-09-10`, `docs/wedge-booking-vs-workshop`,
`feat/booking-mode-foundations`, `feat/shadcn-foundation`,
`feat/workshop-prototype`, `feat/workshop-server-rules`,
`fix/compose-healthcheck-healthz`, `fix/cross-tenant-login-scope`,
`fix/eslint-ignore-claude`, `fix/portal-data-exposure`,
`refactor/drop-cloudflare-assumptions`, `test/workshop-ds9-coverage`. The local
set was the same list minus the ones that never existed locally.

`docs/status-close-2026-09-10` was the one with a commit of its own (`081a616`,
PR #52). It was deleted anyway, after diffing it against `main`: `STATUS.md` was
byte-identical and every other path on it was a deletion of something `main`
has. The orphaned object carries no unique content.

**Kept, and why** — `docs/jack-ranking-2026-09-10` (PR #48, closed) holds the
only copy of the filled **Jack's priority** column and the four duplicate-row
removals; `main`'s comparison file still has that column empty.
`docs/ownership-signoff` and `design/workos-auth-migration` are the two the
7 Sep audit called "safe in content but not in commits", for the reasons given
there.

### Issue #47 and PR #52, closed 19 September 2026

#47 asked Jack to rank 317 Hubtiger features. He did, on 10 Sep: 172 Release 1,
102 Later, 43 Not for us, with the order inside Release 1 attributed to Claude
rather than himself. The write-back into
`docs/decisions/2026-09-10-hubtiger-feature-comparison.md` rode PR #48, which was
closed, so that column on `main` is still empty and the issue comment is the
record. The ranking is no longer the live scope: the 10 Sep scope reduction says
in terms that it supersedes the Release 1 selections in it, and the revised plan
carries 154 of the 172 forward with reasons for the 18 moved to Later.

PR #52 proposed a STATUS update whose content had already reached `main` through
PR #51 — the two copies of `.agents/STATUS.md` were byte-identical — so it was
closed as redundant rather than merged.

### Superseded next actions, as they stood on 10 Sep

Actions 1 (commit the other session's Release 1 work), 1b (answer F05, then
write the Lightspeed adapter spec), 1c (the Hubtiger trial), 2 (the `Workorder`
timestamp question), 3 (branch cleanup) and 6 (decide the first adapter) are all
either done or absorbed. F05 and the adapter choice now live in the Lightspeed
readiness brief; the timestamp question is its step LS-07; the trial lapsed
about 15 Sep with the quote-approval round trip and the booking-page disclosure
re-test still untested.

---

# Moved from STATUS.md, 20 September 2026

Moved to keep STATUS within its 8,000-byte cap after the Phase 0 entry was
added. Both were historical record rather than live state.

## Done (as at 19 Sep 2026)

43 PRs merged, #1–#51; #51 carried the scope reduction, the plan and the screen designs.
#48 and #52 were closed unmerged, both accounted for in `.agents/ARCHIVE.md`,
where ageing content moves rather than being deleted.

## Branches (cleaned 19 Sep 2026)

Cleaned 19 Sep: 29 remote and 19 local deleted, each verified at zero commits
`main` cannot reach. Three kept, reasons in `.agents/ARCHIVE.md`. One matters
here: `docs/jack-ranking-2026-09-10` holds the only copy of the filled **Jack's
priority** column, which is empty on `main`.

## Decisions in force (table moved from STATUS.md, 20 Sep 2026)


| Decision | Status |
|---|---|
| `2026-09-10-release-1-scope-reduction.md` | **Instructed by Mark after review with Jack, 10 Sep — the live scope** |
| `2026-09-10-release-1-lightspeed-readiness.md` | R-Series recommended, conditional; access unproven |
| `2026-09-10-hubtiger-feature-comparison.md` | Reference, 317 rows; superseded as scope, #47 closed 19 Sep |
| `2026-09-06-tenant-scoping-and-pooler-safety.md` | Decided by Jack 6 Sep; carries the flag-flip checklist |
| `2026-09-04-job-type-before-diary.md` | **Proposed, not decided** |
| `2026-09-04-booking-mode-and-downtime.md` | Booking mode decided 5 Sep; downtime model proposed |
| `2026-09-08-competitive-trials.md` | Two decisions by Jack, 8 Sep; three OPEN in §6.4 |

Six older decisions stay in force unchanged — business plan, frontend platform,
Lightspeed platform, R-Series sync (its timestamp question is now LS-07), the
wedge, ownership sign-off — plus the 214-row feature catalogue. Cells and
reasoning: `.agents/ARCHIVE.md`.


The live decisions themselves are the files under `docs/decisions/`; this
table was a summary of them, and summaries of documents that exist do not
belong in a capped file.

## Architecture stage one, moved from STATUS.md 20 Sep 2026

Architecture stage one merged 7 Sep (PR #37): pooler trap, migration race,
outbound timeouts, process lifecycle and README closed. Recovery — managed
Postgres, PITR, a rehearsed restore — is untouched and now outside Release 1.
WorkOS auth and design remediation stay approved and unbuilt. The **workshop
prototype** (PR #45) is an in-memory demo under `prototype/`: a learning
artefact, not product code, and not a step toward WorkOS.

## Read order, fuller version moved from STATUS.md 20 Sep 2026

## Read order for a fresh session

1. This file
2. `2026-09-10-release-1-scope-reduction.md` — what Release 1 is now
3. `2026-09-10-release-1-lightspeed-readiness.md` — integration contract, proof
4. `2026-09-10-release-1-workshop-plan.md` — the package breakdown
5. `2026-08-31-business-plan.md` — ownership, the Jack/Mark split
6. `2026-09-06-tenant-scoping-and-pooler-safety.md` — the
   `DB_TENANT_SCOPE=transaction` checklist

Under `docs/decisions/`, bar the plan under `docs/superpowers/plans/`.

## Canonical commands, earlier version moved from STATUS.md 20 Sep 2026

## Canonical commands

```sh
npm test  # node --test "tests/**/*.test.js"
npm run typecheck && npm run lint && npm run build
npm run docker:up
```

**Last verified:** 278 pass, 0 fail, 10 Sep on the PR #44 merge. **Lint and
typecheck were NOT re-run on it** — last clean 9 Sep. Nothing ran on 19 Sep:
docs and branches only. The docker `app` image is from 31 Aug and runs
stale code — verify the working tree, never that container.

## Carried open items, moved from STATUS.md 20 Sep 2026

**Carried, unchanged, and still open:** CI gating for `prototype` and the Python
runner; three tenant-isolation gaps confirmed ABSENT on `main` 9 Sep (no
composite tenant-consistent FKs, no privilege boundary on the resolver tables,
no idempotency key — `withRetry` can still double-create on a timeout); whether
`gateway` should wait for a healthy `app`; the five ownership queries needing
Mark. Full text and evidence: `.agents/ARCHIVE.md`.

## Operational traps, earlier version moved from STATUS.md 20 Sep 2026

## Operational traps

- **The app is on `localhost:8080`, not 4000.** Compose stops publishing the app
  port deliberately: `TRUST_PROXY=1` is only safe while the gateway is the sole
  entrance. 4000 refuses host connections.
- **Never delete the `cf-*` header names in `server/gateway.js`.** That is the
  strip list, not Cloudflare residue; removing it reintroduces a login
  brute-force bypass (14/14 spoofed IPs passed before PR #8, 11 blocked after).

## Plan register, earlier version moved from STATUS.md 20 Sep 2026

## Plan register

LOCKED: `2026-08-31-master-implementation-plan.md` — the arc, superseded where
its Release 1 sequencing conflicts with the 10 Sep reduction. Current: the
Release 1 workshop plan. Approved and unbuilt: the 2,880-line WorkOS migration,
design remediation. Executed plans and per-plan detail: `.agents/ARCHIVE.md`.

## Screen-design revision detail, moved from STATUS.md 20 Sep 2026

**The screen designs have been revised against Jack's review: 84 screens → 82.**
His export is committed at `docs/reviews/2026-09-17-release-1-screen-review-jack.md`
(71 approved, 13 noted) rather than living only in a browser. Phase 0 applied all
13 notes on 20 Sep: mechanic phone flow (10 screens) → one tablet `job-page`;
Code 128 tag instead of QR; a third appointment-only booking mode; diary and slot
picker following `public/app.js` and `public-portal/portal.js`; services grouped
by category; deposits left out. `check-notes.mjs` asserts each applied note.
**The PDFs and board PNG are stale** — rendered from the 84-screen version, and
WeasyPrint/PyMuPDF/Pillow are not installed here. **The barcode is a declared
non-scanning specimen**; Jack has a scanner from Mon 21 Sep, and a generated,
verified Code 128 replaces it in P00b.

## Read order, 20 Sep version moved from STATUS.md

## Read order for a fresh session

1. This file
2. The Phase 0 plan and the build design, named under **Phase plan** below
3. `docs/decisions/2026-09-10-release-1-scope-reduction.md` — what Release 1 is
4. `2026-09-10-release-1-lightspeed-readiness.md` — integration contract, proof
5. `2026-09-10-release-1-workshop-plan.md` — the package breakdown

Older entries (business plan, tenant-scoping checklist) moved to `ARCHIVE.md`.

## Phase 1 STATUS entry, superseded 20 Sep 2026

## Phase 1 — state machines, built

`server/workshop/state-machines.js` replaces the ambiguous single
`workshop_jobs.status` with seven machines (bookingRequest, custody, work,
quote, capacityHold, printTask, messageIntent) — 35 states, 48 transitions,
with `docs/design/workshop-states.md` generated from them. **No schema and no
endpoint changed**: `JOB_STATUSES` still governs the API, and
`readLegacyStatus` *reads* the old column rather than migrating it.

Phase 2 inherits one open question: **`readLegacyStatus('complete')` returns
`custody: null`**, because the old column never recorded whether a finished
bike went home. A test pins that open so no migration guesses it.

## Screen-design paragraph, second version moved from STATUS.md 20 Sep 2026

**The screen designs are revised: 84 screens → 82.** All 13 of Jack's notes
applied 20 Sep, each asserted by `check-notes.mjs`. PR #54, Mark told on #50.
Detail in `ARCHIVE.md`. Two carried: the tag barcode is a declared
**non-scanning specimen** until Jack's scanner (Mon 21 Sep), and the PDFs and
board PNG are **stale** — WeasyPrint/PyMuPDF/Pillow are not installed here.

## Operational traps, longer version moved from STATUS.md 20 Sep 2026

## Operational traps

- **The app is on `localhost:8080`, not 4000.** Compose stops publishing the app
  port deliberately: `TRUST_PROXY=1` is only safe while the gateway is the sole
  entrance.
- **Never delete the `cf-*` header names in `server/gateway.js`.** That is the
  strip list, not Cloudflare residue; removing it reintroduces a login
  brute-force bypass (14/14 spoofed IPs passed before PR #8, 11 blocked after).
- **Never hand-edit the screen-design HTML.** It is generated by `package.py` from
  `screens.js` / `branches.js`; a hand edit is overwritten on the next run.
- **`npm run build` dirties tracked files** under `public/dist` with no app
  source change. Revert that churn; do not commit it.

## Release 1 scope paragraph, longer version moved from STATUS.md 20 Sep 2026

**Release 1 has a narrowed scope and a plan.** PR #51, 10 Sep.
`docs/decisions/2026-09-10-release-1-scope-reduction.md` is the live scope —
booking, diary, job cards, statuses, capacity, line-level quote approval,
messaging, printing and tags, one Lightspeed adapter. Invoicing, payments,
refunds, customer import, reports, group capacity and recovery are Later. It
**supersedes the #47 Hubtiger ranking**, now closed. The workshop plan is
packages P00–P09 over 154 of the original 172 rows, not yet split into issues.

## Decisions in force, longer version moved from STATUS.md 20 Sep 2026

## Decisions in force

Every decision is a file under `docs/decisions/`; the status summary table
moved to `.agents/ARCHIVE.md` on 20 Sep. The live scope is
`2026-09-10-release-1-scope-reduction.md`. Two remain undecided:
`2026-09-04-job-type-before-diary.md` (proposed) and the downtime model in
`2026-09-04-booking-mode-and-downtime.md`. Five decisions were added 20 Sep
and live in the Phase 0 plan's constraints: barcode-now-QR-later, the
appointment-only walk-in rule, deposits out of Release 1, the two-column
tablet job page, and services grouped by category.

## Lightspeed and architecture paragraphs, moved from STATUS.md 20 Sep 2026

**There is still no Lightspeed technical spec, and no account.**
`2026-09-10-release-1-lightspeed-readiness.md` recommends R-Series *conditional
on the first shop* and leaves proof steps LS-01 to LS-09 all "Pending". None
start without the shop's series and an authorised test account: Jack's to
supply.

Architecture stage one merged 7 Sep (PR #37); detail in `ARCHIVE.md`. Recovery
is outside Release 1. WorkOS auth and design remediation stay approved and
unbuilt. The **workshop prototype** (PR #45) is an in-memory demo, not product
code, and has **no week view** — the diary Jack built is in `public/app.js`, the
customer slot grid in `public-portal/portal.js`.

## Phase plan section, longer version moved from STATUS.md 20 Sep 2026

## Phase plan for building the screen designs

Design: `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`,
which records who decided what. Agreed with Jack 20 Sep: a **new staff app** for
these screens only, cut over at the end, on the **existing server and schema**,
sequenced **by layer** because nothing is deployed. The old app keeps till,
inventory, suppliers and website. Phases: 0 screen designs, 1 state machines and 2
schema (all built) → 3 API (each endpoint traced to a named screen) → 4 screens
→ 5 integration. P00 proofs run alongside, all Jack's. Plans written: phase-0,
phase-1 and phase-2, all dated 2026-09-20 under `docs/superpowers/plans/`.

## Immediate next actions, 20 Sep pre-close version

## Immediate next actions

0. **Phase 3 — the API layer.** No plan written yet. It is the first phase that
   changes behaviour: `server.js` moves off `workshop_jobs.status` onto the new
   columns, each endpoint traced to a named screen in `screen-index.json`.
1. **Jack: the first shop's Lightspeed series, and an authorised test account.**
   Nothing in P00-LS moves without it; P07 stays conditional meanwhile.
2. **Jack: the hardware answers** — printer model, tag dimensions, the Windows
   driver host, 1D or 2D scanner. Scanner arrives Mon 21 Sep; the screen-design barcode
   stays a declared specimen until it is proven.
3. **Jack: the message providers**, and what inbound replies do.
4. **Mark: the screen review**, issue #50, outstanding since 17 Sep — now
   against a superseded version. He needs telling that the screen designs changed.
5. **Split the plan into issues** — row IDs, allowed state changes, expected
   failure, test command and proof artefact per package.

**Carried, unchanged, and still open:** six items, including three
tenant-isolation gaps confirmed ABSENT on `main` 9 Sep. Full text and evidence:
`ARCHIVE.md`.

**The Hubtiger trial lapsed about 15 Sep**; two tests never ran. Re-entry
needs Jack's login.

## Screen-design paragraph, third version moved from STATUS.md 20 Sep 2026

**The screen designs are revised: 84 screens → 82**, all 13 notes applied and
asserted by `check-notes.mjs`. PR #54; Mark told on #50. Carried: the tag
barcode is a declared **non-scanning specimen** until Jack's scanner, and the
PDFs and board PNG are **stale**. Detail in `ARCHIVE.md`.


## Phases 0-2 detail — moved from STATUS.md, 20 September 2026

Moved to make room for Phase 3 while keeping STATUS under its 8,000-byte cap.

**Proven, not assumed** (Phases 1-2): tests run as `epos_app`
(`rolsuper = false`); removing `FORCE ROW LEVEL SECURITY` let shop B read shop
A's quotes; breaking the capacity index predicate let two concurrent bookings
both win; all 20 migrations apply cleanly into an empty database. Detail in PRs
#55 and #56.

**CI did not run the screen-design checks** (recorded at the Phase 2 close).
`package.py`, `check-static.mjs` and `check-notes.mjs` appeared nowhere in
`.github/workflows/test.yml`, so #54's green CI said nothing about the screen designs
being valid - those ran locally only. Phase 3 closed the narrow half of this by
adding `scripts/ci/assert-screen-trace.mjs` to CI, which gates the
endpoint-to-screen trace. Whether the three screen-design scripts themselves should run
in CI was Jack's decision, and he took it on 20 Sep: all three now run, in the
same PR. They could not run as they stood - all three imported jsdom by a
relative path into `prototype/node_modules`, which root CI never installs, so
they would have failed every run on a missing module rather than on a real screen-design
fault. jsdom is now a root dev dependency (30.0.1, exact) and nothing reaches
into `prototype/node_modules`. CI also fails if the committed screen designs do not
match what its source generates, which is the only automated check on the
"never hand-edit the screen-design HTML" trap. **`prototype/` and the Python runner
remain open**, deliberately separate.


## Phase 3's compatibility hole — full text (moved from STATUS.md, 20 Sep 2026)

`POST` and `PUT /api/workshop-jobs` still accept a legacy `status` value and
translate it into `booking_state` and `work_state` at the boundary, because
`public/app.js` sends one from its approve button and its complete/reopen
toggle. Dropping it would have broken the live diary, which is the thing the
generated-column approach exists to avoid.

That PUT path is deliberately **not** version-guarded and **not**
machine-guarded: the old app sends no version, so it cannot take part in the
optimistic-concurrency contract, and some of its moves are not single machine
events. It is the unguarded legacy path, and the reason the action endpoints
exist beside it rather than instead of it. It also leaves `custody_state` alone,
so editing a job cannot reset a bike that is in the shop back to `expected`.

Both die with `public/app.js` in Phase 4.


## Phase 3 — detail at the merge, 20 September 2026 (PR #57)

Fifteen action endpoints, one per thing a person does, each guarded by its Phase
1 machine and by an optimistic `version` check. An illegal move and a lost race
are both 409 and say different things, because a screen can only offer "reload
and look again" for the second.

**The tender rule, decided twice.** Tendering the order for a job requires
`finish` to be a legal move on the work machine, and `finish` is legal only from
`in_progress`. So a tender is refused for a job that never started AND for one
on hold or waiting for parts; the refusal names the way out (`resume`,
`parts_arrived`). Checked before the sale is created, so a refused tender leaves
no sale behind. Jack chose refusal in the plan, reversed it on 20 Sep to "never
refuse a payment", then reversed back the same day. If the breadth proves wrong
at a real till, narrowing it to `not_started` only is a one-line change in the
convert handler's pre-flight.

**Three tests were found to prove nothing** and were fixed: one asserted only a
200 and passed against a PUT that wrote nothing; one ran two HTTP requests in a
`Promise.all` and passed against a deliberately broken check-then-act allocator,
because the requests never actually overlapped; one crossed shops, so RLS hid the
row and the customer-ownership join it claimed to test never ran.

**A CI failure that was real, not flaky.** `tests/server-lifecycle.test.js`
slept 120ms before sending SIGTERM. Measured: module evaluation finishes ~67ms
and the server listens by ~145ms, so that sat in a ~78ms window. Adding four
modules to `server.js`'s import graph lost the race. `server.js` now prints
`SIGNALS_READY` when its handlers are installed and the test waits for it.


## Two open questions closed, 20 September 2026

Both Jack's, both taken after the Phase 3 merge. Recorded here so neither is
re-opened by default.

**`prototype/` and the review-pack Python scripts stay out of CI.** Decided no,
not deferred. `prototype/` is a React demo with its own dependency tree; running
its tests would install a second, unrelated set of libraries on every build of
the real app, to protect something Phase 4's real screens are meant to replace.
`assemble-review.py`, `render-review.py` and `check-pdfs.py` build the review
pack, whose PDFs are already recorded as stale; PDF generation in CI needs fonts
and rendering tooling and is a common source of slow, flaky builds. `package.py`
is the exception and does run in CI - it builds the screen designs, which Phase 4 is
built against. Revisit only if the prototype becomes load-bearing or the PDFs
start being sent to people again.

**Money stays a JavaScript float, and is totalled in SQL.** `server/db.js:31-38`
parses NUMERIC to a JS float on read, a deliberate existing decision that now
also covers quote line amounts. The database stores money exactly; the
imprecision only appears if the application adds amounts up itself, where a
float can drift a fraction of a penny over many additions or break an exact
equality comparison. The alternatives - an exact decimal type across the app, or
storing whole pennies - both mean rewriting the till and every sale for a
problem that has not bitten.

So the rule, which Phase 4 must follow: **sum money in SQL, never in
JavaScript.** The Phase 3 quote code totals nothing in JavaScript, so there is
no existing exposure to unwind.

## Moved from STATUS 2026-09-23 (byte cap)

### Phase 3 detail (merged, PR #57, 20 Sep)

`status` is a **generated column** derived from `booking_state` and
`work_state` (migration 021), so the old diary and portal keep reading it and
**nothing can write it**. Fifteen action endpoints are guarded by the machines
and an optimistic `version` check. Job references (`WH-1000`) are per shop;
capacity holds are taken in the job's transaction; quotes supersede rather
than mutate, per-line.

### Phase plan for building the screen designs (full text)

Design: `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`,
which records who decided what. A **new staff app** for these screens only, cut
over at the end, on the **existing server and schema**, sequenced **by layer**
because nothing is deployed. The old app keeps till, inventory, suppliers and
website. Phases 0-2 built; 3 API → 4 screens → 5 integration remain. P00
proofs run alongside, all Jack's. Plans for phases 0-3 are under
`docs/superpowers/plans/`, all dated 2026-09-20.

### Release 1 scope and screen-design revision (unchanged, settled)

**Release 1 has a narrowed scope and a plan.** PR #51.
`docs/decisions/2026-09-10-release-1-scope-reduction.md` is the live scope;
invoicing, payments, refunds, import, reports, group capacity and recovery are
Later. The workshop plan is packages P00–P09, not yet split into issues.

**The screen designs are revised: 84 screens → 82**, all 13 notes applied and
asserted by `check-notes.mjs` (#54). Carried: the tag barcode is a declared
**non-scanning specimen**, and the PDFs and board PNG are **stale**.

### Phase 4 planning decisions (20 Sep, Jack)

A: the seven print/message screens build against a stub adapter that records
intent and never claims delivery. B: the mechanic auth screens build on the
existing team-login, reading identity only via `GET /api/auth/me`, so the
approved-but-unbuilt WorkOS migration stays a provider swap. C: the quote read
endpoints ship as a Phase 3 patch on their own branch before Phase 4 starts.
D: `react-router`, `@tanstack/react-query`, `@testing-library/react` and
Playwright approved as dependencies. E: the workshop half of `public/app.js`
is cut over in Phase 4's final task, closing the legacy `status` hole.

### Plan defects found executing the quote-reads plan (23 Sep)

Four, all corrected in the plan files: a non-existent export name
(`findProblems`, really `checkSource`); a `COVERED` regex widened so far it
captured three pre-existing untraced routes; a missing
`import '../server/load-env.js'` in the test-setup convention; and a test that
revised a DRAFT quote, which `createRevision` replaces in place, so it never
created the second revision it meant to assert on. A fifth was a security gap
in the plan itself: the portal read checked shop but not quote ownership.

### Quote read endpoints (branch `fix/phase-3-quote-reads`, 23 Sep)

Phase 3 shipped four quote WRITE paths and no read path, so the seven quote
screens had nothing to render from. Added three endpoints:
`GET /api/quotes/:id` (one quote, its lines, and `all`/`approved`/`pending`/
`declined` totals), `GET /api/workshop-jobs/:id/quotes` (revisions, newest
first; a job with no quotes is `200 []`, not 404 — screen 19 opens in that
state), and `GET /api/portal/:shopSlug/quotes/:id` (the customer's read).

Totals are `SUM(quantity * unit_amount)` with `FILTER (WHERE decision = …)`
in SQL. No JavaScript arithmetic on money anywhere.

The portal read is scoped to the owning customer through the same private
`quoteForCustomer(quoteId, customerId)` the portal writes use, and refuses any
state outside a named readable set (`sent`, `partly_approved`, `approved`,
`declined`, `superseded`, `expired`) — an allow-list, so a state added to the
quote machine later stays hidden from customers until someone lists it. Both
refusals return a 404 byte-identical to a nonexistent quote. A test iterates
`quote.states` and fails if any state is classified in neither set or in both.

The portal WRITE routes still distinguish a draft by a 409 naming its state,
so a customer can learn their own draft exists — never its prices. Moving the
state rule into `quoteForCustomer` would fix that and change the write routes,
which this patch put out of scope.

`COVERED` in `assert-screen-trace.mjs` was widened for `/api/quotes/:id` only.
The wider pattern the plan proposed would have captured three pre-existing
untraced routes (GET/PUT/DELETE `/api/workshop-jobs/:id`) and forced screen-id
choices this patch had no basis to make.

### Two id-handling behaviours Phase 4 must handle (found 23 Sep, not fixed)

A non-numeric or fractional id on any of the new read routes — and on the
pre-existing routes that share the pattern — reaches Postgres and the
dispatcher answers **500 with `err.message`** (`server/server.js:4439`), e.g.
`{"error":"invalid input syntax for type integer: \"abc\""}`. It behaves
identically for ids that exist and ids that do not, so it leaks no existence
information, but it echoes a database error to the internet. Phase 4 will hit
it directly: a React route param of `undefined` becomes `NaN` and 500s instead
of 404ing. Fix route-wide (`if (!Number.isInteger(id)) return notFound(...)`)
in its own change, BEFORE the screens start building URLs from route params.

`GET /api/workshop-jobs/:id/quotes` answers `200 []` for a job that does not
exist, while `GET /api/workshop-jobs/:id` answers 404 for the same id. Staff
are authenticated and RLS hides other shops, so nothing leaks; but screen 19
given a stale job id would show "no quotes yet" rather than "job not found".
A behaviour call for the Phase 4 quote journey plan; the fix is to look the
job up first, as `createRevision` already does.

### Moved from STATUS 2026-09-23 (second pass)

**Check the checkout before judging state.** On 9 Sep work sat 156 commits
behind. Run the left-right count against `origin/main` before trusting a tree.

**Stage one's request-wide transaction mode is OFF** — `DB_TENANT_SCOPE` is
`session` until three handlers are restructured.

### Why `npm run build` dirties the tree (23 Sep)

`public/dist/` is listed in `.gitignore` (line 24), but three build outputs —
the Vite manifest and the hashed staff JS and CSS — were committed before that
rule existed, so git tracks them anyway. Every build rewrites them. Revert with
a checkout of that path. The Phase 4 plan calls `public/dist` "(gitignored)",
which is only half true, and its Task 1 reads the committed, stale manifest.

### P00b scanner evidence, summarised (23 Sep)

Full record: `docs/decisions/2026-09-23-p00b-scanner-evidence.md`. AURES
PS-50IIBL, USB keyboard-wedge, 1D laser. Cannot read QR — tested against a
printed QR, no beep, no output. Suffix a single Enter, no prefix. Keys arrive
1.6-16.5 ms apart; a whole code lands inside a quarter of a second, against
roughly 100 ms per key for a person. The scanner is on a US layout against UK
Windows, so the symbol set mangles while `A-Z 0-9` and hyphen do not — job
references are safe, and the scanner's own keyboard language can be set to UK
from its manual, which is the cheaper fix than working around it in code. Caps
Lock inverts letters, so tag resolution must be case-insensitive. The printer
half of P00b is untouched: no tag from our own printer has been scanned, so
the screen-design barcode stays a declared non-scanning specimen.

## Moved from STATUS 2026-09-23 (#59 merged)

The verification paragraph for `fix/phase-3-loose-ends`, superseded when #59
merged as `f871d95` (CI green on `ec15e75`; suite re-run after the rebase,
413/413). Verbatim:

**Verified 23 Sep on `fix/phase-3-loose-ends`, locally, every exit code 0:**
413 pass / 0 fail, typecheck, lint, RLS (30 protected, 2 exempt), screen
trace. Run BEFORE the rebase onto `main`; **re-run after it** — a clean rebase
is not a passing suite. **CI has never run this branch.** #58 was green on its
real head `18e8341`, checked against the run's own SHA: the PR pane reported
the session's branch as the PR head, so do not trust that field. The docker
`app` image is from 31 Aug — verify the working tree, not it.

The "Phase plan for building the screen designs" section, moved for the byte cap
(the fuller text is under "Moved from STATUS 2026-09-23 (byte cap)"). Verbatim:

````markdown
## Phase plan for building the screen designs

Design: `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`.
A **new staff app** for these screens only, cut over at the end, on the
**existing server and schema**, sequenced **by layer** because nothing is
deployed. The old app keeps till, inventory, suppliers, website. 0-3 built;
4 → 5 remain. P00 proofs run alongside. Full text and the five Phase 4
decisions (A-E): `ARCHIVE.md`.
````

## Moved from STATUS 2026-09-23 (Phase 4 foundation, Task 6)

Replaced by a shorter "Phases 0-3" section and a new "Phase 4 foundation"
section. Verbatim:

````markdown
## Phases 0-3

`server/workshop/state-machines.js` replaces the ambiguous single
`workshop_jobs.status` with seven machines — 35 states, 48 transitions,
migrations 016-021. 0-2 merged 20 Sep (#54-#56); **3 merged** (#57). `status`
is a **generated column** — nothing can write it. Fifteen action endpoints are
guarded by the machines and an optimistic `version` check, **which every Phase
4 mutation must echo**. `ARCHIVE.md`.

**One deliberate hole:** the old `status` is still accepted unguarded on
`POST`/`PUT /api/workshop-jobs` for the old diary. It dies with the workshop
half of `public/app.js` in Phase 4's last task.

**Quote line decisions are final** (`2026-09-23-quote-line-decisions-are-final`,
Jack), enforced in `recordLineDecision` (#59). Screen 21 must
show decided lines as settled, not as live controls.

**Print tasks and message intent are not built** — P00b/P00c, so seven screens
have no endpoint: 12, 28, 29, 39, 56, 57, 58. Three more wait on the auth
model: 13, 59, 60.

**Quote reads (#58, merged)** added the three GETs Phase 3 omitted; totals from
SQL; the portal read is owner-scoped and hides drafts. Four things it carries
into Phase 4 — the `COVERED` widening, the 500 on a non-numeric id, the
`200 []` for a missing job, and one-revision drafts — are in `ARCHIVE.md`.

**A 409 carries `code: 'stale' | 'illegal'`** beside `error` on job actions,
quotes and tender (#60, Jack 23 Sep). Screens branch on the code, never the
wording; the client leaves a codeless 409 `unknown`.

**Verified 23 Sep on `feat/phase-4-foundation`, locally:** 432 pass / 0 fail,
typecheck, lint, screen trace, against the committed `public/dist`; browser
check of `/workshop` and deep links. #59 was re-run after its rebase (413/413)
and green in CI on its head `ec15e75` before merging. Check a PR's CI against
the run's own SHA, not the PR pane. The docker `app` image is from 31 Aug.
````

## Moved from STATUS 2026-09-23 (session close, byte cap)

Verbatim:

````markdown
## Decisions in force

Each decision is a file under `docs/decisions/`; summary in `ARCHIVE.md`. Still
undecided: `2026-09-04-job-type-before-diary.md` and the downtime model in
`2026-09-04-booking-mode-and-downtime.md`. The eight taken 20 Sep are in the
Phase 0/2 plans' constraints; the five Phase 4 ones (A-E) in its plan.
````

---

## Verified 23 Sep on `feat/phase-4-intent-adapter` (Task 6)

Every gate exit 0: 437/437 tests; typecheck; lint; build; RLS 30 protected, 2
exempt; screen trace; registry, 9 files, no drift; screen designs packaged, no errors,
notes pass; browser 2/2. Superseded 24 Sep by 466/466 on
`feat/book-server-1-services` (adds the book server piece 1 tests: migration
022, category routes, service placement, public service list, screen trace).

---

## Component-test build step detail (`feat/phase-4-component-tests`)

`pretest` builds `src/` to `.test-build/` (`vite.test.config.ts`); tests
import it via `tests/helpers/dom.js`; use `render()`'s queries, not `screen`.
A malformed id param is now 404 (`ID_PARAMS`); the print-agent route is
`:printJobId`.

---

## Phases 0-3 detail trimmed from STATUS 24 Sep

Screens branch on the 409's `code`, never the wording. The old `status` is
still writable on `POST`/`PUT /api/workshop-jobs` until Phase 4's last task.
Screen 21 shows decided quote lines as settled (#59).

---

## Phase 4 foundation endpoint gaps, trimmed from STATUS 24 Sep

Screens 12, 28, 29, 39, 56-58 have no endpoint until P00b/P00c; 13, 59, 60
wait on auth.

---

## 24 Sep gate list detail, trimmed from STATUS

The 466/466 run's gates, all exit 0: npm test; typecheck; lint; build; RLS
coverage; screen trace; registry validate; registry drift; browser tests
(`npm run test:browser`, port 8091).

## Piece 2b, moved from STATUS 25 Sep

**Piece 2b merged** (#66, 25 Sep). It added migration 024 (hold index
   narrowed to timed holds), mode-aware customer booking POST, the
   per-(shop, date) advisory booking lock, the 409 `capacity` / 400
   shop-rule split, one live hold per live job (`syncJobHold`), walk-in
   queue lengths, and settle-on-read-and-write for a scheduled mode change.
   Rulings, not in the original spec: plan's Decision log,
   `docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md`,
   decisions 1-11; spec updated to match. Follow-up: holds left stale by
   pre-2b staff moves are not backfilled — a stale hold now answers 409
   `capacity` (2b decision 11); a one-off realign is due if any shop has
   live data. **Next: piece 3** (the booking request). Plan 4a stays
   STOPPED at Task 7 item 3 until piece 3 lands; routing decided 23 Sep
   (`docs/decisions/2026-09-23-book-journey-routing-and-modes.md`): customer
   screens under `/book`, two modes, deposits out, all four J2 gaps in.



# Moved from STATUS on 2026-09-29

## Where things stood (27 Sep): the customer booking journey and staff diary

The customer booking journey at `/book` is built end to end (d1–d5: service →
service list → problem → date → details → pending/booking link; PRs #75,
#78–#80, #82, #84, #85, #87, #88) on top of server pieces 1–12 (piece 7 #76,
8 #77, 9 #81, 10 #83, 11 #86, 12 #89). Piece 12 (27 Sep) is the server side of
customer change/cancel via the booking link, plus staff accept/decline-change
and `GET /api/workshop-waiting` with "Seen". Its spec is
`docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md`.

**The staff diary piece is merged (#91, 27 Sep).** Spec `docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md`;
plan, decision log and spec walk in
`docs/superpowers/plans/2026-09-27-staff-diary-waiting.md`. In the legacy diary
(`public/app.js`) there is now a "Waiting for you" column, a review pop-up
(Accept / Decline / Seen), grid markings, and version-checked diary saves. The
rule scripts are `public/diary-waiting.js`, `diary-marks.js` and
`diary-review.js`, and the first browser tests for the legacy diary are in
`tests/browser/diary-waiting.spec.ts`. Local checks and CI pass (PR #91).

