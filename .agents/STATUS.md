# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-26
**Branch:** `main` at `24bccac` (pieces (a) #72, (b) #73, (c) #74, (d1) #75, server pieces 7 #76 and 8 #77 merged; d2 #78, #79, #80, piece 9 #81, d3 #82, piece 10 #83, d4 #84 and its follow-ups #85 merged); server piece 11 (terms) on `feat/book-server-11-terms`; d5 spec on `feat/book-d5-details-send-pending`. Server prerequisite pieces 1-6 for the book
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
(`src/screens/book/draft.tsx`), and is registered by atlas id in `SCREENS` in
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
Until then `/book` uses the default Wheelhouse colours. **Open for piece (d) from (c):** `day-diary` scales so every
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
**Next: server piece 11, then d5, then piece 12 and d6** (Jack, 26 Sep).
Piece 11 (booking terms): spec
`docs/superpowers/specs/2026-09-26-book-server-11-terms-design.md`, approved
with migration 034 and the standard terms text (Claude's plain-English
draft, approved by Jack; not legal advice). Standard Wheelhouse terms, a
shop's own replacement (`bookingTerms` in staff settings, no staff screen
yet), `GET /api/portal/:shopSlug/terms`, and a copy of the terms in force
saved on each online booking (`workshop_jobs.terms_text`). d5 (details,
sending, pending, a real end-to-end journey test): spec
`docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md`
approved; one update channel (Text message default), no marketing box, a
time gone at sending returns to `date`. Piece 12 (change and cancel via the
private link) and d6 (their screens) follow; until then pending says to
contact the shop.
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
earliest bookable moment. **Two follow-ups (Jack, 26 Sep,
`.superpowers/sdd/d4-followups/brief.md`), built on `fix/book-d4-followups`
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

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

## Where this stands

**Release 1 scope is narrowed and settled** (#51); live scope file
`docs/decisions/2026-09-10-release-1-scope-reduction.md`. **The atlas is 82
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
- **Never hand-edit the atlas HTML**; `package.py` regenerates it.
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
   scanned — the atlas barcode stays a non-scanning specimen.
4. **Jack: the message providers**, and what inbound replies do.
5. **Mark: the screen review** (#50), open since 17 Sep.
6. **Split the Release 1 plan into issues** — row IDs, state changes, expected
   failure, test command, proof per package.

**Carried open:** four, incl. three tenant-isolation gaps confirmed ABSENT on
`main` 9 Sep. Three closed 20 Sep (Jack): atlas checks **run in CI**;
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
maps atlas id → URL; `SCREENS` (`app-shell.tsx`) registers built screens.
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

Eight. The screen review (#50) is urgent, re-point at the 82-screen atlas;
the other seven in `ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap 8,000 bytes.
Past that, trim by **moving** — to `ARCHIVE.md` or `docs/decisions/`, never by
deleting. Check the byte count before committing, not after.
